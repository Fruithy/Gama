"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/player/Avatar";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { cn } from "@/components/ui/cn";

const TABS = [
  { href: "/", label: "Play", icon: "🕹️", match: (p: string) => p === "/" },
  { href: "/games", label: "Discover", icon: "🔍", match: (p: string) => p === "/games" || (p.startsWith("/games/") && !p.includes("/", 7)) },
  { href: "/daily", label: "Daily", icon: "📅", match: (p: string) => p.startsWith("/daily") },
  { href: "/records", label: "Records", icon: "🏆", match: (p: string) => p.startsWith("/records") },
  { href: "/me", label: "You", icon: "👤", match: (p: string) => p.startsWith("/me") || p.startsWith("/u/") },
];

/** Top bar (all sizes) + bottom tab bar (phones). Hidden on admin routes and the full-screen idle game. */
export function AppChrome() {
  const pathname = usePathname() ?? "/";
  const { player } = usePlayer();
  if (pathname.startsWith("/admin") || pathname.startsWith("/mine")) return null;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 pt-[var(--safe-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="Home" className="press">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {TABS.slice(0, 4).map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cn("press rounded-full px-3.5 py-2 text-sm font-bold", t.match(pathname) ? "bg-white/10 text-text" : "text-muted hover:text-text")}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <Link href="/me" className="press flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3" aria-label="Your profile">
            <Avatar id={player?.avatar} size={28} />
            <span className="max-w-[110px] truncate text-xs font-bold">{player ? `Lv ${player.level}` : "Guest"}</span>
          </Link>
        </div>
      </header>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[var(--safe-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Tabs"
      >
        <ul className="mx-auto flex max-w-md">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <li key={t.href} className="flex-1">
                <Link href={t.href} className={cn("press flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wide", active ? "text-volt" : "text-muted")} aria-current={active ? "page" : undefined}>
                  <span className={cn("text-xl transition-transform", active && "scale-110")} aria-hidden="true">{t.icon}</span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
