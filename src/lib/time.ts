/** UTC calendar helpers. All competitive periods roll over at 00:00 UTC. */

export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC) of the ISO week containing `d`, as YYYY-MM-DD. */
export function weekKey(d: Date = new Date()): string {
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return dayKey(monday);
}

export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
}

/** Milliseconds until the next UTC midnight. */
export function msUntilNextDay(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

export function nextDayStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Whole days between two YYYY-MM-DD keys (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
