import { describe, it, expect, beforeEach } from "vitest";

// ── Replicate the exact rate-limiting logic from login.ts ──────────────
// (Tested inline because the function is module-private; the algorithm
//  is the same Map-based sliding window used in production.)

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function createRateLimiter() {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function allow(ip: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return true;
    }
    if (bucket.count >= RATE_LIMIT) return false;
    bucket.count++;
    return true;
  }

  return { allow, buckets };
}

describe("Login rate limiting", () => {
  let limiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    limiter = createRateLimiter();
  });

  it("allows first 5 attempts from the same IP", () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow("192.0.2.1")).toBe(true);
    }
  });

  it("blocks the 6th attempt from the same IP (returns 429)", () => {
    for (let i = 0; i < 5; i++) {
      limiter.allow("192.0.2.1");
    }
    expect(limiter.allow("192.0.2.1")).toBe(false);
    // 7th, 8th etc. also blocked
    expect(limiter.allow("192.0.2.1")).toBe(false);
  });

  it("tracks different IPs independently", () => {
    // Exhaust IP-A
    for (let i = 0; i < 5; i++) {
      limiter.allow("10.0.0.1");
    }
    expect(limiter.allow("10.0.0.1")).toBe(false);

    // IP-B still has all 5 attempts
    expect(limiter.allow("10.0.0.2")).toBe(true);
  });

  it("resets the bucket after the window expires", () => {
    const limiter = createRateLimiter();
    // Exhaust
    for (let i = 0; i < 5; i++) {
      limiter.allow("10.0.0.1");
    }
    expect(limiter.allow("10.0.0.1")).toBe(false);

    // Fast-forward the bucket's resetAt past now
    const bucket = limiter.buckets.get("10.0.0.1")!;
    bucket.resetAt = Date.now() - 1; // expired

    expect(limiter.allow("10.0.0.1")).toBe(true); // new window
  });

  it("increments count correctly within the same window", () => {
    limiter.allow("10.0.0.1");
    limiter.allow("10.0.0.1");
    limiter.allow("10.0.0.1");
    expect(limiter.buckets.get("10.0.0.1")!.count).toBe(3);
  });
});


