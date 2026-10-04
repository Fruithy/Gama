import { DIFFICULTY_INFO } from "@/games/taxonomy";
import type { Difficulty } from "@/games/core/types";
import { cn } from "@/components/ui/cn";

const COLORS: Record<Difficulty, string> = { easy: "bg-mint", medium: "bg-sun", hard: "bg-flare", impossible: "bg-violet" };

/** Bars + label so difficulty never relies on colour alone. */
export function DifficultyMeter({ difficulty, className, showLabel = true }: { difficulty: Difficulty; className?: string; showLabel?: boolean }) {
  const info = DIFFICULTY_INFO[difficulty];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`${info.label}: ${info.blurb}`}>
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-full", i <= info.rank ? COLORS[difficulty] : "bg-white/20")} style={{ height: 4 + i * 2.5 }} />
        ))}
      </span>
      {showLabel && <span className="text-[11px] font-bold uppercase tracking-wide">{info.label}</span>}
      {!showLabel && <span className="sr-only">{info.label}</span>}
    </span>
  );
}
