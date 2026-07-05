/**
 * Admin routes:
 *   GET    /api/admin/users                    — list users (tenant-scoped)
 *   POST   /api/admin/users                    — create user (assigns tenantId)
 *   PATCH  /api/admin/users/:id                — update user (tenant-scoped)
 *   DELETE /api/admin/users/:id                — delete user (tenant-scoped)
 *   GET    /api/admin/beta-applications        — list beta applications
 *   PATCH  /api/admin/beta-applications/:id    — update beta application status
 *   POST   /api/admin/clear-data               — delete all business data in tenant (preserves users)
 *   GET    /api/admin/export                   — export tenant-scoped label data as JSON
 *   POST   /api/admin/import                   — import label data into tenant
 */
import { eq, sql, and } from "drizzle-orm";
import type { JwtPayload } from "../auth.js";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import {
  auralabelsUsers,
  auralabelsBetaApplications,
  auralabelsArtists,
  auralabelsReleases,
  auralabelsDemos,
  auralabelsContracts,
  auralabelsTasks,
  auralabelsCampaigns,
  auralabelsAiActions,
  auralabelsActivities,
  auralabelsRevenue,
} from "@aura-labels/db/schema";
import type { Env } from "../env.js";
import { generateId, nowDate, jsonOk, jsonCreated, jsonBadRequest, jsonNotFound, jsonError, parseBody, CorsHeaders } from "./helpers.js";
import { bulkPurgeActivitiesHandler } from "./activities.js";

/**
 * Route all /api/admin/* requests through a single dispatcher.
 */
