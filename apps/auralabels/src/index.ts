/**
 * AURA Labels — Cloudflare Worker entry point.
 *
 * Routes:
 *   OPTIONS /api/*  — CORS preflight
 *   POST /api/login — authenticate (username + password → JWT)
 *   GET  /api/verify — token validation
 *   GET  /api/health — health check
 *   GET  /api/_health/live   — liveness probe
 *
 * All other /api/* routes require a valid Bearer token.
 *
 * Bootstrap: on first request, if the auralabels_users table is empty
 * and BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD are set,
 * the first admin user is created. Subsequent boots skip this.
 */
import { loginHandler } from "./routes/login.js";
import { authenticateRequest, isPublicPath } from "./auth.js";
import type { JwtPayload } from "./auth.js";
import { getDb } from "./db.js";
import { auralabelsUsers } from "@aura-labels/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { Env } from "./env.js";
import { demosHandler } from "./routes/demos.js";
import { artistsHandler } from "./routes/artists.js";
import { releasesHandler } from "./routes/releases.js";
import { contractsHandler } from "./routes/contracts.js";
import { tasksHandler } from "./routes/tasks.js";
import { campaignsHandler } from "./routes/campaigns.js";
import { aiActionsHandler } from "./routes/ai-actions.js";
import { activitiesHandler } from "./routes/activities.js";
import { notificationsHandler } from "./routes/notifications.js";
import { revenueHandler } from "./routes/revenue.js";
import { adminHandler } from "./routes/admin.js";
import { betaApplicationsHandler } from "./routes/beta-applications.js";
import { aiGenerateHandler } from "./routes/ai-generate.js";
import { filesHandler, cleanupHandler } from "./routes/files.js";
import { webhookHandler } from "./routes/webhook.js";
import { registerHandler } from "./routes/register.js";
import type { CorsHeaders } from "./routes/helpers.js";
import type { ScheduledController } from "./env.js";

// ── Bootstrap admin (idempotent — runs once when users table is empty) ──

let bootstrapPromise: Promise<void> | null = null;

/** Exported for integration testing. */
export { bootstrapPromise };

/** Test-only: reset bootstrapPromise so tests get a fresh bootstrap on each run. */
export function resetBootstrapForTest(): void {
  bootstrapPromise = null;
}

/**
 * Bootstrap the first admin user if the users table is empty.
 * Exported for integration testing — tests call this directly with a mock DB.
 */
export async function bootstrapAdminIfNeeded(env: Env): Promise<void> {
  // If we've already succeeded, return the cached promise immediately.
  if (bootstrapPromise) return bootstrapPromise;

  const u = env.BOOTSTRAP_ADMIN_USERNAME;
  const p = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!u || !p) return; // Secrets not set yet — retry on next request

  const db = getDb(env.DATABASE_URL);
  if (!db) return; // DB not reachable yet — retry on next request

  // Don't set bootstrapPromise until we know the outcome. If an early
  // return happened above (missing secrets, cold DB), the next request
  // will try again. Once we commit to trying, cache the promise so
  // concurrent requests dedupe.
  bootstrapPromise = (async () => {
    try {
      const rows = await db
        .select()
        .from(auralabelsUsers)
        .where(eq(auralabelsUsers.username, u))
        .limit(1);

      if (rows.length > 0) {
        console.log(`[auth] Bootstrap user "${u}" already exists — skipping`);
        return; // already bootstrapped — promise stays cached (success)
      }

      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const hash = await bcrypt.hash(p, 10);

      await db.insert(auralabelsUsers).values({
        id,
        username: u,
        passwordHash: hash,
        role: "admin",
        tenantId: null,
        disabled: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });

      console.log(`[auth] Bootstrapped admin user "${u}" from BOOTSTRAP_ADMIN_* env vars`);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === "23505" || /unique constraint/i.test(e?.message ?? "")) {
        // Sibling boot already created the user — outcome is final,
        // cache the resolved promise to skip future DB round-trips.
        console.log(`[auth] Bootstrap user "${u}" already exists (race won by a sibling boot)`);
        bootstrapPromise = Promise.resolve();
        return;
      }

      // Reset the cached promise on transient failures (Neon cold-start
      // timeouts, connection drops) so the next request retries.
      bootstrapPromise = null;
      console.error("[auth] Bootstrap admin failed:", err);
    }
  })();

  return bootstrapPromise;
}

