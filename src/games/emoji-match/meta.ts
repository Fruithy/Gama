import { defineGame } from "../core/define";

export const BALANCE = {
  durationS: 30,
  wrongPenaltyS: 2,
  /** Faces in play grows with matches; similar faces appear together later. */
  startFaces: 4,
  maxFaces: 12,
  grid: 3, // 3×3 choices
  driftFrom: 10, // matches before the rows start sliding
  driftSpeed: 34,
  comboStep: 5,
};

export default defineGame({
  slug: "emoji-match",
  name: "Emoji Match",
  shortDescription: "Match the face. Fast. Faster. Wrong.",
  instructions: "Tap the face below that matches the one at the top.",
  howTo: ["Every 5 in a row raises your multiplier.", "Wrong taps cost 2 seconds.", "Later, the faces start sliding around."],
  category: "reaction",
  tags: ["puzzle"],
  difficulty: "easy",
  controls: ["tap"],
  estimatedDuration: 30,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#331a06", "#ffb21d"], accent: "#ff3d7f", ink: "#0b0b0f" },
  validation: {
    minDurationMs: 4_000,
    maxDurationMs: 5 * 60_000,
    maxScore: 2_500,
    maxScorePerSecond: 30,
    maxActionsPerSecond: 8,
    maxScorePerAction: 6,
    monotonicCheckpoints: true,
  },
  milestones: { good: 120, great: 230, legendary: 380 },
  load: () => import("./game"),
  art: () => import("./art"),
});
