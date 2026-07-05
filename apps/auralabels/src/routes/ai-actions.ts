/**
 * AI Actions CRUD — /api/ai-actions
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsAiActions } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, nowDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";

export async function aiActionsHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/ai-actions", "").split("/").filter(Boolean);
  const id = pathParts[0] ?? null;
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsAiActions.tenantId, tenantId) : undefined;

  try {
    // GET /api/ai-actions
    if (req.method === "GET" && !id) {
      const rows = tFilter
        ? await db.select().from(auralabelsAiActions).where(tFilter).orderBy(auralabelsAiActions.createdAt)
        : await db.select().from(auralabelsAiActions).orderBy(auralabelsAiActions.createdAt);
      return jsonOk(rows.map(mapAiAction), corsHeaders);
    }

    // GET /api/ai-actions/:id
    if (req.method === "GET" && id) {
      const conditions = [eq(auralabelsAiActions.id, id)];
      if (tFilter) conditions.push(tFilter);
      const row = (await db.select().from(auralabelsAiActions).where(and(...conditions)).limit(1))[0];
      if (!row) return jsonNotFound("AI action not found", corsHeaders);
      return jsonOk(mapAiAction(row), corsHeaders);
    }

    // POST /api/ai-actions
    if (req.method === "POST" && !id) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const action = {
        id: generateId("ai"),
        tenantId: tenantId ?? "default",
        action: String(body.action ?? ""),
        description: String(body.description ?? ""),
        category: String(body.category ?? "analysis"),
        priority: String(body.priority ?? "medium"),
        createdAt: body.createdAt ? new Date(String(body.createdAt)) : nowDate(),
        used: !!body.used,
      };

      await db.insert(auralabelsAiActions).values(action);
      const created = (await db.select().from(auralabelsAiActions).where(eq(auralabelsAiActions.id, action.id)).limit(1))[0];
      return jsonCreated({ status: "ok", action: mapAiAction(created) }, corsHeaders);
    }

    // PUT /api/ai-actions/:id
    if (req.method === "PUT" && id) {
      const putConditions = [eq(auralabelsAiActions.id, id)];
      if (tFilter) putConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsAiActions).where(and(...putConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("AI action not found", corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      await db.update(auralabelsAiActions).set({
        action: String(body.action ?? existing.action),
        description: String(body.description ?? existing.description),
        category: String(body.category ?? existing.category),
        priority: String(body.priority ?? existing.priority),
        used: body.used !== undefined ? !!body.used : existing.used,
      }).where(and(...putConditions));

      const updateConditions = [eq(auralabelsAiActions.id, id)];
      if (tFilter) updateConditions.push(tFilter);
      const updated = (await db.select().from(auralabelsAiActions).where(and(...updateConditions)).limit(1))[0];
      return jsonOk({ status: "ok", action: mapAiAction(updated) }, corsHeaders);
    }

    // DELETE /api/ai-actions/:id
    if (req.method === "DELETE" && id) {
      const deleteConditions = [eq(auralabelsAiActions.id, id)];
      if (tFilter) deleteConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsAiActions).where(and(...deleteConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("AI action not found", corsHeaders);

      await db.delete(auralabelsAiActions).where(and(...deleteConditions));
      return jsonOk({ status: "ok", id }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] AI Actions error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

function parseBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  return false;
}

function mapAiAction(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, used: parseBool(row.used) };
}
