import { defineGame } from "../core/define";

export const BALANCE = {
  lives: 3,
  startSpeed: 220,
  speedGrowth: 1.06,
  maxSpeed: 900,
  startTolerance: 34, // px either side of the nail head that still hits
  toleranceShrink: 0.95,
  minTolerance: 9,
  perfectFraction: 0.22,
  swingTime: 0.12, // s
};

export default defineGame({
  slug: "nail-hit",
  name: "Nail Hit",
  shortDescription: "One swing. Dead centre. Don't hit your thumb.",
  instructions: "Tap to swing the hammer when it's right above the nail.",
  howTo: ["Perfect hits drive the nail in one blow.", "Off-centre hits only tap it part-way.", "Three misses and you're done."],
  category: "timing",
  tags: ["precision"],
  difficulty: "medium",
  controls: ["tap", "keyboard"],
  estimatedDuration: 35,
  scoreUnit: "pts",
  theme: { bg: ["#2a1606", "#a0521d"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 400,
    maxDurationMs: 20 * 60_000,
    maxScore: 30_000,
    maxScorePerSecond: 250,
    maxActionsPerSecond: 8,
    maxScorePerAction: 120,
    monotonicCheckpoints: true,
  },
  milestones: { good: 400, great: 1100, legendary: 2500 },
  load: () => import("./game"),
  art: () => import("./art"),
});
