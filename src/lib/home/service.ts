import "server-only";
import type { Db } from "@/lib/db";
import { liveGames } from "@/games/registry";
import { applyOverride, getOverrides } from "@/lib/games/catalog";
import { getConfig } from "@/lib/config/service";
import { trendingScore, type DailyActivity } from "@/lib/analytics/trending";
import type { GameDefinition } from "@/games/core/types";

export interface CatalogStats {
  /** Live + enabled games with admin overrides applied, in display order. */
  games: GameDefinition[];
  playCounts: Record<string, number>;
  trendingScores: Record<string, number>;
  /** Slugs sorted by trending score (admin "trending" overrides first). */
  trending: string[];
  mostPlayed: string[];
  ratings: Record<string, number>;
}

let cache: { at: number; value: CatalogStats } | null = null;
const TTL_MS = 60_000;

export function invalidateCatalogCache() {
  cache = null;
}

export async function getCatalogStats(db: Db): Promise<CatalogStats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const [overrides, cfg] = await Promise.all([getOverrides(db), getConfig(db)]);
  const games = liveGames
    .filter((g) => overrides.get(g.id)?.enabled !== false)
    .map((g) => applyOverride(g, overrides.get(g.id)))
    .sort((a, b) => (overrides.get(a.id)?.sortOrder ?? 0) - (overrides.get(b.id)?.sortOrder ?? 0));

  const [daily, totals, uniques, ratingRows] = await Promise.all([
    db.query<{ game_id: string; age: number; starts: number; shares: number; challenges_created: number; favorites: number; completions: number; retries: number }>(
      `select game_id, ((now() at time zone 'utc')::date - day)::int as age, starts, shares, challenges_created, favorites, completions, retries
       from game_daily_stats where day >= (now() at time zone 'utc')::date - 7`,
    ),
    db.query<{ game_id: string; plays: number }>("select game_id, sum(starts)::int as plays from game_daily_stats group by game_id"),
    db.query<{ game_id: string; n: number }>(
      "select game_id, count(distinct player_id)::int as n from score_runs where submitted_at > now() - interval '24 hours' group by game_id",
    ),
    db.query<{ game_id: string; up: number; total: number }>("select game_id, count(*) filter (where fun)::int as up, count(*)::int as total from ratings group by game_id"),
  ]);

  const byGame = new Map<string, DailyActivity[]>();
  for (const r of daily) {
    const list = byGame.get(r.game_id) ?? [];
    list.push({ ageDays: r.age, plays: r.starts, shares: r.shares, challenges: r.challenges_created, favorites: r.favorites, completions: r.completions, retries: r.retries });
    byGame.set(r.game_id, list);
  }
  const uniq = new Map(uniques.map((u) => [u.game_id, u.n]));
  const playCounts: Record<string, number> = {};
  for (const t of totals) playCounts[t.game_id] = Number(t.plays);
  const trendingScores: Record<string, number> = {};
  for (const g of games) trendingScores[g.id] = trendingScore(byGame.get(g.id) ?? [], uniq.get(g.id) ?? 0, cfg.trending);

  const trending = games
    .map((g) => g.id)
    .sort((a, b) => Number(!!overrides.get(b)?.trendingOverride) - Number(!!overrides.get(a)?.trendingOverride) || trendingScores[b] - trendingScores[a]);
  const mostPlayed = games.map((g) => g.id).sort((a, b) => (playCounts[b] ?? 0) - (playCounts[a] ?? 0));
  const ratings: Record<string, number> = {};
  for (const r of ratingRows) if (r.total >= 3) ratings[r.game_id] = r.up / r.total;

  const value = { games, playCounts, trendingScores, trending, mostPlayed, ratings };
  cache = { at: Date.now(), value };
  return value;
}
