import Link from "next/link";
import { getCategory } from "@/games/taxonomy";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/components/ui/cn";
import { DifficultyMeter } from "./DifficultyMeter";
import { thumbnailUrl, type CardGame } from "./types";

function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/**
 * The arcade cabinet card. Server-renderable (no client JS): hover/press
 * animation is pure CSS; route prefetch comes from <Link>.
 */
export function GameCard({
  game,
  plays,
  size = "md",
  priority = false,
  className,
  href,
}: {
  game: CardGame;
  plays?: number;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
  className?: string;
  href?: string;
}) {
  const cat = getCategory(game.category);
  const widths = { sm: "w-[132px]", md: "w-[164px]", lg: "w-full" };
  return (
    <Link
      href={href ?? `/games/${game.slug}`}
      className={cn(
        "group press relative block shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-surface-2 outline-offset-4 transition-transform duration-200 hover:-translate-y-1 hover:rotate-[-0.6deg]",
        widths[size],
        className,
      )}
      style={{ boxShadow: `0 10px 30px -14px ${game.theme.accent}88` }}
      aria-label={`${game.name} — ${game.shortDescription}`}
      data-game={game.slug}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${game.theme.bg[0]}, ${game.theme.bg[1]})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art; next/image adds nothing for vectors */}
        <img
          src={thumbnailUrl(game)}
          alt=""
          width={400}
          height={400}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-x-0 top-0 h-auto w-full transition-transform duration-300 group-hover:scale-[1.06]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {game.isNew && <Pill tone="volt">New</Pill>}
          {game.trending && <Pill tone="flare">🔥 Hot</Pill>}
          {game.usesCamera && <Pill tone="ion">📸 Cam</Pill>}
          {game.usesMicrophone && <Pill tone="sun">🎤 Mic</Pill>}
        </div>
        {plays !== undefined && plays > 0 && (
          <div className="absolute right-2 top-2">
            <Pill tone="dark">▶ {compact(plays)}</Pill>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className={cn("font-display font-black uppercase leading-[0.95] text-white drop-shadow", size === "sm" ? "text-[15px]" : "text-lg")}>{game.name}</p>
          <div className="mt-1.5 flex items-center justify-between text-white/80">
            <span className="text-[11px] font-semibold">
              {cat?.emoji} {cat?.label}
            </span>
            <DifficultyMeter difficulty={game.difficulty} showLabel={size !== "sm"} />
          </div>
        </div>
      </div>
    </Link>
  );
}
