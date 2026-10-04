import "server-only";
import { createPgliteDb, createPostgresDb } from "./drivers";
import { migrate } from "./migrate";
import type { Db } from "./types";

export type { Db, Row } from "./types";

/**
 * Process-wide database handle. Cached on globalThis so Next.js dev reloads
 * (and multiple bundles in one process) share a single PGlite instance.
 */
const g = globalThis as unknown as { __faDb?: Promise<Db> };

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return createPostgresDb(url);

  const dir = process.env.PGLITE_DATA_DIR ?? ".data/pglite";
  const db = await createPgliteDb(dir);
  // Local convenience: keep the embedded database migrated (and optionally seeded).
  await migrate(db);
  if (process.env.AUTO_SEED === "true" && process.env.NODE_ENV !== "production") {
    const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from profiles");
    if (n === 0) {
      const { seedDatabase } = await import("@/lib/seed/seed");
      await seedDatabase(db, { log: (m) => console.log(`[seed] ${m}`) });
    }
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__faDb) {
    g.__faDb = init().catch((err) => {
      g.__faDb = undefined;
      throw err;
    });
  }
  return g.__faDb;
}

/** For tests: inject an isolated database. */
export function setDbForTests(db: Db | undefined) {
  g.__faDb = db ? Promise.resolve(db) : undefined;
}