export default {
  // ── Scheduled handler (cron trigger) ────────────────────────────
  /**
   * Daily cleanup of R2 files older than 90 days.
   * Triggered by the cron schedule in wrangler.toml.
   */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    console.log("[cron] Running scheduled R2 cleanup...");
    await cleanupHandler(env);
  },

  // ── Incoming email handler (Cloudflare Email Routing) ────────────
  /**
   * Handles incoming emails forwarded by Cloudflare Email Routing.
   * Forwards to the team inbox and sends a notification via the send_email binding.
   */
  async email(message: {
    from: string;
    to: string;
    forward(addr: string): Promise<void>;
    headers: Map<string, string>;
  }, env: Env): Promise<void> {
    try {
      // Forward the incoming email to the team inbox
      await message.forward("team@auralabels.app");

      // Send a notification email about the incoming message
      if (env.SEND_EMAIL) {
        await env.SEND_EMAIL.send({
          from: message.to,
          to: "team@auralabels.app",
          subject: `📬 New email from ${message.from}`,
          text: `New email received from ${message.from}\n\nReply to: ${message.from}\n\n(This is an automated notification — the original email has been forwarded to your inbox.)`,
        });
      }
    } catch (err) {
      console.error("[email] Failed to process incoming email:", err);
    }
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    // CORS headers for the SPA frontend
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "DELETE, GET, PATCH, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    try {
      // ── Bootstrap admin on first request ──────────────────────
      await bootstrapAdminIfNeeded(env);

      // ── Public routes (no auth required) ──────────────────────

      // Health check
      if (pathname === "/api/health" || pathname === "/api/_health/live") {
        return new Response(
          JSON.stringify({ status: "ok" }),
          { status: 200, headers: corsHeaders },
        );
      }

      // Login
      if (pathname === "/api/login") {
        return loginHandler(req, env, corsHeaders);
      }

      // Token verify (middleware already verified — just confirm)
      if (pathname === "/api/verify") {
        if (!env.JWT_SECRET) {
          return new Response(
            JSON.stringify({ status: "error", message: "Server not configured" }),
            { status: 500, headers: corsHeaders },
          );
        }
        const user = await authenticateRequest(req, env.JWT_SECRET);
        if (!user) {
          return new Response(
            JSON.stringify({ status: "error", message: "Invalid or expired token" }),
            { status: 401, headers: corsHeaders },
          );
        }
        return new Response(
          JSON.stringify({ status: "ok", user: { username: user.username, role: user.role } }),
          { status: 200, headers: corsHeaders },
        );
      }

      // ── Public GET /api/files/* (file serving) ────────────────
      // Browsers and <img> tags don't send Authorization headers, so file
      // serving must be public. POST and DELETE still go through auth below.
      if (req.method === "GET" && pathname.startsWith("/api/files/")) {
        return filesHandler(req, env, corsHeaders, url);
      }

      // ── Auth gate for all other /api/* routes ─────────────────

      if (pathname.startsWith("/api/")) {
        if (!env.JWT_SECRET) {
          return new Response(
            JSON.stringify({ status: "error", message: "Server not configured" }),
            { status: 500, headers: corsHeaders },
          );
        }

        // isPublicPath gates /api/webhook, /api/register, /api/beta-applications,
        // and other future routes that don't need JWT auth (webhook uses IP rate
        // limiting, register uses honeypot + rate limiting).
        let authenticatedUser: JwtPayload | null = null;

        // Webhook (Make.com → demo inbox) — public, rate-limited
        if (pathname.startsWith("/api/webhook")) {
          return webhookHandler(req, env, corsHeaders);
        }

        // Register (self-service tenant onboarding) — public, rate-limited + honeypot
        if (pathname === "/api/register") {
          return registerHandler(req, env, corsHeaders);
        }

        if (!isPublicPath(pathname)) {
          authenticatedUser = await authenticateRequest(req, env.JWT_SECRET);
          if (!authenticatedUser) {
            return new Response(
              JSON.stringify({
                status: "error",
                message: "Unauthorized — missing or invalid token",
              }),
              { status: 401, headers: corsHeaders },
            );
          }
        }

        // ── CRUD route dispatching ────────────────────────────────
        type RouteHandler = (req: Request, env: Env, corsHeaders: CorsHeaders, url: URL, user: JwtPayload | null) => Promise<Response>;
        const routes: Record<string, RouteHandler> = {
          "/api/ai/generate": async (req, env, corsHeaders, _url, _user) => aiGenerateHandler(req, env, corsHeaders),
          "/api/files": async (req, env, corsHeaders, url, _user) => filesHandler(req, env, corsHeaders, url),
          "/api/demos": async (req, env, corsHeaders, _url, user) => demosHandler(req, env, corsHeaders, user),
          "/api/artists": async (req, env, corsHeaders, _url, user) => artistsHandler(req, env, corsHeaders, user),
          "/api/releases": async (req, env, corsHeaders, _url, user) => releasesHandler(req, env, corsHeaders, user),
          "/api/contracts": async (req, env, corsHeaders, _url, user) => contractsHandler(req, env, corsHeaders, user),
          "/api/tasks": async (req, env, corsHeaders, _url, user) => tasksHandler(req, env, corsHeaders, user),
          "/api/campaigns": async (req, env, corsHeaders, _url, user) => campaignsHandler(req, env, corsHeaders, user),
          "/api/ai-actions": async (req, env, corsHeaders, _url, user) => aiActionsHandler(req, env, corsHeaders, user),
          "/api/activities": async (req, env, corsHeaders, _url, user) => activitiesHandler(req, env, corsHeaders, user),
          "/api/notifications": async (req, env, corsHeaders, _url, user) => notificationsHandler(req, env, corsHeaders, user),
          "/api/revenue": async (req, env, corsHeaders, _url, user) => revenueHandler(req, env, corsHeaders, user),
          "/api/admin": async (req, env, corsHeaders, url, user) => adminHandler(req, env, corsHeaders, url, user),
          "/api/beta-applications": async (req, env, corsHeaders, _url, _user) => betaApplicationsHandler(req, env, corsHeaders),
        };

        // Match the route prefix
        for (const [prefix, handler] of Object.entries(routes)) {
          if (pathname === prefix || pathname.startsWith(prefix + "/")) {
            return handler(req, env, corsHeaders, url, authenticatedUser);
          }
        }

        // Fallback: route not found among migrated handlers
        return new Response(
          JSON.stringify({ status: "error", message: "Route not found" }),
          { status: 404, headers: corsHeaders },
        );
      }

      // ── Landing page — serve a minimal coming-soon page for non-API requests
      const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="dark">
<title>AURA — A&R Utility & Resources AI Assistant</title>
<meta name="description" content="AURA — A&R Utility & Resources AI Assistant for independent labels. Coming soon.">
<meta property="og:type" content="website">
<meta property="og:title" content="AURA — A&R Utility & Resources AI Assistant">
<meta property="og:description" content="Coming soon.">
<meta property="og:image" content="data:image/webp;base64,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">
<meta name="twitter:card" content="summary_large_image">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #09090b;
    color: #e4e4e7;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 2rem;
  }
  .card {
    text-align: center;
    max-width: 480px;
  }
  .logo {
    width: 180px;
    height: auto;
    margin-bottom: 2rem;
    filter: drop-shadow(0 0 40px rgba(168, 85, 247, 0.3));
    animation: pulse-glow 4s ease-in-out infinite;
  }
  @keyframes pulse-glow {
    0%, 100% { filter: drop-shadow(0 0 40px rgba(168, 85, 247, 0.3)); }
    50% { filter: drop-shadow(0 0 60px rgba(168, 85, 247, 0.5)); }
  }
  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #fafafa;
    margin-bottom: 0.5rem;
  }
  .subtitle {
    font-size: 0.875rem;
    color: #a1a1aa;
    line-height: 1.6;
    margin-bottom: 2rem;
  }
  .badge {
    display: inline-block;
    padding: 0.375rem 1.25rem;
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #c4b5fd;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .footer {
    margin-top: 3rem;
    font-size: 0.75rem;
    color: #52525b;
  }
</style>
</head>
<body>
<div class="card">
  <img class="logo" src="data:image/webp;base64,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" alt="AURA" width="180">
  <h1>AURA</h1>
  <p class="subtitle">A&amp;R Utility &amp; Resources AI Assistant<br>for independent record labels</p>
  <span class="badge">Coming Soon</span>
  <p class="footer">auralabels.app</p>
</div>
</body>
</html>`;

      return new Response(landingHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err: unknown) {
      console.error("[worker] Unhandled error:", err);
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Internal error",
        }),
        { status: 500, headers: corsHeaders },
      );
    }
  },
};
