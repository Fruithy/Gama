import type { Db } from "@/lib/db/types";
import { allGames } from "@/games/registry";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";

/**
 * Mirror the code registry + achievement catalogue into the database.
 * Idempotent. Gameplay-owned columns (version, direction, status) follow the
 * code; admin-owned columns (enabled, featured, labels…) are never clobbered.
 * Kept free of `server-only` so CLI scripts (seed/migrate) can use it.
 */
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