export async function adminHandler(req: Request, env: Env, corsHeaders: CorsHeaders, url: URL, user: JwtPayload | null): Promise<Response> {
  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const tenantId = user?.tenantId ?? null;

  // Normalize path: /api/admin/users or /api/admin/users/:id or /api/admin/beta-applications or /api/admin/beta-applications/:id
  const path = url.pathname.replace("/api/admin/", "");
  const parts = path.split("/").filter(Boolean);

  try {
    if (parts[0] === "users") {
      return usersSubHandler(req, env, corsHeaders, db, parts.slice(1), tenantId);
    }
    if (parts[0] === "beta-applications") {
      return betaAppsAdminHandler(req, corsHeaders, db, parts.slice(1), user);
    }
    if (parts[0] === "activities" && parts[1] === "bulk-purge") {
      return bulkPurgeActivitiesHandler(req, env, corsHeaders, tenantId);
    }
    if (parts[0] === "clear-data") {
      return requireAdmin(user, corsHeaders, () => clearDataHandler(req, corsHeaders, db, tenantId));
    }
    if (parts[0] === "export") {
      return requireAdmin(user, corsHeaders, () => exportDataHandler(corsHeaders, db, tenantId));
    }
    if (parts[0] === "import") {
      return requireAdmin(user, corsHeaders, () => importDataHandler(req, corsHeaders, db, tenantId));
    }

    return jsonBadRequest("Not found", corsHeaders);
  } catch (err) {
    console.error("[api] Admin error:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}

/* ── Users sub-handler ─────────────────────────────────────────────── */

async function usersSubHandler(
  req: Request,
  _env: Env, // unused — auth is handled by the gate in index.ts
  corsHeaders: CorsHeaders,
  db: NonNullable<ReturnType<typeof getDb>>,
  parts: string[],
  tenantId: string | null,
): Promise<Response> {
  const id = parts[0] ?? null;

  // GET /api/admin/users
  if (req.method === "GET" && !id) {
    const rows = tenantId
      ? await db
        .select({
          id: auralabelsUsers.id,
          username: auralabelsUsers.username,
          role: auralabelsUsers.role,
          tenantId: auralabelsUsers.tenantId,
          disabled: auralabelsUsers.disabled,
          createdAt: auralabelsUsers.createdAt,
          updatedAt: auralabelsUsers.updatedAt,
        })
        .from(auralabelsUsers)
        .where(eq(auralabelsUsers.tenantId, tenantId))
        .orderBy(auralabelsUsers.createdAt)
      : await db
        .select({
          id: auralabelsUsers.id,
          username: auralabelsUsers.username,
          role: auralabelsUsers.role,
          tenantId: auralabelsUsers.tenantId,
          disabled: auralabelsUsers.disabled,
          createdAt: auralabelsUsers.createdAt,
          updatedAt: auralabelsUsers.updatedAt,
        })
        .from(auralabelsUsers)
        .orderBy(auralabelsUsers.createdAt);

    return jsonOk({ status: "ok", users: rows }, corsHeaders);
  }

  // POST /api/admin/users
  if (req.method === "POST" && !id) {
    const body = await parseBody(req);
    if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "user");

    if (!username || username.length < 2) {
      return jsonBadRequest("Username is required (min 2 chars)", corsHeaders);
    }
    if (!password || password.length < 6) {
      return jsonBadRequest("Password is required (min 6 chars)", corsHeaders);
    }
    if (!["admin", "user"].includes(role)) {
      return jsonBadRequest('Role must be "admin" or "user"', corsHeaders);
    }

    // Check if username already exists
    const existing = await db
      .select()
      .from(auralabelsUsers)
      .where(eq(auralabelsUsers.username, username))
      .limit(1);

    if (existing.length > 0) {
      return jsonBadRequest("Username already exists", corsHeaders);
    }

    const now = nowDate();
    const hash = await bcrypt.hash(password, 10);
    const userId = generateId("user");
    // Assign tenantId: from body if specified, otherwise from the creating admin's own tenant
    const assignedTenantId = body.tenantId !== undefined ? String(body.tenantId) : (tenantId ?? null);
    await db.insert(auralabelsUsers).values({
        id: userId,
        username,
        passwordHash: hash,
        role,
        tenantId: assignedTenantId,
        disabled: false,
        createdAt: now,
        updatedAt: now,
      });

    const created = (await db
      .select({
        id: auralabelsUsers.id,
        username: auralabelsUsers.username,
        role: auralabelsUsers.role,
        tenantId: auralabelsUsers.tenantId,
        disabled: auralabelsUsers.disabled,
        createdAt: auralabelsUsers.createdAt,
        updatedAt: auralabelsUsers.updatedAt,
      })
      .from(auralabelsUsers)
      .where(eq(auralabelsUsers.id, userId))
      .limit(1))[0];

    console.log(`[api] Created user: ${username} (${role})`);
    return jsonCreated({ status: "ok", user: created }, corsHeaders);
  }

  // PATCH /api/admin/users/:id
  if (req.method === "PATCH" && id) {
    const userConditions = [eq(auralabelsUsers.id, id)];
    if (tenantId) userConditions.push(eq(auralabelsUsers.tenantId, tenantId));
    const existing = (await db.select().from(auralabelsUsers).where(and(...userConditions)).limit(1))[0];
    if (!existing) return jsonNotFound("User not found", corsHeaders);

    const body = await parseBody(req);
    if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

    const now = nowDate();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (body.password) {
      updates.passwordHash = await bcrypt.hash(String(body.password), 10);
    }
    if (body.role && ["admin", "user"].includes(String(body.role))) {
      updates.role = String(body.role);
    }
    if (body.tenantId !== undefined) {
      updates.tenantId = String(body.tenantId);
    }
    if (body.disabled !== undefined) {
      updates.disabled = Boolean(body.disabled);
    }

    await db.update(auralabelsUsers).set(updates).where(and(...userConditions));

    const updated = (await db
      .select({
        id: auralabelsUsers.id,
        username: auralabelsUsers.username,
        role: auralabelsUsers.role,
        tenantId: auralabelsUsers.tenantId,
        disabled: auralabelsUsers.disabled,
        createdAt: auralabelsUsers.createdAt,
        updatedAt: auralabelsUsers.updatedAt,
      })
      .from(auralabelsUsers)
      .where(eq(auralabelsUsers.id, id))
      .limit(1))[0];

    return jsonOk({ status: "ok", user: updated }, corsHeaders);
  }

  // DELETE /api/admin/users/:id
  if (req.method === "DELETE" && id) {
    const deleteConditions = [eq(auralabelsUsers.id, id)];
    if (tenantId) deleteConditions.push(eq(auralabelsUsers.tenantId, tenantId));
    const existing = (await db.select().from(auralabelsUsers).where(and(...deleteConditions)).limit(1))[0];
    if (!existing) return jsonNotFound("User not found", corsHeaders);

    await db.delete(auralabelsUsers).where(and(...deleteConditions));
    console.log(`[api] Deleted user: ${existing.username} (id=${id})`);
    return jsonOk({ status: "ok", id }, corsHeaders);
  }

  return jsonBadRequest("Method not allowed", corsHeaders);
}

/* ── Beta applications admin sub-handler ───────────────────────────── */

async function betaAppsAdminHandler(
  req: Request,
  corsHeaders: CorsHeaders,
  db: NonNullable<ReturnType<typeof getDb>>,
  parts: string[],
  user: JwtPayload | null,
): Promise<Response> {
  const id = parts[0] ?? null;

  // GET /api/admin/beta-applications
  if (req.method === "GET" && !id) {
    const rows = await db
      .select()
      .from(auralabelsBetaApplications)
      .orderBy(
        sql`CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 WHEN 'spam' THEN 3 END`,
        auralabelsBetaApplications.createdAt,
      );

    return jsonOk({ status: "ok", applications: rows.map(mapBetaApp) }, corsHeaders);
  }

  // PATCH /api/admin/beta-applications/:id
  if (req.method === "PATCH" && id) {
    const existing = (await db.select().from(auralabelsBetaApplications).where(eq(auralabelsBetaApplications.id, id)).limit(1))[0];
    if (!existing) return jsonNotFound("Beta application not found", corsHeaders);

    const body = await parseBody(req);
    if (!body) return jsonBadRequest("Invalid JSON body", corsHeaders);

    const status = String(body.status ?? "");
    if (!["pending", "approved", "rejected", "spam"].includes(status)) {
      return jsonBadRequest('Status must be one of: pending, approved, rejected, spam', corsHeaders);
    }

    // Get current user for reviewedBy
    const reviewedBy = user?.username ?? null;

    const now = nowDate();
    await db.update(auralabelsBetaApplications).set({
      status,
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    }).where(eq(auralabelsBetaApplications.id, id));

    const updated = (await db.select().from(auralabelsBetaApplications).where(eq(auralabelsBetaApplications.id, id)).limit(1))[0];
    return jsonOk({ status: "ok", application: mapBetaApp(updated) }, corsHeaders);
  }

  return jsonBadRequest("Method not allowed", corsHeaders);
}

function mapBetaApp(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    label: row.label ?? "",
    role: row.role ?? "Not specified",
    notes: row.notes ?? "",
    status: row.status ?? "pending",
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Middleware: verify the caller has admin role before proceeding.
 * Returns a 403 response if the user is not an admin, otherwise
 * calls the provided handler.
 */
async function requireAdmin(
  user: JwtPayload | null,
  corsHeaders: CorsHeaders,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ status: "error", message: "Forbidden — admin role required" }),
      { status: 403, headers: corsHeaders },
    );
  }
  return handler();
}

