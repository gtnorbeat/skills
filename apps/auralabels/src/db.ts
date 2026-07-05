/**
 * Database client — uses Drizzle ORM with Neon HTTP driver.
 *
 * Mirrors the pattern from apps/internal-worker/src/db.ts.
 * Uses the shared schema from @aura-labels/db.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@aura-labels/db/schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Returns a Drizzle ORM client bound to the Neon database via HTTP.
 * Returns null if DATABASE_URL is missing.
 */
export function getDb(
  databaseUrl?: string,
): ReturnType<typeof drizzle<typeof schema>> | null {
  if (_db) return _db;

  if (!databaseUrl) return null;

  try {
    const sql = neon(databaseUrl);
    _db = drizzle(sql, { schema });
    return _db;
  } catch {
    return null;
  }
}
