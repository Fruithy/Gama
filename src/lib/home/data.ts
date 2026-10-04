import "server-only";
import { getDb } from "@/lib/db";
import { liveGames } from "@/games/registry";
import { getCatalogStats, type CatalogStats } from "./service";
import { getDailyChallenge } from "@/lib/daily/service";
import { boardTotal } from "@/lib/leaderboards/service";
import { ensureSynced } from "@/lib/games/catalog";
import { selectDailyGame } from "@/lib/daily/select";
import { dayKey } from "@/lib/time";

export interface HomeData extends CatalogStats {
  daily: { slug: string; players: number; day: string };
  degraded: boolean;
}

/**
 * Homepage data with graceful degradation: if the database is unreachable the
 * arcade still renders from the code registry (every game stays playable;
 * scores queue locally).
 */
export async function getHomeData(): Promise<HomeData> {
  try {
    const db = await getDb();
    await ensureSynced(db);
    const [stats, daily] = await Promise.all([getCatalogStats(db), getDailyChallenge(db)]);
    const players = await boardTotal(db, { gameId: daily.game_id, board: "daily", dailyChallengeId: daily.id });
    return { ...stats, daily: { slug: daily.game_id, players, day: daily.day }, degraded: false };
  } catch (e) {
    console.error("[home] degraded mode", e);
    const games = liveGames;
    const day = dayKey();
    return {
      games,
      playCounts: {},
      trendingScores: {},
      trending: games.filter((g) => g.trending).map((g) => g.id),
      mostPlayed: games.map((g) => g.id),
      ratings: {},
      daily: { slug: selectDailyGame(day, games.filter((g) => g.dailyEligible !== false).map((g) => g.slug)), players: 0, day },
      degraded: true,
    };
  }
}
