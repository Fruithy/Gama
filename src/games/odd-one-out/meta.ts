import { defineGame } from "../core/define";

export const BALANCE = {
  lives: 3,
  startGrid: 2,
  maxGrid: 7,
  /** Levels per grid-size step. */
  levelsPerGrow: 2,
  startDelta: 24, // lightness difference (%)
  deltaDecay: 0.9,
  minDelta: 2.5,
  startTimeS: 6,
  minTimeS: 3,
};

export default defineGame({
  slug: "odd-one-out",
  name: "Odd One Out",
  shortDescription: "One square is different. Your eyes are lying.",
  instructions: "Find and tap the one square that's a slightly different shade.",
  howTo: ["The difference gets tiny, fast.", "Faster finds score more.", "Wrong tap or timeout costs a life."],
  category: "puzzle",
  tags: ["reaction"],
  difficulty: "impossible",
  controls: ["tap"],
  estimatedDuration: 45,
  scoreUnit: "pts",
  theme: { bg: ["#2e2406", "#c49a1d"], accent: "#ffc23d", ink: "#ffffff" },
  accessibility: { requiresColorVision: true, note: "Relies on subtle colour differences — tough with colour-vision deficiency." },
  validation: {
    minDurationMs: 500,
    maxDurationMs: 30 * 60_000,
    maxScore: 10_000,
    maxScorePerSecond: 50,
    maxActionsPerSecond: 8,
    maxScorePerAction: 25,
    monotonicCheckpoints: true,
  },
  milestones: { good: 250, great: 500, legendary: 900 },
  load: () => import("./game"),
  art: () => import("./art"),
});
