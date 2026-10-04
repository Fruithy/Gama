import { defineGame } from "../core/define";

export const BALANCE = {
  beats: 96,
  startBpm: 100,
  bpmStepEvery: 8,
  bpmStep: 3,
  maxBpm: 150,
  leadInS: 1.6,
  /** Judgement windows (seconds either side of the beat). */
  perfect: 0.045,
  great: 0.09,
  good: 0.14,
  points: { perfect: 300, great: 200, good: 100 },
  comboStep: 10,
  maxMultiplier: 4,
  maxMisses: 12,
  noteSpeed: 420, // px per second of lookahead
  offbeatFrom: 16,
  offbeatChance: 0.3,
  restChance: 0.12,
};

export default defineGame({
  slug: "rhythm-tap",
  name: "Rhythm Tap",
  shortDescription: "Tap on the beat. The beat speeds up.",
  instructions: "Tap anywhere exactly when a note hits the ring.",
  howTo: ["Sound on recommended — the beat is also shown visually.", "Perfect = within 45 ms.", "12 misses and the music stops."],
  category: "rhythm",
  tags: ["timing"],
  difficulty: "medium",
  controls: ["tap", "keyboard"],
  estimatedDuration: 55,
  scoreUnit: "pts",
  isNew: true,
  featured: true,
  theme: { bg: ["#1a0633", "#7a1dc4"], accent: "#3dd8ff", ink: "#ffffff" },
  accessibility: { requiresSound: false, note: "Playable visually; sound makes it much easier." },
  validation: {
    minDurationMs: 2_000,
    maxDurationMs: 10 * 60_000,
    maxScore: 160_000,
    maxScorePerSecond: 5_000,
    maxActionsPerSecond: 10,
    maxScorePerAction: 1_200,
    monotonicCheckpoints: true,
  },
  milestones: { good: 15_000, great: 40_000, legendary: 80_000 },
  load: () => import("./game"),
  art: () => import("./art"),
});
