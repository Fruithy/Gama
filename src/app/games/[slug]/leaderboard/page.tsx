import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLiveGame, liveGames } from "@/games/registry";
import { LeaderboardTabs } from "@/components/leaderboard/LeaderboardTabs";
import { buttonClass } from "@/components/ui/Button";

export const dynamicParams = false;

export function generateStaticParams() {
  return liveGames.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = getLiveGame(slug);
  return game ? { title: `${game.name} leaderboard — Top 100`, alternates: { canonical: `/games/${slug}/leaderboard` } } : {};
}

export default async function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getLiveGame(slug);
  if (!game) notFound();
  return (
    <div className="animate-rise px-4 pt-6 sm:px-0">
      <Link href={`/games/${slug}`} className="text-xs font-bold text-muted hover:text-text">← {game.name}</Link>
      <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none">{game.name}<br /><span className="text-volt">Top 100</span></h1>
      <p className="mt-2 text-sm text-muted">{game.scoreDirection === "lower" ? "Lower is better." : "Higher is better."} Ties go to whoever got there first.</p>
      <div className="mt-6 max-w-2xl">
        <LeaderboardTabs gameId={game.id} format={game.scoreFormat} unit={game.scoreUnit} limit={100} />
      </div>
      <Link href={`/games/${slug}?play=1`} className={buttonClass("primary", "xl", "fixed inset-x-4 bottom-[calc(92px+var(--safe-bottom))] z-20 md:static md:mt-8 md:inline-flex")}>
        ▶ Beat them
      </Link>
    </div>
  );
}
