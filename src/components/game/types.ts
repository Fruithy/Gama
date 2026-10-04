import type { GameSummary } from "@/games/registry";

/** Minimal serialisable game card data passed from server to client components. */
export type CardGame = Pick<
  GameSummary,
  "id" | "slug" | "name" | "shortDescription" | "category" | "difficulty" | "theme" | "usesCamera" | "usesMicrophone" | "isNew" | "trending" | "thumbnail" | "estimatedDuration"
>;

export function toCard(g: GameSummary | CardGame): CardGame {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    shortDescription: g.shortDescription,
    category: g.category,
    difficulty: g.difficulty,
    theme: g.theme,
    usesCamera: g.usesCamera,
    usesMicrophone: g.usesMicrophone,
    isNew: g.isNew,
    trending: g.trending,
    thumbnail: g.thumbnail,
    estimatedDuration: g.estimatedDuration,
  };
}

export function thumbnailUrl(g: Pick<CardGame, "slug" | "thumbnail">): string {
  return g.thumbnail || `/art/${g.slug}.svg`;
}
