import { readJson, writeJson } from "./storage";
import type { SubmitRunRequest } from "@/lib/runs/types";

/**
 * Local (device) progression for anonymous players: recents, favourites,
 * personal bests, play counts and the offline score queue. Server data wins
 * whenever available; this makes the arcade feel personal from the first tap.
 */
const K = {
  recent: "fa:recent",
  favorites: "fa:favorites",
  bests: "fa:bests",
  plays: "fa:plays",
  pending: "fa:pending",
  rated: "fa:rated",
} as const;

export type LocalBests = Record<string, number>;

export function getRecent(): string[] {
  return readJson<string[]>(K.recent, []);
}

export function pushRecent(slug: string) {
  writeJson(K.recent, [slug, ...getRecent().filter((s) => s !== slug)].slice(0, 12));
}

export function getLocalFavorites(): string[] {
  return readJson<string[]>(K.favorites, []);
}

export function setLocalFavorites(slugs: string[]) {
  writeJson(K.favorites, Array.from(new Set(slugs)).slice(0, 100));
}

export function getLocalBests(): LocalBests {
  return readJson<LocalBests>(K.bests, {});
}

/** Returns true when `score` beats the stored local best. */
export function recordLocalBest(slug: string, score: number, direction: "higher" | "lower"): boolean {
  const bests = getLocalBests();
  const prev = bests[slug];
  const better = prev === undefined || (direction === "higher" ? score > prev : score < prev);
  if (better) {
    bests[slug] = score;
    writeJson(K.bests, bests);
  }
  return better;
}

export function incrementPlays(slug: string): number {
  const plays = readJson<Record<string, number>>(K.plays, {});
  plays[slug] = (plays[slug] ?? 0) + 1;
  writeJson(K.plays, plays);
  return plays[slug];
}

export function getPlays(slug: string): number {
  return readJson<Record<string, number>>(K.plays, {})[slug] ?? 0;
}

export function wasRated(slug: string): boolean {
  return readJson<string[]>(K.rated, []).includes(slug);
}

export function markRated(slug: string) {
  writeJson(K.rated, [...readJson<string[]>(K.rated, []), slug]);
}

/** Offline queue: runs whose submission failed. Retried later; never faked as submitted. */
export interface PendingRun {
  payload: SubmitRunRequest;
  queuedAt: number;
}

export function getPending(): PendingRun[] {
  return readJson<PendingRun[]>(K.pending, []);
}

export function queuePending(payload: SubmitRunRequest) {
  const list = getPending().filter((p) => p.payload.runId !== payload.runId);
  list.push({ payload, queuedAt: Date.now() });
  writeJson(K.pending, list.slice(-20));
}

export function removePending(runId: string) {
  writeJson(K.pending, getPending().filter((p) => p.payload.runId !== runId));
}
