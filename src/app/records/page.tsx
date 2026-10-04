import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { ensureSynced } from "@/lib/games/catalog";
import { getCurrentPlayer } from "@/lib/players/service";
import { playerRecords } from "@/lib/players/records";
import { getGame } from "@/games/registry";
import { formatScoreWithUnit } from "@/games/core/format";
import { RANK_TIER_LABEL } from "@/lib/leaderboards/compose";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { TrophyCabinet } from "@/components/player/TrophyCabinet";
import { thumbnailUrl, toCard } from "@/components/game/types";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My records", robots: { index: false } };

const STAT_LABEL: Record<string, string> = { maxCombo: "combo", accuracy: "% accuracy" };

export default async function RecordsPage() {
  let data: Awaited<ReturnType<typeof playerRecords>> | null = null;
  let username = "";
  try {
    const db = await getDb();
    await ensureSynced(db);
    const me = await getCurrentPlayer(db);
    if (me) {
      data = await playerRecords(db, me.id);
      username = me.username;
    }
  } catch {
    /* render empty state */
  }

  if (!data || data.stats?.total_plays === 0) {
    return (
      <div className="px-4 pt-8 sm:px-0">
        <h1 className="font-display text-4xl font-black uppercase">Records</h1>
        <EmptyState className="mt-6" icon="🏆" title="Your record book is empty">
          Play any game — your bests, ranks and trophies land here automatically.
          <div className="mt-4"><Link href="/" className={buttonClass("primary", "md")}>Play now</Link></div>
        </EmptyState>
      </div>
    );
  }

  const top = data.bests[0];
  return (
    <div className="animate-rise px-4 pt-6 sm:px-0">
      <p className="text-xs font-black uppercase tracking-widest text-muted">{username}</p>
      <h1 className="font-display text-4xl font-black uppercase leading-none">Record book</h1>

      {top && (() => {
        const g = getGame(top.gameId)!;
        return (
          <Link href={`/games/${g.slug}`} className="noise press relative mt-5 block overflow-hidden rounded-[28px] border border-white/10 p-5" style={{ background: `linear-gradient(135deg, ${g.theme.bg[0]}, ${g.theme.bg[1]})` }}>
            <p className="text-xs font-black uppercase tracking-widest text-white/80">Your best ranking</p>
            <p className="font-display text-6xl font-black leading-none text-white">#{top.rank.toLocaleString("en-US")}</p>
            <p className="mt-1 font-bold text-white">{g.name} · {formatScoreWithUnit(top.score, g)}</p>
            {top.tier && <span className="mt-2 inline-block rounded-full bg-black/40 px-3 py-1 text-xs font-black text-volt">{RANK_TIER_LABEL[top.tier]}</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl(toCard(g))} alt="" width={400} height={400} className="absolute -right-6 -top-4 w-36 rotate-12 rounded-3xl opacity-90" />
          </Link>
        );
      })()}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.headlines.map((h) => {
          if (!h) return null;
          const g = getGame(h.gameId);
          const value = "score" in h && h.score !== undefined && g ? formatScoreWithUnit(h.score, g) : `${Math.round(Number("value" in h ? h.value : 0))} ${STAT_LABEL["stat" in h ? String(h.stat) : ""] ?? ""}`;
          return (
            <div key={h.id} className="rounded-2xl bg-white/[0.05] p-3">
              <p className="text-2xl">{h.icon}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-muted">{h.label}</p>
              <p className="font-display text-xl font-black tabular">{value}</p>
              {g && <p className="truncate text-[11px] text-faint">{g.name}</p>}
            </div>
          );
        })}
        <div className="rounded-2xl bg-white/[0.05] p-3">
          <p className="text-2xl">📅</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-muted">Daily wins</p>
          <p className="font-display text-xl font-black">{data.stats?.daily_wins ?? 0}</p>
          <p className="text-[11px] text-faint">Longest streak {data.stats?.longest_streak ?? 0}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-[19px] font-black uppercase">📈 All personal bests</h2>
        <div className="flex flex-col gap-1.5">
          {data.bests.map((b) => {
            const g = getGame(b.gameId)!;
            return (
              <Link key={b.gameId} href={`/games/${g.slug}`} className="press flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2 pr-3 hover:bg-white/[0.07]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnailUrl(toCard(g))} alt="" width={48} height={48} className="h-12 w-12 rounded-xl" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{g.name}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn("h-full rounded-full", b.percentile >= 90 ? "bg-volt" : b.percentile >= 50 ? "bg-ion" : "bg-white/40")} style={{ width: `${Math.max(4, b.percentile)}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display font-black tabular">{formatScoreWithUnit(b.score, g)}</p>
                  <p className="text-[11px] text-muted">#{b.rank.toLocaleString("en-US")} · better than {b.percentile}%</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-[19px] font-black uppercase">🏆 Achievements</h2>
        <TrophyCabinet achievements={data.achievements} />
      </section>
    </div>
  );
}
