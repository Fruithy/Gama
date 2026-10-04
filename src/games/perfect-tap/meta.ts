import { defineGame } from "../core/define";

export const BALANCE = {
  ringRadius: 128,
  startSpeed: 2.3, // rad/s
  speedPerRound: 0.13,
  maxSpeed: 7,
  startZone: 0.95, // rad
  zoneShrink: 0.94,
  minZone: 0.17,
  /** Inner fraction of the zone that counts as PERFECT. */
  perfectFraction: 0.28,
  perfectBase: 100,
  comboBonus: 20,
  maxComboBonus: 10,
  /** Laps the marker may pass the zone without a tap before it's a miss. */
  graceLaps: 1,
};

export default defineGame({
  slug: "perfect-tap",
  name: "Perfect Tap",
  shortDescription: "Hit the tiny zone. Then hit a tinier one.",
  instructions: "Tap when the spinning marker is inside the glowing zone.",
  howTo: ["Dead centre = PERFECT and builds your combo.", "The zone shrinks and the marker speeds up every round.", "Tap outside the zone and it's over."],
  category: "timing",
  tags: ["reaction"],
  difficulty: "hard",
  controls: ["tap", "keyboard"],
  estimatedDuration: 30,
  scoreFormat: "points",
  scoreUnit: "pts",
  featured: true,
  theme: { bg: ["#120a2e", "#3d1a8a"], accent: "#d4ff3a", ink: "#ffffff" },
  validation: {
    minDurationMs: 500,
    maxDurationMs: 20 * 60_000,
    maxScore: 60_000,
    maxScorePerSecond: 900,
    maxActionsPerSecond: 8,
    maxScorePerAction: 300,
    monotonicCheckpoints: true,
  },
  milestones: { good: 800, great: 2000, legendary: 5000 },
  load: () => import("./game"),
  art: () => import("./art"),
});
