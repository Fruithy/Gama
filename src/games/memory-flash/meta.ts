import { defineGame } from "../core/define";

export const BALANCE = {
  pads: 9,
  startFlashMs: 520,
  minFlashMs: 260,
  flashDecayPerRound: 18,
  gapMs: 140,
  maxLength: 60,
};

export default defineGame({
  slug: "memory-flash",
  name: "Memory Flash",
  shortDescription: "Watch the pattern. Repeat it. It gets longer.",
  instructions: "Watch the pads light up, then tap them back in the same order.",
  howTo: ["One more step every round.", "Each pad has its own colour, symbol and sound.", "One wrong tap ends the run."],
  category: "memory",
  tags: ["puzzle"],
  difficulty: "medium",
  controls: ["tap"],
  estimatedDuration: 60,
  scoreFormat: "count",
  scoreUnit: "steps",
  theme: { bg: ["#170b33", "#5a2fd6"], accent: "#ff3d7f", ink: "#ffffff" },
  validation: {
    minDurationMs: 1_000,
    maxDurationMs: 60 * 60_000,
    maxScore: 60,
    maxScorePerSecond: 0.5,
    maxActionsPerSecond: 10,
    monotonicCheckpoints: true,
  },
  milestones: { good: 8, great: 14, legendary: 22 },
  load: () => import("./game"),
  art: () => import("./art"),
});
