import { defineGame } from "../core/define";

export const BALANCE = {
  durationMs: 10_000,
  /** Debounce: faster presses are ignored (no human sustains >25 taps/s). */
  minTapIntervalMs: 40,
};

export default defineGame({
  slug: "tap-rush",
  name: "Tap Rush",
  shortDescription: "10 seconds. Tap like your life depends on it.",
  instructions: "Tap the blob as fast as you can for 10 seconds.",
  howTo: ["Only one finger counts — extra fingers are ignored.", "Your taps-per-second is shown live."],
  category: "reaction",
  difficulty: "easy",
  controls: ["tap", "keyboard"],
  estimatedDuration: 10,
  scoreFormat: "count",
  scoreUnit: "taps",
  trending: true,
  theme: { bg: ["#2b0a1a", "#ff3d7f"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 9_000,
    maxDurationMs: 30_000,
    fixedDurationMs: BALANCE.durationMs,
    fixedDurationToleranceMs: 800,
    maxScore: 220,
    maxActionsPerSecond: 22,
    maxScorePerAction: 1,
    monotonicCheckpoints: true,
  },
  milestones: { good: 60, great: 90, legendary: 120 },
  load: () => import("./game"),
  art: () => import("./art"),
});
