/**
 * Registration handler — POST /api/register
 *
 * Self-service tenant onboarding. A new label manager registers
 * their label and admin account in one step, receiving a JWT on success.
 *
 * This route is public (no JWT required) — gated by isPublicPath in auth.ts.
 * Security: hCaptcha verification, honeypot, IP rate limiting (2 per hour),
 * username uniqueness check.
 *
 * Expected JSON body:
 * {
 *   username: string (min 3 chars),
 *   password: string (min 8 chars),
 *   email: string,
 *   labelName: string,
 *   "h-captcha-response": string (hCaptcha token)
 * }
 */
import { getDb } from "../db.js";
import { auralabelsUsers } from "@aura-labels/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken } from "../auth.js";
import type { Env } from "../env.js";
import {
  generateId,
  nowDate,
  jsonOk,
  jsonBadRequest,
  jsonCreated,
  jsonError,
  parseBody,
  CorsHeaders,
} from "./helpers.js";

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

const RATE_LIMIT = 2;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const registerRateBuckets = new Map<string, { count: number; resetAt: number }>();

function registerAllowSubmit(key: string): boolean {
  const now = Date.now();
  const bucket = registerRateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    registerRateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

export async function registerHandler(
  req: Request,
  env: Env,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  if (!env.JWT_SECRET) {
    return jsonError("Server not configured", corsHeaders);
  }

  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  try {
    const body = await parseBody(req);
    if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

    // Honeypot — real users leave `website` blank; bots fill every field
    if (typeof body.website === "string" && body.website.trim() !== "") {
      console.log("[api] Registration honeypot tripped");
      // Silent 201 — bot thinks it succeeded
      return jsonOk({ status: "ok" }, corsHeaders);
    }

    // IP rate limiting
    const cfIp = req.headers.get("CF-Connecting-IP") ?? "anon";
    if (!registerAllowSubmit(cfIp)) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Too many registration attempts. Try again in an hour.",
        }),
        { status: 429, headers: corsHeaders },
      );
    }

    // hCaptcha verification — must pass before any DB work
    const captchaToken = String(body["h-captcha-response"] ?? "").trim();
    if (!captchaToken) {
      return jsonBadRequest("CAPTCHA verification required", corsHeaders);
    }

    if (env.HCAPTCHA_SECRET_KEY) {
      try {
        const verifyRes = await fetch(HCAPTCHA_VERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: env.HCAPTCHA_SECRET_KEY,
            response: captchaToken,
          }).toString(),
        });
        const verifyData = (await verifyRes.json()) as { success: boolean; "error-codes"?: string[] };
        if (!verifyData.success) {
          console.log(`[api] hCaptcha failed: ${(verifyData["error-codes"] ?? []).join(", ")}`);
          return jsonBadRequest("CAPTCHA verification failed — please try again", corsHeaders);
        }
      } catch (err) {
        // Network error reaching hCaptcha — fail open to avoid blocking
        // legitimate users, since honeypot + rate limiting are still in place.
        console.warn("[api] hCaptcha verification unreachable, allowing registration:", err);
      }
    } else {
      // No secret configured — dev/testing mode, accept the token
      console.log("[api] hCaptcha secret key not set — skipping verification (dev mode)");
    }

    // Validate fields
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const email = String(body.email ?? "").trim();
    const labelName = String(body.labelName ?? "My Label").trim();

    if (!username || username.length < 3) {
      return jsonBadRequest("Username is required (min 3 chars)", corsHeaders);
    }
    if (!password || password.length < 8) {
      return jsonBadRequest("Password is required (min 8 chars)", corsHeaders);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonBadRequest("A valid email is required", corsHeaders);
    }
    if (!labelName || labelName.length < 2) {
      return jsonBadRequest("Label name is required (min 2 chars)", corsHeaders);
    }
    if (username.length > 100 || labelName.length > 100 || email.length > 200) {
      return jsonBadRequest("Field too long", corsHeaders);
    }

    // Check if username already exists
    const existing = await db
      .select()
      .from(auralabelsUsers)
      .where(eq(auralabelsUsers.username, username))
      .limit(1);

    if (existing.length > 0) {
      return jsonBadRequest("Username already exists", corsHeaders);
    }

    // Generate tenant and user IDs
    const tenantId = generateId("tenant");
    const userId = generateId("user");
    const now = nowDate();
    const hash = await bcrypt.hash(password, 10);

    await db.insert(auralabelsUsers).values({
      id: userId,
      username,
      passwordHash: hash,
      role: "admin",
      tenantId,
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-login: sign a JWT for immediate access
    const token = await signToken(
      { username, role: "admin", tenantId },
      env.JWT_SECRET,
      "7d",
    );

    console.log(
      `[api] Registered: username="${username}", label="${labelName}", tenantId=${tenantId}`,
    );

    return jsonCreated(
      {
        status: "ok",
        token,
        user: {
          username,
          role: "admin",
          tenantId,
          labelName,
        },
      },
      corsHeaders,
    );
  } catch (err) {
    console.error("[api] Registration error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}