/* ── Data Management (clear / export / import) ───────────────────── */

// Tables in dependency order — child tables first, then parents.
// Preserves auralabelsUsers and auralabelsBetaApplications.
const BUSINESS_TABLES = [
  auralabelsActivities,
  auralabelsAiActions,
  auralabelsCampaigns,
  auralabelsTasks,
  auralabelsContracts,
  auralabelsReleases,
  auralabelsDemos,
  auralabelsArtists,
  auralabelsRevenue,
] as const;

/**
 * POST /api/admin/clear-data
 * Deletes all business data from every auralabels_* table while
 * preserving users and beta applications. Tenant-scoped: only
 * deletes data belonging to the requesting admin's tenant.
 * Super admins (tenantId: null) can clear all data.
 * Requires admin role.
 */
async function clearDataHandler(
  req: Request,
  corsHeaders: CorsHeaders,
  db: NonNullable<ReturnType<typeof getDb>>,
  tenantId: string | null,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonBadRequest("Method not allowed", corsHeaders);
  }

  const body = await parseBody(req);
  const confirm = String(body?.confirm ?? "");
  if (confirm !== "DELETE ALL DATA") {
    return jsonBadRequest(
      'Send {"confirm": "DELETE ALL DATA"} to confirm',
      corsHeaders,
    );
  }

  const counts: Record<string, number> = {};
  for (const table of BUSINESS_TABLES) {
    const tableAny = table as unknown as { tenantId?: unknown; _?: { name: string } };
    const tableName = tableAny._?.name ?? "unknown";
    if (tenantId && tableAny.tenantId !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await db.delete(table as any).where(eq(tableAny.tenantId as any, tenantId));
      counts[tableName] = (result as { rowCount?: number })?.rowCount ?? 0;
    } else {
      const result = await db.delete(table);
      counts[tableName] = (result as { rowCount?: number })?.rowCount ?? 0;
    }
  }

  // Also clear beta applications (not tenant-scoped)
  const betaResult = await db.delete(auralabelsBetaApplications);
  counts["auralabels_beta_applications"] = (betaResult as { rowCount?: number })?.rowCount ?? 0;

  console.log("[api] Cleared all business data:", counts);
  return jsonOk({ status: "ok", deleted: counts }, corsHeaders);
}

