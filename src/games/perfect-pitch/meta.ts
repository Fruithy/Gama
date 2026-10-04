import { defineGame } from "../core/define";

export const BALANCE = {
  rounds: 5,
  roundTimeS: 8,
  /** Seconds the voice must stay inside the zone to lock a note. */
  lockS: 1.2,
  zoneCents: 50,
  /** MIDI notes for targets (any octave of the pitch class counts). */
  midiMin: 55,
  midiMax: 72,
  speedBonus: 30,
};

export default defineGame({
  slug: "perfect-pitch",
  name: "Perfect Pitch",
  shortDescription: "Hum the note. Hold it. Don't wobble.",
  instructions: "Hum or sing the target note and hold it in the green zone.",
  howTo: ["Any octave counts — sing where it's comfortable.", "Your audio is analysed on-device, never recorded.", "Without a mic you can practise with the slider (unranked)."],
  category: "rhythm",
  tags: ["precision"],
  difficulty: "hard",
  controls: ["voice", "drag"],
  estimatedDuration: 40,
  usesMicrophone: true,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#2e1a06", "#c48a1d"], accent: "#ff3d7f", ink: "#ffffff" },
  accessibility: { requiresSound: true, note: "Needs a microphone and your voice. A reference tone plays each round." },
  validation: {
    minDurationMs: 3_000,
    maxDurationMs: 10 * 60_000,
    maxScore: 700,
    maxScorePerSecond: 150,
    maxActionsPerSecond: 30,
  },
  milestones: { good: 300, great: 450, legendary: 580 },
  load: () => import("./game"),
  art: () => import("./art"),
});
