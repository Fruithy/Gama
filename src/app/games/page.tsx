import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalogStats } from "@/lib/home/service";
import { getDb } from "@/lib/db";
import { ensureSynced } from "@/lib/games/catalog";
import { liveGames, toSummary } from "@/games/registry";
import { Discover } from "@/components/discover/Discover";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "All games",
  description: "Search and filter every FILTER ARCADE game: reaction, timing, puzzle, sports, rhythm and camera games. Free, instant, no download.",
  alternates: { canonical: "/games" },
};

async function stats() {
  try {
    const db = await getDb();
    await ensureSynced(db);
    return await getCatalogStats(db);
  } catch {
    return null;
  }
}

export default async function DiscoverPage() {
  const s = await stats();
  const games = (s?.games ?? liveGames).map(toSummary);
  return (
    <Suspense>
      <Discover
        games={games}
        playCounts={s?.playCounts ?? {}}
        trending={s?.trendingScores ?? {}}
        ratings={s?.ratings ?? {}}
      />
    </Suspense>
  );
}