/**
 * GET /api/admin/export
 * Exports tenant-scoped label data as a JSON object keyed by table name.
 * auralabelsUsers is included so the admin can migrate users to a new DB.
 * Password hashes are included (they're needed for a working import).
 * Super admins (tenantId: null) export all data across all tenants.
 */
async function exportDataHandler(
  corsHeaders: CorsHeaders,
  db: NonNullable<ReturnType<typeof getDb>>,
  tenantId: string | null,
): Promise<Response> {
  const data: Record<string, unknown[]> = {};

  // Export all business tables with tenant filtering (super admins see all)
  data.artists = tenantId
    ? await db.select().from(auralabelsArtists).where(eq(auralabelsArtists.tenantId, tenantId)).orderBy(auralabelsArtists.name)
    : await db.select().from(auralabelsArtists).orderBy(auralabelsArtists.name);
  data.releases = tenantId
    ? await db.select().from(auralabelsReleases).where(eq(auralabelsReleases.tenantId, tenantId)).orderBy(auralabelsReleases.releaseDate)
    : await db.select().from(auralabelsReleases).orderBy(auralabelsReleases.releaseDate);
  data.demos = tenantId
    ? await db.select().from(auralabelsDemos).where(eq(auralabelsDemos.tenantId, tenantId)).orderBy(auralabelsDemos.receivedDate)
    : await db.select().from(auralabelsDemos).orderBy(auralabelsDemos.receivedDate);
  data.contracts = tenantId
    ? await db.select().from(auralabelsContracts).where(eq(auralabelsContracts.tenantId, tenantId)).orderBy(auralabelsContracts.createdAt)
    : await db.select().from(auralabelsContracts).orderBy(auralabelsContracts.createdAt);
  data.tasks = tenantId
    ? await db.select().from(auralabelsTasks).where(eq(auralabelsTasks.tenantId, tenantId)).orderBy(auralabelsTasks.dueDate)
    : await db.select().from(auralabelsTasks).orderBy(auralabelsTasks.dueDate);
  data.campaigns = tenantId
    ? await db.select().from(auralabelsCampaigns).where(eq(auralabelsCampaigns.tenantId, tenantId)).orderBy(auralabelsCampaigns.createdAt)
    : await db.select().from(auralabelsCampaigns).orderBy(auralabelsCampaigns.createdAt);
  data.aiActions = tenantId
    ? await db.select().from(auralabelsAiActions).where(eq(auralabelsAiActions.tenantId, tenantId)).orderBy(auralabelsAiActions.createdAt)
    : await db.select().from(auralabelsAiActions).orderBy(auralabelsAiActions.createdAt);
  data.activities = tenantId
    ? await db.select().from(auralabelsActivities).where(eq(auralabelsActivities.tenantId, tenantId))
    : await db.select().from(auralabelsActivities);
  data.revenue = tenantId
    ? await db.select().from(auralabelsRevenue).where(eq(auralabelsRevenue.tenantId, tenantId)).orderBy(auralabelsRevenue.updatedAt).limit(1)
    : await db.select().from(auralabelsRevenue).orderBy(auralabelsRevenue.updatedAt).limit(1);
  data.betaApplications = await db.select().from(auralabelsBetaApplications);

  // Users — include password hashes so the import can restore credentials
  const users = tenantId
    ? await db
      .select({
        id: auralabelsUsers.id,
        username: auralabelsUsers.username,
        passwordHash: auralabelsUsers.passwordHash,
        role: auralabelsUsers.role,
        tenantId: auralabelsUsers.tenantId,
        disabled: auralabelsUsers.disabled,
        createdAt: auralabelsUsers.createdAt,
        updatedAt: auralabelsUsers.updatedAt,
      })
      .from(auralabelsUsers)
      .where(eq(auralabelsUsers.tenantId, tenantId))
      .orderBy(auralabelsUsers.createdAt)
    : await db
      .select({
        id: auralabelsUsers.id,
        username: auralabelsUsers.username,
        passwordHash: auralabelsUsers.passwordHash,
        role: auralabelsUsers.role,
        tenantId: auralabelsUsers.tenantId,
        disabled: auralabelsUsers.disabled,
        createdAt: auralabelsUsers.createdAt,
        updatedAt: auralabelsUsers.updatedAt,
      })
      .from(auralabelsUsers)
      .orderBy(auralabelsUsers.createdAt);
  data.users = users;

  // Attach metadata
  const meta = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    rowCounts: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v.length]),
    ),
  };

  return jsonOk({ status: "ok", meta, data }, corsHeaders);
}

