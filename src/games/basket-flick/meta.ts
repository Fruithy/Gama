import { defineGame } from "../core/define";

export const BALANCE = {
  misses: 3,
  gravity: 1500,
  /**
   * Every shot flies a fixed-time arc that comes back down through rim height
   * after `flightTime`; swipe LENGTH sets where (depth) that happens. Length is
   * far easier to control than flick speed, so skill is reading distance.
   */
  flightTime: 0.75,
  depthPerPx: 1.55,
  minDepth: 120,
  maxDepth: 900,
  aimFactor: 0.9,
  hoopZ: 420,
  hoopHeight: 232,
  rimRadius: 44,
  ballRadius: 26,
  swishFraction: 0.35,
  moveFrom: 5,
  distanceFrom: 3,
  perspective: 0.0028,
};

export default defineGame({
  slug: "basket-flick",
  name: "Basket Flick",
  shortDescription: "Flick it. Arc it. Swish it.",
  instructions: "Swipe up on the ball to shoot. Longer swipe = more power.",
  howTo: ["Aim by swiping toward the hoop.", "Clean swishes score 3, other baskets 2.", "The hoop moves and changes distance. Three misses ends it."],
  category: "sports",
  tags: ["physics"],
  difficulty: "medium",
  controls: ["swipe"],
  estimatedDuration: 45,
  scoreFormat: "count",
  scoreUnit: "pts",
  trending: true,
  theme: { bg: ["#2e1406", "#ff6a3d"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 600,
    maxDurationMs: 60 * 60_000,
    maxScore: 5_000,
    maxScorePerSecond: 4,
    maxActionsPerSecond: 6,
    maxScorePerAction: 5,
    monotonicCheckpoints: true,
  },
  milestones: { good: 20, great: 50, legendary: 120 },
  load: () => import("./game"),
  art: () => import("./art"),
});
