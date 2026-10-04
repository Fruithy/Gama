import { defineGame } from "../core/define";

export const BALANCE = {
  gravity: 1550,
  flapVelocity: 470,
  startSpeed: 165,
  speedGain: 1.6, // px/s per gate
  maxSpeed: 240,
  pillarWidth: 74,
  spacing: 235,
  startGap: 215,
  gapShrink: 2.2, // px per gate
  minGap: 152,
  /** Max vertical jump between consecutive gap centres — keeps every gate reachable. */
  maxGapShift: 210,
  radius: 18,
};

export default defineGame({
  slug: "flappy-critter",
  name: "Flappy Critter",
  shortDescription: "Flap through the gaps. Gravity is undefeated.",
  instructions: "Tap to flap. Fly through the openings without touching anything.",
  howTo: ["Each tap is one flap.", "Openings get tighter as you go.", "Touch a pillar, the floor or the ceiling and it's over."],
  category: "arcade",
  difficulty: "hard",
  controls: ["tap", "keyboard"],
  estimatedDuration: 25,
  scoreFormat: "count",
  scoreUnit: "",
  trending: true,
  theme: { bg: ["#0b2440", "#1f8ad6"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 400,
    maxDurationMs: 60 * 60_000,
    maxScore: 3_000,
    maxScorePerSecond: 1.6,
    maxActionsPerSecond: 12,
    monotonicCheckpoints: true,
  },
  milestones: { good: 10, great: 30, legendary: 80 },
  load: () => import("./game"),
  art: () => import("./art"),
});