/**
 * POST /api/admin/import
 * Imports label data from a JSON object keyed by table name.
 * Clears existing business data for the tenant before importing.
 * Preserves existing users — only imports users if the table is empty.
 * All imported rows are assigned the requesting admin's tenantId.
 */
async function importDataHandler(
  req: Request,
  corsHeaders: CorsHeaders,
  db: NonNullable<ReturnType<typeof getDb>>,
  tenantId: string | null,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonBadRequest("Method not allowed", corsHeaders);
  }

  const body = await parseBody(req);
  if (!body || !body.data || typeof body.data !== "object") {
    return jsonBadRequest(
      'Request body must include a "data" object with table arrays',
      corsHeaders,
    );
  }

  const importData = body.data as Record<string, unknown[]>;
  const counts: Record<string, number> = {};

  // Check for users import
  if (Array.isArray(importData.users) && importData.users.length > 0) {
    const existingUsers = await db
      .select()
      .from(auralabelsUsers)
      .limit(1);
    if (existingUsers.length === 0) {
      // Only import users if the table is empty
      for (const user of importData.users) {
        const u = user as Record<string, unknown>;
        await db.insert(auralabelsUsers).values({
          id: String(u.id ?? generateId("user")),
          username: String(u.username ?? ""),
          passwordHash: String(u.passwordHash ?? ""),
          role: String(u.role ?? "user"),
          tenantId: u.tenantId ? String(u.tenantId) : null,
          disabled: Boolean(u.disabled ?? false),
          createdAt: u.createdAt ? new Date(String(u.createdAt)) : nowDate(),
          updatedAt: u.updatedAt ? new Date(String(u.updatedAt)) : nowDate(),
        });
      }
      counts.users = importData.users.length;
    } else {
      counts.users = 0;
      console.log("[api] Import: users table not empty — skipped user import");
    }
  }

  // Clear existing business data for the tenant
  for (const table of BUSINESS_TABLES) {
    const tAny = table as unknown as { tenantId?: unknown; _?: { name: string } };
    if (tenantId && tAny.tenantId !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.delete(table as any).where(eq(tAny.tenantId as any, tenantId));
    } else {
      await db.delete(table);
    }
  }
  await db.delete(auralabelsBetaApplications);

  // Table inserters — maps table name to (table, default column)
  type TableInserter = {
    insert: (rows: unknown[]) => Promise<void>;
    name: string;
  };

  const inserters: TableInserter[] = [
    {
      name: "artists",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsArtists).values({
            id: String(row.id ?? generateId("artist")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            name: String(row.name ?? ""),
            label: String(row.label ?? ""),
            status: String(row.status ?? "active"),
            imageUrl: String(row.imageUrl ?? ""),
            genres: row.genres ?? [],
            socialLinks: row.socialLinks ?? [],
            totalReleases: Number(row.totalReleases ?? 0),
            signedSince: String(row.signedSince ?? ""),
            bio: String(row.bio ?? ""),
            createdAt: row.createdAt ? new Date(String(row.createdAt)) : nowDate(),
            updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : nowDate(),
          });
        }
      },
    },
    {
      name: "releases",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsReleases).values({
            id: String(row.id ?? generateId("release")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            catalogNumber: String(row.catalogNumber ?? ""),
            title: String(row.title ?? ""),
            artist: String(row.artist ?? ""),
            artistId: String(row.artistId ?? ""),
            status: String(row.status ?? "draft"),
            priority: String(row.priority ?? "medium"),
            releaseDate: String(row.releaseDate ?? ""),
            tracks: row.tracks ?? [],
            artworkUrl: String(row.artworkUrl ?? ""),
            genres: row.genres ?? [],
            launchChecklist: row.launchChecklist ?? [],
            readinessPercentage: Number(row.readinessPercentage ?? 0),
            promoAssetsReady: Boolean(row.promoAssetsReady ?? false),
            distributorSubmitted: Boolean(row.distributorSubmitted ?? false),
            needsAttention: Boolean(row.needsAttention ?? false),
            createdAt: row.createdAt ? new Date(String(row.createdAt)) : nowDate(),
            updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : nowDate(),
          });
        }
      },
    },
    {
      name: "demos",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsDemos).values({
            id: String(row.id ?? generateId("demo")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            artistName: String(row.artistName ?? ""),
            email: String(row.email ?? ""),
            instagram: String(row.instagram ?? ""),
            trackTitle: String(row.trackTitle ?? ""),
            genre: String(row.genre ?? ""),
            duration: String(row.duration ?? ""),
            bpm: Number(row.bpm ?? 0),
            key: String(row.key ?? ""),
            receivedDate: String(row.receivedDate ?? ""),
            status: String(row.status ?? "new"),
            rating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : null,
            labelFit: row.labelFit ? String(row.labelFit) : null,
            privateLink: String(row.privateLink ?? ""),
            audioUrl: String(row.audioUrl ?? ""),
            notes: String(row.notes ?? ""),
            nextAction: row.nextAction ? String(row.nextAction) : null,
          });
        }
      },
    },
    {
      name: "contracts",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsContracts).values({
            id: String(row.id ?? generateId("contract")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            artist: String(row.artist ?? ""),
            artistId: String(row.artistId ?? ""),
            type: String(row.type ?? "exclusive"),
            status: String(row.status ?? "draft"),
            priority: String(row.priority ?? "medium"),
            signedDate: row.signedDate ? String(row.signedDate) : null,
            expiryDate: row.expiryDate ? String(row.expiryDate) : null,
            revenueShare: Number(row.revenueShare ?? 50),
            value: Number(row.value ?? 0),
            rights: String(row.rights ?? ""),
            gdprStatus: String(row.gdprStatus ?? "pending"),
            ipiStatus: String(row.ipiStatus ?? "pending"),
            fileUrl: row.fileUrl ? String(row.fileUrl) : null,
            nextAction: row.nextAction ? String(row.nextAction) : null,
            notes: String(row.notes ?? ""),
            createdAt: row.createdAt ? new Date(String(row.createdAt)) : nowDate(),
            updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : nowDate(),
          });
        }
      },
    },
    {
      name: "tasks",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsTasks).values({
            id: String(row.id ?? generateId("task")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            title: String(row.title ?? ""),
            description: String(row.description ?? ""),
            status: String(row.status ?? "todo"),
            priority: String(row.priority ?? "medium"),
            category: String(row.category ?? "admin"),
            dueDate: String(row.dueDate ?? ""),
            assignee: String(row.assignee ?? ""),
            relatedToType: row.relatedToType ? String(row.relatedToType) : null,
            relatedToId: row.relatedToId ? String(row.relatedToId) : null,
            relatedToTitle: row.relatedToTitle ? String(row.relatedToTitle) : null,
            overdue: Boolean(row.overdue ?? false),
            createdAt: row.createdAt ? new Date(String(row.createdAt)) : nowDate(),
            updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : nowDate(),
          });
        }
      },
    },
    {
      name: "campaigns",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsCampaigns).values({
            id: String(row.id ?? generateId("campaign")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            name: String(row.name ?? ""),
            releaseId: String(row.releaseId ?? ""),
            releaseTitle: String(row.releaseTitle ?? ""),
            artist: String(row.artist ?? ""),
            status: String(row.status ?? "planning"),
            priority: String(row.priority ?? "medium"),
            startDate: String(row.startDate ?? ""),
            endDate: String(row.endDate ?? ""),
            platforms: row.platforms ?? [],
            budget: Number(row.budget ?? 0),
            impressions: Number(row.impressions ?? 0),
            engagements: Number(row.engagements ?? 0),
            promoPoolStatus: String(row.promoPoolStatus ?? "not_started"),
            djFeedbackStatus: String(row.djFeedbackStatus ?? "not_started"),
            instagramContentStatus: String(row.instagramContentStatus ?? "not_started"),
            youtubeTeaserStatus: String(row.youtubeTeaserStatus ?? "not_started"),
            beatportFeaturePitchStatus: String(row.beatportFeaturePitchStatus ?? "not_started"),
            spotifyPitchStatus: String(row.spotifyPitchStatus ?? "not_started"),
            emailBlastStatus: String(row.emailBlastStatus ?? "not_started"),
            campaignChecklist: row.campaignChecklist ?? [],
            readinessPercentage: Number(row.readinessPercentage ?? 0),
            missingContent: row.missingContent ?? [],
            nextAction: String(row.nextAction ?? ""),
            createdAt: row.createdAt ? new Date(String(row.createdAt)) : nowDate(),
            updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : nowDate(),
          });
        }
      },
    },
    {
      name: "aiActions",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsAiActions).values({
            id: String(row.id ?? generateId("ai-action")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            action: String(row.action ?? ""),
            description: String(row.description ?? ""),
            category: String(row.category ?? "analysis"),
            priority: String(row.priority ?? "medium"),
            createdAt: row.createdAt ? new Date(String(row.createdAt)) : nowDate(),
            used: Boolean(row.used ?? false),
          });
        }
      },
    },
    {
      name: "activities",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsActivities).values({
            id: String(row.id ?? generateId("activity")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            artistId: String(row.artistId ?? ""),
            artistName: String(row.artistName ?? ""),
            action: String(row.action ?? ""),
            timestamp: String(row.timestamp ?? new Date().toISOString()),
            type: String(row.type ?? "note"),
          });
        }
      },
    },
    {
      name: "revenue",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsRevenue).values({
            id: String(row.id ?? generateId("revenue")),
            tenantId: String(row.tenantId ?? tenantId ?? "default"),
            totalRevenue: Number(row.totalRevenue ?? 0),
            monthlyRevenue: Number(row.monthlyRevenue ?? 0),
            pendingPayouts: Number(row.pendingPayouts ?? 0),
            currency: String(row.currency ?? "EUR"),
            revenueByArtist: row.revenueByArtist ?? [],
            revenueByRelease: row.revenueByRelease ?? [],
            updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : nowDate(),
          });
        }
      },
    },
    {
      name: "betaApplications",
      insert: async (rows) => {
        for (const r of rows) {
          const row = r as Record<string, unknown>;
          await db.insert(auralabelsBetaApplications).values({
            id: String(row.id ?? generateId("beta-app")),
            name: String(row.name ?? ""),
            email: String(row.email ?? ""),
            label: String(row.label ?? ""),
            role: String(row.role ?? "Not specified"),
            notes: String(row.notes ?? ""),
            status: String(row.status ?? "pending"),
            reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
            reviewedAt: row.reviewedAt ? new Date(String(row.reviewedAt)) : null,
            createdAt: row.createdAt ? new Date(String(row.createdAt)) : nowDate(),
            updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : nowDate(),
          });
        }
      },
    },
  ];

  for (const inserter of inserters) {
    const rows = importData[inserter.name];
    if (Array.isArray(rows) && rows.length > 0) {
      await inserter.insert(rows);
      counts[inserter.name] = rows.length;
    }
  }

  console.log("[api] Imported data:", counts);
  return jsonOk({ status: "ok", imported: counts }, corsHeaders);
}
