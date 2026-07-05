/**
 * GET /api/notifications — build a notification feed from across all entities (tenant-scoped).
 *
 * Returns notifications for:
 *   - Tasks due within 3 days (high/critical priority)
 *   - Overdue tasks
 *   - Releases needing attention
 *   - Contracts expiring within 30 days or already expired
 *   - Demos awaiting review
 *   - Artists missing info (bio, image, Instagram)
 */
import { getDb } from "../db.js";
import {
  auralabelsTasks,
  auralabelsReleases,
  auralabelsContracts,
  auralabelsDemos,
  auralabelsArtists,
} from "@aura-labels/db/schema";
import { eq, and, lte, gte, ne, or, isNotNull, inArray } from "drizzle-orm";
import type { Env } from "../env.js";
import type { JwtPayload } from "../auth.js";
import { jsonOk, jsonError, CorsHeaders } from "./helpers.js";

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string;
  link: string;
  createdAt: string;
  read: boolean;
}

export async function notificationsHandler(req: Request, env: Env, corsHeaders: CorsHeaders, user: JwtPayload | null): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  const db = getDb(env.DATABASE_URL);
  if (!db) return jsonError("Database not available", corsHeaders);

  const tenantId = user?.tenantId ?? null;

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const notifications: Notification[] = [];

    // Helper to add days to a date string
    const addDays = (dateStr: string, days: number): string => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    // Format date for Italian locale
    const fmtDate = (dateStr: string): string => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
    };

    const threeDaysFromNow = addDays(todayStr, 3);
    const thirtyDaysFromNow = addDays(todayStr, 30);

    // 1. Tasks due within 3 days (high/critical, not done)
    const tasksConditions = [
      ne(auralabelsTasks.status, "done"),
      inArray(auralabelsTasks.priority, ["high", "critical"]),
      lte(auralabelsTasks.dueDate, threeDaysFromNow),
      gte(auralabelsTasks.dueDate, todayStr),
    ];
    if (tenantId) tasksConditions.push(eq(auralabelsTasks.tenantId, tenantId));
    const tasksDueSoon = await db
      .select()
      .from(auralabelsTasks)
      .where(and(...tasksConditions))
      .orderBy(auralabelsTasks.dueDate);

    for (const t of tasksDueSoon) {
      notifications.push({
        id: `notif-task-due-${t.id}`,
        type: "task_due",
        title: "Task in scadenza",
        description: `${t.title} — due ${fmtDate(t.dueDate ?? "")}`,
        link: "/calendar",
        createdAt: now.toISOString(),
        read: false,
      });
    }

    // 2. Overdue tasks
    const overdueConditions = [
      eq(auralabelsTasks.overdue, true),
      ne(auralabelsTasks.status, "done"),
    ];
    if (tenantId) overdueConditions.push(eq(auralabelsTasks.tenantId, tenantId));
    const overdueTasks = await db
      .select()
      .from(auralabelsTasks)
      .where(and(...overdueConditions))
      .orderBy(auralabelsTasks.dueDate);

    for (const t of overdueTasks) {
      notifications.push({
        id: `notif-overdue-${t.id}`,
        type: "task_overdue",
        title: "Task in ritardo",
        description: `${t.title} — scaduto il ${fmtDate(t.dueDate ?? "")}`,
        link: "/calendar",
        createdAt: now.toISOString(),
        read: false,
      });
    }

    // 3. Releases needing attention
    const releaseConditions = [eq(auralabelsReleases.needsAttention, true)];
    if (tenantId) releaseConditions.push(eq(auralabelsReleases.tenantId, tenantId));
    const attentionReleases = await db
      .select()
      .from(auralabelsReleases)
      .where(and(...releaseConditions))
      .orderBy(auralabelsReleases.releaseDate);

    for (const r of attentionReleases) {
      notifications.push({
        id: `notif-release-${r.id}`,
        type: "release_attention",
        title: "Release da sistemare",
        description: `${r.catalogNumber} ${r.title} — ${r.artist} (ready ${r.readinessPercentage}%)`,
        link: "/releases",
        createdAt: now.toISOString(),
        read: false,
      });
    }

    // 4. Contracts expiring within 30 days or already expired
    const contractConditions = [
      or(
        and(isNotNull(auralabelsContracts.expiryDate), lte(auralabelsContracts.expiryDate, thirtyDaysFromNow)),
        eq(auralabelsContracts.status, "expired"),
      ),
    ];
    if (tenantId) contractConditions.push(eq(auralabelsContracts.tenantId, tenantId));
    const expiringContracts = await db
      .select()
      .from(auralabelsContracts)
      .where(and(...contractConditions))
      .orderBy(auralabelsContracts.expiryDate);

    for (const c of expiringContracts) {
      const isExpired = c.status === "expired" || (c.expiryDate ? new Date(c.expiryDate) < now : false);
      notifications.push({
        id: `notif-contract-${c.id}`,
        type: "contract_expiring",
        title: isExpired ? "Contratto scaduto" : "Contratto in scadenza",
        description: `${c.artist} — ${(c.type ?? "").replace("_", " ")} ${isExpired ? "scaduto" : `scade il ${fmtDate(c.expiryDate ?? "")}`}`,
        link: "/contracts",
        createdAt: now.toISOString(),
        read: false,
      });
    }

    // 5. Demos awaiting review
    const demoConditions = [inArray(auralabelsDemos.status, ["new", "listening"])];
    if (tenantId) demoConditions.push(eq(auralabelsDemos.tenantId, tenantId));
    const pendingDemos = await db
      .select()
      .from(auralabelsDemos)
      .where(and(...demoConditions))
      .orderBy(auralabelsDemos.receivedDate);

    for (const d of pendingDemos) {
      notifications.push({
        id: `notif-demo-${d.id}`,
        type: "demo_review",
        title: "Demo da recensire",
        description: `${d.artistName} — "${d.trackTitle}" (${d.genre})`,
        link: "/demo-inbox",
        createdAt: now.toISOString(),
        read: false,
      });
    }

    // 6. Artists missing info (bio, image, Instagram)
    const allArtists = tenantId
      ? await db.select().from(auralabelsArtists).where(eq(auralabelsArtists.tenantId, tenantId))
      : await db.select().from(auralabelsArtists);
    for (const a of allArtists) {
      const socialLinks: { platform?: string }[] = [];
      try {
        const parsed = typeof a.socialLinks === "string" ? JSON.parse(a.socialLinks as string) : (a.socialLinks as unknown[] ?? []);
        for (const s of parsed) {
          if (typeof s === "object" && s !== null) socialLinks.push(s as { platform?: string });
        }
      } catch { /* ignore parse errors */ }

      const missing: string[] = [];
      if (!a.bio) missing.push("bio");
      if (!a.imageUrl) missing.push("foto");
      if (!socialLinks.some((s) => s.platform?.toLowerCase().includes("instagram"))) missing.push("Instagram");
      if (missing.length > 0) {
        notifications.push({
          id: `notif-artist-${a.id}`,
          type: "artist_missing_info",
          title: "Informazioni artista mancanti",
          description: `${a.name} — manca: ${missing.join(", ")}`,
          link: "/artists",
          createdAt: now.toISOString(),
          read: false,
        });
      }
    }

    // Sort by type priority (most urgent first)
    const typeOrder = [
      "task_overdue", "contract_expiring", "release_attention",
      "task_due", "demo_review", "artist_missing_info",
    ];
    notifications.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));

    return jsonOk(notifications, corsHeaders);
  } catch (err) {
    console.error("[api] Error building notifications:", err);
    return jsonError("Internal server error", corsHeaders);
  }
}
