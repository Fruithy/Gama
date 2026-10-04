import { noStore, route } from "@/lib/api/http";
import { db } from "@/lib/api/server";
import { getCatalogStats } from "@/lib/home/service";
import { getDailyChallenge } from "@/lib/daily/service";
import { boardTotal } from "@/lib/leaderboards/service";
import { msUntilNextDay } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const d = await db();
  const [stats, daily] = await Promise.all([getCatalogStats(d), getDailyChallenge(d)]);
  const players = await boardTotal(d, { gameId: daily.game_id, board: "daily", dailyChallengeId: daily.id });
  return noStore({
    trending: stats.trending,
    mostPlayed: stats.mostPlayed,
    playCounts: stats.playCounts,
    daily: { day: daily.day, gameId: daily.game_id, players, endsInMs: msUntilNextDay() },
  });
});
