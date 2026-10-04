import { createPgliteDb } from "@/lib/db/drivers";
import { migrate } from "@/lib/db/migrate";
import type { Db } from "@/lib/db/types";

/** Fresh, fully migrated in-memory Postgres (PGlite) per test file. */
export async function testDb(): Promise<Db> {
  const db = await createPgliteDb("memory://");
  await migrate(db);
  return db;
}
