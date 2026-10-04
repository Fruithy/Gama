/**
 * THE GAME REGISTRY — single source of truth for every game on the platform.
 *
 * Adding a game = import its meta and append it to `GAMES`. Pages, SEO,
 * leaderboards, analytics, sharing, favourites and history pick it up
 * automatically.
 */
import type { Difficulty, GameCategory, GameDefinition } from "./core/types";
import { plannedGames } from "./planned";

import stackUp from "./stack-up/meta";

const GAMES: GameDefinition[] = [
  stackUp,
];

/* ───────────────────────────── lookups ───────────────────────────── */

const ALL: GameDefinition[] = [...GAMES, ...plannedGames.filter((p) => !GAMES.some((g) => g.slug === p.slug))];
const BY_SLUG = new Map(ALL.map((g) => [g.slug, g]));

if (BY_SLUG.size !== ALL.length) throw new Error("Duplicate game slug in registry");

/** Playable games, in registry order. */
export const liveGames: GameDefinition[] = GAMES.filter((g) => g.status === "live");
/** Every known game including second-wave placeholders. */
export const allGames: GameDefinition[] = ALL;

export function getGame(slug: string): GameDefinition | undefined {
  return BY_SLUG.get(slug);
}

export function getLiveGame(slug: string): GameDefinition | undefined {
  const g = BY_SLUG.get(slug);
  return g && g.status === "live" ? g : undefined;
}

/* ───────────────────────────── taxonomy ───────────────────────────── */

export interface CategoryInfo {
  slug: string;
  label: string;
  title: string;
  description: string;
  emoji: string;
  /** Membership test — categories can be real categories or collections. */
  match: (g: GameDefinition) => boolean;
}

const inCat = (c: GameCategory) => (g: GameDefinition) => g.category === c || (g.tags ?? []).includes(c);

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

export function gamesInCategory(slug: string, games: GameDefinition[] = liveGames): GameDefinition[] {
  const cat = getCategory(slug);
  return cat ? games.filter(cat.match) : [];
}

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; rank: number; blurb: string }> = {
  easy: { label: "Easy", rank: 1, blurb: "Most players survive 15–30 seconds." },
  medium: { label: "Medium", rank: 2, blurb: "Skill becomes obvious fast." },
  hard: { label: "Hard", rank: 3, blurb: "Most players fail quickly — and know exactly why." },
  impossible: { label: "Impossible", rank: 4, blurb: "Brutally hard. Always technically fair." },
};

/** Related games: same category first, then same difficulty, stable order. */
export function relatedGames(slug: string, count = 6): GameDefinition[] {
  const me = getGame(slug);
  if (!me) return liveGames.slice(0, count);
  const scored = liveGames
    .filter((g) => g.slug !== slug)
    .map((g, i) => ({
      g,
      s: (g.category === me.category ? 4 : 0) + ((g.tags ?? []).includes(me.category) ? 2 : 0) + (g.difficulty === me.difficulty ? 1 : 0) - i * 0.001,
    }))
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, count).map((x) => x.g);
}

/** Serializable subset for client components (no functions). */
export type GameSummary = Omit<GameDefinition, "load" | "art">;

export function toSummary(g: GameDefinition): GameSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { load, art, ...rest } = g;
  return rest;
}
