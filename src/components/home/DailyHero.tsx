import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { buttonClass } from "@/components/ui/Button";
import { DifficultyMeter } from "@/components/game/DifficultyMeter";
import { thumbnailUrl, type CardGame } from "@/components/game/types";
import { Countdown } from "./Countdown";

/** First viewport: today's Daily Challenge with a giant PLAY button. */
export function DailyHero({ game, players }: { game: CardGame; players: number }) {
  return (
    <section className="px-4 pt-4 sm:px-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[26px] font-black uppercase leading-none tracking-tight sm:text-4xl">
          {BRAND.tagline.split(" ").slice(0, -1).join(" ")} <span className="text-gradient-volt">{BRAND.tagline.split(" ").slice(-1)}</span>
        </h1>
      </div>
      <p className="-mt-1 mb-4 text-sm text-muted">{BRAND.subline}</p>

      <div
        className="noise relative overflow-hidden rounded-[28px] border border-white/10"
        style={{ background: `radial-gradient(120% 90% at 85% 10%, ${game.theme.bg[1]} 0%, ${game.theme.bg[0]} 55%, #0a0a0c 100%)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl(game)}
          alt=""
          width={400}
          height={400}
          fetchPriority="high"
          className="pointer-events-none absolute -right-10 -top-6 w-[62%] max-w-[340px] rotate-6 rounded-[32px] opacity-95 shadow-2xl sm:right-6 sm:top-6 sm:w-[300px]"
        />
        <div className="relative flex min-h-[300px] flex-col justify-end p-5 sm:min-h-[340px] sm:p-8">
          <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-volt backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-volt" /> Daily Challenge
          </span>
          <h2 className="font-display text-5xl font-black uppercase leading-[0.9] text-white drop-shadow-lg sm:text-6xl">{game.name}</h2>
          <p className="mt-2 max-w-[60%] text-sm text-white/80">{game.shortDescription}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
            <span>
              <b className="tabular text-white">{players.toLocaleString("en-US")}</b> playing today
            </span>
            <Countdown prefix="New in " className="font-semibold" />
            <DifficultyMeter difficulty={game.difficulty} />
          </div>
          <div className="mt-5 flex gap-3">
            <Link href={`/games/${game.slug}?mode=daily`} className={buttonClass("primary", "xl", "flex-1 animate-[pulse-ring_2s_ease-out_infinite] sm:flex-none sm:px-14")}>
              ▶ {BRAND.cta}
            </Link>
            <Link href="/daily" className={buttonClass("secondary", "xl", "px-5 text-base")} aria-label="Daily challenge leaderboard">
              🏆
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
