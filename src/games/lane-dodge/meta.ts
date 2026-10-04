import { defineGame } from "../core/define";

export const BALANCE = {
  lanes: 3,
  startSpeed: 330, // px/s
  speedGain: 9, // px/s per second
  maxSpeed: 980,
  /** Minimum time between obstacle rows — always ≥ one lane-switch. */
  minRowGapS: 0.42,
  startRowGapS: 0.95,
  laneSwitchS: 0.11,
  doubleBlockFrom: 8, // seconds
  coinChance: 0.35,
};

export default defineGame({
  slug: "lane-dodge",
  name: "Lane Dodge",
  shortDescription: "Three lanes. Zero brakes. Swerve.",
  instructions: "Tap left or right side (or swipe) to switch lanes and dodge.",
  howTo: ["It only gets faster.", "There's always an open lane — find it.", "Coins are a bonus. Crashing is not."],
  category: "arcade",
  tags: ["reaction"],
  difficulty: "medium",
  controls: ["tap", "swipe", "keyboard"],
  estimatedDuration: 40,
  scoreFormat: "meters",
  scoreUnit: "m",
  trending: true,
  theme: { bg: ["#1d1d24", "#3a3a48"], accent: "#ffc23d", ink: "#ffffff" },
  validation: {
    minDurationMs: 300,
    maxDurationMs: 60 * 60_000,
    maxScore: 400_000,
    maxScorePerSecond: 130,
    maxActionsPerSecond: 12,
    monotonicCheckpoints: true,
  },
  milestones: { good: 600, great: 1500, legendary: 3500 },
  load: () => import("./game"),
  art: () => import("./art"),
});
