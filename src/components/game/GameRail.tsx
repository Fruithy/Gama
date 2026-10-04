import Link from "next/link";
import { GameCard } from "./GameCard";
import type { CardGame } from "./types";

/** Horizontally scrolling row of game cards with a section header. */
export function GameRail({
  title,
  emoji,
  href,
  games,
  plays,
  size = "md",
  subtitle,
}: {
  title: string;
  emoji?: string;
  href?: string;
  games: CardGame[];
  plays?: Record<string, number>;
  size?: "sm" | "md";
  subtitle?: string;
}) {
  if (!games.length) return null;
  return (
    <section className="mt-8" aria-label={title}>
      <div className="mb-3 flex items-end justify-between px-4 sm:px-0">
        <div>
          <h2 className="font-display text-[19px] font-black uppercase tracking-tight">
            {emoji && <span className="mr-1.5" aria-hidden="true">{emoji}</span>}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="press rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold text-muted hover:text-text">
            See all →
          </Link>
        )}
      </div>
      <div className="rail -mx-0 flex gap-3 overflow-x-auto px-4 pb-2 sm:px-0">
        {games.map((g) => (
          <GameCard key={g.slug} game={g} plays={plays?.[g.id]} size={size} />
        ))}
      </div>
    </section>
  );
}
