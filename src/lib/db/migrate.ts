import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./types";

/**
 * Minimal migration runner for local / self-hosted use. Supabase projects can
 * equally use `supabase db push` — the files are plain SQL either way.
 */
export const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export async function applyShimIfNeeded(db: Db) {
  const rows = await db.query<{ ok: boolean }>(
    "select exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'uid') as ok",
  );
  if (rows[0]?.ok) return;
  const shim = await readFile(path.join(process.cwd(), "src", "lib", "db", "shim.sql"), "utf8");
  await db.exec(shim);
}

export async function migrate(db: Db, opts: { log?: (msg: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  await applyShimIfNeeded(db);
  await db.exec("create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await db.query<{ name: string }>("select name from public._migrations")).map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    log(`→ applying ${file}`);
    await db.tx(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into public._migrations(name) values ($1)", [file]);
    });
  }
}
