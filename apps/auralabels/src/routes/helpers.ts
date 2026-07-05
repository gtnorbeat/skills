/**
 * Shared helpers for route handlers.
 *
 * Provides consistent ID generation, readiness calculation,
 * and convenient Response builders so each route handler doesn't
 * repeat the JSON.stringify + headers boilerplate.
 */

/** Standard JSON response header set used by every API route. */
export type CorsHeaders = Record<string, string>;

/** Generate a prefixed ID (e.g. "demo-1719000000-a1b2c"). */
export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Calculate readiness percentage from a checklist of required items. */
export function calculateReadiness(checklist: { required?: boolean; completed?: boolean }[]): number {
  const required = checklist.filter((i) => i.required);
  if (required.length === 0) return 0;
  const completed = required.filter((i) => i.completed).length;
  return Math.round((completed / required.length) * 100);
}

/** 200 JSON response. */
export function jsonOk(data: unknown, corsHeaders: CorsHeaders): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
}

/** 201 JSON response (created). */
export function jsonCreated(data: unknown, corsHeaders: CorsHeaders): Response {
  return new Response(JSON.stringify(data), { status: 201, headers: corsHeaders });
}

/** 400 JSON error response. */
export function jsonBadRequest(message: string, corsHeaders: CorsHeaders): Response {
  return new Response(
    JSON.stringify({ status: "error", message }),
    { status: 400, headers: corsHeaders },
  );
}

/** 404 JSON error response. */
export function jsonNotFound(message: string, corsHeaders: CorsHeaders): Response {
  return new Response(
    JSON.stringify({ status: "error", message }),
    { status: 404, headers: corsHeaders },
  );
}

/** 500 JSON error response. */
export function jsonError(message: string, corsHeaders: CorsHeaders): Response {
  return new Response(
    JSON.stringify({ status: "error", message }),
    { status: 500, headers: corsHeaders },
  );
}

/** Parse request body as JSON, returning null on failure. */
export async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return await req.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Return a timestamp string suitable for auralabels DB columns.
 * ISO 8601 without timezone.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Return a Date object for the current time.
 * Drizzle ORM's timestamp columns expect Date objects for INSERT/UPDATE.
 */
export function nowDate(): Date {
  return new Date();
}

/**
 * Today's date as YYYY-MM-DD (shared by notifications, demo defaults, etc.).
 */
export function todayDate(): string {
  return nowISO().split("T")[0];
}
