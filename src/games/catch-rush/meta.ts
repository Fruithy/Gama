import { defineGame } from "../core/define";
import { CATCH_BALANCE } from "./balance";

export const BALANCE = CATCH_BALANCE;

export default defineGame({
  slug: "catch-rush",
  name: "Catch Rush",
  shortDescription: "Fruit rain. Bomb rain. Catch the right one.",
  instructions: "Drag the basket to catch fruit. Avoid the bombs.",
  howTo: ["Stars are worth 5.", "Bombs cost 3 seconds and your combo.", "Every 10 in a row raises your multiplier."],
  category: "arcade",
  tags: ["reaction"],
  difficulty: "easy",
  controls: ["drag", "keyboard"],
  estimatedDuration: 45,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#0b2e1a", "#2fa05a"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 5_000,
    maxDurationMs: 5 * 60_000,
    maxScore: 2_000,
    maxScorePerSecond: 25,
    maxActionsPerSecond: 15,
    monotonicCheckpoints: true,
  },
  milestones: { good: 60, great: 120, legendary: 220 },
  load: () => import("./game"),
  art: () => import("./art"),
});
