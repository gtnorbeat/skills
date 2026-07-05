/**
 * Pages Function — proxy /api/* requests to the AURA Worker.
 *
 * Cloudflare Pages _redirects cannot proxy POST/PUT/DELETE bodies to
 * external URLs reliably, so we use a Pages Function instead.
 * This catch-all route forwards every /api/* request (method, headers,
 * body) to the Worker at aura.gtnorbeat.workers.dev.
 */

/** The AURA Worker runs on the workers.dev subdomain. */
const WORKER_ORIGIN = "https://aura.gtnorbeat.workers.dev";

interface PagesFunctionContext {
  request: Request;
  env: Record<string, string>;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  const url = new URL(context.request.url);
  const targetUrl = `${WORKER_ORIGIN}${url.pathname}${url.search}`;

  try {
    // Forward the request with the original method, headers, and body.
    const proxyRequest = new Request(targetUrl, {
      method: context.request.method,
      headers: context.request.headers,
      body: ["GET", "HEAD"].includes(context.request.method)
        ? null
        : context.request.body,
    });

    const response = await fetch(proxyRequest);

    // Ensure API responses are never cached by Cloudflare's edge or the
    // browser.
    //
    // Primary defense: Cloudflare Cache Rule (http_request_cache_settings)
    // bypasses cache for starts_with(http.request.uri.path, "/api/").
    // This header is defense-in-depth in case a misconfiguration or
    // downstream proxy ignores the edge Cache Rule.
    const headers = new Headers(response.headers);
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (_err) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: `Proxy error: unable to reach AURA Worker`,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
