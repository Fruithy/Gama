import "server-only";
import type { Db } from "@/lib/db";
import { liveGames } from "@/games/registry";
import { addDays, dayKey } from "@/lib/time";
import { getOverrides } from "@/lib/games/catalog";
import { dailySeed, selectDailyGame } from "./select";

export interface DailyChallengeRow {
  id: string;
  day: string;
  game_id: string;
  seed: string;
  source: "auto" | "admin";
  winner_id: string | null;
  finalized_at: Date | null;
}

const COLS = "id, day::text as day, game_id, seed, source, winner_id, finalized_at";

export async function eligibleDailyGames(db: Db): Promise<string[]> {
  const overrides = await getOverrides(db);
  return liveGames.filter((g) => g.dailyEligible !== false && overrides.get(g.id)?.enabled !== false).map((g) => g.slug);
}

/** Today's challenge, creating it deterministically on first access. */
export async function getDailyChallenge(db: Db, day: string = dayKey()): Promise<DailyChallengeRow> {
  const existing = await db.query<DailyChallengeRow>(`select ${COLS} from daily_challenges where day = $1::date`, [day]);
  if (existing[0]) return existing[0];

  const recent = await db.query<{ game_id: string }>(
    "select game_id from daily_challenges where day < $1::date and day >= $1::date - 7 order by day asc",
    [day],
  );
  const slug = selectDailyGame(day, await eligibleDailyGames(db), recent.map((r) => r.game_id));
  await db.query(
    "insert into daily_challenges (day, game_id, seed, source) values ($1::date, $2, $3, 'auto') on conflict (day) do nothing",
    [day, slug, dailySeed(day, slug)],
  );
  // Roll-over hook: crown yesterday's winner exactly once.
  await finalizeDay(db, addDays(day, -1));
  const rows = await db.query<DailyChallengeRow>(`select ${COLS} from daily_challenges where day = $1::date`, [day]);
  return rows[0];
}

/** Admin override for a given day (resets the seed to the new game). */
export async function setDailyChallenge(db: Db, day: string, slug: string) {
  await db.query(
    `insert into daily_challenges (day, game_id, seed, source) values ($1::date, $2, $3, 'admin')
     on conflict (day) do update set game_id = excluded.game_id, seed = excluded.seed, source = 'admin'`,
    [day, slug, dailySeed(day, slug)],
  );
}

export async function finalizeDay(db: Db, day: string) {
  await db.tx(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      "select id from daily_challenges where day = $1::date and finalized_at is null for update",
      [day],
    );
    if (!rows[0]) return;
    const top = await tx.query<{ player_id: string }>(
      "select player_id from daily_challenge_scores where daily_challenge_id = $1 order by sort_score desc, achieved_at asc limit 1",
      [rows[0].id],
    );
    const winner = top[0]?.player_id ?? null;
    await tx.query("update daily_challenges set finalized_at = now(), winner_id = $2 where id = $1", [rows[0].id, winner]);
    if (winner) await tx.query("update profiles set daily_wins = daily_wins + 1 where id = $1", [winner]);
  });
}

export async function dailyHistory(db: Db, playerId: string | null, days = 28) {
  const today = dayKey();
  const from = addDays(today, -(days - 1));
  const rows = await db.query<{ day: string; game_id: string; best_score: number | null; attempts: number | null; id: string }>(
    `select dc.id, dc.day::text as day, dc.game_id, s.best_score, s.attempts
     from daily_challenges dc
     left join daily_challenge_scores s on s.daily_challenge_id = dc.id and s.player_id = $3
     where dc.day between $1::date and $2::date order by dc.day asc`,
    [from, today, playerId],
  );
  return rows.map((r) => ({ day: r.day, gameId: r.game_id, played: r.attempts !== null, best: r.best_score === null ? null : Number(r.best_score), attempts: r.attempts ?? 0 }));
}
