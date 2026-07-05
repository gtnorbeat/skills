/**
 * Demos CRUD — /api/demos
 *
 * GET    /api/demos          — list all demo submissions (tenant-scoped)
 * POST   /api/demos          — create a demo (manual entry)
 * PATCH  /api/demos/:id      — update status, rating, notes, etc. (tenant-scoped)
 * DELETE /api/demos/:id      — delete a demo (tenant-scoped)
 * POST   /api/demos/:id/restore — undo a delete (client snapshot)
 */
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsDemos } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, todayDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";

const ALLOWED_STATUSES = ["new", "listening", "interested", "rejected", "accepted"] as const;
const ALLOWED_LABEL_FITS = ["perfect", "good", "moderate", "poor"] as const;

export async function demosHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/demos", "").split("/").filter(Boolean);
  const id = pathParts[0] ?? null;
  const action = pathParts[1] ?? null; // "restore"
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsDemos.tenantId, tenantId) : undefined;

  try {
    // ── GET /api/demos ─────────────────────────────────────────────
    if (req.method === "GET" && !id) {
      const rows = tFilter
        ? await db.select().from(auralabelsDemos).where(tFilter).orderBy(desc(auralabelsDemos.receivedDate))
        : await db.select().from(auralabelsDemos).orderBy(desc(auralabelsDemos.receivedDate));
      return jsonOk(rows.map(mapDemo), corsHeaders);
    }

    // ── GET /api/demos/:id ─────────────────────────────────────────
    if (req.method === "GET" && id) {
      const conditions = [eq(auralabelsDemos.id, id)];
      if (tFilter) conditions.push(tFilter);
      const row = (await db.select().from(auralabelsDemos).where(and(...conditions)).limit(1))[0];
      if (!row) return jsonNotFound("Demo not found", corsHeaders);
      return jsonOk(mapDemo(row), corsHeaders);
    }

    // ── POST /api/demos ────────────────────────────────────────────
    if (req.method === "POST" && !action) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const receivedDate = String(body.receivedDate ?? todayDate()).split("T")[0];
      const status = String(body.status ?? "new");
      if (!ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
        return jsonBadRequest(`Invalid status "${status}"`, corsHeaders);
      }

      const demo = {
        id: generateId("demo"),
        tenantId: tenantId ?? "default",
        artistName: String(body.artistName ?? "Unknown Artist"),
        email: String(body.email ?? ""),
        instagram: String(body.instagram ?? ""),
        trackTitle: String(body.trackTitle ?? "Unknown Track"),
        genre: String(body.genre ?? ""),
        duration: String(body.duration ?? ""),
        bpm: parseInt(String(body.bpm ?? "0"), 10) || 0,
        key: String(body.key ?? ""),
        receivedDate,
        status,
        rating: body.rating !== undefined && body.rating !== null ? parseInt(String(body.rating), 10) : null,
        labelFit: body.labelFit !== undefined && body.labelFit !== null ? String(body.labelFit) : null,
        privateLink: String(body.privateLink ?? ""),
        audioUrl: String(body.audioUrl ?? ""),
        notes: String(body.notes ?? ""),
        nextAction: body.nextAction !== undefined && body.nextAction !== null ? String(body.nextAction) : "Listen and rate",
      };

      await db.insert(auralabelsDemos).values(demo);
      const createConditions = [eq(auralabelsDemos.id, demo.id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsDemos).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Created demo: ${demo.artistName} — "${demo.trackTitle}"`);
      return jsonCreated({ status: "ok", demo: mapDemo(created) }, corsHeaders);
    }

    // ── POST /api/demos/:id/restore ────────────────────────────────
    if (req.method === "POST" && action === "restore" && id) {
      const restoreConditions = [eq(auralabelsDemos.id, id)];
      if (tFilter) restoreConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsDemos).where(and(...restoreConditions)).limit(1))[0];
      if (existing) return jsonOk({ status: "ok", demo: mapDemo(existing) }, corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const status = String(body.status ?? "new");
      const demo = {
        id,
        tenantId: tenantId ?? "default",
        artistName: String(body.artistName ?? "Unknown Artist"),
        email: String(body.email ?? ""),
        instagram: String(body.instagram ?? ""),
        trackTitle: String(body.trackTitle ?? "Unknown Track"),
        genre: String(body.genre ?? ""),
        duration: String(body.duration ?? ""),
        bpm: parseInt(String(body.bpm ?? "0"), 10) || 0,
        key: String(body.key ?? ""),
        receivedDate: String(body.receivedDate ?? todayDate()),
        status,
        rating: body.rating !== undefined && body.rating !== null ? parseInt(String(body.rating), 10) : null,
        labelFit: body.labelFit !== undefined && body.labelFit !== null ? String(body.labelFit) : null,
        privateLink: String(body.privateLink ?? ""),
        audioUrl: String(body.audioUrl ?? ""),
        notes: String(body.notes ?? ""),
        nextAction: body.nextAction !== undefined && body.nextAction !== null ? String(body.nextAction) : "Listen and rate",
      };

      await db.insert(auralabelsDemos).values(demo);
      const createConditions = [eq(auralabelsDemos.id, id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsDemos).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Restored demo ${id}: ${demo.artistName} — "${demo.trackTitle}"`);
      return jsonOk({ status: "ok", demo: mapDemo(created) }, corsHeaders);
    }

    // ── PATCH /api/demos/:id ───────────────────────────────────────
    if (req.method === "PATCH" && id) {
      const patchConditions = [eq(auralabelsDemos.id, id)];
      if (tFilter) patchConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsDemos).where(and(...patchConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Demo not found", corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const updates: Record<string, unknown> = {};

      if (body.status && ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
        updates.status = body.status;
        // Auto-update nextAction based on status
        const nextActions: Record<string, string> = {
          new: "Listen and rate",
          listening: "Finish listening and assess",
          interested: "Schedule follow-up call",
          rejected: "Send polite rejection",
          accepted: "Prepare contract and onboarding",
        };
        updates.nextAction = nextActions[body.status as string] ?? existing.nextAction;
      }

      if (body.rating !== undefined) {
        const r = parseInt(String(body.rating), 10);
        if (r >= 1 && r <= 5) updates.rating = r;
      }
      if (body.notes !== undefined) updates.notes = String(body.notes);
      if (body.labelFit !== undefined && ALLOWED_LABEL_FITS.includes(body.labelFit as typeof ALLOWED_LABEL_FITS[number])) {
        updates.labelFit = String(body.labelFit);
      }
      if (body.nextAction !== undefined) updates.nextAction = String(body.nextAction);

      if (Object.keys(updates).length > 0) {
        await db.update(auralabelsDemos).set(updates).where(and(...patchConditions));
      }

      const updateConditions = [eq(auralabelsDemos.id, id)];
      if (tFilter) updateConditions.push(tFilter);
      const updated = (await db.select().from(auralabelsDemos).where(and(...updateConditions)).limit(1))[0];
      console.log(`[api] Updated demo ${id}: status=${updates.status ?? "(unchanged)"}`);
      return jsonOk({ status: "ok", demo: mapDemo(updated) }, corsHeaders);
    }

    // ── DELETE /api/demos/:id ──────────────────────────────────────
    if (req.method === "DELETE" && id) {
      const deleteConditions = [eq(auralabelsDemos.id, id)];
      if (tFilter) deleteConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsDemos).where(and(...deleteConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Demo not found", corsHeaders);

      await db.delete(auralabelsDemos).where(and(...deleteConditions));
      console.log(`[api] Deleted demo ${id}: ${existing.artistName} — "${existing.trackTitle}"`);
      return jsonOk({ status: "ok", id }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Demos error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

function mapDemo(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    rating: row.rating ?? null,
    labelFit: row.labelFit ?? null,
    nextAction: row.nextAction ?? null,
  };
}


