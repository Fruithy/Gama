import { defineGame } from "../core/define";

export const BALANCE = {
  trackWidth: 340,
  markerWidth: 6,
  startSpeed: 260, // px/s
  speedGrowth: 1.07,
  maxSpeed: 1100,
  startTarget: 96,
  targetShrink: 0.9,
  minTarget: 12,
  /** Within this fraction of the target's half-width = PERFECT. */
  perfectFraction: 0.18,
};

export default defineGame({
  slug: "stop-the-bar",
  name: "Stop The Bar",
  shortDescription: "Freeze the marker inside the box. Box shrinks.",
  instructions: "Tap to stop the sliding marker inside the green box.",
  howTo: ["Centre hits score PERFECT bonuses.", "Every level: smaller box, faster marker.", "Stop outside the box and you're out."],
  category: "timing",
  tags: ["precision"],
  difficulty: "medium",
  controls: ["tap", "keyboard"],
  estimatedDuration: 25,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#06231d", "#0f6b52"], accent: "#3dffb0", ink: "#ffffff" },
  validation: {
    minDurationMs: 300,
    maxDurationMs: 20 * 60_000,
    maxScore: 25_000,
    maxScorePerSecond: 500,
    maxActionsPerSecond: 8,
    maxScorePerAction: 200,
    monotonicCheckpoints: true,
  },
  milestones: { good: 600, great: 1500, legendary: 3200 },
  load: () => import("./game"),
  art: () => import("./art"),
});
