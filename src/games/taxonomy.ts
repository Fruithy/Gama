/**
 * Categories, collections and difficulty labels. Kept separate from the
 * registry so client components can use them without bundling every meta.
 */
import type { Difficulty, GameCategory, GameDefinition } from "./core/types";

type Matchable = Pick<GameDefinition, "category" | "tags" | "usesCamera" | "usesMicrophone" | "difficulty" | "estimatedDuration">;

/* ───────────────────────────── taxonomy ───────────────────────────── */

export interface CategoryInfo {
  slug: string;
  label: string;
  title: string;
  description: string;
  emoji: string;
  /** Membership test — categories can be real categories or collections. */
  match: (g: Matchable) => boolean;
}

const inCat = (c: GameCategory) => (g: Matchable) => g.category === c || (g.tags ?? []).includes(c);

export const CATEGORIES: CategoryInfo[] = [
  { slug: "reaction", label: "Reaction", title: "Reaction Games", description: "Pure reflex tests. Milliseconds decide everything.", emoji: "⚡", match: inCat("reaction") },
  { slug: "timing", label: "Timing", title: "Timing Games", description: "Tap at the perfect moment. Not before, not after.", emoji: "⏱️", match: inCat("timing") },
  { slug: "precision", label: "Precision", title: "Precision Games", description: "Steady hands only. Every pixel counts.", emoji: "🎯", match: inCat("precision") },
  { slug: "arcade", label: "Arcade", title: "Arcade Games", description: "One-tap arcade classics, reinvented.", emoji: "🕹️", match: inCat("arcade") },
  { slug: "puzzle", label: "Puzzle", title: "Puzzle Games", description: "Fast brains beat fast thumbs.", emoji: "🧩", match: inCat("puzzle") },
  { slug: "memory", label: "Memory", title: "Memory Games", description: "Remember more than everyone else.", emoji: "🧠", match: inCat("memory") },
  { slug: "sports", label: "Sports", title: "Sports Games", description: "Flicks, shots and trick kicks.", emoji: "🏀", match: inCat("sports") },
  { slug: "physics", label: "Physics", title: "Physics Games", description: "Gravity is the real opponent.", emoji: "🪀", match: inCat("physics") },
  { slug: "rhythm", label: "Rhythm", title: "Rhythm & Sound Games", description: "Stay on beat. Use your voice.", emoji: "🎵", match: (g) => inCat("rhythm")(g) || g.usesMicrophone },
  { slug: "camera", label: "Camera", title: "Camera Games", description: "Play with your face. Processed on your device, never uploaded.", emoji: "📸", match: (g) => g.usesCamera },
  { slug: "impossible", label: "Impossible", title: "Impossible Games", description: "Technically fair. Practically impossible. Prove us wrong.", emoji: "💀", match: (g) => g.difficulty === "impossible" },
  { slug: "quick", label: "Quick", title: "Quick Games", description: "Done in under 20 seconds. One more try.", emoji: "🔥", match: (g) => g.estimatedDuration <= 20 },
];

export function getCategory(slug: string): CategoryInfo | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}


export const DIFFICULTY_INFO: Record<Difficulty, { label: string; rank: number; blurb: string }> = {
  easy: { label: "Easy", rank: 1, blurb: "Most players survive 15–30 seconds." },
  medium: { label: "Medium", rank: 2, blurb: "Skill becomes obvious fast." },
  hard: { label: "Hard", rank: 3, blurb: "Most players fail quickly — and know exactly why." },
  impossible: { label: "Impossible", rank: 4, blurb: "Brutally hard. Always technically fair." },
};

