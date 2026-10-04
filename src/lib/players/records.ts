import "server-only";
import type { Db } from "@/lib/db";
import { getGame } from "@/games/registry";
import { rankOf, boardTotal } from "@/lib/leaderboards/service";
import { percentileBetterThan, rankTier, type RankTier } from "@/lib/leaderboards/compose";
import { playerAchievements } from "@/lib/achievements/service";

export interface PlayerBest {
  gameId: string;
  score: number;
  rank: number;
  total: number;
  percentile: number;
  tier: RankTier;
  achievedAt: string;
}

/** Headline records: each picks a stat from the player's data (data-driven, no per-record UI code). */
const HEADLINES: Array<{ id: string; label: string; icon: string; source: { game: string } | { stat: string; agg: "max" } }> = [
  { id: "fastest-reaction", label: "Fastest reaction", icon: "⚡", source: { game: "reaction-flash" } },
  { id: "highest-stack", label: "Highest stack", icon: "🏗️", source: { game: "stack-up" } },
  { id: "longest-survival", label: "Longest balance", icon: "⚖️", source: { game: "balance-bar" } },
  { id: "most-taps", label: "Fastest thumbs", icon: "👆", source: { game: "tap-rush" } },
  { id: "highest-combo", label: "Highest combo", icon: "🔥", source: { stat: "maxCombo", agg: "max" } },
  { id: "best-accuracy", label: "Best accuracy", icon: "🎯", source: { stat: "accuracy", agg: "max" } },
];

export async function playerRecords(db: Db, playerId: string) {
  const [bestsRows, statsRows, profileRows, achievements] = await Promise.all([
    db.query<{ game_id: string; score: number; sort_score: number; achieved_at: Date }>(
      "select game_id, score, sort_score, achieved_at from personal_bests where player_id = $1",
      [playerId],
    ),
    db.query<{ game_id: string; plays: number; best_stats: Record<string, number> }>("select game_id, plays, best_stats from player_game_stats where player_id = $1", [playerId]),
    db.query<{ total_plays: number; games_played: number; daily_streak: number; longest_streak: number; daily_wins: number; challenge_wins: number; xp: number; level: number }>(
      "select total_plays, games_played, daily_streak, longest_streak, daily_wins, challenge_wins, xp, level from profiles where id = $1",
      [playerId],
    ),
    playerAchievements(db, playerId),
  ]);

  const bests: PlayerBest[] = [];
  for (const b of bestsRows) {
    if (!getGame(b.game_id)) continue;
    const q = { gameId: b.game_id, board: "global" as const };
    const [rank, total] = await Promise.all([rankOf(db, q, Number(b.sort_score), b.achieved_at), boardTotal(db, q)]);
    const t = Math.max(total, rank);
    bests.push({ gameId: b.game_id, score: Number(b.score), rank, total: t, percentile: percentileBetterThan(rank, t), tier: rankTier(rank, t), achievedAt: new Date(b.achieved_at).toISOString() });
  }
  bests.sort((a, b) => a.rank - b.rank || b.percentile - a.percentile);

  const headlines = HEADLINES.map((h) => {
    if ("game" in h.source) {
      const best = bests.find((b) => b.gameId === (h.source as { game: string }).game);
      return best ? { id: h.id, label: h.label, icon: h.icon, gameId: best.gameId, score: best.score, rank: best.rank } : null;
    }
    const stat = h.source.stat;
    let top: { gameId: string; value: number } | null = null;
    for (const s of statsRows) {
      const v = Number(s.best_stats?.[stat] ?? 0);
      if (v > 0 && (!top || v > top.value)) top = { gameId: s.game_id, value: v };
    }
    return top ? { id: h.id, label: h.label, icon: h.icon, gameId: top.gameId, value: top.value, stat } : null;
  }).filter(Boolean);

  const mostPlayed = statsRows.sort((a, b) => b.plays - a.plays).slice(0, 5).map((s) => ({ gameId: s.game_id, plays: s.plays }));

  return {
    stats: profileRows[0] ?? null,
    bests,
    headlines,
    mostPlayed,
    achievements: achievements.map((a) => ({ ...a, unlocked_at: a.unlocked_at ? new Date(a.unlocked_at).toISOString() : null })),
  };
}

export type PlayerRecords = Awaited<ReturnType<typeof playerRecords>>;
