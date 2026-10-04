import { cn } from "./cn";

export function Pill({ children, className, tone = "default" }: { children: React.ReactNode; className?: string; tone?: "default" | "volt" | "flare" | "ion" | "sun" | "violet" | "dark" }) {
  const tones = {
    default: "bg-white/10 text-text",
    volt: "bg-volt text-black",
    flare: "bg-flare text-white",
    ion: "bg-ion text-black",
    sun: "bg-sun text-black",
    violet: "bg-violet text-white",
    dark: "bg-black/55 text-white backdrop-blur",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", tones[tone], className)}>{children}</span>;
}
