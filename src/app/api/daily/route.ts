import { noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { dailyHistory, getDailyChallenge } from "@/lib/daily/service";
import { getBoard } from "@/lib/leaderboards/service";
import { msUntilNextDay } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const d = await db();
  const [daily, me] = await Promise.all([getDailyChallenge(d), getCurrentPlayer(d)]);
  const q = { gameId: daily.game_id, board: "daily" as const, dailyChallengeId: daily.id, playerId: me?.id ?? null };
  const [board, countryBoard, history, mine] = await Promise.all([
    getBoard(d, { ...q, limit: 10 }),
    me?.country ? getBoard(d, { ...q, country: me.country, limit: 3 }) : Promise.resolve(null),
    dailyHistory(d, me?.id ?? null, 28),
    me ? d.query<{ attempts: number; best_score: number }>("select attempts, best_score from daily_challenge_scores where daily_challenge_id = $1 and player_id = $2", [daily.id, me.id]) : Promise.resolve([]),
  ]);
  const streakAlive = !!me && (me.last_daily_day === daily.day || (me.last_daily_day !== null && Date.parse(daily.day) - Date.parse(me.last_daily_day) <= 86_400_000));
  return noStore({
    challenge: { id: daily.id, day: daily.day, gameId: daily.game_id, seed: daily.seed, endsInMs: msUntilNextDay() },
    board,
    countryRank: countryBoard?.me?.rank ?? null,
    me: me
      ? {
          attempts: mine[0]?.attempts ?? 0,
          best: mine[0] ? Number(mine[0].best_score) : null,
          rank: board.me?.rank ?? null,
          streak: streakAlive ? me.daily_streak : 0,
          longestStreak: me.longest_streak,
          playedToday: me.last_daily_day === daily.day,
        }
      : null,
    history,
  });
});
