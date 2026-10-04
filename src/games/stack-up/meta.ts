import { defineGame } from "../core/define";

export const BALANCE = {
  blockHeight: 30,
  baseWidth: 230,
  startSpeed: 170,
  speedPerBlock: 7,
  maxSpeed: 460,
  /** Offset (logical px) that still counts as a perfect drop. */
  perfectTolerance: 5,
  /** Perfect streak length that starts regrowing the block. */
  regrowStreak: 3,
  regrowAmount: 8,
};

export default defineGame({
  slug: "stack-up",
  name: "Stack Up",
  shortDescription: "Drop the slab. Slice the overhang. Go higher.",
  instructions: "Tap to drop the sliding block onto the tower.",
  howTo: ["Anything hanging over the edge gets sliced off.", "Perfect drops keep your width — 3 in a row grows it back.", "Miss the tower completely and it's over."],
  category: "arcade",
  tags: ["timing", "precision"],
  difficulty: "medium",
  controls: ["tap", "keyboard"],
  estimatedDuration: 45,
  scoreUnit: "",
  scoreFormat: "count",
  featured: true,
  trending: true,
  theme: { bg: ["#1a1446", "#ff3d7f"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 400,
    maxDurationMs: 30 * 60_000,
    maxScore: 2_000,
    maxScorePerSecond: 7,
    maxActionsPerSecond: 9,
    maxScorePerAction: 2,
    monotonicCheckpoints: true,
  },
  milestones: { good: 20, great: 50, legendary: 120 },
  load: () => import("./game"),
  art: () => import("./art"),
});
