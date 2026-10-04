import { defineGame } from "../core/define";

export const BALANCE = {
  balls: 5,
  /** A cleared level refunds a ball every N levels. */
  refundEvery: 3,
  gravity: 1200,
  ballRadius: 13,
  restitution: 0.55,
  substeps: 4,
  dropperSpeed: 140,
  pegRadius: 9,
  barLength: 110,
  cupWidth: 96,
  minCupWidth: 58,
  levelPoints: 100,
};

export default defineGame({
  slug: "physics-drop",
  name: "Physics Drop",
  shortDescription: "Drop it through the chaos. Land it in the cup.",
  instructions: "Tap to drop the ball. Get it past the spinning bars into the cup.",
  howTo: ["The dropper slides — pick your moment.", "You have 5 balls. Clearing levels earns some back.", "Bars spin and pegs move as you go deeper."],
  category: "physics",
  tags: ["timing"],
  difficulty: "hard",
  controls: ["tap", "keyboard"],
  estimatedDuration: 60,
  scoreUnit: "pts",
  theme: { bg: ["#22062e", "#a01d8c"], accent: "#3dd8ff", ink: "#ffffff" },
  validation: {
    minDurationMs: 800,
    maxDurationMs: 30 * 60_000,
    maxScore: 40_000,
    maxScorePerSecond: 90,
    maxActionsPerSecond: 6,
    maxScorePerAction: 200,
    monotonicCheckpoints: true,
  },
  milestones: { good: 400, great: 1000, legendary: 2200 },
  load: () => import("./game"),
  art: () => import("./art"),
});
