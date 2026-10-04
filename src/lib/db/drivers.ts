import type { Db, Row } from "./types";

/**
 * Database drivers.
 *  - postgres.js when DATABASE_URL is set (Supabase / any Postgres).
 *  - PGlite (Postgres compiled to WASM) otherwise — zero-setup local dev and
 *    fully isolated in-memory databases for tests. Same SQL, same migrations.
 */

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir && dataDir !== "memory://") {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dataDir, { recursive: true });
  }
  const pg = dataDir && dataDir !== "memory://" ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;

  type Queryable = { query: <T>(q: string, p?: unknown[]) => Promise<{ rows: T[] }>; exec: (q: string) => Promise<unknown> };
  const wrap = (q: Queryable, inTx: boolean): Db => ({
    kind: "pglite",
    async query<T = Row>(sql: string, params: unknown[] = []) {
      const res = await q.query<T>(sql, params);
      return res.rows;
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (inTx) return fn(wrap(q, true));
      return pg.transaction(async (t) => fn(wrap(t as unknown as Queryable, true)));
    },
    async close() {
      if (!inTx) await pg.close();
    },
  });
  return wrap(pg as unknown as Queryable, false);
}

export async function createPostgresDb(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    // Supabase's transaction-mode pooler does not support prepared statements.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    types: {
      // int8 → JS number (our scores/xp stay far below 2^53).
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      // Parse json/jsonb results; params are always sent pre-stringified with ::jsonb casts.
      json: { to: 114, from: [114, 3802], serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)), parse: (x: string) => JSON.parse(x) },
    },
    onnotice: () => {},
  });

  type Unsafe = { unsafe: (q: string, p?: unknown[]) => Promise<unknown> };
  const wrap = (q: Unsafe, inTx: boolean): Db => ({
    kind: "postgres",
    async query<T = Row>(text: string, params: unknown[] = []) {
      const rows = (await q.unsafe(text, params as never[])) as unknown as T[];
      return Array.from(rows);
    },
    async exec(text: string) {
      await q.unsafe(text);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (inTx) return fn(wrap(q, true));
      return (await sql.begin(async (t) => fn(wrap(t as unknown as Unsafe, true)))) as T;
    },
    async close() {
      if (!inTx) await sql.end({ timeout: 5 });
    },
  });
  return wrap(sql as unknown as Unsafe, false);
}
