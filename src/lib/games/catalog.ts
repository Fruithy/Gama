import "server-only";
import type { Db } from "@/lib/db";
import { getGame } from "@/games/registry";
import { syncRegistry } from "./sync";

export { syncRegistry };
import type { GameDefinition } from "@/games/core/types";

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
