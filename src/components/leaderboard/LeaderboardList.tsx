import Link from "next/link";
import { formatScore } from "@/games/core/format";
import type { ScoreFormat } from "@/games/core/types";
import type { BoardRow } from "@/lib/leaderboards/compose";
import { Avatar } from "@/components/player/Avatar";
import { Flag } from "@/components/player/Flag";
import { cn } from "@/components/ui/cn";

const MEDALS = ["🥇", "🥈", "🥉"];

function relTime(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Ranked rows with a "…" gap before the player's neighbourhood. */
export function LeaderboardList({
  rows,
  format,
  unit,
  showTime = true,
  compact = false,
}: {
  rows: BoardRow[];
  format: ScoreFormat;
  unit: string;
  showTime?: boolean;
  compact?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-1" aria-label="Leaderboard">
      {rows.map((r) =>
        "gap" in r ? (
          <li key={r.key} className="py-1 text-center font-display text-lg font-black tracking-[0.4em] text-faint" aria-label="more players">
            …
          </li>
        ) : (
          <li
            key={`${r.rank}-${r.playerId}`}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3",
              compact ? "py-1.5" : "py-2.5",
              r.isMe ? "bg-volt text-black" : r.rank <= 3 ? "bg-white/[0.06]" : "bg-white/[0.025]",
            )}
            aria-current={r.isMe ? "true" : undefined}
          >
            <span className={cn("w-12 shrink-0 font-display font-black tabular", r.rank > 999 ? "text-xs" : "text-sm")}>
              {r.rank <= 3 ? <span className="text-xl">{MEDALS[r.rank - 1]}</span> : `#${r.rank.toLocaleString("en-US")}`}
            </span>
            <Avatar id={r.avatar} size={compact ? 26 : 32} />
            <Link href={`/u/${encodeURIComponent(r.username)}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
              {r.username}
              {r.isMe && <span className="ml-1.5 text-[10px] font-black uppercase">you</span>}
            </Link>
            <Flag code={r.country} className="text-base" />
            {showTime && !compact && <span className={cn("hidden w-8 text-right text-xs sm:inline", r.isMe ? "text-black/60" : "text-faint")}>{relTime(r.achievedAt)}</span>}
            <span className="min-w-[64px] text-right font-display font-black tabular">
              {formatScore(r.score, format)}
              {unit && format !== "percent10" && <span className={cn("ml-1 text-[10px] font-bold", r.isMe ? "text-black/60" : "text-muted")}>{unit}</span>}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}
