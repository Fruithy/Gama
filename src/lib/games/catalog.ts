import "server-only";
import type { Db } from "@/lib/db";
import { allGames, getGame } from "@/games/registry";
import type { GameDefinition } from "@/games/core/types";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";

/**
 * The registry (code) owns gameplay facts: version, score direction,
 * validation rules. The `games` table owns operational facts admins edit:
 * enabled, featured, trending, category/difficulty label, thumbnail.
 */
export interface GameOverride {
  id: string;
  enabled: boolean;
  featured: boolean;
  trendingOverride: boolean;
  isNew: boolean;
  category: string;
  difficulty: string;
  thumbnailUrl: string | null;
  name: string;
  shortDescription: string | null;
  sortOrder: number;
}

const g = globalThis as unknown as { __faSynced?: Promise<void> };

/** Upsert registry → DB once per process. Idempotent; never clobbers admin edits. */
export function ensureSynced(db: Db): Promise<void> {
  if (!g.__faSynced) {
    g.__faSynced = syncRegistry(db).catch((e) => {
      g.__faSynced = undefined;
      throw e;
    });
  }
  return g.__faSynced;
}

export async function syncRegistry(db: Db) {
  const games = allGames;
  await db.query(
    `insert into games (id, slug, name, category, difficulty, score_direction, current_version, status, featured, is_new, short_description, sort_order)
     select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[], $8::text[], $9::bool[], $10::bool[], $11::text[], $12::int[])
     on conflict (id) do update set
       current_version = excluded.current_version,
       score_direction = excluded.score_direction,
       status = excluded.status,
       updated_at = case when games.current_version <> excluded.current_version or games.status <> excluded.status then now() else games.updated_at end`,
    [
      games.map((x) => x.id),
      games.map((x) => x.slug),
      games.map((x) => x.name),
      games.map((x) => x.category),
      games.map((x) => x.difficulty),
      games.map((x) => x.scoreDirection),
      games.map((x) => x.version),
      games.map((x) => x.status),
      games.map((x) => !!x.featured),
      games.map((x) => !!x.isNew),
      games.map((x) => x.shortDescription),
      games.map((_, i) => i),
    ],
  );
  await db.query(
    `insert into game_versions (game_id, version, rules)
     select * from unnest($1::text[], $2::int[], $3::jsonb[]) on conflict do nothing`,
    [games.map((x) => x.id), games.map((x) => x.version), games.map((x) => JSON.stringify(x.validation))],
  );
  await db.query(
    `insert into achievements (id, name, description, icon, xp, rule, tier, sort_order)
     select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::jsonb[], $7::text[], $8::int[])
     on conflict (id) do nothing`,
    [
      ACHIEVEMENTS.map((a) => a.id),
      ACHIEVEMENTS.map((a) => a.name),
      ACHIEVEMENTS.map((a) => a.description),
      ACHIEVEMENTS.map((a) => a.icon),
      ACHIEVEMENTS.map((a) => a.xp),
      ACHIEVEMENTS.map((a) => JSON.stringify(a.rule)),
      ACHIEVEMENTS.map((a) => a.tier),
      ACHIEVEMENTS.map((_, i) => i),
    ],
  );
}

export async function getOverrides(db: Db): Promise<Map<string, GameOverride>> {
  await ensureSynced(db);
  const rows = await db.query<{
    id: string; enabled: boolean; featured: boolean; trending_override: boolean; is_new: boolean;
    category: string; difficulty: string; thumbnail_url: string | null; name: string; short_description: string | null; sort_order: number;
  }>("select id, enabled, featured, trending_override, is_new, category, difficulty, thumbnail_url, name, short_description, sort_order from games");
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id, enabled: r.enabled, featured: r.featured, trendingOverride: r.trending_override, isNew: r.is_new,
        category: r.category, difficulty: r.difficulty, thumbnailUrl: r.thumbnail_url, name: r.name,
        shortDescription: r.short_description, sortOrder: r.sort_order,
      },
    ]),
  );
}

/** Registry definition with admin overrides applied (metadata only). */
export function applyOverride(def: GameDefinition, o: GameOverride | undefined): GameDefinition {
  if (!o) return def;
  return {
    ...def,
    name: o.name || def.name,
    shortDescription: o.shortDescription || def.shortDescription,
    category: o.category as GameDefinition["category"],
    difficulty: o.difficulty as GameDefinition["difficulty"],
    featured: o.featured,
    isNew: o.isNew,
    trending: o.trendingOverride || def.trending,
    thumbnail: o.thumbnailUrl || def.thumbnail,
  };
}

export async function getPlayableGame(db: Db, slug: string): Promise<GameDefinition | null> {
  const def = getGame(slug);
  if (!def || def.status !== "live") return null;
  const o = (await getOverrides(db)).get(def.id);
  if (o && !o.enabled) return null;
  return def;
}
