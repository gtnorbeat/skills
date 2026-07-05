// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithTimeout, FETCH_TIMEOUT_MS } from "@/utils/api";

// ── localStorage seed ──────────────────────────────────────────────
// api.ts reads localStorage.getItem("auth_token") in getAuthHeaders().
// For fetchWithTimeout (which doesn't touch auth), the mock is harmless
// and sets up the environment for future integration tests that exercise
// the full fetch wrappers.

beforeEach(() => {
  localStorage.setItem("auth_token", "test-jwt-token");
});

// Helper: assign a vitest mock as globalThis.fetch without TS complaints.
function mockFetch(impl: typeof fetch): typeof fetch {
  return (globalThis.fetch = vi.fn(impl) as unknown as typeof fetch);
}

// ── fetchWithTimeout ───────────────────────────────────────────────

describe("fetchWithTimeout", () => {
  it("resolves with a Response when fetch succeeds before timeout", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    mockFetch(vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch);

    const res = await fetchWithTimeout("https://example.com/api/test");
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("rejects with a timeout error when the request hangs", { timeout: 10_000 }, async () => {
    // A promise that rejects on abort signal — simulates a hung server
    // that the AbortController eventually cancels.
    const hangingFetch = vi.fn(
      (_input: RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            const onAbort = () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            };
            if (signal.aborted) {
              onAbort();
            } else {
              signal.addEventListener("abort", onAbort, { once: true });
            }
          }
          // Never resolve — the abort signal is the only exit.
        }),
    ) as unknown as typeof fetch;
    globalThis.fetch = hangingFetch;

    await expect(
      fetchWithTimeout("https://example.com/api/test", {}, 50),
    ).rejects.toThrow("Request timed out");
  });

  it("rejects with an offline hint when fetch throws TypeError and navigator.onLine is false", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });
    mockFetch(
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch,
    );

    await expect(
      fetchWithTimeout("https://example.com/api/test"),
    ).rejects.toThrow("You appear to be offline");
  });

  it("rejects with the original TypeError when navigator.onLine is true", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
    mockFetch(
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch,
    );

    await expect(
      fetchWithTimeout("https://example.com/api/test"),
    ).rejects.toThrow("Failed to fetch");
  });

  it("clears the timeout when the request succeeds", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const mockResponse = new Response("ok", { status: 200 });
    mockFetch(vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch);

    await fetchWithTimeout("https://example.com/api/test");
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("exports a default timeout of 15 seconds", () => {
    expect(FETCH_TIMEOUT_MS).toBe(15_000);
  });

  it("passes through the request init options", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    mockFetch(vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch);

    await fetchWithTimeout("https://example.com/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/api/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ key: "value" }),
      }),
    );
  });

  it("attaches an AbortController signal to the request", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    mockFetch(vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch);

    await fetchWithTimeout("https://example.com/api/test");

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = callArgs[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
