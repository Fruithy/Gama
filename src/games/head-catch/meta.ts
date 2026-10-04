import { defineGame } from "../core/define";
import { CATCH_BALANCE } from "../catch-rush/balance";

export const BALANCE = CATCH_BALANCE;

export default defineGame({
  slug: "head-catch",
  name: "Head Catch",
  shortDescription: "Your head is the controller. Catch with your face.",
  instructions: "Move your head left and right to steer the basket. Catch fruit, dodge bombs.",
  howTo: ["Sit about an arm's length from the camera.", "Video is processed on your device — never uploaded.", "Touch fallback is available as practice (unranked)."],
  category: "camera",
  tags: ["arcade"],
  difficulty: "medium",
  controls: ["head", "drag"],
  estimatedDuration: 45,
  usesCamera: true,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#06222e", "#1d8ac4"], accent: "#3dd8ff", ink: "#ffffff" },
  accessibility: { note: "Needs a front camera and head movement. Touch practice mode available." },
  validation: {
    minDurationMs: 5_000,
    maxDurationMs: 5 * 60_000,
    maxScore: 2_000,
    maxScorePerSecond: 25,
    maxActionsPerSecond: 15,
    monotonicCheckpoints: true,
  },
  milestones: { good: 50, great: 100, legendary: 180 },
  load: () => import("./game"),
  art: () => import("./art"),
});
