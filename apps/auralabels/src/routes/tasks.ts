/**
 * Tasks CRUD — /api/tasks
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsTasks } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, nowDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";

export async function tasksHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/tasks", "").split("/").filter(Boolean);
  const id = pathParts[0] ?? null;
  const action = pathParts[1] ?? null;
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsTasks.tenantId, tenantId) : undefined;

  try {
    // GET /api/tasks
    if (req.method === "GET" && !id) {
      const rows = tFilter
        ? await db.select().from(auralabelsTasks).where(tFilter).orderBy(auralabelsTasks.dueDate)
        : await db.select().from(auralabelsTasks).orderBy(auralabelsTasks.dueDate);
      return jsonOk(rows.map(mapTask), corsHeaders);
    }

    // GET /api/tasks/:id
    if (req.method === "GET" && id) {
      const conditions = [eq(auralabelsTasks.id, id)];
      if (tFilter) conditions.push(tFilter);
      const row = (await db.select().from(auralabelsTasks).where(and(...conditions)).limit(1))[0];
      if (!row) return jsonNotFound("Task not found", corsHeaders);
      return jsonOk(mapTask(row), corsHeaders);
    }

    // POST /api/tasks
    if (req.method === "POST" && !action) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const task = {
        id: generateId("task"),
        tenantId: tenantId ?? "default",
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        status: String(body.status ?? "todo"),
        priority: String(body.priority ?? "medium"),
        category: String(body.category ?? "admin"),
        dueDate: String(body.dueDate ?? ""),
        assignee: String(body.assignee ?? ""),
        relatedToType: body.relatedToType !== undefined ? String(body.relatedToType) : null,
        relatedToId: body.relatedToId !== undefined ? String(body.relatedToId) : null,
        relatedToTitle: body.relatedToTitle !== undefined ? String(body.relatedToTitle) : null,
        overdue: !!body.overdue,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(auralabelsTasks).values(task);
      const createConditions = [eq(auralabelsTasks.id, task.id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsTasks).where(and(...createConditions)).limit(1))[0];
      return jsonCreated({ status: "ok", task: mapTask(created) }, corsHeaders);
    }

    // POST /api/tasks/:id/restore
    if (req.method === "POST" && action === "restore" && id) {
      const restoreConditions = [eq(auralabelsTasks.id, id)];
      if (tFilter) restoreConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsTasks).where(and(...restoreConditions)).limit(1))[0];
      if (existing) return jsonOk({ status: "ok", task: mapTask(existing) }, corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const task = {
        id,
        tenantId: tenantId ?? "default",
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        status: String(body.status ?? "todo"),
        priority: String(body.priority ?? "medium"),
        category: String(body.category ?? "admin"),
        dueDate: String(body.dueDate ?? ""),
        assignee: String(body.assignee ?? ""),
        relatedToType: body.relatedToType !== undefined ? String(body.relatedToType) : null,
        relatedToId: body.relatedToId !== undefined ? String(body.relatedToId) : null,
        relatedToTitle: body.relatedToTitle !== undefined ? String(body.relatedToTitle) : null,
        overdue: !!body.overdue,
        createdAt: body.createdAt ? new Date(String(body.createdAt)) : now,
        updatedAt: now,
      };

      await db.insert(auralabelsTasks).values(task);
      const createConditions = [eq(auralabelsTasks.id, id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsTasks).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Restored task: ${task.title} (id=${id})`);
      return jsonOk({ status: "ok", task: mapTask(created) }, corsHeaders);
    }

    // PUT /api/tasks/:id
    if (req.method === "PUT" && id) {
      const putConditions = [eq(auralabelsTasks.id, id)];
      if (tFilter) putConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsTasks).where(and(...putConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Task not found", corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      await db.update(auralabelsTasks).set({
        title: String(body.title ?? existing.title),
        description: String(body.description ?? existing.description),
        status: String(body.status ?? existing.status),
        priority: String(body.priority ?? existing.priority),
        category: String(body.category ?? existing.category),
        dueDate: String(body.dueDate ?? existing.dueDate),
        assignee: String(body.assignee ?? existing.assignee),
        relatedToType: body.relatedToType !== undefined ? String(body.relatedToType) : existing.relatedToType,
        relatedToId: body.relatedToId !== undefined ? String(body.relatedToId) : existing.relatedToId,
        relatedToTitle: body.relatedToTitle !== undefined ? String(body.relatedToTitle) : existing.relatedToTitle,
        overdue: body.overdue !== undefined ? !!body.overdue : existing.overdue,
        updatedAt: now,
      }).where(and(...putConditions));

      const updateConditions = [eq(auralabelsTasks.id, id)];
      if (tFilter) updateConditions.push(tFilter);
      const updated = (await db.select().from(auralabelsTasks).where(and(...updateConditions)).limit(1))[0];
      return jsonOk({ status: "ok", task: mapTask(updated) }, corsHeaders);
    }

    // DELETE /api/tasks/:id
    if (req.method === "DELETE" && id) {
      const deleteConditions = [eq(auralabelsTasks.id, id)];
      if (tFilter) deleteConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsTasks).where(and(...deleteConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Task not found", corsHeaders);

      await db.delete(auralabelsTasks).where(and(...deleteConditions));
      return jsonOk({ status: "ok", id }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Tasks error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

function parseBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  return false;
}

function mapTask(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    overdue: parseBool(row.overdue),
    relatedTo: row.relatedToType ? {
      type: row.relatedToType,
      id: row.relatedToId,
      title: row.relatedToTitle,
    } : null,
  };
}
