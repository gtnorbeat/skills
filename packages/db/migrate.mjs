import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import crypto from "crypto";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);
const db = drizzle(sql);

/**
 * Previous CI runs with `drizzle-kit migrate` + `pg` driver partially applied
 * DDL before hanging (Neon scale-to-zero + pg SSL incompatibility). Tables
 * exist but `drizzle.__drizzle_migrations` was never committed.
 *
 * This heals that state by pre-seeding the migration journal with hashes of
 * migrations that were already applied, so `migrate()` skips them cleanly.
 */
async function healPartialMigrations() {
  const check = await sql`SELECT 1 FROM pg_tables WHERE tablename = 'auralabels_activities'`;

  if (check.length === 0) {
    console.log("Fresh database — no healing needed.");
    return;
  }

  console.log("Found existing tables. Healing drizzle migrations journal...");

  await sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
  await sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const appliedFiles = [
    "0000_red_steel_serpent.sql",
    "0001_add_auralabels_tables.sql",
  ];

  for (const file of appliedFiles) {
    const content = fs.readFileSync(join(__dirname, "drizzle", file), "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    const exists = await sql`SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = ${hash}`;
    if (exists.length === 0) {
      await sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`;
      console.log(`  Marked ${file} as already applied.`);
    }
  }

  console.log("Journal healed. Proceeding with pending migrations...");
}

try {
  await healPartialMigrations();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully.");
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
}
