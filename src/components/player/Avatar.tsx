import { AVATAR_COLORS, parseAvatar } from "@/lib/players/avatar";

/** Generated blob avatar — original art, deterministic from the avatar id. */
const BODIES = [
  "M32 6c14 0 26 10 26 26S46 58 32 58 6 48 6 32 18 6 32 6Z",
  "M32 4c10 4 26 8 26 26 0 16-12 28-26 28S6 46 6 30C6 12 22 0 32 4Z",
  "M12 14c6-8 34-8 40 0s8 30 0 38-34 8-40 0-6-30 0-38Z",
  "M32 5l7 9 11-2 1 11 9 7-7 9 2 11-11 1-7 9-9-7-11 2-1-11-9-7 7-9-2-11 11-1Z",
  "M32 6c18 0 26 14 26 28 0 14-10 24-26 24S6 48 6 34C6 20 14 6 32 6Z",
  "M10 22c0-10 10-16 22-16s22 6 22 16v26c0 6-4 10-8 6l-5-5-5 5-4-5-4 5-5-5-5 5c-4 4-8 0-8-6Z",
];

export function Avatar({ id, size = 36, className = "", label }: { id: string | null | undefined; size?: number; className?: string; label?: string }) {
  const { body, color } = parseAvatar(id);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={BODIES[body]} fill={AVATAR_COLORS[color]} stroke="#0a0a0c" strokeWidth="3" />
      <circle cx="24" cy="29" r="7" fill="#fff" stroke="#0a0a0c" strokeWidth="2.5" />
      <circle cx="40" cy="29" r="7" fill="#fff" stroke="#0a0a0c" strokeWidth="2.5" />
      <circle cx={26 + (body % 3) - 1} cy="30" r="3.2" fill="#0a0a0c" />
      <circle cx={42 + (body % 3) - 1} cy="30" r="3.2" fill="#0a0a0c" />
      <path d={body % 2 ? "M25 43q7 6 14 0" : "M27 44h10"} stroke="#0a0a0c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
