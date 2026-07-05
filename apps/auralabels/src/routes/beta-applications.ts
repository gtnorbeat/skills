/**
 * POST /api/beta-applications — public beta application form.
 *
 * This route is registered BEFORE the auth gate (see isPublicPath in auth.ts).
 * Includes:
 *   - Honeypot (hidden `website` field — bots fill it, real users don't)
 *   - IP rate limiting (5 POSTs per hour)
 *   - Field validation
 */
import { getDb } from "../db.js";
import { auralabelsBetaApplications } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import { generateId, jsonOk, jsonBadRequest, jsonError, parseBody, CorsHeaders } from "./helpers.js";

const ALLOWED_ROLES = new Set([
  "Independent Label",
  "Boutique Label",
  "A&R Team",
  "Label Manager",
  "Artist Management Company",
  "Music Entrepreneur",
  "Not specified",
]);

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const betaAppRateBuckets = new Map<string, { count: number; resetAt: number }>();

function betaAppsAllowSubmit(key: string): boolean {
  const now = Date.now();
  const bucket = betaAppRateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    betaAppRateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

export async function betaApplicationsHandler(req: Request, env: Env, corsHeaders: CorsHeaders): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  try {
    const body = await parseBody(req);
    if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

    // Honeypot — real users leave `website` blank; bots fill every field
    if (typeof body.website === "string" && body.website.trim() !== "") {
      console.log(`[api] Beta application honeypot tripped`);
      // Silent 201 — bot thinks it succeeded
      return jsonOk({ status: "ok" }, corsHeaders);
    }

    // IP rate limiting
    const cfIp = req.headers.get("CF-Connecting-IP") ?? "anon";
    if (!betaAppsAllowSubmit(cfIp)) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Too many applications right now. Please try again in an hour.",
        }),
        { status: 429, headers: corsHeaders },
      );
    }

    // Validate fields
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const label = String(body.label ?? "").trim();
    const role = String(body.role ?? "Not specified").trim();
    const notes = String(body.notes ?? "");

    if (!name || name.length > 100) {
      return jsonBadRequest("Name is required (max 100 chars).", corsHeaders);
    }
    if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonBadRequest("A valid email is required.", corsHeaders);
    }
    if (label.length > 100) {
      return jsonBadRequest("Label is too long (max 100 chars).", corsHeaders);
    }
    if (notes.length > 500) {
      return jsonBadRequest("Notes are too long (max 500 chars).", corsHeaders);
    }
    if (!ALLOWED_ROLES.has(role)) {
      return jsonBadRequest("Invalid role value.", corsHeaders);
    }

    const id = generateId("betaapp");

    await db.insert(auralabelsBetaApplications).values({
      id,
      name,
      email,
      label,
      role,
      notes,
      status: "pending",
    });

    console.log(`[api] Beta application received: ${email} (${role})`);
    return jsonOk({ status: "ok" }, corsHeaders);
  } catch (err) {
    console.error("[api] Error creating beta application:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}
