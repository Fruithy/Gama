import { defineGame } from "../core/define";

export const BALANCE = {
  rounds: 10,
  /** Fill speed (% per second) range; later rounds accelerate while held. */
  minSpeed: 38,
  maxSpeed: 70,
  accelFromRound: 4,
  accel: 55, // %/s² once accelerating
  targetMin: 35,
  targetMax: 94,
  perfectWithin: 1.0, // percentage points
  pointsPerPct: 12,
};

export default defineGame({
  slug: "perfect-hold",
  name: "Perfect Hold",
  shortDescription: "Hold. Hold. Let go exactly on the line.",
  instructions: "Hold anywhere to fill the bar. Release exactly on the target line.",
  howTo: ["10 rounds, one hold each.", "Within 1% = PERFECT.", "Hit 100% and it bursts — zero points."],
  category: "timing",
  tags: ["precision"],
  difficulty: "medium",
  controls: ["hold", "keyboard"],
  estimatedDuration: 30,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#06232e", "#1da0a0"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 3_000,
    maxDurationMs: 10 * 60_000,
    maxScore: 1_400,
    maxScorePerSecond: 400,
    maxActionsPerSecond: 6,
    maxScorePerAction: 140,
    monotonicCheckpoints: true,
  },
  milestones: { good: 600, great: 850, legendary: 1050 },
  load: () => import("./game"),
  art: () => import("./art"),
});
