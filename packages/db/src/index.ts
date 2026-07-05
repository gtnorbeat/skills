/**
 * Database client — lazy-initialized so it only connects when DATABASE_URL is set.
 *
 * Usage:
 *   import { getDb } from "@aura-labels/db";
 *   const db = getDb(); // returns null if DATABASE_URL is missing
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _initAttempted = false;

export function getDb() {
  if (_initAttempted) return _db;
  _initAttempted = true;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  try {
    const sql = neon(url);
    _db = drizzle(sql, { schema });
    return _db;
  } catch {
    return null;
  }
}

export { schema };
