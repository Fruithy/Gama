import { defineGame } from "../core/define";

export const BALANCE = {
  gravity: 1650,
  jumpVelocity: 820,
  springVelocity: 1350,
  moveAccel: 2600,
  maxMoveSpeed: 420,
  friction: 0.86,
  platformWidth: 74,
  /** Vertical gap range; the upper bound stays below max jump height (≈ v²/2g ≈ 203px). */
  minGap: 52,
  maxGapStart: 92,
  maxGapEnd: 165,
  gapRampHeight: 12_000,
  movingFrom: 1_500,
  breakingFrom: 3_000,
  springChance: 0.06,
  pxPerMeter: 10,
};

export default defineGame({
  slug: "platform-hop",
  name: "Platform Hop",
  shortDescription: "Bounce up forever. Don't look down.",
  instructions: "Hold left or right (or drag) to steer the bouncing blob upward.",
  howTo: ["You bounce automatically.", "Fly off one side, appear on the other.", "Cracked platforms break. Springs launch you."],
  category: "arcade",
  difficulty: "medium",
  controls: ["hold", "drag", "keyboard"],
  estimatedDuration: 60,
  scoreFormat: "meters",
  scoreUnit: "m",
  theme: { bg: ["#0b1d3a", "#5b8cff"], accent: "#d4ff3a", ink: "#ffffff" },
  validation: {
    minDurationMs: 300,
    maxDurationMs: 60 * 60_000,
    maxScore: 500_000,
    maxScorePerSecond: 150,
    maxActionsPerSecond: 15,
    monotonicCheckpoints: true,
  },
  milestones: { good: 500, great: 1500, legendary: 4000 },
  load: () => import("./game"),
  art: () => import("./art"),
});
