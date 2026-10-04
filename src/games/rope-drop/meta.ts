import { defineGame } from "../core/define";

export const BALANCE = {
  lives: 3,
  gravity: 1400,
  segments: 11,
  constraintIterations: 12,
  damping: 0.995,
  objectRadius: 22,
  cupWidth: 96,
  cupDepth: 46,
  levelTimeS: 14,
  cupSpeedFromLevel: 3,
  cupSpeedBase: 50,
  cupSpeedPerLevel: 9,
  /** Landing within this fraction of the cup's half-width = SWISH (perfect). */
  swishFraction: 0.3,
};

export default defineGame({
  slug: "rope-drop",
  name: "Rope Drop",
  shortDescription: "Cut the rope. Time the swing. Nail the cup.",
  instructions: "Swipe across the ropes to drop the gem into the cup.",
  howTo: ["The gem swings — cut at the right moment.", "Some levels have several ropes. Cut them all.", "Miss three drops and it's over."],
  category: "physics",
  tags: ["timing", "puzzle"],
  difficulty: "medium",
  controls: ["swipe"],
  estimatedDuration: 60,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#1b0f2e", "#6b2fa0"], accent: "#3dffb0", ink: "#ffffff" },
  validation: {
    minDurationMs: 700,
    maxDurationMs: 30 * 60_000,
    maxScore: 60_000,
    maxScorePerSecond: 160,
    maxActionsPerSecond: 10,
    monotonicCheckpoints: true,
  },
  milestones: { good: 500, great: 1300, legendary: 3000 },
  load: () => import("./game"),
  art: () => import("./art"),
});
