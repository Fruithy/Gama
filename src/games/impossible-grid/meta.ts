import { defineGame } from "../core/define";

export const BALANCE = {
  totalTimeMs: 90_000,
  /** Level schedule: [kind, grid size]. Repeats the last entry afterwards. */
  levels: [
    ["toggle", 3],
    ["stroke", 3],
    ["toggle", 4],
    ["stroke", 4],
    ["toggle", 4],
    ["stroke", 5],
    ["toggle", 5],
    ["stroke", 5],
    ["toggle", 5],
    ["stroke", 6],
  ] as Array<["toggle" | "stroke", number]>,
  levelPoints: 100,
  fastBonusMax: 60,
  fastBonusWindowS: 12,
};

export default defineGame({
  slug: "impossible-grid",
  name: "Impossible Grid",
  shortDescription: "Light every circle. The rules fight back.",
  instructions: "Light up every circle. Read the rule at the top of each level.",
  howTo: ["TAP levels: a tap flips a circle and its neighbours.", "DRAG levels: light every circle in one unbroken line — drag back to undo.", "90 seconds. Solve as many as you can."],
  category: "puzzle",
  tags: ["memory"],
  difficulty: "impossible",
  controls: ["tap", "drag"],
  estimatedDuration: 90,
  scoreUnit: "pts",
  featured: true,
  theme: { bg: ["#0b0b0f", "#2a2a3d"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 2_000,
    maxDurationMs: 5 * 60_000,
    fixedDurationMs: BALANCE.totalTimeMs,
    fixedDurationToleranceMs: 1_500,
    maxScore: 5_000,
    maxScorePerSecond: 120,
    maxActionsPerSecond: 22, // drag strokes count each cell entered
    monotonicCheckpoints: true,
  },
  milestones: { good: 400, great: 900, legendary: 1600 },
  load: () => import("./game"),
  art: () => import("./art"),
});
