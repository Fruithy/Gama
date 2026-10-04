"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Overview, GamesSection, PlayersSection, ScoresSection, DailySection, ReportsSection, AnalyticsSection, AchievementsSection, FlagsSection, ConfigSection } from "./sections";

const SECTIONS = [
  ["overview", "Overview"],
  ["games", "Games"],
  ["players", "Players"],
  ["scores", "Scores & Leaderboards"],
  ["daily", "Daily Challenge"],
  ["reports", "Reports"],
  ["analytics", "Analytics"],
  ["achievements", "Achievements"],
  ["flags", "Feature Flags"],
  ["config", "XP & Config"],
] as const;

type Section = (typeof SECTIONS)[number][0];

export function AdminApp() {
  const params = useSearchParams();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState("");
  const section = (params.get("s") as Section) || "overview";

  const check = useCallback(() => api<{ admin: boolean }>("/api/admin/session").then((r) => setAuthed(r.admin)).catch(() => setAuthed(false)), []);
  useEffect(() => {
    void check();
  }, [check]);

  if (authed === null) return <p className="p-8 text-muted">Checking access…</p>;
  if (!authed) {
    return (
      <div className="mx-auto mt-24 max-w-sm rounded-[24px] border border-line bg-surface p-6">
        <Logo />
        <h1 className="mt-4 font-display text-2xl font-black uppercase">Admin</h1>
        <p className="mt-1 text-sm text-muted">Sign in with an admin account, or use the ADMIN_SECRET.</p>
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            try {
              await api("/api/admin/session", { json: { action: "login", secret } });
              await check();
            } catch (e2) {
              setErr((e2 as Error).message);
            }
          }}
        >
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Admin secret" aria-label="Admin secret" className="h-12 rounded-2xl border border-line-strong bg-surface-2 px-4 outline-none focus:border-volt" />
          {err && <p className="text-sm text-flare">{err}</p>}
          <Button type="submit" size="lg">Enter</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-line p-4 md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center justify-between">
          <Logo compact />
          <span className="text-xs font-black uppercase tracking-widest text-flare">Admin</span>
        </div>
        <nav className="rail mt-4 flex gap-1 overflow-x-auto md:flex-col" aria-label="Admin sections">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => router.replace(`/admin?s=${id}`)}
              className={cn("shrink-0 rounded-xl px-3 py-2 text-left text-sm font-bold", section === id ? "bg-white/10 text-text" : "text-muted hover:text-text")}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="mt-4 hidden text-xs text-muted underline md:block"
          onClick={async () => {
            await api("/api/admin/session", { json: { action: "logout" } });
            router.push("/");
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="min-w-0 p-4 md:p-6">
        {section === "overview" && <Overview />}
        {section === "games" && <GamesSection />}
        {section === "players" && <PlayersSection />}
        {section === "scores" && <ScoresSection />}
        {section === "daily" && <DailySection />}
        {section === "reports" && <ReportsSection />}
        {section === "analytics" && <AnalyticsSection />}
        {section === "achievements" && <AchievementsSection />}
        {section === "flags" && <FlagsSection />}
        {section === "config" && <ConfigSection />}
      </main>
    </div>
  );
}
