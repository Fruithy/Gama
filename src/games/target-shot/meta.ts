import { defineGame } from "../core/define";

export const BALANCE = {
  misses: 3,
  gravity: 520, // "drop" over the flight — pulls the arrow back toward you
  powerPerPx: 7.2,
  minPower: 600,
  maxPower: 1550,
  targetRadius: 64,
  minTargetRadius: 34,
  /** Ring scores from the centre out. */
  rings: [10, 8, 6, 4, 2],
  windFrom: 2,
  windMax: 240,
  movingFrom: 4,
  /** Preview the first fraction of the flight only — skill, not a solved puzzle. */
  previewS: 0.22,
};

export default defineGame({
  slug: "target-shot",
  name: "Target Shot",
  shortDescription: "Pull back. Read the wind. Bullseye.",
  instructions: "Drag back to aim, release to shoot. Hit the middle of the target.",
  howTo: ["Pull further for more power.", "Wind and moving targets arrive after a few shots.", "Three misses and the range closes."],
  category: "sports",
  tags: ["precision"],
  difficulty: "medium",
  controls: ["drag"],
  estimatedDuration: 60,
  scoreUnit: "pts",
  theme: { bg: ["#2e1206", "#c4561d"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 800,
    maxDurationMs: 60 * 60_000,
    maxScore: 20_000,
    maxScorePerSecond: 30,
    maxActionsPerSecond: 6,
    maxScorePerAction: 40,
    monotonicCheckpoints: true,
  },
  milestones: { good: 80, great: 200, legendary: 450 },
  load: () => import("./game"),
  art: () => import("./art"),
});
