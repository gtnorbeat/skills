/**
 * Vitest global setup — runs once before all test files.
 *
 * Probes the test database and exports DB_AVAILABLE = "true"
 * or "false" so crud.test.ts can skip gracefully when the
 * database is unreachable (wrong credentials, network down, etc.)
 * instead of crashing the entire CI pipeline.
 *
 * This runs BEFORE modules are evaluated, so the `itDb` fixture
 * can be decided at module-load time.
 */
import { neon } from "@neondatabase/serverless";

export async function setup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.warn("⚠  DATABASE_URL not set — CRUD tests will be skipped.");
    process.env.DB_AVAILABLE = "false";
    return;
  }

  try {
    const sql = neon(dbUrl);
    await sql`SELECT 1`;
    process.env.DB_AVAILABLE = "true";
    console.log("✓ Test database reachable");
  } catch (err) {
    console.warn(
      "⚠  Test database unreachable — CRUD tests will be skipped.",
      err instanceof Error ? err.message : String(err),
    );
    process.env.DB_AVAILABLE = "false";
  }
}

export function teardown(): void {
  // nothing to clean up
}
