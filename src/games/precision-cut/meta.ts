import { defineGame } from "../core/define";

export const BALANCE = {
  rounds: 10,
  targetMin: 12,
  targetMax: 88,
  pointsPerPctError: 8,
  perfectWithin: 0.5, // percentage points
  perfectBonus: 20,
  movingFrom: 5, // round index (0-based) after which the object drifts
  driftSpeed: 34,
  revealS: 1.1,
};

export default defineGame({
  slug: "precision-cut",
  name: "Precision Cut",
  shortDescription: "CUT 37%. Exactly 37%. No ruler.",
  instructions: "Swipe down through the object to cut it at the requested percentage.",
  howTo: ["Percent is measured from the left end.", "Within 0.5% = PERFECT.", "10 cuts. Later objects start to drift."],
  category: "precision",
  tags: ["puzzle"],
  difficulty: "hard",
  controls: ["swipe"],
  estimatedDuration: 35,
  scoreUnit: "pts",
  isNew: true,
  featured: true,
  theme: { bg: ["#2e0b0b", "#d6452f"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 3_000,
    maxDurationMs: 10 * 60_000,
    maxScore: 1_200,
    maxScorePerSecond: 150,
    maxActionsPerSecond: 6,
    maxScorePerAction: 120,
    monotonicCheckpoints: true,
  },
  milestones: { good: 600, great: 800, legendary: 950 },
  load: () => import("./game"),
  art: () => import("./art"),
});
