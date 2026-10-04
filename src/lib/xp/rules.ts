/**
 * XP economy. Pure functions — values come from `app_config.xp` (admin
 * editable) with these defaults.
 *
 * Anti-farming: only "meaningful" runs earn completion XP (minimum duration),
 * and each game pays completion XP for at most N runs per player per day.
 * Bonus XP (personal best, first play of day, daily, challenge win) is
 * naturally rate-limited by its own conditions.
 */
export interface XpConfig {
  completion: number;
  maxPaidRunsPerGamePerDay: number;
  minRunDurationMs: number;
  firstPlayOfDay: number;
  personalBest: number;
  dailyChallenge: number;
  challengeWin: number;
  newGameBonus: number;
}

export const DEFAULT_XP: XpConfig = {
  completion: 10,
  maxPaidRunsPerGamePerDay: 12,
  minRunDurationMs: 3_000,
  firstPlayOfDay: 50,
  personalBest: 25,
  dailyChallenge: 40,
  challengeWin: 30,
  newGameBonus: 20,
};

export interface XpContext {
  durationMs: number;
  /** Paid runs already counted for this game today (before this run). */
  paidRunsToday: number;
  firstPlayOfDay: boolean;
  isPersonalBest: boolean;
  /** First time ever playing this game. */
  firstTimeGame: boolean;
  /** First daily-challenge run today. */
  firstDailyRunToday: boolean;
  challengeWon: boolean;
  /** Only accepted (not flagged) runs earn XP. */
  accepted: boolean;
}

export interface XpAward {
  total: number;
  breakdown: Array<{ reason: string; xp: number }>;
  paidCompletion: boolean;
}

export function computeRunXp(ctx: XpContext, cfg: XpConfig = DEFAULT_XP): XpAward {
  const breakdown: XpAward["breakdown"] = [];
  if (!ctx.accepted) return { total: 0, breakdown, paidCompletion: false };
  const meaningful = ctx.durationMs >= cfg.minRunDurationMs;
  let paidCompletion = false;
  if (meaningful && ctx.paidRunsToday < cfg.maxPaidRunsPerGamePerDay) {
    breakdown.push({ reason: "Run complete", xp: cfg.completion });
    paidCompletion = true;
  }
  if (meaningful && ctx.firstPlayOfDay) breakdown.push({ reason: "First play today", xp: cfg.firstPlayOfDay });
  if (meaningful && ctx.firstTimeGame) breakdown.push({ reason: "New game", xp: cfg.newGameBonus });
  if (ctx.isPersonalBest) breakdown.push({ reason: "Personal best", xp: cfg.personalBest });
  if (ctx.firstDailyRunToday) breakdown.push({ reason: "Daily challenge", xp: cfg.dailyChallenge });
  if (ctx.challengeWon) breakdown.push({ reason: "Challenge won", xp: cfg.challengeWin });
  return { total: breakdown.reduce((s, b) => s + b.xp, 0), breakdown, paidCompletion };
}

/**
 * Level curve: XP needed to *reach* level n is 60·(n−1)^1.7, so early levels
 * come quickly (a few sessions) and later levels become status symbols.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(60 * Math.pow(level - 1, 1.7));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 999) level++;
  return level;
}

export function levelProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current: xp - base, needed: next - base, ratio: (xp - base) / Math.max(1, next - base) };
}
