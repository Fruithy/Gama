/**
 * Trending score — configurable, recency-weighted.
 *
 *   trend = Σ_day decay(age) · ( plays·w.plays + shares·w.shares + challenges·w.challenges
 *                               + favorites·w.favorites )
 *           + unique24h·w.unique24h
 *           + replayRate·w.replayRate + completionRate·w.completionRate
 *
 * decay(age) = 0.5^(age / halfLifeDays) — yesterday counts, last week barely.
 * Rates are scaled by min(1, plays7d / rateConfidencePlays) so a game with
 * 3 plays can't top the chart on a perfect replay rate.
 */
export interface TrendingWeights {
  plays: number;
  unique24h: number;
  shares: number;
  challenges: number;
  favorites: number;
  replayRate: number;
  completionRate: number;
  halfLifeDays: number;
  rateConfidencePlays: number;
}

export const DEFAULT_TRENDING_WEIGHTS: TrendingWeights = {
  plays: 1,
  unique24h: 3,
  shares: 8,
  challenges: 10,
  favorites: 6,
  replayRate: 40,
  completionRate: 15,
  halfLifeDays: 1.5,
  rateConfidencePlays: 200,
};

export interface DailyActivity {
  /** 0 = today. */
  ageDays: number;
  plays: number;
  shares: number;
  challenges: number;
  favorites: number;
  completions: number;
  retries: number;
}

export function trendingScore(days: DailyActivity[], unique24h: number, w: TrendingWeights = DEFAULT_TRENDING_WEIGHTS): number {
  let score = 0;
  let plays7 = 0;
  let completions7 = 0;
  let retries7 = 0;
  for (const d of days) {
    if (d.ageDays > 7) continue;
    const decay = Math.pow(0.5, d.ageDays / w.halfLifeDays);
    score += decay * (d.plays * w.plays + d.shares * w.shares + d.challenges * w.challenges + d.favorites * w.favorites);
    plays7 += d.plays;
    completions7 += d.completions;
    retries7 += d.retries;
  }
  const confidence = Math.min(1, plays7 / Math.max(1, w.rateConfidencePlays));
  const replayRate = plays7 ? Math.min(1, retries7 / plays7) : 0;
  const completionRate = plays7 ? Math.min(1, completions7 / plays7) : 0;
  score += unique24h * w.unique24h;
  score += confidence * (replayRate * w.replayRate + completionRate * w.completionRate);
  return Math.round(score * 100) / 100;
}
