import { BRAND } from "@/lib/brand";

/** Logo mark: a squircle "lens" with a play-target — swap here to rebrand. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d4ff3a" />
          <stop offset="1" stopColor="#3dd8ff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#lm)" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#0a0a0c" strokeWidth="5" />
      <path d="M28 24.5 L41 32 L28 39.5 Z" fill="#0a0a0c" />
      <circle cx="49" cy="15" r="4" fill="#ff3d7f" stroke="#0a0a0c" strokeWidth="2.5" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const [first, ...rest] = BRAND.name.split(" ");
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={compact ? 28 : 32} />
      {!compact && (
        <span className="font-display text-[15px] font-black leading-none tracking-tight">
          {first}
          <span className="text-volt"> {rest.join(" ")}</span>
        </span>
      )}
    </span>
  );
}
