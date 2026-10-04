import { defineGame } from "../core/define";

export const BALANCE = {
  barWidth: 340,
  startZone: 230,
  minZone: 46,
  zoneShrinkPerSecond: 3.2,
  /** Instability: acceleration away from the zone centre per px of offset. */
  startInstability: 2.2,
  instabilityGrowth: 0.06,
  pushForce: 900,
  damping: 0.985,
  gustStrength: 160,
  /** Time outside the zone before you fall (forgiving edge-skims). */
  graceS: 0.35,
};

export default defineGame({
  slug: "balance-bar",
  name: "Balance Bar",
  shortDescription: "Keep the wobble inside the zone. It wants out.",
  instructions: "Hold left or right side of the screen to keep the ball in the zone.",
  howTo: ["The ball always drifts away from centre.", "The safe zone shrinks and wanders.", "Score = how long you survive."],
  category: "precision",
  tags: ["arcade"],
  difficulty: "hard",
  controls: ["hold", "keyboard"],
  estimatedDuration: 30,
  leaderboardType: "survival",
  scoreFormat: "centiseconds",
  scoreUnit: "s",
  theme: { bg: ["#04212b", "#0b7a8c"], accent: "#3dd8ff", ink: "#ffffff" },
  validation: {
    minDurationMs: 300,
    maxDurationMs: 60 * 60_000,
    maxScore: 360_000,
    maxScorePerSecond: 101, // centiseconds accrue at exactly 100/s
    maxActionsPerSecond: 16,
    monotonicCheckpoints: true,
  },
  milestones: { good: 2000, great: 4500, legendary: 9000 },
  load: () => import("./game"),
  art: () => import("./art"),
});
