import type { AchievementDef, PlayerStatKey } from "./definitions";

/** Everything the evaluator may look at after a run. */
export interface AchievementContext {
  player: Record<PlayerStatKey, number>;
  personalBestCount: number;
  run?: {
    score: number;
    scoreFormat: string;
    scoreDirection: "higher" | "lower";
    difficulty: string;
    legendary: number;
    stats: Record<string, number>;
    globalRank: number | null;
    dailyRank: number | null;
  };
}

export function ruleSatisfied(def: AchievementDef, ctx: AchievementContext): boolean {
  const r = def.rule;
  switch (r.type) {
    case "player_stat":
      return (ctx.player[r.stat] ?? 0) >= r.gte;
    case "personal_best_count":
      return ctx.personalBestCount >= r.gte;
    case "run_stat":
      return !!ctx.run && (ctx.run.stats[r.stat] ?? 0) >= r.gte;
    case "run_score":
      return (
        !!ctx.run &&
        ctx.run.scoreDirection === "higher" &&
        (ctx.run.scoreFormat === "points" || ctx.run.scoreFormat === "count") &&
        ctx.run.score >= r.gte
      );
    case "rank": {
      if (!ctx.run) return false;
      const rank = r.board === "global" ? ctx.run.globalRank : ctx.run.dailyRank;
      return rank !== null && rank <= r.lte;
    }
    case "impossible_win": {
      if (!ctx.run || ctx.run.difficulty !== "impossible") return false;
      return ctx.run.scoreDirection === "higher" ? ctx.run.score >= ctx.run.legendary : ctx.run.score <= ctx.run.legendary;
    }
  }
}

/** Returns newly unlocked achievements (not already in `owned`). */
export function evaluateAchievements(defs: AchievementDef[], ctx: AchievementContext, owned: Set<string>): AchievementDef[] {
  return defs.filter((d) => !owned.has(d.id) && ruleSatisfied(d, ctx));
}
