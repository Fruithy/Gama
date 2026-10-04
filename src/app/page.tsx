import { getHomeData } from "@/lib/home/data";
import { CATEGORIES } from "@/games/taxonomy";
import { GameRail } from "@/components/game/GameRail";
import { GameCard } from "@/components/game/GameCard";
import { toCard, type CardGame } from "@/components/game/types";
import { DailyHero } from "@/components/home/DailyHero";
import { PersonalRails } from "@/components/home/PersonalRails";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();
  const cards = data.games.map(toCard);
  const bySlug = new Map(cards.map((c) => [c.slug, c]));
  const pick = (ids: string[]) => ids.map((id) => bySlug.get(id)).filter((g): g is CardGame => !!g);
  const inCat = (slug: string) => {
    const cat = CATEGORIES.find((c) => c.slug === slug)!;
    return data.games.filter(cat.match).map(toCard);
  };
  const daily = bySlug.get(data.daily.slug) ?? cards[0];
  const trendingIds = new Set(data.trending.slice(0, 3));
  const trendingCards = pick(data.trending.slice(0, 10)).map((c) => ({ ...c, trending: c.trending || trendingIds.has(c.id) }));
  const featured = cards.filter((c) => data.games.find((g) => g.id === c.id)?.featured && c.slug !== daily?.slug);
  const spotlight = featured[0] ?? trendingCards[0];

  return (
    <div className="animate-rise">
      {daily && <DailyHero game={daily} players={data.daily.players} />}
      {data.degraded && (
        <p className="mx-4 mt-4 rounded-2xl border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-sun sm:mx-0">
          Leaderboards are taking a breather. Every game still works — scores are saved on your device and sync later.
        </p>
      )}

      <PersonalRails games={cards} plays={data.playCounts} which="recent" />

      {spotlight && (
        <section className="mt-8 px-4 sm:px-0" aria-label="Featured challenge">
          <h2 className="mb-3 font-display text-[19px] font-black uppercase">⭐ Featured Challenge</h2>
          <div className="grid grid-cols-[132px_1fr] items-center gap-4 rounded-[24px] border border-line bg-surface p-3 sm:grid-cols-[180px_1fr]">
            <GameCard game={spotlight} size="lg" plays={data.playCounts[spotlight.id]} />
            <div className="min-w-0">
              <p className="font-display text-2xl font-black uppercase leading-none">{spotlight.name}</p>
              <p className="mt-2 text-sm text-muted">{spotlight.shortDescription}</p>
              <Link href={`/games/${spotlight.slug}`} className={buttonClass("light", "sm", "mt-4 h-11 w-full max-w-[240px] px-3 text-[13px]")}>
                Beat the world
              </Link>
            </div>
          </div>
        </section>
      )}

      <GameRail title="Trending Now" emoji="🔥" games={trendingCards} plays={data.playCounts} href="/games?sort=trending" />
      <GameRail title="Quick Games" emoji="⚡" games={inCat("quick")} plays={data.playCounts} href="/games/quick" subtitle="Under 20 seconds. One more try." size="sm" />
      <GameRail title="Impossible" emoji="💀" games={inCat("impossible")} plays={data.playCounts} href="/games/impossible" subtitle="Technically fair. Practically impossible." />
      <GameRail title="Reaction" emoji="⚡" games={inCat("reaction")} plays={data.playCounts} href="/games/reaction" />
      <GameRail title="Timing" emoji="⏱️" games={inCat("timing")} plays={data.playCounts} href="/games/timing" />
      <GameRail title="Puzzle" emoji="🧩" games={inCat("puzzle")} plays={data.playCounts} href="/games/puzzle" />
      <GameRail title="Sports" emoji="🏀" games={inCat("sports")} plays={data.playCounts} href="/games/sports" />
      <GameRail title="Rhythm" emoji="🎵" games={inCat("rhythm")} plays={data.playCounts} href="/games/rhythm" />
      <GameRail title="Camera Games" emoji="📸" games={inCat("camera")} plays={data.playCounts} href="/games/camera" subtitle="Your face is the controller. Nothing leaves your device." />
      <GameRail title="New Games" emoji="✨" games={cards.filter((c) => c.isNew)} plays={data.playCounts} />
      <GameRail title="Most Played" emoji="👑" games={pick(data.mostPlayed.slice(0, 10))} plays={data.playCounts} href="/games?sort=played" />
      <PersonalRails games={cards} plays={data.playCounts} which="favorites" />

      <div className="mt-10 px-4 text-center sm:px-0">
        <Link href="/games" className={buttonClass("secondary", "lg")}>
          Browse all {cards.length} games
        </Link>
      </div>
    </div>
  );
}
