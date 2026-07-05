/**
 * Database integration test setup.
 *
 * Connects to a test database using DATABASE_URL from the environment.
 * Skips gracefully if DATABASE_URL is not set or unreachable.
 *
 * DB availability is probed by global-setup.ts BEFORE test modules
 * load so itDb/itDb fixtures skip correctly even when the connection
 * is down (wrong credentials, network error, etc.).
 *
 * Build the shared schema before running tests:
 *   cd packages/db && npm run build
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../src/schema.js";
import { beforeAll, afterEach } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * True when the test database is reachable — set by global-setup.ts.
 * Evaluated at module-load time so itDb/itDb skip correctly even
 * when DATABASE_URL is set but the connection handshake fails.
 */
export const isDbAvailable = process.env.DB_AVAILABLE === "true";

/** The Drizzle client — only valid when isDbAvailable is true. */
export let db: ReturnType<typeof drizzle<typeof schema>>;

// All auralabels tables in deletion-dependency order (leaves first).
const ALL_TABLES = [
  schema.auralabelsActivities,
  schema.auralabelsAiActions,
  schema.auralabelsCampaigns,
  schema.auralabelsTasks,
  schema.auralabelsContracts,
  schema.auralabelsReleases,
  schema.auralabelsDemos,
  schema.auralabelsArtists,
  schema.auralabelsRevenue,
  schema.auralabelsBetaApplications,
  schema.auralabelsUsers,
] as const;

beforeAll(async () => {
  if (!isDbAvailable || !DATABASE_URL) {
    console.warn("⚠ Database not available — CRUD tests will be skipped.");
    return;
  }

  const sql = neon(DATABASE_URL);
  db = drizzle(sql, { schema });
  console.log("✓ Test database connected");
});

/**
 * Clean all auralabels tables between tests. Deletes in dependency
 * order so foreign keys don't trip (activities reference artists, etc.).
 * Nexus tables (users, conversations, agents, etc.) are left untouched.
 */
export async function clearAllTables() {
  if (!db || !isDbAvailable) return;
  for (const table of ALL_TABLES) {
    await db.delete(table as Parameters<typeof db.delete>[0]);
  }
}

// Clean tables after each test for isolation.
afterEach(async () => {
  await clearAllTables();
});

/**
 * Helpers for generating stable test IDs.
 */
let _counter = 0;
export function testId(prefix: string): string {
  return `test-${prefix}-${++_counter}-${Date.now()}`;
}

export function resetCounter(): void {
  _counter = 0;
}
