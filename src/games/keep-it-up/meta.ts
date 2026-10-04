import { defineGame } from "../core/define";

export const BALANCE = {
  gravity: 1350,
  kickVelocity: 830,
  sideKick: 9, // horizontal velocity per px of tap offset
  radius: 38,
  minRadius: 30,
  /** Tap must land within this × radius of the ball centre. */
  hitRadius: 1.55,
  perfectZone: 0.32,
  restitution: 0.78,
  windFrom: 15, // kicks
  windMax: 260,
};

export default defineGame({
  slug: "keep-it-up",
  name: "Keep It Up",
  shortDescription: "Juggle the ball. Never let it drop.",
  instructions: "Tap the ball to kick it up. Tap off-centre to steer it.",
  howTo: ["Tap the left side to send it right (and vice versa).", "Dead-centre kicks are PERFECT and score double.", "Wind kicks in after 15 kicks."],
  category: "sports",
  tags: ["physics"],
  difficulty: "easy",
  controls: ["tap"],
  estimatedDuration: 40,
  scoreFormat: "count",
  scoreUnit: "kicks",
  featured: true,
  theme: { bg: ["#06260f", "#1f9c4a"], accent: "#ffffff", ink: "#ffffff" },
  validation: {
    minDurationMs: 300,
    maxDurationMs: 60 * 60_000,
    maxScore: 10_000,
    maxScorePerSecond: 5,
    maxActionsPerSecond: 10,
    maxScorePerAction: 2,
    monotonicCheckpoints: true,
  },
  milestones: { good: 25, great: 70, legendary: 180 },
  load: () => import("./game"),
  art: () => import("./art"),
});
