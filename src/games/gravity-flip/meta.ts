import { defineGame } from "../core/define";

export const BALANCE = {
  startSpeed: 270,
  speedGain: 7,
  maxSpeed: 640,
  gravity: 3200,
  corridor: 300, // px between floor and ceiling
  radius: 18,
  /** Gap between obstacles on alternating sides ≥ speed × this — always time to flip. */
  flipSafetyS: 0.42,
  minGapS: 0.55,
  maxGapS: 1.25,
  pxPerMeter: 12,
};

export default defineGame({
  slug: "gravity-flip",
  name: "Gravity Flip",
  shortDescription: "Floor. Ceiling. Floor. Don't touch the spikes.",
  instructions: "Tap to flip gravity and dodge the spikes on the floor and ceiling.",
  howTo: ["You run automatically.", "Each tap flips you to the other side.", "It speeds up. It always speeds up."],
  category: "arcade",
  tags: ["timing"],
  difficulty: "hard",
  controls: ["tap", "keyboard"],
  estimatedDuration: 35,
  scoreFormat: "meters",
  scoreUnit: "m",
  isNew: true,
  theme: { bg: ["#1a0b2e", "#8b5cff"], accent: "#d4ff3a", ink: "#ffffff" },
  validation: {
    minDurationMs: 300,
    maxDurationMs: 60 * 60_000,
    maxScore: 400_000,
    maxScorePerSecond: 60,
    maxActionsPerSecond: 12,
    monotonicCheckpoints: true,
  },
  milestones: { good: 250, great: 700, legendary: 1800 },
  load: () => import("./game"),
  art: () => import("./art"),
});
