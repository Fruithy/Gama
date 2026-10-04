import { cn } from "@/components/ui/cn";

interface Ach {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  unlocked_at: string | Date | null;
}

const TIER_RING: Record<string, string> = {
  bronze: "from-[#c98a4b] to-[#7a4a1d]",
  silver: "from-[#e6e6ee] to-[#8a8a99]",
  gold: "from-[#ffd76a] to-[#c58b00]",
  legend: "from-[#d4ff3a] via-[#3dd8ff] to-[#ff3d7f]",
};

export function TrophyCabinet({ achievements }: { achievements: Ach[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {achievements.map((a) => {
        const unlocked = !!a.unlocked_at;
        return (
          <div key={a.id} className="flex flex-col items-center text-center" title={`${a.name}: ${a.description}`}>
            <div className={cn("grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br p-[3px]", unlocked ? TIER_RING[a.tier] ?? TIER_RING.bronze : "from-white/10 to-white/5")}>
              <div className={cn("grid h-full w-full place-items-center rounded-full bg-surface text-2xl", !unlocked && "grayscale opacity-30")}>{a.icon}</div>
            </div>
            <p className={cn("mt-1 text-[10px] font-bold leading-tight", unlocked ? "text-text" : "text-faint")}>{a.name}</p>
          </div>
        );
      })}
    </div>
  );
}
