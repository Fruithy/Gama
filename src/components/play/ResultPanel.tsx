"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatScore, formatScoreWithUnit, scoreGap } from "@/games/core/format";
import type { GameResult, PlayMode } from "@/games/core/types";
import type { SubmitRunResponse } from "@/lib/runs/types";
import { RANK_TIER_LABEL } from "@/lib/leaderboards/compose";
import { flagEmoji } from "@/lib/country";
import { pickTaunt } from "@/lib/brand";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { GameSummary } from "@/games/registry";
import type { CardGame } from "@/components/game/types";
import { RatingPrompt } from "./RatingPrompt";

export type SubmitState =
  | { state: "submitting" }
  | { state: "done"; response: SubmitRunResponse }
  | { state: "queued"; message: string }
  | { state: "error"; message: string }
  | { state: "unranked"; message: string };

function useCountUp(target: number, enabled: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    const dur = Math.min(900, 300 + target * 8);
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return enabled ? v : target;
}

export function ResultPanel({
  game,
  result,
  submit,
  localBest,
  isLocalBest,
  mode,
  challengeTarget,
  nextGame,
  armed,
  showRating,
  reducedMotion,
  onRetry,
  onExit,
  onChallenge,
  onShare,
}: {
  game: GameSummary;
  result: GameResult;
  submit: SubmitState;
  localBest: number | null;
  isLocalBest: boolean;
  mode: PlayMode;
  challengeTarget?: { username: string; score: number } | null;
  nextGame?: CardGame | null;
  armed: boolean;
  showRating: boolean;
  reducedMotion: boolean;
  onRetry: () => void;
  onExit: () => void;
  onChallenge: () => void;
  onShare: () => void;
}) {
  const res = submit.state === "done" ? submit.response : null;
  const lowerFailed = game.scoreDirection === "lower" && !result.completed;
  const counted = useCountUp(result.score, !reducedMotion && game.scoreFormat !== "centiseconds" && !lowerFailed);
  const shown = game.scoreFormat === "centiseconds" ? result.score : counted;
  const global = res?.ranks?.global;
  const tier = global?.tier ?? null;
  const pbNew = res?.personalBest?.isNew ?? isLocalBest;
  const best = res?.personalBest?.best ?? localBest;
  const ch = res?.challenge;

  let headline: React.ReactNode = result.reason ?? "GAME OVER";
  let headlineClass = "text-white";
  if (lowerFailed) {
    headline = result.reason ?? "FAILED";
    headlineClass = "text-flare";
  } else if (mode === "challenge" && ch) {
    headline = ch.won ? "YOU WON" : ch.tie ? "DEAD HEAT" : `YOU LOST BY ${scoreGap(result.score, ch.opponent.score, game)}`;
    headlineClass = ch.won ? "text-volt" : ch.tie ? "text-sun" : "text-flare";
  } else if (global) {
    headline = (
      <>
        YOU&apos;RE <span className="text-volt">#{global.rank.toLocaleString("en-US")}</span> IN THE WORLD
      </>
    );
  }

  const hasRun = submit.state === "done" && res?.status === "accepted";

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-black/75 backdrop-blur-md" role="dialog" aria-label="Results">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-[calc(24px+var(--safe-bottom))] pt-[calc(56px+var(--safe-top))]">
        {tier && !lowerFailed && (
          <div className={cn("mx-auto mb-3 animate-pop rounded-full px-4 py-1.5 font-display text-sm font-black tracking-widest", tier === "world-record" ? "bg-sun text-black" : "bg-volt text-black")}>
            {tier === "world-record" ? "👑 " : "🏆 "}
            {RANK_TIER_LABEL[tier]}
          </div>
        )}
        <h2 className={cn("animate-rise text-center font-display text-[26px] font-black uppercase leading-tight", headlineClass)}>{headline}</h2>

        {!lowerFailed && (
          <div className="mt-2 animate-pop text-center">
            <div className="font-display text-[96px] font-black leading-none tracking-tighter tabular text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.4)]" aria-live="polite">
              {formatScore(shown, game.scoreFormat)}
            </div>
            {game.scoreUnit && <div className="-mt-1 text-sm font-bold uppercase tracking-widest text-muted">{game.scoreUnit}</div>}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          {pbNew && !lowerFailed ? (
            <span className="animate-pop rounded-full bg-sun px-3 py-1 font-black uppercase text-black">⭐ New personal best</span>
          ) : best !== null && best !== undefined ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-muted">
              Best <b className="text-text">{formatScoreWithUnit(best, game)}</b>
              {!lowerFailed && result.score !== best && <> · {scoreGap(result.score, best, game)} off</>}
            </span>
          ) : null}
          {mode === "challenge" && challengeTarget && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-muted">
              vs {challengeTarget.username}: <b className="text-text">{formatScoreWithUnit(challengeTarget.score, game)}</b>
            </span>
          )}
        </div>

        {/* Rank strip */}
        {res?.ranks && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="World" value={`#${res.ranks.global.rank.toLocaleString("en-US")}`} sub={res.ranks.global.percentile >= 50 ? `top ${Math.max(1, 100 - res.ranks.global.percentile)}%` : `of ${res.ranks.global.total.toLocaleString("en-US")}`} />
            <Stat label={res.ranks.country ? `${flagEmoji(res.ranks.country.code)} Country` : "Country"} value={res.ranks.country ? `#${res.ranks.country.rank.toLocaleString("en-US")}` : "—"} sub={res.ranks.country ? `of ${res.ranks.country.total.toLocaleString("en-US")}` : "set in profile"} />
            <Stat label="Today" value={`#${res.ranks.today.rank.toLocaleString("en-US")}`} sub={`of ${res.ranks.today.total.toLocaleString("en-US")}`} />
          </div>
        )}
        {res?.nextTarget && (
          <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-center text-sm">
            🎯 <b>{scoreGap(res.nextTarget.score, result.score, game)}</b> more to pass <b>{res.nextTarget.username}</b> for #{res.nextTarget.rank.toLocaleString("en-US")}
          </p>
        )}
        {res?.daily && (
          <p className="mt-3 rounded-2xl border border-volt/30 bg-volt/10 px-3 py-2 text-center text-sm text-volt">
            📅 Daily #{res.daily.rank.toLocaleString("en-US")} of {res.daily.total.toLocaleString("en-US")} · attempt {res.daily.attempts} · 🔥 {res.daily.streak}-day streak
          </p>
        )}

        {/* Status line — honest about what happened to the score */}
        <div className="mt-3 min-h-[22px] text-center text-xs">
          {submit.state === "submitting" && <span className="animate-pulse text-muted">Ranking your score…</span>}
          {submit.state === "queued" && <span className="text-sun">💾 {submit.message}</span>}
          {submit.state === "error" && <span className="text-flare">{submit.message}</span>}
          {submit.state === "unranked" && <span className="text-muted">{submit.message}</span>}
          {res?.status === "flagged" && <span className="text-sun">Score under review — it&apos;ll appear on the leaderboard once verified.</span>}
          {res?.status === "rejected" && <span className="text-flare">This run couldn&apos;t be verified, so it wasn&apos;t ranked.</span>}
        </div>

        {res?.xp && res.xp.gained > 0 && (
          <div className="mt-1 rounded-2xl bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-volt">+{res.xp.gained} XP</span>
              <span className="text-muted">{res.xp.levelUp ? `🎉 Level ${res.xp.level}!` : `Level ${res.xp.level}`}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-volt to-ion transition-[width] duration-700" style={{ width: `${Math.round(res.xp.progress * 100)}%` }} />
            </div>
          </div>
        )}
        {res?.achievements && res.achievements.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {res.achievements.map((a) => (
              <div key={a.id} className="flex animate-pop items-center gap-3 rounded-2xl border border-sun/40 bg-sun/10 px-3 py-2">
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-black">Achievement: {a.name}</p>
                  <p className="text-xs text-muted">{a.description}</p>
                </div>
                <span className="text-xs font-bold text-sun">+{a.xp}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-6">
          <Button size="xl" className="w-full" onClick={onRetry} disabled={!armed} autoFocus aria-keyshortcuts="R">
            ↻ {mode === "challenge" ? "Rematch" : "Retry"}
          </Button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="light" size="md" onClick={onChallenge} disabled={!hasRun}>
              ⚔️ Challenge
            </Button>
            <Button variant="secondary" size="md" onClick={onShare}>
              ↗ Share
            </Button>
            <Link href={`/games/${game.slug}/leaderboard`} className={buttonClass("secondary", "md")}>
              🏆 Top 100
            </Link>
            {nextGame ? (
              <Link href={`/games/${nextGame.slug}?play=1`} className={buttonClass("secondary", "md")}>
                Next game →
              </Link>
            ) : (
              <Button variant="secondary" size="md" onClick={onExit}>
                Exit
              </Button>
            )}
          </div>
          {!hasRun && submit.state !== "submitting" && <p className="mt-2 text-center text-[11px] text-faint">Challenges need a verified online score.</p>}
          {showRating && (
            <div className="mt-4">
              <RatingPrompt gameId={game.id} />
            </div>
          )}
          <p className="mt-4 text-center text-xs italic text-faint">“{pickTaunt(result.score + result.metadata.actions)}”</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-2 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="font-display text-lg font-black tabular">{value}</div>
      <div className="text-[10px] text-faint">{sub}</div>
    </div>
  );
}
