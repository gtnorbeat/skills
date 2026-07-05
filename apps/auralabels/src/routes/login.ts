/**
 * POST /api/login — authenticate with username + password.
 *
 * Uses jose for JWT signing (Web Crypto) and bcryptjs for password hashing.
 *
 * Security layers:
 *   - IP rate limiting: 5 attempts per 15-minute window (in-memory Map)
 *   - Timing-safe bcrypt comparison (dummy hash when user not found)
 *   - Account disabled check
 */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { signToken } from "../auth.js";
import { auralabelsUsers } from "@aura-labels/db/schema";
import type { Env } from "../env.js";

/** Dummy bcrypt hash constant — used for timing-safe comparison when user doesn't exist. */
const DUMMY_HASH = "$2a$10$CgsVEpH8cAB1pQw7nD4XcuO2vZfYrKgS5bN6lMxT9jRkAhFWL3P0e1";

// ── IP rate limiting for login ──────────────────────────────

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const loginRateBuckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the IP is still under the rate limit. */
function loginAllowAttempt(ip: string): boolean {
  const now = Date.now();
  const bucket = loginRateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    loginRateBuckets.set(ip, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= LOGIN_RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

export async function loginHandler(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  // Validate JWT_SECRET
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return new Response(
      JSON.stringify({ status: "error", message: "Server not configured" }),
      { status: 500, headers: corsHeaders },
    );
  }

  try {
    const body: { username?: string; password?: string; rememberMe?: boolean } = await req.json();
    const { username, password, rememberMe } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ status: "error", message: "Username and password are required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    // IP rate limiting — guards against brute-force attacks
    const clientIp = req.headers.get("CF-Connecting-IP") ?? "anon";
    if (!loginAllowAttempt(clientIp)) {
      console.warn(`[auth] Login rate limit exceeded for IP ${clientIp}`);
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Too many login attempts. Please try again in 15 minutes.",
        }),
        { status: 429, headers: corsHeaders },
      );
    }

    const db = getDb(env.DATABASE_URL);
    if (!db) {
      return new Response(
        JSON.stringify({ status: "error", message: "Database not available" }),
        { status: 503, headers: corsHeaders },
      );
    }

    // Look up user
    const rows = await db
      .select()
      .from(auralabelsUsers)
      .where(eq(auralabelsUsers.username, username))
      .limit(1);

    const user = rows[0] ?? null;

    // Timing-safe bcrypt compare — always runs even if user doesn't exist
    const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, hashToCheck);

    if (!user || !ok) {
      return new Response(
        JSON.stringify({ status: "error", message: "Invalid credentials" }),
        { status: 401, headers: corsHeaders },
      );
    }

    // Check disabled
    if (user.disabled) {
      return new Response(
        JSON.stringify({ status: "error", message: "Account disabled. Contact an admin." }),
        { status: 403, headers: corsHeaders },
      );
    }

    // Sign token — 7d if remembered, 5m otherwise
    const tokenExpiry = rememberMe ? "7d" : "5m";
    const token = await signToken(
      {
        username: user.username,
        role: user.role as "admin" | "user" | undefined,
        tenantId: user.tenantId,
      },
      jwtSecret,
      tokenExpiry,
    );

    console.log(`[auth] User "${user.username}" (${user.role}) logged in (remember=${!!rememberMe}, expiry=${tokenExpiry})`);

    return new Response(
      JSON.stringify({ status: "ok", token, rememberMe: !!rememberMe }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("[api] Login error:", err);
    return new Response(
      JSON.stringify({ status: "error", message: "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
}
