"use client";

import { useEffect, useState } from "react";
import { GameRail } from "@/components/game/GameRail";
import type { CardGame } from "@/components/game/types";
import { getRecent } from "@/lib/client/local";
import { usePlayer } from "@/components/providers/PlayerProvider";

/** "Continue Playing" / "Your Favorites" — device-local, rendered after hydration. */
export function PersonalRails({ games, plays, which }: { games: CardGame[]; plays: Record<string, number>; which: "recent" | "favorites" }) {
  const { favorites } = usePlayer();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(getRecent()), []);
  const bySlug = new Map(games.map((g) => [g.slug, g]));
  const slugs = which === "recent" ? recent : favorites;
  const list = slugs.map((s) => bySlug.get(s)).filter((g): g is CardGame => !!g);
  if (!list.length) return null;
  return which === "recent" ? (
    <GameRail title="Continue Playing" emoji="⏯️" games={list} plays={plays} size="sm" />
  ) : (
    <GameRail title="Your Favorites" emoji="❤️" games={list} plays={plays} />
  );
}
