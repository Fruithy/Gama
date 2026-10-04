import { defineGame } from "../core/define";

export const BALANCE = {
  gravity: 2700,
  jumpVelocity: 860,
  startSpeed: 260,
  speedGain: 6,
  maxSpeed: 560,
  /** Gaps between obstacles ≥ speed × this (≥ one full jump). */
  minGapS: 0.85,
  maxGapS: 1.7,
  blinkThreshold: 0.55,
  mouthThreshold: 0.45,
  /** Ignore re-triggers for this long (one blink = one jump). */
  refractoryS: 0.28,
};

export default defineGame({
  slug: "blink-jump",
  name: "Blink Jump",
  shortDescription: "Blink to jump. Yes, really. Don't blink otherwise.",
  instructions: "Blink (or open your mouth) to jump over the obstacles.",
  howTo: ["Your face is the button — processed on your device only.", "Each blink is one jump.", "Touch fallback is practice only (unranked)."],
  category: "camera",
  tags: ["arcade", "timing"],
  difficulty: "hard",
  controls: ["face", "tap"],
  estimatedDuration: 40,
  usesCamera: true,
  scoreFormat: "count",
  scoreUnit: "jumps",
  isNew: true,
  theme: { bg: ["#2e0b22", "#c41d7a"], accent: "#d4ff3a", ink: "#ffffff" },
  accessibility: { note: "Needs a front camera; jumps also trigger on an open mouth. Touch practice available." },
  validation: {
    minDurationMs: 500,
    maxDurationMs: 60 * 60_000,
    maxScore: 5_000,
    maxScorePerSecond: 1.5,
    maxActionsPerSecond: 8,
    monotonicCheckpoints: true,
  },
  milestones: { good: 15, great: 40, legendary: 100 },
  load: () => import("./game"),
  art: () => import("./art"),
});
