/**
 * Activities — /api/activities
 *
 * GET  /api/activities                        — list all activities (tenant-scoped)
 * POST /api/activities                        — log a new activity
 * POST /api/admin/activities/bulk-purge       — bulk delete stale activities
 */
import { eq, like, and, sql, gte } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsActivities } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, jsonOk, jsonCreated, jsonBadRequest, jsonError, parseBody, CorsHeaders } from "./helpers.js";

export async function activitiesHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/activities", "").split("/").filter(Boolean);
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsActivities.tenantId, tenantId) : undefined;

  try {
    // GET /api/activities
    if (req.method === "GET" && pathParts.length === 0) {
      const rows = tFilter
        ? await db.select().from(auralabelsActivities).where(tFilter).orderBy(auralabelsActivities.timestamp)
        : await db.select().from(auralabelsActivities).orderBy(auralabelsActivities.timestamp);
      return jsonOk(rows, corsHeaders);
    }

    // POST /api/activities
    if (req.method === "POST" && pathParts.length === 0) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const activity = {
        id: generateId("act"),
        tenantId: tenantId ?? "default",
        artistId: String(body.artistId ?? ""),
        artistName: String(body.artistName ?? ""),
        action: String(body.action ?? ""),
        timestamp: String(body.timestamp ?? new Date().toISOString()),
        type: String(body.type ?? "note"),
      };

      await db.insert(auralabelsActivities).values(activity);
      const created = (await db.select().from(auralabelsActivities).where(eq(auralabelsActivities.id, activity.id)).limit(1))[0];
      return jsonCreated({ status: "ok", activity: created ?? null }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Activities error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

/**
 * POST /api/admin/activities/bulk-purge
 *
 * Administrative deletion of stale activity rows (tenant-scoped).
 * Body: { actionPrefix?: string, since?: string, dryRun?: boolean, confirm?: boolean }
 * Default dryRun: true. dryRun=false requires explicit confirm: true.
 * Rows with type = 'admin_meta' are excluded from purge.
 */
export async function bulkPurgeActivitiesHandler(req: Request, env: Env, corsHeaders: CorsHeaders, tenantId: string | null): Promise<Response> {
  if (req.method !== "POST") {
    return jsonBadRequest("Method not allowed", corsHeaders);
  }

  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  try {
    const body = await parseBody(req);
    if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

    const actionPrefix = body.actionPrefix ? String(body.actionPrefix) : null;
    const since = body.since ? String(body.since) : null;
    const dryRun = body.dryRun !== false; // defaults to true
    const confirm = body.confirm === true;

    if (!dryRun && !confirm) {
      return jsonOk({
        status: "error",
        message: 'dryRun=false requires confirm: true',
      }, corsHeaders);
    }

    // Build count query
    const conditions = [sql`type != 'admin_meta'`];
    if (tenantId) {
      conditions.push(eq(auralabelsActivities.tenantId, tenantId));
    }
    if (actionPrefix) {
      conditions.push(like(auralabelsActivities.action, `${actionPrefix}%`));
    }
    if (since) {
      conditions.push(gte(auralabelsActivities.timestamp, since));
    }

    const whereClause = and(...conditions);

    // Count matching rows
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(auralabelsActivities)
      .where(whereClause);

    const matchedCount = Number(countRows[0]?.count ?? 0);

    if (dryRun) {
      return jsonOk({
        status: "ok",
        dryRun: true,
        matched: matchedCount,
        message: `Dry run: ${matchedCount} activity rows would be deleted. Pass "confirm": true with "dryRun": false to execute.`,
      }, corsHeaders);
    }

    // Execute delete
    const deleted = await db
      .delete(auralabelsActivities)
      .where(whereClause)
      .returning({ id: auralabelsActivities.id });

    return jsonOk({
      status: "ok",
      dryRun: false,
      deletedIds: deleted.map((r) => r.id),
      deletedCount: deleted.length,
    }, corsHeaders);
  } catch (err) {
    console.error("[api] Bulk purge error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}
