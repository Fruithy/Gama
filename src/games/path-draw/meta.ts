import { defineGame } from "../core/define";

export const BALANCE = {
  lives: 3,
  startWidth: 66,
  widthDecay: 0.92,
  minWidth: 24,
  controlPoints: 6,
  /** Max jump along the path per move event (stops skipping across a hairpin). */
  maxAdvance: 70,
  resumeRadius: 34,
  levelPoints: 100,
  accuracyBonus: 50,
  speedBonus: 50,
  speedBonusWindowS: 6,
};

export default defineGame({
  slug: "path-draw",
  name: "Path Draw",
  shortDescription: "Trace the tunnel. Touch a wall, start over.",
  instructions: "Drag from the green start to the flag without touching the walls.",
  howTo: ["Stay near the centre line for accuracy points.", "Fast clean runs score bonus points.", "The tunnel gets narrower every level."],
  category: "precision",
  tags: ["puzzle"],
  difficulty: "hard",
  controls: ["drag"],
  estimatedDuration: 50,
  scoreUnit: "pts",
  theme: { bg: ["#0b1f2e", "#1d6fa0"], accent: "#d4ff3a", ink: "#ffffff" },
  validation: {
    minDurationMs: 800,
    maxDurationMs: 30 * 60_000,
    maxScore: 30_000,
    maxScorePerSecond: 160,
    maxActionsPerSecond: 8,
    monotonicCheckpoints: true,
  },
  milestones: { good: 600, great: 1400, legendary: 2800 },
  load: () => import("./game"),
  art: () => import("./art"),
});
