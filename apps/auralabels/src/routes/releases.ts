/**
 * Releases CRUD — /api/releases
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsReleases } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, calculateReadiness, nowDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";

export async function releasesHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/releases", "").split("/").filter(Boolean);
  const id = pathParts[0] ?? null;
  const action = pathParts[1] ?? null;
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsReleases.tenantId, tenantId) : undefined;

  try {
    // GET /api/releases
    if (req.method === "GET" && !id) {
      const rows = tFilter
        ? await db.select().from(auralabelsReleases).where(tFilter).orderBy(auralabelsReleases.releaseDate)
        : await db.select().from(auralabelsReleases).orderBy(auralabelsReleases.releaseDate);
      return jsonOk(rows.map(mapRelease), corsHeaders);
    }

    // GET /api/releases/:id
    if (req.method === "GET" && id) {
      const conditions = [eq(auralabelsReleases.id, id)];
      if (tFilter) conditions.push(tFilter);
      const row = (await db.select().from(auralabelsReleases).where(and(...conditions)).limit(1))[0];
      if (!row) return jsonNotFound("Release not found", corsHeaders);
      return jsonOk({ status: "ok", release: mapRelease(row) }, corsHeaders);
    }

    // POST /api/releases
    if (req.method === "POST" && !action) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const checklist = body.launchChecklist ?? [];
      const release = {
        id: generateId("release"),
        tenantId: tenantId ?? "default",
        catalogNumber: String(body.catalogNumber ?? ""),
        title: String(body.title ?? "Unknown Release"),
        artist: String(body.artist ?? ""),
        artistId: String(body.artistId ?? ""),
        status: String(body.status ?? "draft"),
        priority: String(body.priority ?? "medium"),
        releaseDate: String(body.releaseDate ?? now.toISOString().split("T")[0]),
        tracks: toJson(body.tracks ?? []),
        artworkUrl: String(body.artworkUrl ?? ""),
        genres: toJson(body.genres ?? []),
        launchChecklist: toJson(checklist),
        readinessPercentage: calculateReadiness(checklist as { required?: boolean; completed?: boolean }[]),
        promoAssetsReady: !!body.promoAssetsReady,
        distributorSubmitted: !!body.distributorSubmitted,
        needsAttention: !!body.needsAttention,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(auralabelsReleases).values(release);
      const createConditions = [eq(auralabelsReleases.id, release.id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsReleases).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Created release: ${release.title}`);
      return jsonCreated({ status: "ok", release: mapRelease(created) }, corsHeaders);
    }

    // POST /api/releases/:id/restore
    if (req.method === "POST" && action === "restore" && id) {
      const restoreConditions = [eq(auralabelsReleases.id, id)];
      if (tFilter) restoreConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsReleases).where(and(...restoreConditions)).limit(1))[0];
      if (existing) return jsonOk({ status: "ok", release: mapRelease(existing) }, corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const checklist = body.launchChecklist ?? [];
      const release = {
        id,
        tenantId: tenantId ?? "default",
        catalogNumber: String(body.catalogNumber ?? ""),
        title: String(body.title ?? "Unknown Release"),
        artist: String(body.artist ?? ""),
        artistId: String(body.artistId ?? ""),
        status: String(body.status ?? "draft"),
        priority: String(body.priority ?? "medium"),
        releaseDate: String(body.releaseDate ?? now.toISOString().split("T")[0]),
        tracks: toJson(body.tracks ?? []),
        artworkUrl: String(body.artworkUrl ?? ""),
        genres: toJson(body.genres ?? []),
        launchChecklist: toJson(checklist),
        readinessPercentage: calculateReadiness(checklist as { required?: boolean; completed?: boolean }[]),
        promoAssetsReady: !!body.promoAssetsReady,
        distributorSubmitted: !!body.distributorSubmitted,
        needsAttention: !!body.needsAttention,
        createdAt: body.createdAt ? new Date(String(body.createdAt)) : now,
        updatedAt: now,
      };

      await db.insert(auralabelsReleases).values(release);
      const createConditions = [eq(auralabelsReleases.id, id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsReleases).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Restored release: ${release.title} (id=${id})`);
      return jsonOk({ status: "ok", release: mapRelease(created) }, corsHeaders);
    }

    // PUT /api/releases/:id
    if (req.method === "PUT" && id) {
      const putConditions = [eq(auralabelsReleases.id, id)];
      if (tFilter) putConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsReleases).where(and(...putConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Release not found", corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const checklist = body.launchChecklist !== undefined
        ? (body.launchChecklist as { required?: boolean; completed?: boolean }[])
        : (existing.launchChecklist as { required?: boolean; completed?: boolean }[]);

      await db.update(auralabelsReleases).set({
        catalogNumber: String(body.catalogNumber ?? existing.catalogNumber),
        title: String(body.title ?? existing.title),
        artist: String(body.artist ?? existing.artist),
        artistId: String(body.artistId ?? existing.artistId),
        status: String(body.status ?? existing.status),
        priority: String(body.priority ?? existing.priority),
        releaseDate: String(body.releaseDate ?? existing.releaseDate),
        tracks: toJson(body.tracks ?? existing.tracks),
        artworkUrl: String(body.artworkUrl ?? existing.artworkUrl),
        genres: toJson(body.genres ?? existing.genres),
        launchChecklist: toJson(checklist),
        readinessPercentage: calculateReadiness(checklist),
        promoAssetsReady: body.promoAssetsReady !== undefined ? !!body.promoAssetsReady : existing.promoAssetsReady,
        distributorSubmitted: body.distributorSubmitted !== undefined ? !!body.distributorSubmitted : existing.distributorSubmitted,
        needsAttention: body.needsAttention !== undefined ? !!body.needsAttention : existing.needsAttention,
        updatedAt: now,
      }).where(and(...putConditions));

      const updateConditions = [eq(auralabelsReleases.id, id)];
      if (tFilter) updateConditions.push(tFilter);
      const updated = (await db.select().from(auralabelsReleases).where(and(...updateConditions)).limit(1))[0];
      return jsonOk({ status: "ok", release: mapRelease(updated) }, corsHeaders);
    }

    // DELETE /api/releases/:id
    if (req.method === "DELETE" && id) {
      const deleteConditions = [eq(auralabelsReleases.id, id)];
      if (tFilter) deleteConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsReleases).where(and(...deleteConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Release not found", corsHeaders);

      await db.delete(auralabelsReleases).where(and(...deleteConditions));
      console.log(`[api] Deleted release: ${existing.title}`);
      return jsonOk({ status: "ok", id }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Releases error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

function toJson(val: unknown): string {
  if (typeof val === "string") return val;
  return JSON.stringify(val ?? []);
}

function parseBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  return false;
}

function parseJsonField(val: unknown): unknown[] {
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
  if (Array.isArray(val)) return val;
  return [];
}

function mapRelease(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    tracks: parseJsonField(row.tracks),
    genres: parseJsonField(row.genres),
    launchChecklist: parseJsonField(row.launchChecklist),
    promoAssetsReady: parseBool(row.promoAssetsReady),
    distributorSubmitted: parseBool(row.distributorSubmitted),
    needsAttention: parseBool(row.needsAttention),
  };
}
