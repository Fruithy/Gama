/**
 * Database CLI.
 *   npm run db:migrate   apply supabase/migrations/*.sql
 *   npm run db:seed      insert development data (refuses in production)
 *   npm run db:unseed    remove all seeded profiles and their data
 *   npm run db:reset     wipe local PGlite data dir, migrate and seed
 *
 * Targets DATABASE_URL when set, otherwise the local PGlite directory.
 */
import { rm } from "node:fs/promises";
import { createPgliteDb, createPostgresDb } from "../src/lib/db/drivers";
import { migrate } from "../src/lib/db/migrate";
import { seedDatabase, unseedDatabase } from "../src/lib/seed/seed";
import { loadEnv } from "./env";

loadEnv();
const cmd = process.argv[2];
const force = process.argv.includes("--force");

async function open() {
  if (process.env.DATABASE_URL) return createPostgresDb(process.env.DATABASE_URL);
  return createPgliteDb(process.env.PGLITE_DATA_DIR ?? ".data/pglite");
}

async function main() {
  if (cmd === "reset") {
    if (process.env.DATABASE_URL) throw new Error("db:reset only works on the local PGlite database.");
    await rm(process.env.PGLITE_DATA_DIR ?? ".data/pglite", { recursive: true, force: true });
  }
  const db = await open();
  try {
    await migrate(db, { log: console.log });
    if (cmd === "seed" || cmd === "reset") {
      const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from profiles where is_seed");
      if (n > 0 && !force) console.log("Seed data already present (use --force to add more).");
      else await seedDatabase(db, { log: (m) => console.log(`[seed] ${m}`), force });
    } else if (cmd === "unseed") {
      await unseedDatabase(db);
      console.log("Seed data removed.");
    } else if (cmd !== "migrate" && cmd !== "reset") {
      console.log("usage: tsx scripts/db.ts <migrate|seed|unseed|reset> [--force]");
    }
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
