import { defineGame } from "../core/define";

export const BALANCE = {
  rounds: 5,
  minDelayS: 1.2,
  maxDelayS: 4.0,
  /** No tap within this window after GO counts as this many ms. */
  timeoutMs: 1500,
  resultPauseS: 0.9,
};

export default defineGame({
  slug: "reaction-flash",
  name: "Reaction Flash",
  shortDescription: "Wait for it… wait for it… NOW. Measured in ms.",
  instructions: "Wait for the screen to flash green, then tap as fast as you can.",
  howTo: ["5 rounds. Your score is your average reaction time.", "Tap before the flash and the run is void.", "Lower is better. Under 200 ms is elite."],
  category: "reaction",
  difficulty: "easy",
  controls: ["tap", "keyboard"],
  estimatedDuration: 15,
  leaderboardType: "time",
  scoreDirection: "lower",
  scoreFormat: "ms",
  scoreUnit: "ms",
  featured: true,
  theme: { bg: ["#2e0606", "#c4162a"], accent: "#3dffb0", ink: "#ffffff" },
  accessibility: { requiresFastReactions: true, note: "The flash is also signalled by a big TAP! label and a sound." },
  validation: {
    minDurationMs: 6_000,
    maxDurationMs: 5 * 60_000,
    maxScore: BALANCE.timeoutMs,
    minScore: 110, // averaged human visual reaction floor — anything faster is anticipation or automation
    maxActionsPerSecond: 6,
  },
  milestones: { good: 280, great: 230, legendary: 185 },
  load: () => import("./game"),
  art: () => import("./art"),
});
