import type { GameDefinition, ScoreDirection, ScoreFormat } from "./types";

const nf = new Intl.NumberFormat("en-US");

/** Human formatting for a stored integer score. Shared by server + client. */
export function formatScore(score: number | null | undefined, format: ScoreFormat): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  switch (format) {
    case "ms":
      return `${nf.format(Math.round(score))}`;
    case "centiseconds":
      return (score / 100).toFixed(2);
    case "percent10":
      return `${(score / 10).toFixed(1)}%`;
    case "meters":
      return nf.format(Math.round(score));
    default:
      return nf.format(Math.round(score));
  }
}

/** Score with its unit: "213 ms", "12.34 s", "47". */
export function formatScoreWithUnit(
  score: number | null | undefined,
  def: Pick<GameDefinition, "scoreFormat" | "scoreUnit">,
): string {
  const base = formatScore(score, def.scoreFormat);
  if (base === "—") return base;
  if (def.scoreFormat === "percent10") return base;
  return def.scoreUnit ? `${base} ${def.scoreUnit}` : base;
}

/**
 * Leaderboards always sort DESC on `sort_score`; lower-is-better games store
 * the negated score so one index shape serves both directions.
 */
export function toSortScore(score: number, direction: ScoreDirection): number {
  return direction === "higher" ? score : -score;
}

export function isBetter(a: number, b: number | null | undefined, direction: ScoreDirection): boolean {
  if (b === null || b === undefined) return true;
  return direction === "higher" ? a > b : a < b;
}

/** Absolute gap between two scores, formatted ("LOST BY 3", "BY 12 ms"). */
export function scoreGap(a: number, b: number, def: Pick<GameDefinition, "scoreFormat" | "scoreUnit">): string {
  return formatScoreWithUnit(Math.abs(a - b), def);
}
