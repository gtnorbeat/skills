/**
 * Artists CRUD — /api/artists
 *
 * GET    /api/artists          — list all artists (tenant-scoped)
 * GET    /api/artists/:id      — get single artist (tenant-scoped)
 * POST   /api/artists          — create artist
 * PUT    /api/artists/:id      — update artist (tenant-scoped)
 * DELETE /api/artists/:id      — delete artist (tenant-scoped)
 * POST   /api/artists/:id/restore — undo delete
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsArtists } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, nowDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";

export async function artistsHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/artists", "").split("/").filter(Boolean);
  const id = pathParts[0] ?? null;
  const action = pathParts[1] ?? null;
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsArtists.tenantId, tenantId) : undefined;

  try {
    // GET /api/artists
    if (req.method === "GET" && !id) {
      const rows = tFilter
        ? await db.select().from(auralabelsArtists).where(tFilter).orderBy(auralabelsArtists.name)
        : await db.select().from(auralabelsArtists).orderBy(auralabelsArtists.name);
      return jsonOk(rows.map(mapArtist), corsHeaders);
    }

    // GET /api/artists/:id
    if (req.method === "GET" && id) {
      const conditions = [eq(auralabelsArtists.id, id)];
      if (tFilter) conditions.push(tFilter);
      const row = (await db.select().from(auralabelsArtists).where(and(...conditions)).limit(1))[0];
      if (!row) return jsonNotFound("Artist not found", corsHeaders);
      return jsonOk(mapArtist(row), corsHeaders);
    }

    // POST /api/artists
    if (req.method === "POST" && !action) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const artist = {
        id: generateId("artist"),
        tenantId: tenantId ?? "default",
        name: String(body.name ?? "Unknown Artist"),
        label: String(body.label ?? "ORBEAT Records"),
        status: String(body.status ?? "active"),
        imageUrl: String(body.imageUrl ?? ""),
        genres: JSON.stringify(body.genres ?? []),
        socialLinks: JSON.stringify(body.socialLinks ?? []),
        totalReleases: parseInt(String(body.totalReleases ?? "0"), 10) || 0,
        signedSince: String(body.signedSince ?? now.toISOString().split("T")[0]),
        bio: String(body.bio ?? ""),
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(auralabelsArtists).values(artist);
      const conditions = [eq(auralabelsArtists.id, artist.id)];
      if (tFilter) conditions.push(tFilter);
      const created = (await db.select().from(auralabelsArtists).where(and(...conditions)).limit(1))[0];
      console.log(`[api] Created artist: ${artist.name}`);
      return jsonCreated({ status: "ok", artist: mapArtist(created) }, corsHeaders);
    }

    // POST /api/artists/:id/restore
    if (req.method === "POST" && action === "restore" && id) {
      const existingConditions = [eq(auralabelsArtists.id, id)];
      if (tFilter) existingConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsArtists).where(and(...existingConditions)).limit(1))[0];
      if (existing) return jsonOk({ status: "ok", artist: mapArtist(existing) }, corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const artist = {
        id: id ?? generateId("artist"),
        tenantId: tenantId ?? "default",
        name: String(body.name ?? "Unknown Artist"),
        label: String(body.label ?? "ORBEAT Records"),
        status: String(body.status ?? "active"),
        imageUrl: String(body.imageUrl ?? ""),
        genres: JSON.stringify(body.genres ?? []),
        socialLinks: JSON.stringify(body.socialLinks ?? []),
        totalReleases: parseInt(String(body.totalReleases ?? "0"), 10) || 0,
        signedSince: String(body.signedSince ?? now.toISOString().split("T")[0]),
        bio: String(body.bio ?? ""),
        createdAt: body.createdAt ? new Date(String(body.createdAt)) : now,
        updatedAt: now,
      };

      await db.insert(auralabelsArtists).values(artist);
      const createConditions = [eq(auralabelsArtists.id, id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsArtists).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Restored artist: ${artist.name} (id=${id})`);
      return jsonOk({ status: "ok", artist: mapArtist(created) }, corsHeaders);
    }

    // PUT /api/artists/:id
    if (req.method === "PUT" && id) {
      const existingConditions = [eq(auralabelsArtists.id, id)];
      if (tFilter) existingConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsArtists).where(and(...existingConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Artist not found", corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const parseJson = (val: unknown, fallback: unknown): string => {
        if (val === undefined && typeof fallback === "string") return fallback;
        if (typeof val === "string") return val;
        if (typeof fallback === "string") return fallback;
        return JSON.stringify(val ?? fallback ?? []);
      };

      const now = nowDate();
      await db.update(auralabelsArtists).set({
        name: String(body.name ?? existing.name),
        label: String(body.label ?? existing.label),
        status: String(body.status ?? existing.status),
        imageUrl: String(body.imageUrl ?? existing.imageUrl),
        genres: parseJson(body.genres, existing.genres),
        socialLinks: parseJson(body.socialLinks, existing.socialLinks),
        totalReleases: body.totalReleases !== undefined ? parseInt(String(body.totalReleases), 10) : existing.totalReleases,
        signedSince: String(body.signedSince ?? existing.signedSince),
        bio: String(body.bio ?? existing.bio),
        updatedAt: now,
      }).where(and(...existingConditions));

      const updateConditions = [eq(auralabelsArtists.id, id)];
      if (tFilter) updateConditions.push(tFilter);
      const updated = (await db.select().from(auralabelsArtists).where(and(...updateConditions)).limit(1))[0];
      return jsonOk({ status: "ok", artist: mapArtist(updated) }, corsHeaders);
    }

    // DELETE /api/artists/:id
    if (req.method === "DELETE" && id) {
      const deleteConditions = [eq(auralabelsArtists.id, id)];
      if (tFilter) deleteConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsArtists).where(and(...deleteConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Artist not found", corsHeaders);

      await db.delete(auralabelsArtists).where(and(...deleteConditions));
      console.log(`[api] Deleted artist: ${existing.name}`);
      return jsonOk({ status: "ok", id }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Artists error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

function parseJsonField(val: unknown): unknown[] {
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
  if (Array.isArray(val)) return val;
  return [];
}

function mapArtist(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    genres: parseJsonField(row.genres),
    socialLinks: parseJsonField(row.socialLinks),
  };
}
