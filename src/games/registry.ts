/**
 * THE GAME REGISTRY — single source of truth for every game on the platform.
 *
 * Adding a game = import its meta and append it to `GAMES`. Pages, SEO,
 * leaderboards, analytics, sharing, favourites and history pick it up
 * automatically.
 */
import type { GameDefinition } from "./core/types";
import { plannedGames } from "./planned";

import perfectTap from "./perfect-tap/meta";
import tapRush from "./tap-rush/meta";
import stopTheBar from "./stop-the-bar/meta";
import nailHit from "./nail-hit/meta";
import safeTile from "./safe-tile/meta";
import impossibleGrid from "./impossible-grid/meta";
import ropeDrop from "./rope-drop/meta";
import balanceBar from "./balance-bar/meta";
import stackUp from "./stack-up/meta";

const GAMES: GameDefinition[] = [
  perfectTap,
  tapRush,
  stopTheBar,
  nailHit,
  safeTile,
  impossibleGrid,
  ropeDrop,
  balanceBar,
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

export { CATEGORIES, DIFFICULTY_INFO, getCategory, type CategoryInfo } from "./taxonomy";
import { getCategory } from "./taxonomy";

export function gamesInCategory(slug: string, games: GameDefinition[] = liveGames): GameDefinition[] {
  const cat = getCategory(slug);
  return cat ? games.filter(cat.match) : [];
}

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
