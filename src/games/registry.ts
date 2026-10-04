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
import precisionCut from "./precision-cut/meta";
import popRush from "./pop-rush/meta";
import reactionFlash from "./reaction-flash/meta";
import laneDodge from "./lane-dodge/meta";
import platformHop from "./platform-hop/meta";
import flappyCritter from "./flappy-critter/meta";
import gravityFlip from "./gravity-flip/meta";
import keepItUp from "./keep-it-up/meta";
import targetShot from "./target-shot/meta";
import basketFlick from "./basket-flick/meta";
import memoryFlash from "./memory-flash/meta";
import oddOneOut from "./odd-one-out/meta";
import emojiMatch from "./emoji-match/meta";
import pathDraw from "./path-draw/meta";
import physicsDrop from "./physics-drop/meta";
import perfectHold from "./perfect-hold/meta";
import quickMath from "./quick-math/meta";
import fallingDodge from "./falling-dodge/meta";
import catchRush from "./catch-rush/meta";
import headCatch from "./head-catch/meta";
import blinkJump from "./blink-jump/meta";
import rhythmTap from "./rhythm-tap/meta";
import perfectPitch from "./perfect-pitch/meta";

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
  precisionCut,
  popRush,
  reactionFlash,
  laneDodge,
  platformHop,
  flappyCritter,
  gravityFlip,
  keepItUp,
  targetShot,
  basketFlick,
  memoryFlash,
  oddOneOut,
  emojiMatch,
  pathDraw,
  physicsDrop,
  perfectHold,
  quickMath,
  fallingDodge,
  catchRush,
  headCatch,
  blinkJump,
  rhythmTap,
  perfectPitch,
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
