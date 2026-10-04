"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameSummary } from "@/games/registry";
import { getCategory } from "@/games/taxonomy";
import type { PlayMode } from "@/games/core/types";
import { formatScoreWithUnit } from "@/games/core/format";
import { api } from "@/lib/client/api";
import { Button, buttonClass } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { DifficultyMeter } from "@/components/game/DifficultyMeter";
import { thumbnailUrl } from "@/components/game/types";
import { LeaderboardTabs } from "@/components/leaderboard/LeaderboardTabs";
import { Avatar } from "@/components/player/Avatar";
import { Flag } from "@/components/player/Flag";
import type { BoardEntry } from "@/lib/leaderboards/compose";
import { ReportButton } from "./ReportButton";

const CONTROL_LABEL: Record<string, string> = { tap: "👆 Tap", hold: "✋ Hold", swipe: "👉 Swipe", drag: "☝️ Drag", keyboard: "⌨️ Keys", head: "🙂 Head", face: "😮 Face", voice: "🎤 Voice" };

interface Summary {
  enabled: boolean;
  record: BoardEntry | null;
  todayTop: BoardEntry | null;
  totalPlayers: number;
  playCount: number;
  personalBest: number | null;
  myPlays: number;
}

/** Pre-game screen: everything a first-timer needs in two seconds, then a giant PLAY. */
export function PreGame({
  game,
  mode,
  challenge,
  localBest,
  onPlay,
  favorite,
  onToggleFavorite,
  boardKey,
}: {
  game: GameSummary;
  mode: PlayMode;
  challenge: { score: number; creator: { username: string } } | null;
  localBest: number | null;
  onPlay: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  boardKey: number;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const cat = getCategory(game.category);

  useEffect(() => {
    api<Summary>(`/api/games/${game.id}/summary`)
      .then(setSummary)
      .catch(() => setFailed(true));
  }, [game.id, boardKey]);

  const best = summary?.personalBest ?? localBest;
  const disabled = summary?.enabled === false;

  return (
    <div className="animate-rise px-4 pt-4 sm:px-0">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/games" className="press rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-muted hover:text-text">
          ← All games
        </Link>
        <div className="flex gap-2">
          <button type="button" onClick={onToggleFavorite} className="press grid h-9 w-9 place-items-center rounded-full bg-white/5 text-lg" aria-pressed={favorite} aria-label={favorite ? "Remove from favourites" : "Add to favourites"}>
            {favorite ? "❤️" : "🤍"}
          </button>
          <ReportButton gameId={game.id} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,420px)_1fr] md:gap-6">
        <div className="flex items-center gap-4 md:block">
          <div className="noise relative w-[34%] shrink-0 overflow-hidden rounded-[22px] border border-white/10 md:w-full md:rounded-[28px]" style={{ background: `linear-gradient(135deg, ${game.theme.bg[0]}, ${game.theme.bg[1]})` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl(game)} alt={`${game.name} artwork`} width={400} height={400} fetchPriority="high" className="aspect-square w-full" />
            <div className="absolute left-2 top-2 hidden gap-1 md:flex">
              {game.isNew && <Pill tone="volt">New</Pill>}
              {game.usesCamera && <Pill tone="ion">📸 Camera</Pill>}
              {game.usesMicrophone && <Pill tone="sun">🎤 Mic</Pill>}
            </div>
          </div>
          <div className="min-w-0 md:hidden">
            <h1 className="font-display text-[32px] font-black uppercase leading-[0.9] tracking-tight">{game.name}</h1>
            <p className="mt-1.5 text-sm leading-snug text-muted">{game.shortDescription}</p>
          </div>
        </div>

        <div className="flex flex-col">
          <h1 className="hidden font-display text-[52px] font-black uppercase leading-[0.9] tracking-tight md:block">{game.name}</h1>
          <p className="mt-2 hidden text-muted md:block">{game.shortDescription}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted md:mt-3">
            <span className="rounded-full bg-white/5 px-2.5 py-1">{cat?.emoji} {cat?.label}</span>
            <span className="rounded-full bg-white/5 px-2.5 py-1"><DifficultyMeter difficulty={game.difficulty} /></span>
            <span className="rounded-full bg-white/5 px-2.5 py-1">⏱ ~{game.estimatedDuration}s</span>
            {game.controls.filter((c) => c !== "keyboard").map((c) => (
              <span key={c} className="rounded-full bg-white/5 px-2.5 py-1">{CONTROL_LABEL[c]}</span>
            ))}
            {game.usesCamera && <span className="rounded-full bg-ion/15 px-2.5 py-1 text-ion md:hidden">📸 Camera</span>}
            {game.usesMicrophone && <span className="rounded-full bg-sun/15 px-2.5 py-1 text-sun md:hidden">🎤 Mic</span>}
          </div>

          {mode === "challenge" && challenge && (
            <div className="mt-4 rounded-2xl border border-sun/40 bg-sun/10 p-3 text-sm">
              ⚔️ <b>{challenge.creator.username}</b> scored <b>{formatScoreWithUnit(challenge.score, game)}</b>. Same level, same rules. Can you beat it?
            </div>
          )}
          {mode === "daily" && (
            <div className="mt-4 rounded-2xl border border-volt/40 bg-volt/10 p-3 text-sm text-volt">📅 Daily Challenge — everyone plays the exact same level today.</div>
          )}

          <div className="mt-3 rounded-2xl bg-white/[0.04] p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted">How to play</p>
            <p className="mt-1 text-lg font-bold leading-snug">{game.instructions}</p>
            {game.howTo && (
              <ul className="mt-2 hidden space-y-1 text-sm text-muted md:block">
                {game.howTo.map((h) => (
                  <li key={h}>• {h}</li>
                ))}
              </ul>
            )}
            {game.accessibility?.note && <p className="mt-2 text-xs text-sun">♿ {game.accessibility.note}</p>}
          </div>

          <Button size="xl" className="mt-4 w-full" onClick={onPlay} disabled={disabled} data-testid="play-button">
            {disabled ? "Unavailable" : mode === "challenge" ? "⚔️ Play challenge" : mode === "daily" ? "▶ Play daily" : "▶ Play"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-faint">No sign-up needed. Space / Enter works on desktop.</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile label="Your best" value={best !== null && best !== undefined ? formatScoreWithUnit(best, game) : "—"} loading={false} />
            <StatTile
              label="World record"
              value={summary?.record ? formatScoreWithUnit(summary.record.score, game) : failed ? "—" : summary ? "Open" : ""}
              sub={summary?.record ? <><Flag code={summary.record.country} /> {summary.record.username}</> : undefined}
              loading={!summary && !failed}
            />
            <StatTile label="Today's top" value={summary?.todayTop ? formatScoreWithUnit(summary.todayTop.score, game) : failed ? "—" : summary ? "Open" : ""} sub={summary?.todayTop?.username} loading={!summary && !failed} />
          </div>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-[19px] font-black uppercase">🏆 Leaderboard</h2>
          <Link href={`/games/${game.slug}/leaderboard`} className="text-xs font-bold text-muted hover:text-text">
            Top 100 →
          </Link>
        </div>
        <LeaderboardTabs gameId={game.id} format={game.scoreFormat} unit={game.scoreUnit} limit={5} refreshKey={boardKey} />
        {summary?.record && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sun/20 to-transparent p-3">
            <Avatar id={summary.record.avatar} size={40} />
            <div className="text-sm">
              <p className="font-black">👑 {summary.record.username} holds the record</p>
              <p className="text-muted">{summary.totalPlayers.toLocaleString("en-US")} players ranked · {summary.playCount.toLocaleString("en-US")} plays</p>
            </div>
            <Link href={`/u/${summary.record.username}`} className={buttonClass("secondary", "sm", "ml-auto")}>View</Link>
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value, sub, loading }: { label: string; value: string; sub?: React.ReactNode; loading: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      {loading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="truncate font-display text-lg font-black tabular">{value}</p>}
      {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
