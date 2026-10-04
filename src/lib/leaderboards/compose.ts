/**
 * Leaderboard presentation helpers (pure).
 */

export interface BoardEntry {
  rank: number;
  playerId: string;
  username: string;
  avatar: string;
  country: string | null;
  score: number;
  achievedAt: string;
  isMe?: boolean;
}

export type BoardRow = BoardEntry | { gap: true; key: string };

/**
 * Top N, then "…", then the player's neighbourhood — so a player at #12,481
 * still sees where they stand:
 *
 *   1 playerA 98 · 2 playerB 95 · 3 playerC 91 · … · 12,480 · 12,481 YOU · 12,482
 */
export function composeBoard(top: BoardEntry[], around: BoardEntry[], meId: string | null): BoardRow[] {
  const rows: BoardRow[] = top.map((e) => ({ ...e, isMe: e.playerId === meId }));
  const lastTopRank = top.length ? top[top.length - 1].rank : 0;
  const tail = around.filter((e) => e.rank > lastTopRank).sort((a, b) => a.rank - b.rank);
  if (tail.length) {
    if (tail[0].rank > lastTopRank + 1) rows.push({ gap: true, key: `gap-${lastTopRank}` });
    for (const e of tail) rows.push({ ...e, isMe: e.playerId === meId });
  }
  return rows;
}

export type RankTier = "world-record" | "top-10" | "top-100" | "top-1000" | "top-1-percent" | "top-10-percent" | null;

/** The flex label for a result screen ("TOP 100", "WORLD RECORD"). */
export function rankTier(rank: number | null, total: number): RankTier {
  if (!rank || rank < 1) return null;
  if (rank === 1) return "world-record";
  if (rank <= 10) return "top-10";
  if (rank <= 100) return "top-100";
  if (rank <= 1000 && total >= 2000) return "top-1000";
  const pct = rank / Math.max(1, total);
  if (pct <= 0.01 && total >= 200) return "top-1-percent";
  if (pct <= 0.1 && total >= 50) return "top-10-percent";
  return null;
}

export const RANK_TIER_LABEL: Record<Exclude<RankTier, null>, string> = {
  "world-record": "WORLD RECORD",
  "top-10": "TOP 10",
  "top-100": "TOP 100",
  "top-1000": "TOP 1000",
  "top-1-percent": "TOP 1%",
  "top-10-percent": "TOP 10%",
};

/** Percentile (0–100, higher = better) for "better than X% of players". */
export function percentileBetterThan(rank: number, total: number): number {
  if (total <= 1) return 100;
  return Math.max(0, Math.min(100, Math.round(((total - rank) / (total - 1)) * 100)));
}
