import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getChallenge } from "@/lib/challenges/service";
import { getGame } from "@/games/registry";
import { formatScoreWithUnit } from "@/games/core/format";
import { buttonClass } from "@/components/ui/Button";
import { Avatar } from "@/components/player/Avatar";
import { Flag } from "@/components/player/Flag";
import { thumbnailUrl, toCard } from "@/components/game/types";
import { ChallengeOpenTracker } from "@/components/play/ChallengeOpenTracker";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

async function load(token: string) {
  try {
    const db = await getDb();
    return await getChallenge(db, token);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const ch = await load(token);
  const game = ch && getGame(ch.gameId);
  if (!ch || !game) return { title: "Challenge" };
  const title = `${ch.creator.username} scored ${formatScoreWithUnit(ch.score, game)} in ${game.name}. Can you beat it?`;
  return {
    title,
    description: `${BRAND.name} challenge: same level, same rules. ${game.instructions}`,
    robots: { index: false },
    openGraph: { title, description: "You're not beating this.", type: "website" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function ChallengePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ch = await load(token);
  const game = ch && getGame(ch.gameId);
  if (!ch || !game) notFound();
  const card = toCard(game);
  return (
    <div className="flex min-h-[80dvh] animate-rise flex-col px-4 pt-6 sm:px-0">
      <ChallengeOpenTracker token={token} />
      <div className="noise relative overflow-hidden rounded-[32px] border border-white/10 p-5 text-center" style={{ background: `radial-gradient(120% 90% at 50% 0%, ${game.theme.bg[1]}, ${game.theme.bg[0]} 60%, #0a0a0c)` }}>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">⚔️ You&apos;ve been challenged</p>
        <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-black/40 py-1.5 pl-1.5 pr-4">
          <Avatar id={ch.creator.avatar} size={36} />
          <span className="font-bold text-white">{ch.creator.username}</span>
          <Flag code={ch.creator.country} />
        </div>
        <p className="mt-4 font-display text-xl font-black uppercase text-white">scored</p>
        <p className="font-display text-[110px] font-black leading-none tracking-tighter text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.4)]">{formatScoreWithUnit(ch.score, game).split(" ")[0]}</p>
        <p className="text-sm font-bold uppercase tracking-widest text-white/70">{game.scoreUnit} in {game.name}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailUrl(card)} alt="" width={400} height={400} className="mx-auto mt-5 w-36 rotate-[-4deg] rounded-3xl shadow-2xl" />
        <p className="mt-5 font-display text-2xl font-black uppercase text-white">Can you beat it?</p>
        <p className="mt-1 text-sm text-white/75">Same level. Same rules. {game.instructions}</p>
      </div>
      <Link href={`/games/${game.slug}?challenge=${token}&play=1`} className={buttonClass("primary", "xl", "mt-5 w-full")} data-testid="play-challenge">
        ⚔️ Play challenge
      </Link>
      <p className="mt-3 text-center text-xs text-muted">
        {ch.stats.attempts.toLocaleString("en-US")} tried · {ch.stats.wins.toLocaleString("en-US")} won · no sign-up needed
      </p>
    </div>
  );
}
