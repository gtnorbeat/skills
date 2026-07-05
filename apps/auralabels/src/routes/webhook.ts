/**
 * Webhook handler — POST /api/webhook/:uuid
 *
 * Receives demo submissions from Make.com (or any HTTP webhook source).
 * The UUID in the URL identifies the webhook endpoint (per-tenant in future).
 *
 * This route is public (no JWT required) — gated by isPublicPath in auth.ts.
 * Security: IP rate limiting (30 POSTs per hour per IP).
 *
 * Expected JSON body:
 * {
 *   artistName: string,
 *   artistEmail?: string,
 *   trackTitle: string,
 *   genre?: string,
 *   privateLink?: string,
 *   instagram?: string,
 *   duration?: string,
 *   bpm?: number,
 *   key?: string,
 *   notes?: string,
 * }
 */
import { getDb } from "../db.js";
import { auralabelsDemos } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import { generateId, todayDate, jsonBadRequest, jsonCreated, jsonError, parseBody, CorsHeaders } from "./helpers.js";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const webhookRateBuckets = new Map<string, { count: number; resetAt: number }>();

function webhookAllowSubmit(key: string): boolean {
  const now = Date.now();
  const bucket = webhookRateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    webhookRateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

export async function webhookHandler(req: Request, env: Env, corsHeaders: CorsHeaders): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed — send POST with demo fields" }),
      { status: 405, headers: corsHeaders },
    );
  }

  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  // Extract UUID from path for logging / future tenant routing
  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/webhook", "").split("/").filter(Boolean);
  const webhookUuid = pathParts[0] ?? "unknown";
  // UUID validation — must be a valid v4 UUID (36 chars with dashes)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validUuid = uuidPattern.test(webhookUuid);

  if (!validUuid && webhookUuid !== "unknown") {
    return jsonBadRequest("Invalid webhook UUID format", corsHeaders);
  }

  // IP rate limiting
  const cfIp = req.headers.get("CF-Connecting-IP") ?? "anon";
  const rateKey = `${cfIp}:${webhookUuid}`;
  if (!webhookAllowSubmit(rateKey)) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Too many submissions. Try again later.",
      }),
      { status: 429, headers: corsHeaders },
    );
  }

  try {
    const body = await parseBody(req);
    if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

    // Required fields
    const artistName = String(body.artistName ?? "").trim();
    const trackTitle = String(body.trackTitle ?? "").trim();

    if (!artistName) {
      return jsonBadRequest("artistName is required", corsHeaders);
    }
    if (!trackTitle) {
      return jsonBadRequest("trackTitle is required", corsHeaders);
    }
    if (artistName.length > 200 || trackTitle.length > 300) {
      return jsonBadRequest("artistName or trackTitle too long", corsHeaders);
    }

    // Optional fields
    const email = String(body.artistEmail ?? body.email ?? "").trim().slice(0, 200);
    const genre = String(body.genre ?? "").trim().slice(0, 100);
    const privateLink = String(body.privateLink ?? "").trim().slice(0, 500);
    const instagram = String(body.instagram ?? "").trim().slice(0, 200);
    const duration = String(body.duration ?? "").trim().slice(0, 20);
    const bpm = parseInt(String(body.bpm ?? "0"), 10) || 0;
    const key = String(body.key ?? "").trim().slice(0, 10);
    const notes = String(body.notes ?? "").trim().slice(0, 500);

    const receivedDate = todayDate();
    const demoId = generateId("demo");

    await db.insert(auralabelsDemos).values({
      id: demoId,
      tenantId: "default",
      artistName,
      email,
      instagram,
      trackTitle,
      genre,
      duration,
      bpm,
      key,
      receivedDate,
      status: "new",
      rating: null,
      labelFit: null,
      privateLink,
      audioUrl: "",
      notes,
      nextAction: "Listen and rate",
    });

    console.log(
      `[api] Webhook ${webhookUuid}: created demo "${trackTitle}" by ${artistName}`,
    );

    return jsonCreated(
      { status: "ok", demoId, message: `Demo "${trackTitle}" by ${artistName} received` },
      corsHeaders,
    );
  } catch (err) {
    console.error("[api] Webhook error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}
