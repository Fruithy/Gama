import { hashString } from "@/games/core/rng";

/**
 * Deterministic daily game selection: the same UTC day always maps to the
 * same game for every server instance, with no coordination needed. Admins
 * can override a day (stored in `daily_challenges`).
 *
 * Avoids repeating any game picked within the last `cooldownDays`.
 */
export function selectDailyGame(day: string, eligible: string[], recent: string[] = [], cooldownDays = 5): string {
  if (eligible.length === 0) throw new Error("No eligible daily games");
  const sorted = [...eligible].sort();
  const blocked = new Set(recent.slice(-cooldownDays));
  const pool = sorted.filter((s) => !blocked.has(s));
  const candidates = pool.length ? pool : sorted;
  return candidates[hashString(`daily:${day}`) % candidates.length];
}

/** The shared seed every player gets for a given daily challenge. */
export function dailySeed(day: string, gameSlug: string): string {
  return `daily-${day}-${gameSlug}-${hashString(`${day}|${gameSlug}`).toString(36)}`;
}

/**
 * Picks for a sequence of days, honouring the cooldown chain. Used when the
 * table has gaps (e.g. after downtime) so history stays deterministic.
 */
export function selectDailySequence(days: string[], eligible: string[], cooldownDays = 5): Record<string, string> {
  const out: Record<string, string> = {};
  const recent: string[] = [];
  for (const d of days) {
    const pick = selectDailyGame(d, eligible, recent, cooldownDays);
    out[d] = pick;
    recent.push(pick);
  }
  return out;
}

/** Streak update when a player participates on `day`. */
export function nextStreak(lastDay: string | null, currentStreak: number, day: string): number {
  if (!lastDay) return 1;
  if (lastDay === day) return Math.max(1, currentStreak);
  const prev = new Date(`${day}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10) === lastDay ? currentStreak + 1 : 1;
}
