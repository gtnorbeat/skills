/**
 * Contracts CRUD — /api/contracts
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsContracts } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, nowDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";

export async function contractsHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/contracts", "").split("/").filter(Boolean);
  const id = pathParts[0] ?? null;
  const action = pathParts[1] ?? null;
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsContracts.tenantId, tenantId) : undefined;

  try {
    // GET /api/contracts
    if (req.method === "GET" && !id) {
      const rows = tFilter
        ? await db.select().from(auralabelsContracts).where(tFilter).orderBy(auralabelsContracts.createdAt)
        : await db.select().from(auralabelsContracts).orderBy(auralabelsContracts.createdAt);
      return jsonOk(rows, corsHeaders);
    }

    // GET /api/contracts/:id
    if (req.method === "GET" && id) {
      const conditions = [eq(auralabelsContracts.id, id)];
      if (tFilter) conditions.push(tFilter);
      const row = (await db.select().from(auralabelsContracts).where(and(...conditions)).limit(1))[0];
      if (!row) return jsonNotFound("Contract not found", corsHeaders);
      return jsonOk({ status: "ok", contract: row }, corsHeaders);
    }

    // POST /api/contracts
    if (req.method === "POST" && !action) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const contract = {
        id: generateId("contract"),
        tenantId: tenantId ?? "default",
        artist: String(body.artist ?? ""),
        artistId: String(body.artistId ?? ""),
        type: String(body.type ?? "exclusive"),
        status: String(body.status ?? "draft"),
        priority: String(body.priority ?? "medium"),
        signedDate: body.signedDate !== undefined ? String(body.signedDate) : null,
        expiryDate: body.expiryDate !== undefined ? String(body.expiryDate) : null,
        revenueShare: parseInt(String(body.revenueShare ?? "50"), 10) || 50,
        value: parseFloat(String(body.value ?? "0")) || 0,
        rights: String(body.rights ?? ""),
        gdprStatus: String(body.gdprStatus ?? "pending"),
        ipiStatus: String(body.ipiStatus ?? "pending"),
        fileUrl: body.fileUrl !== undefined ? String(body.fileUrl) : null,
        nextAction: body.nextAction !== undefined ? String(body.nextAction) : null,
        notes: String(body.notes ?? ""),
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(auralabelsContracts).values(contract);
      const created = (await db.select().from(auralabelsContracts).where(eq(auralabelsContracts.id, contract.id)).limit(1))[0];
      console.log(`[api] Created contract: ${contract.artist}`);
      return jsonCreated({ status: "ok", contract: created }, corsHeaders);
    }

    // POST /api/contracts/:id/restore
    if (req.method === "POST" && action === "restore" && id) {
      const restoreConditions = [eq(auralabelsContracts.id, id)];
      if (tFilter) restoreConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsContracts).where(and(...restoreConditions)).limit(1))[0];
      if (existing) return jsonOk({ status: "ok", contract: existing }, corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const contract = {
        id,
        tenantId: tenantId ?? "default",
        artist: String(body.artist ?? ""),
        artistId: String(body.artistId ?? ""),
        type: String(body.type ?? "exclusive"),
        status: String(body.status ?? "draft"),
        priority: String(body.priority ?? "medium"),
        signedDate: body.signedDate !== undefined ? String(body.signedDate) : null,
        expiryDate: body.expiryDate !== undefined ? String(body.expiryDate) : null,
        revenueShare: parseInt(String(body.revenueShare ?? "50"), 10) || 50,
        value: parseFloat(String(body.value ?? "0")) || 0,
        rights: String(body.rights ?? ""),
        gdprStatus: String(body.gdprStatus ?? "pending"),
        ipiStatus: String(body.ipiStatus ?? "pending"),
        fileUrl: body.fileUrl !== undefined ? String(body.fileUrl) : null,
        nextAction: body.nextAction !== undefined ? String(body.nextAction) : null,
        notes: String(body.notes ?? ""),
        createdAt: body.createdAt ? new Date(String(body.createdAt)) : now,
        updatedAt: now,
      };

      await db.insert(auralabelsContracts).values(contract);
      const createConditions = [eq(auralabelsContracts.id, id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsContracts).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Restored contract: ${contract.artist} (id=${id})`);
      return jsonOk({ status: "ok", contract: created }, corsHeaders);
    }

    // PUT /api/contracts/:id
    if (req.method === "PUT" && id) {
      const putConditions = [eq(auralabelsContracts.id, id)];
      if (tFilter) putConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsContracts).where(and(...putConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Contract not found", corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      await db.update(auralabelsContracts).set({
        artist: String(body.artist ?? existing.artist),
        artistId: String(body.artistId ?? existing.artistId),
        type: String(body.type ?? existing.type),
        status: String(body.status ?? existing.status),
        priority: String(body.priority ?? existing.priority),
        signedDate: body.signedDate !== undefined ? String(body.signedDate) : existing.signedDate,
        expiryDate: body.expiryDate !== undefined ? String(body.expiryDate) : existing.expiryDate,
        revenueShare: body.revenueShare !== undefined ? parseInt(String(body.revenueShare), 10) : existing.revenueShare,
        value: body.value !== undefined ? parseFloat(String(body.value)) : existing.value,
        rights: String(body.rights ?? existing.rights),
        gdprStatus: String(body.gdprStatus ?? existing.gdprStatus),
        ipiStatus: String(body.ipiStatus ?? existing.ipiStatus),
        fileUrl: body.fileUrl !== undefined ? String(body.fileUrl) : existing.fileUrl,
        nextAction: body.nextAction !== undefined ? String(body.nextAction) : existing.nextAction,
        notes: String(body.notes ?? existing.notes),
        updatedAt: now,
      }).where(and(...putConditions));

      const updateConditions = [eq(auralabelsContracts.id, id)];
      if (tFilter) updateConditions.push(tFilter);
      const updated = (await db.select().from(auralabelsContracts).where(and(...updateConditions)).limit(1))[0];
      return jsonOk({ status: "ok", contract: updated }, corsHeaders);
    }

    // DELETE /api/contracts/:id
    if (req.method === "DELETE" && id) {
      const deleteConditions = [eq(auralabelsContracts.id, id)];
      if (tFilter) deleteConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsContracts).where(and(...deleteConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Contract not found", corsHeaders);

      await db.delete(auralabelsContracts).where(and(...deleteConditions));
      console.log(`[api] Deleted contract: ${existing.artist}`);
      return jsonOk({ status: "ok", id }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Contracts error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}
