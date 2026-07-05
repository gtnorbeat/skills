/* AURA PWA service worker — MOBILE_FIRST Phase 6
 *
 * Strategy: cache the app SHELL (HTML scaffold + content-hashed JS/CSS
 * chunks + fonts + the brand raster) so the second cold-launch comes
 * up instantly on repeat visits, and so the app stays installable on
 * iOS Safari + Android Chrome.
 *
 * Online-only thin client: /api/* is NEVER cached. API requests always
 * go to the network so the user sees the canonical state of artists /
 * releases / contracts / revenue etc. This matches the online-only
 * choice locked in by MOBILE_FIRST Phase 1
 * (no client SQLite / IndexedDB mirror — server SQLite is the single
 * source of truth).
 *
 * Caching rules:
 *   • HTML navigations (mode === "navigate"): network-first with cache
 *     fallback. The freshest index.html wins on every online visit;
 *     on network failure the cached index.html is served so the SPA
 *     router can take over and render the requested route client-side.
 *   • Content-hashed chunks (/assets/* Vite/Rollup outputs): cache-
 *     first. The URL's hash IS the version — a string-match in the
 *     cache never conflicts with a future deployed version, so serve
 *     straight from disk.
 *   • Fonts + brand raster: cache-first after install.
 *   • Cross-origin OR non-GET requests: pass through untouched.
 *
 * Versioning: bump CACHE_VERSION to force re-install on every client
 * after a deploy changes the shell composition. Old caches are
 * dropped in the activate handler below.
 *
 * Failure modes: Safari private mode may block registration (the App
 * code already try/catches around the call); content-blockers may
 * refuse SW altogether. Both degrade to a network-only SPA — no
 * startup throw, no console noise.
 */

const CACHE_VERSION = "aura-shell-v6";

/* Styled offline fallback page — served when the network fails AND
 * the cache doesn't have a copy of the navigation request. Keeps
 * the AURA brand colours so the offline state reads as part of the
 * app, not a raw browser error. */
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AURA — Offline</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e4dfd8;color:#3f3f46;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:2rem}
.card{max-width:400px;text-align:center}
.logo{font-size:2rem;font-weight:700;letter-spacing:-0.04em;color:#0891b2;margin-bottom:1.5rem}
h1{font-size:1.25rem;font-weight:600;margin-bottom:0.75rem}
p{font-size:0.875rem;line-height:1.5;margin-bottom:1.5rem;color:#52525b}
button{background:#0891b2;color:#000;border:none;padding:0.75rem 1.5rem;border-radius:0.5rem;font-size:0.875rem;font-weight:600;cursor:pointer}
button:hover{background:#06b6d4}
</style>
</head>
<body>
<div class="card">
<div class="logo">AURA</div>
<h1>You're offline</h1>
<p>The app shell is cached — you can still navigate to pages you've
visited before. Data-bound sections will show stale content until
your connection returns.</p>
<button onclick="location.reload()">Try again</button>
</div>
</body>
</html>`;

/* Pre-cached at install time. Wrong-listed URLs fail install — keep
 * this list to assets that always respond 200 in both dev and prod.
 * The brand images (/brand-assets/AURA-*.webp) are served cache-first
 * on their first access rather than pre-cached — they're too large to
 * justify pre-caching for an auth-gated app that rarely goes fully
 * offline. */
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/fonts/Geist-Variable.woff2",
  "/fonts/Ethnocentric%20Light.woff2",
];

self.addEventListener("install", (event) => {
  /* preCache returns a promise that resolves only after every entry is
   * stored; if any single fetch fails the whole install is rejected
   * and the SW stays broken-until-next-try. Acceptable: a failed
   * install is recoverable on the next page load. */
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)),
  );
  /* skipWaiting pulls the new SW into active state immediately on
   * install. Without it the new SW waits until all clients close
   * (a window of stale-cache usage). */
  self.skipWaiting();
});

/* Allow the page to trigger SKIP_WAITING so a waiting SW activates
 * immediately without requiring all tabs to close. The page sends
 * this message after the user accepts the update banner, then
 * listens for `controllerchange` to reload. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  /* Drop any cache from a prior shell version so clients don't keep
   * serving stale index.html after a deploy. claim() takes ownership
   * of uncontrolled tabs so subsequent fetches route through the
   * new SW across reloads. */
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  /* Pass-through: non-GET, cross-origin, /api/* (single source of
   * truth lives on the server — NO caching). The /api prefix uses
   * `startsWith` rather than strict equality to cover both `/api/x`
   * and the rare `/api` exactly. */
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/api") return;

  /* HTML detection: SPA navigations set mode === "navigate"; curl /
   * fetch sniffing the index.html sets `Accept: text/html`. Either
   * signal routes to the network-first branch. */
  const isHtml =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    /* Network-first: always try fresh index.html. Cache the response
     * body under the canonical "/" key (not the per-navigation URL)
     * so the cache holds ONE entry for the SPA shell — every deep
     * navigation falls back to the same cached index.html, all
     * effectively identical bodies. The catch path mirrors this:
     * `caches.match(request)` first tries the navigation URL (in
     * case a future bug re-introduces per-URL caching), then falls
     * back to `caches.match("/")` for the canonical shell. */
    event.respondWith(
      fetch(request)
        .then((response) => {
          /* Only cache successful responses — a 4xx/5xx (deploy
           * blip, edge propagation delay, etc.) must NEVER be
           * stored under the canonical "/" key, or it poisons
           * the offline fallback and is replayed on every
           * subsequent network failure. */
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/"))
            .then(
              (fallback) =>
                fallback ||
                new Response(OFFLINE_PAGE, {
                  status: 503,
                  headers: { "Content-Type": "text/html; charset=utf-8" },
                }),
            ),
        ),
    );
    return;
  }

  /* Cache-first for content-hashed chunks + fonts + brand raster: the
   * URL hash is the version. A miss falls back to network, and on
   * network success the response is added to the cache for future
   * repeat-launches. network-failures that miss the cache simply
   * fail (no fallback — no shell for an unknown chunk = nothing
   * useful to serve anyway). */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }).catch(() => caches.match("/")),
  );
});
