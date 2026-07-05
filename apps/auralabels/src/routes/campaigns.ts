/**
 * Campaigns CRUD — /api/campaigns
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.js";
import { auralabelsCampaigns } from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { generateId, nowDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";

export async function campaignsHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/api/campaigns", "").split("/").filter(Boolean);
  const id = pathParts[0] ?? null;
  const action = pathParts[1] ?? null;
  const tenantId = user?.tenantId ?? null;
  const tFilter = tenantId ? eq(auralabelsCampaigns.tenantId, tenantId) : undefined;

  try {
    // GET /api/campaigns
    if (req.method === "GET" && !id) {
      const rows = tFilter
        ? await db.select().from(auralabelsCampaigns).where(tFilter).orderBy(auralabelsCampaigns.createdAt)
        : await db.select().from(auralabelsCampaigns).orderBy(auralabelsCampaigns.createdAt);
      return jsonOk(rows.map(mapCampaign), corsHeaders);
    }

    // GET /api/campaigns/:id
    if (req.method === "GET" && id) {
      const conditions = [eq(auralabelsCampaigns.id, id)];
      if (tFilter) conditions.push(tFilter);
      const row = (await db.select().from(auralabelsCampaigns).where(and(...conditions)).limit(1))[0];
      if (!row) return jsonNotFound("Campaign not found", corsHeaders);
      return jsonOk(mapCampaign(row), corsHeaders);
    }

    // POST /api/campaigns
    if (req.method === "POST" && !action) {
      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const campaign = {
        id: generateId("camp"),
        tenantId: tenantId ?? "default",
        name: String(body.name ?? "Untitled Campaign"),
        releaseId: String(body.releaseId ?? ""),
        releaseTitle: String(body.releaseTitle ?? ""),
        artist: String(body.artist ?? ""),
        status: String(body.status ?? "planning"),
        priority: String(body.priority ?? "medium"),
        startDate: String(body.startDate ?? now.toISOString().split("T")[0]),
        endDate: String(body.endDate ?? now.toISOString().split("T")[0]),
        platforms: toJson(body.platforms ?? []),
        budget: parseFloat(String(body.budget ?? "0")) || 0,
        impressions: parseInt(String(body.impressions ?? "0"), 10) || 0,
        engagements: parseInt(String(body.engagements ?? "0"), 10) || 0,
        promoPoolStatus: String(body.promoPoolStatus ?? "not_started"),
        djFeedbackStatus: String(body.djFeedbackStatus ?? "not_started"),
        instagramContentStatus: String(body.instagramContentStatus ?? "not_started"),
        youtubeTeaserStatus: String(body.youtubeTeaserStatus ?? "not_started"),
        beatportFeaturePitchStatus: String(body.beatportFeaturePitchStatus ?? "not_started"),
        spotifyPitchStatus: String(body.spotifyPitchStatus ?? "not_started"),
        emailBlastStatus: String(body.emailBlastStatus ?? "not_started"),
        campaignChecklist: toJson(body.campaignChecklist ?? []),
        readinessPercentage: parseInt(String(body.readinessPercentage ?? "0"), 10) || 0,
        missingContent: toJson(body.missingContent ?? []),
        nextAction: String(body.nextAction ?? ""),
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(auralabelsCampaigns).values(campaign);
      const createConditions = [eq(auralabelsCampaigns.id, campaign.id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsCampaigns).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Created campaign: ${campaign.name}`);
      return jsonCreated({ status: "ok", campaign: mapCampaign(created) }, corsHeaders);
    }

    // POST /api/campaigns/:id/restore
    if (req.method === "POST" && action === "restore" && id) {
      const restoreConditions = [eq(auralabelsCampaigns.id, id)];
      if (tFilter) restoreConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsCampaigns).where(and(...restoreConditions)).limit(1))[0];
      if (existing) return jsonOk({ status: "ok", campaign: mapCampaign(existing) }, corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      const campaign = {
        id,
        tenantId: tenantId ?? "default",
        name: String(body.name ?? "Untitled Campaign"),
        releaseId: String(body.releaseId ?? ""),
        releaseTitle: String(body.releaseTitle ?? ""),
        artist: String(body.artist ?? ""),
        status: String(body.status ?? "planning"),
        priority: String(body.priority ?? "medium"),
        startDate: String(body.startDate ?? now.toISOString().split("T")[0]),
        endDate: String(body.endDate ?? now.toISOString().split("T")[0]),
        platforms: toJson(body.platforms ?? []),
        budget: parseFloat(String(body.budget ?? "0")) || 0,
        impressions: parseInt(String(body.impressions ?? "0"), 10) || 0,
        engagements: parseInt(String(body.engagements ?? "0"), 10) || 0,
        promoPoolStatus: String(body.promoPoolStatus ?? "not_started"),
        djFeedbackStatus: String(body.djFeedbackStatus ?? "not_started"),
        instagramContentStatus: String(body.instagramContentStatus ?? "not_started"),
        youtubeTeaserStatus: String(body.youtubeTeaserStatus ?? "not_started"),
        beatportFeaturePitchStatus: String(body.beatportFeaturePitchStatus ?? "not_started"),
        spotifyPitchStatus: String(body.spotifyPitchStatus ?? "not_started"),
        emailBlastStatus: String(body.emailBlastStatus ?? "not_started"),
        campaignChecklist: toJson(body.campaignChecklist ?? []),
        readinessPercentage: parseInt(String(body.readinessPercentage ?? "0"), 10) || 0,
        missingContent: toJson(body.missingContent ?? []),
        nextAction: String(body.nextAction ?? ""),
        createdAt: body.createdAt ? new Date(String(body.createdAt)) : now,
        updatedAt: now,
      };

      await db.insert(auralabelsCampaigns).values(campaign);
      const createConditions = [eq(auralabelsCampaigns.id, id)];
      if (tFilter) createConditions.push(tFilter);
      const created = (await db.select().from(auralabelsCampaigns).where(and(...createConditions)).limit(1))[0];
      console.log(`[api] Restored campaign: ${campaign.name} (id=${id})`);
      return jsonOk({ status: "ok", campaign: mapCampaign(created) }, corsHeaders);
    }

    // PUT /api/campaigns/:id
    if (req.method === "PUT" && id) {
      const putConditions = [eq(auralabelsCampaigns.id, id)];
      if (tFilter) putConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsCampaigns).where(and(...putConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Campaign not found", corsHeaders);

      const body = await parseBody(req);
      if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

      const now = nowDate();
      await db.update(auralabelsCampaigns).set({
        name: String(body.name ?? existing.name),
        releaseId: String(body.releaseId ?? existing.releaseId),
        releaseTitle: String(body.releaseTitle ?? existing.releaseTitle),
        artist: String(body.artist ?? existing.artist),
        status: String(body.status ?? existing.status),
        priority: String(body.priority ?? existing.priority),
        startDate: String(body.startDate ?? existing.startDate),
        endDate: String(body.endDate ?? existing.endDate),
        platforms: toJson(body.platforms ?? existing.platforms),
        budget: body.budget !== undefined ? parseFloat(String(body.budget)) : existing.budget,
        impressions: body.impressions !== undefined ? parseInt(String(body.impressions), 10) : existing.impressions,
        engagements: body.engagements !== undefined ? parseInt(String(body.engagements), 10) : existing.engagements,
        promoPoolStatus: String(body.promoPoolStatus ?? existing.promoPoolStatus),
        djFeedbackStatus: String(body.djFeedbackStatus ?? existing.djFeedbackStatus),
        instagramContentStatus: String(body.instagramContentStatus ?? existing.instagramContentStatus),
        youtubeTeaserStatus: String(body.youtubeTeaserStatus ?? existing.youtubeTeaserStatus),
        beatportFeaturePitchStatus: String(body.beatportFeaturePitchStatus ?? existing.beatportFeaturePitchStatus),
        spotifyPitchStatus: String(body.spotifyPitchStatus ?? existing.spotifyPitchStatus),
        emailBlastStatus: String(body.emailBlastStatus ?? existing.emailBlastStatus),
        campaignChecklist: toJson(body.campaignChecklist ?? existing.campaignChecklist),
        readinessPercentage: body.readinessPercentage !== undefined ? parseInt(String(body.readinessPercentage), 10) : existing.readinessPercentage,
        missingContent: toJson(body.missingContent ?? existing.missingContent),
        nextAction: String(body.nextAction ?? existing.nextAction),
        updatedAt: now,
      }).where(and(...putConditions));

      const updateConditions = [eq(auralabelsCampaigns.id, id)];
      if (tFilter) updateConditions.push(tFilter);
      const updated = (await db.select().from(auralabelsCampaigns).where(and(...updateConditions)).limit(1))[0];
      return jsonOk({ status: "ok", campaign: mapCampaign(updated) }, corsHeaders);
    }

    // DELETE /api/campaigns/:id
    if (req.method === "DELETE" && id) {
      const deleteConditions = [eq(auralabelsCampaigns.id, id)];
      if (tFilter) deleteConditions.push(tFilter);
      const existing = (await db.select().from(auralabelsCampaigns).where(and(...deleteConditions)).limit(1))[0];
      if (!existing) return jsonNotFound("Campaign not found", corsHeaders);

      await db.delete(auralabelsCampaigns).where(and(...deleteConditions));
      return jsonOk({ status: "ok", id }, corsHeaders);
    }

    return jsonBadRequest("Method not allowed", corsHeaders);
  } catch (err) {
    console.error("[api] Campaigns error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

function toJson(val: unknown): string {
  if (typeof val === "string") return val;
  return JSON.stringify(val ?? []);
}

function parseJsonField(val: unknown): unknown[] {
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
  if (Array.isArray(val)) return val;
  return [];
}

function mapCampaign(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    platforms: parseJsonField(row.platforms),
    campaignChecklist: parseJsonField(row.campaignChecklist),
    missingContent: parseJsonField(row.missingContent),
  };
}
