import { defineGame } from "../core/define";

export const BALANCE = {
  startWindowMs: 1700,
  windowDecay: 0.94,
  minWindowMs: 430,
  /** Rounds at which the tile count steps up to 3, then 4. */
  threeTilesFrom: 5,
  fourTilesFrom: 12,
  revealMs: 140,
};

export default defineGame({
  slug: "safe-tile",
  name: "Safe Tile",
  shortDescription: "One tile is safe. You have half a second.",
  instructions: "Read the rule, tap the one safe tile before time runs out.",
  howTo: ["Rules change every round: shapes, sizes, ticks, counts.", "Wrong tile or too slow = game over.", "The window shrinks every round."],
  category: "reaction",
  tags: ["puzzle"],
  difficulty: "hard",
  controls: ["tap"],
  estimatedDuration: 25,
  scoreUnit: "pts",
  theme: { bg: ["#0a1a33", "#1f5bd6"], accent: "#3dd8ff", ink: "#ffffff" },
  accessibility: { requiresFastReactions: true, note: "Rules use shapes, sizes and symbols — never colour alone." },
  validation: {
    minDurationMs: 400,
    maxDurationMs: 15 * 60_000,
    maxScore: 10_000,
    maxScorePerSecond: 60,
    maxActionsPerSecond: 7,
    maxScorePerAction: 25,
    monotonicCheckpoints: true,
  },
  milestones: { good: 150, great: 350, legendary: 700 },
  load: () => import("./game"),
  art: () => import("./art"),
});
