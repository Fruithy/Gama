import { defineGame } from "../core/define";

export const BALANCE = {
  durationS: 30,
  wrongPenaltyS: 3,
  comboStep: 5,
  /** Difficulty tier rises every N correct answers. */
  tierEvery: 6,
};

export default defineGame({
  slug: "quick-math",
  name: "Quick Math",
  shortDescription: "True or false. 30 seconds. No calculators.",
  instructions: "Is the sum right? Tap TRUE or FALSE as fast as you can.",
  howTo: ["Streaks raise your multiplier.", "Wrong answers cost 3 seconds.", "Numbers grow. Tricks get sneakier."],
  category: "puzzle",
  tags: ["reaction"],
  difficulty: "medium",
  controls: ["tap", "keyboard"],
  estimatedDuration: 30,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#0b0b0f", "#2f2f45"], accent: "#3dffb0", ink: "#ffffff" },
  validation: {
    minDurationMs: 3_000,
    maxDurationMs: 5 * 60_000,
    maxScore: 1_500,
    maxScorePerSecond: 20,
    maxActionsPerSecond: 6,
    maxScorePerAction: 8,
    monotonicCheckpoints: true,
  },
  milestones: { good: 60, great: 120, legendary: 200 },
  load: () => import("./game"),
  art: () => import("./art"),
});
