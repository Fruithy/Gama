import { defineGame } from "./core/define";
import type { ControlType, GameCategory, GameDefinition } from "./core/types";

/**
 * Second-wave games: fully described so the platform (admin, roadmap, SEO
 * placeholders) already knows them, but `status: "planned"` keeps them out of
 * public listings. Implementing one = create its folder, move the entry into
 * the registry as a real meta. No platform changes required.
 *
 * Note: "Color Switch" from the brief ships as "Hue Shift" to avoid an
 * existing trademark.
 */
interface PlannedSpec {
  slug: string;
  name: string;
  category: GameCategory;
  desc: string;
  controls: ControlType[];
  glyph: string;
  bg: [string, string];
  camera?: boolean;
  mic?: boolean;
}

const SPECS: PlannedSpec[] = [
  { slug: "tiny-gap", name: "Tiny Gap", category: "timing", desc: "Slip through a gap that barely exists.", controls: ["tap"], glyph: "| |", bg: ["#0f2a3d", "#3dd8ff"] },
  { slug: "pattern-rush", name: "Pattern Rush", category: "memory", desc: "Spot the pattern, finish it fast.", controls: ["tap"], glyph: "◆◇", bg: ["#2a0f3d", "#8b5cff"] },
  { slug: "word-rush", name: "Word Rush", category: "puzzle", desc: "Unscramble words against the clock.", controls: ["tap", "keyboard"], glyph: "Aa", bg: ["#3d2a0f", "#ffc23d"] },
  { slug: "rank-ten", name: "Rank Ten", category: "puzzle", desc: "Rank ten things. Match the crowd.", controls: ["drag"], glyph: "10", bg: ["#0f3d2a", "#3dffb0"] },
  { slug: "impostor-party", name: "Impostor Party", category: "puzzle", desc: "One of them is lying. Find it.", controls: ["tap"], glyph: "?!", bg: ["#3d0f1f", "#ff3d7f"] },
  { slug: "merge-drop", name: "Merge Drop", category: "physics", desc: "Drop, merge, don't overflow.", controls: ["tap", "drag"], glyph: "2+2", bg: ["#1f0f3d", "#ff6a3d"] },
  { slug: "traffic-gap", name: "Traffic Gap", category: "timing", desc: "Cross when the gap opens. Not before.", controls: ["tap"], glyph: "▶", bg: ["#1d1d1d", "#d4ff3a"] },
  { slug: "sound-guess", name: "Sound Guess", category: "rhythm", desc: "Name that noise in one second.", controls: ["tap"], glyph: "♪?", bg: ["#0f1f3d", "#3dd8ff"] },
  { slug: "say-on-beat", name: "Say On Beat", category: "rhythm", desc: "Say the word exactly on the beat.", controls: ["voice"], glyph: "♫", bg: ["#3d0f3a", "#ff3d7f"], mic: true },
  { slug: "face-paddle", name: "Face Paddle", category: "camera", desc: "Steer the paddle with your face. Keep the rally alive.", controls: ["head"], glyph: "▬", bg: ["#0f2a3d", "#3dd8ff"], camera: true },
  { slug: "head-maze", name: "Head Maze", category: "camera", desc: "Steer through a maze with your head.", controls: ["head"], glyph: "◎", bg: ["#0f3d3a", "#3dffb0"], camera: true },
  { slug: "header-challenge", name: "Header Challenge", category: "camera", desc: "Head the ball. Keep it up.", controls: ["head"], glyph: "⚽", bg: ["#123d0f", "#d4ff3a"], camera: true },
  { slug: "goal-timing", name: "Goal Timing", category: "sports", desc: "Shoot when the keeper blinks.", controls: ["tap"], glyph: "GOAL", bg: ["#0f3d16", "#3dffb0"] },
  { slug: "target-keeper", name: "Target Keeper", category: "sports", desc: "Save everything. Even the impossible ones.", controls: ["swipe"], glyph: "🧤", bg: ["#3d1a0f", "#ff6a3d"] },
  { slug: "daily-trivia-sprint", name: "Daily Trivia Sprint", category: "puzzle", desc: "Ten questions. Thirty seconds.", controls: ["tap"], glyph: "Q?", bg: ["#2a2a0f", "#ffc23d"] },
  { slug: "hue-shift", name: "Hue Shift", category: "arcade", desc: "Only pass through your own colour.", controls: ["tap"], glyph: "◐", bg: ["#1a0f3d", "#8b5cff"] },
];

export const plannedGames: GameDefinition[] = SPECS.map((s) =>
  defineGame({
    slug: s.slug,
    name: s.name,
    shortDescription: s.desc,
    instructions: s.desc,
    category: s.category,
    difficulty: "medium",
    controls: s.controls,
    estimatedDuration: 30,
    usesCamera: s.camera ?? false,
    usesMicrophone: s.mic ?? false,
    status: "planned",
    theme: { bg: s.bg, accent: s.bg[1], ink: "#fff" },
    validation: { minDurationMs: 1000, maxDurationMs: 600_000, maxScore: 100_000, maxActionsPerSecond: 15 },
    milestones: { good: 10, great: 25, legendary: 50 },
    art: async () => {
      const { placeholderArt } = await import("./core/art-kit");
      return { default: placeholderArt(s.bg, s.glyph) };
    },
  }),
);
