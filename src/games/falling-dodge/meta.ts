import { defineGame } from "../core/define";

export const BALANCE = {
  playerRadius: 20,
  moveSpeed: 520,
  startSpawnS: 0.7,
  minSpawnS: 0.2,
  startFall: 260,
  maxFall: 720,
  rampS: 50,
  /** Always leave a gap at least this wide between simultaneous blocks. */
  minGap: 80,
};

export default defineGame({
  slug: "falling-dodge",
  name: "Falling Dodge",
  shortDescription: "The sky is falling. Literally. Dodge it.",
  instructions: "Drag left and right (or hold the sides) to dodge the falling blocks.",
  howTo: ["Every block that passes you scores a point.", "It rains harder the longer you last."],
  category: "arcade",
  tags: ["reaction"],
  difficulty: "easy",
  controls: ["drag", "hold", "keyboard"],
  estimatedDuration: 30,
  scoreFormat: "count",
  scoreUnit: "dodged",
  isNew: true,
  theme: { bg: ["#140b2e", "#3d2fa0"], accent: "#ff6a3d", ink: "#ffffff" },
  validation: {
    minDurationMs: 300,
    maxDurationMs: 60 * 60_000,
    maxScore: 50_000,
    maxScorePerSecond: 8,
    maxActionsPerSecond: 15,
    monotonicCheckpoints: true,
  },
  milestones: { good: 40, great: 120, legendary: 300 },
  load: () => import("./game"),
  art: () => import("./art"),
});
