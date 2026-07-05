/**
 * GET /api/revenue — fetch revenue summary (tenant-scoped)
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsRevenue } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { jsonOk, jsonError, CorsHeaders } from "./helpers.js";

export async function revenueHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsRevenue.tenantId, tenantId) : undefined;

  try {
    const rows = tFilter
      ? await db
        .select()
        .from(auralabelsRevenue)
        .where(tFilter)
        .orderBy(auralabelsRevenue.updatedAt)
        .limit(1)
      : await db
        .select()
        .from(auralabelsRevenue)
        .orderBy(auralabelsRevenue.updatedAt)
        .limit(1);

    const row = rows[0] ?? null;
    if (!row) {
      return jsonOk({
        totalRevenue: 0,
        monthlyRevenue: 0,
        pendingPayouts: 0,
        currency: "EUR",
        revenueByArtist: [],
        revenueByRelease: [],
      }, corsHeaders);
    }

    const mapRevenue = (r: Record<string, unknown>) => ({
      ...r,
      revenueByArtist: parseJsonField(r.revenueByArtist),
      revenueByRelease: parseJsonField(r.revenueByRelease),
    });

    return jsonOk(mapRevenue(row as Record<string, unknown>), corsHeaders);
  } catch (err) {
    console.error("[api] Revenue error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

function parseJsonField(val: unknown): unknown[] {
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
  if (Array.isArray(val)) return val;
  return [];
}
