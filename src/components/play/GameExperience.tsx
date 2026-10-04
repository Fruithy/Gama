"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getGame, type GameSummary } from "@/games/registry";
import type { GameResult, GameRuntime, HudState, PlayMode } from "@/games/core/types";
import { getAudio } from "@/games/core/audio";
import { haptics } from "@/games/core/haptics";
import { randomSeed } from "@/games/core/rng";
import { formatScore, formatScoreWithUnit } from "@/games/core/format";
import type { CameraService } from "@/games/core/camera";
import type { MicService } from "@/games/core/mic";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/analytics";
import { getLocalBests, incrementPlays, pushRecent, recordLocalBest, wasRated } from "@/lib/client/local";
import type { StartRunResponse } from "@/lib/runs/types";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { Button } from "@/components/ui/Button";
import type { CardGame } from "@/components/game/types";
import { buildSubmission, startServerRun, submitServerRun } from "./run-client";
import { ResultPanel, type SubmitState } from "./ResultPanel";
import { ShareSheet } from "./ShareSheet";
import { PermissionGate, type PermissionState } from "./PermissionGate";
import { PreGame } from "./PreGame";

type Phase = "intro" | "loading" | "permission" | "ready" | "countdown" | "playing" | "paused" | "over" | "error";

interface ChallengeInfo {
  token: string;
  score: number;
  seed: string;
  creator: { username: string };
}

/** Delay before the result screen accepts input (prevents tap-through retries). */
const RESULT_ARM_MS = 650;
const COUNT_STEP_MS = 420;
/** If the server run hasn't been issued by the end of the countdown, wait this long before going offline. */
const SESSION_GRACE_MS = 1500;
/** Ask "Fun?" from this many plays on. */
const RATING_AFTER_PLAYS = 3;

export function GameExperience({ game, related }: { game: GameSummary; related: CardGame[] }) {
  const def = useMemo(() => getGame(game.slug)!, [game.slug]);
  const params = useSearchParams();
  const router = useRouter();
  const { player, flags, refresh, isFavorite, toggleFavorite } = usePlayer();

  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<HudState>({});
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ state: "submitting" });
  const [armed, setArmed] = useState(false);
  const [localBest, setLocalBest] = useState<number | null>(null);
  const [isLocalBest, setIsLocalBest] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [share, setShare] = useState<{ url: string; text: string; title: string } | null>(null);
  const [perm, setPerm] = useState<PermissionState>({ kind: "none" });
  const [mode, setMode] = useState<PlayMode>("normal");
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [dailySeed, setDailySeed] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const sessionRef = useRef<StartRunResponse | null>(null);
  const nextSessionRef = useRef<Promise<StartRunResponse | null> | null>(null);
  const cameraRef = useRef<CameraService | null>(null);
  const micRef = useRef<MicService | null>(null);
  const phaseRef = useRef<Phase>("intro");
  const timers = useRef<number[]>([]);
  const reducedMotion = useRef(false);
  const modeRef = useRef<PlayMode>("normal");
  const challengeRef = useRef<ChallengeInfo | null>(null);
  const dailySeedRef = useRef<string | null>(null);

  phaseRef.current = phase;
  modeRef.current = mode;
  challengeRef.current = challenge;
  dailySeedRef.current = dailySeed;

  /* ── boot: preload this game's chunk immediately, read mode from URL ────── */
  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMuted(getAudio().muted);
    setLocalBest(getLocalBests()[game.slug] ?? null);
    void def.load?.(); // warm the code-split game chunk while the player reads the instructions
    track("game_opened", game.id);
  }, [def, game.id, game.slug]);

  useEffect(() => {
    const token = params.get("challenge");
    const wantDaily = params.get("mode") === "daily";
    if (token) {
      api<ChallengeInfo & { gameId: string }>(`/api/challenges/${token}`)
        .then((c) => {
          if (c.gameId !== game.id) return;
          setChallenge(c);
          setMode("challenge");
        })
        .catch(() => {});
    } else if (wantDaily) {
      api<{ challenge: { gameId: string; seed: string } }>("/api/daily")
        .then((d) => {
          if (d.challenge.gameId === game.id) {
            setMode("daily");
            setDailySeed(d.challenge.seed);
          }
        })
        .catch(() => {});
    }
  }, [params, game.id]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  /* ── body lock while the stage is open ─────────────────────────────────── */
  const stageOpen = phase !== "intro";
  useEffect(() => {
    if (!stageOpen) return;
    document.body.classList.add("game-lock");
    return () => document.body.classList.remove("game-lock");
  }, [stageOpen]);

  /* ── auto-pause when the tab/app goes to background ─────────────────────── */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && phaseRef.current === "playing") {
        runtimeRef.current?.pause();
        setPhase("paused");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const requestSession = useCallback((): Promise<StartRunResponse | null> => {
    const m = modeRef.current;
    return startServerRun(game.id, game.version, m, challengeRef.current?.token).then((r) => {
      if ("error" in r) {
        if (r.error === "version_mismatch") setErrorMsg(r.message);
        return null;
      }
      return r;
    });
  }, [game.id, game.version]);

  /** Seed to use when the server can't issue one (offline): shared seeds for daily/challenge stay fair. */
  const fallbackSeed = () => (modeRef.current === "challenge" && challengeRef.current ? challengeRef.current.seed : modeRef.current === "daily" && dailySeedRef.current ? dailySeedRef.current : randomSeed());

  /* ── countdown → start ─────────────────────────────────────────────────── */
  const beginCountdown = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    clearTimers();
    setResult(null);
    setArmed(false);
    setSubmit({ state: "submitting" });
    sessionRef.current = null;
    const pending = nextSessionRef.current ?? requestSession();
    nextSessionRef.current = null;
    let resolved = false;
    pending.then((s) => {
      resolved = true;
      sessionRef.current = s;
      // Seed the level during the countdown so the board is visible before GO.
      if (phaseRef.current === "countdown") rt.reset(s?.seed ?? fallbackSeed());
    });
    rt.reset(fallbackSeed());
    setPhase("countdown");
    const audio = getAudio();
    const steps = [3, 2, 1];
    steps.forEach((n, i) =>
      later(() => {
        setCount(n);
        audio.play("tick", { pitch: 1 + i * 0.15 });
      }, i * COUNT_STEP_MS),
    );
    const go = () => {
      setCount(0);
      audio.play("go");
      haptics.heavy();
      rt.start();
      setPhase("playing");
    };
    later(() => {
      if (resolved) go();
      else {
        const waitStart = Date.now();
        const poll = () => {
          if (resolved || Date.now() - waitStart > SESSION_GRACE_MS) go();
          else later(poll, 60);
        };
        poll();
      }
    }, steps.length * COUNT_STEP_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSession]);

  /* ── game over ─────────────────────────────────────────────────────────── */
  const handleGameOver = useCallback(
    async (r: GameResult) => {
      setResult(r);
      setPhase("over");
      later(() => setArmed(true), RESULT_ARM_MS);
      const plays = incrementPlays(game.slug);
      pushRecent(game.slug);
      setShowRating(flags.ratings && plays >= RATING_AFTER_PLAYS && !wasRated(game.slug));
      const practice = r.ranked === false;
      const rankable = !practice && (game.scoreDirection === "higher" || r.completed);
      let localPb = false;
      if (rankable) {
        const prev = getLocalBests()[game.slug] ?? null;
        localPb = recordLocalBest(game.slug, r.score, game.scoreDirection);
        setIsLocalBest(localPb && prev !== null);
        setLocalBest(localPb ? r.score : prev);
      } else if (!practice) {
        track("game_failed", game.id, { reason: r.reason ?? "fail" });
      }
      if (localPb) {
        getAudio().play("levelup");
        haptics.success();
      }
      // Pre-issue the next run so RETRY is instant.
      nextSessionRef.current = requestSession();

      const session = sessionRef.current;
      if (!rankable) {
        setSubmit({
          state: "unranked",
          message: practice ? "Practice mode (touch controls) — not ranked. Allow the camera/mic to compete." : "Runs that end early don't count. Try again!",
        });
        return;
      }
      if (!session) {
        setSubmit({ state: "queued", message: "Offline run — score saved on this device only." });
        return;
      }
      const outcome = await submitServerRun(buildSubmission(session, game.id, game.version, r));
      if (outcome.kind === "ok") {
        setSubmit({ state: "done", response: outcome.response });
        setBoardKey((k) => k + 1);
        if (outcome.response.ranks?.global.tier) haptics.success();
        if (!player) void refresh();
        else if (outcome.response.xp?.levelUp || (outcome.response.achievements?.length ?? 0) > 0) void refresh();
      } else if (outcome.kind === "queued") {
        setSubmit({ state: "queued", message: outcome.message });
        track("score_submit_failed", game.id);
      } else {
        setSubmit({ state: "error", message: outcome.message });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, requestSession, player, refresh, flags.ratings],
  );

  /* ── mount the runtime into the stage ──────────────────────────────────── */
  const mountRuntime = useCallback(async () => {
    if (!def.load) throw new Error("Game has no runtime");
    // The stage element renders on the next React commit after phase → "loading".
    for (let i = 0; i < 60 && !stageRef.current; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
    if (!stageRef.current) throw new Error("Stage not mounted");
    const mod = await def.load();
    if (!stageRef.current) return;
    runtimeRef.current?.destroy();
    const rt = mod.default(def);
    runtimeRef.current = rt;
    rt.onGameOver((r) => void handleGameOver(r));
    await rt.initialize({
      container: stageRef.current,
      seed: fallbackSeed(),
      mode: modeRef.current,
      definition: def,
      audio: getAudio(),
      haptics,
      reducedMotion: reducedMotion.current,
      onHud: setHud,
      camera: cameraRef.current ?? undefined,
      mic: micRef.current ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, handleGameOver]);

  const stopDevices = () => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    setCameraOn(false);
  };

  /* ── PLAY ──────────────────────────────────────────────────────────────── */
  const play = useCallback(async () => {
    getAudio().unlock(); // inside the user gesture
    setErrorMsg("");
    setPhase("loading");
    if ((game.usesCamera && flags.cameraGames) || (game.usesMicrophone && flags.micGames)) {
      if (!cameraRef.current && !micRef.current) {
        setPerm({ kind: game.usesCamera ? "camera" : "mic", status: "explain" });
        setPhase("permission");
        return;
      }
    }
    try {
      await mountRuntime();
      beginCountdown();
    } catch (e) {
      console.error(e);
      setErrorMsg("This game failed to load. Check your connection and try again.");
      setPhase("error");
    }
  }, [game.usesCamera, game.usesMicrophone, flags.cameraGames, flags.micGames, mountRuntime, beginCountdown]);

  const onPermissionResolved = useCallback(
    async (outcome: { camera?: CameraService; mic?: MicService; denied?: boolean }) => {
      if (outcome.camera) {
        cameraRef.current = outcome.camera;
        previewRef.current?.appendChild(outcome.camera.video);
        setCameraOn(true);
        // Wait for the on-device face model before the countdown so the first seconds are playable.
        setPhase("loading");
        setLoadingMsg("Loading face tracking…");
        const status = await outcome.camera.startTracking();
        setLoadingMsg("");
        if (status === "failed") setErrorMsg("Face tracking isn't available on this device — touch practice mode instead.");
      }
      if (outcome.mic) micRef.current = outcome.mic;
      if (outcome.denied) track(game.usesCamera ? "camera_denied" : "mic_denied", game.id);
      setPerm({ kind: "none" });
      setPhase("loading");
      try {
        await mountRuntime();
        beginCountdown();
      } catch {
        setErrorMsg("This game failed to load.");
        setPhase("error");
      }
    },
    [game.id, game.usesCamera, mountRuntime, beginCountdown],
  );

  // ?play=1 → straight into the stage (from "Next game" / challenge pages).
  const autoplayed = useRef(false);
  useEffect(() => {
    if (autoplayed.current || params.get("play") !== "1") return;
    autoplayed.current = true;
    setPhase("ready");
  }, [params]);

  const retry = useCallback(() => {
    if (phaseRef.current !== "over" && phaseRef.current !== "paused") return;
    track("retry", game.id);
    getAudio().unlock();
    runtimeRef.current?.reset();
    beginCountdown();
  }, [game.id, beginCountdown]);

  const exit = useCallback(() => {
    clearTimers();
    runtimeRef.current?.destroy();
    runtimeRef.current = null;
    stopDevices();
    setPhase("intro");
    setHud({});
    setBoardKey((k) => k + 1);
    if (params.get("play") || params.get("mode") || params.get("challenge")) router.replace(`/games/${game.slug}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.slug, params, router]);

  const pause = () => {
    if (phaseRef.current !== "playing") return;
    runtimeRef.current?.pause();
    setPhase("paused");
  };
  const resume = () => {
    runtimeRef.current?.resume();
    setPhase("playing");
  };

  useEffect(() => () => {
    clearTimers();
    runtimeRef.current?.destroy();
    stopDevices();
  }, []);

  // Keyboard: Esc pauses / exits, R retries on the result screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phaseRef.current === "playing") pause();
        else if (phaseRef.current === "paused" || phaseRef.current === "over") exit();
      } else if ((e.key === "r" || e.key === "R") && phaseRef.current === "over" && armed) retry();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleMute = () => {
    const a = getAudio();
    a.setMuted(!a.muted);
    setMuted(a.muted);
  };

  /* ── challenge + share ─────────────────────────────────────────────────── */
  const runId = submit.state === "done" && submit.response.status === "accepted" ? submit.response.runId : null;
  const scoreText = result ? formatScoreWithUnit(result.score, game) : "";

  const openChallenge = async () => {
    if (!runId) return;
    try {
      const { url } = await api<{ url: string }>("/api/challenges", { json: { runId } });
      setShare({ url, title: "Challenge a friend", text: `${player?.username ?? "I"} scored ${scoreText} in ${game.name}. Can you beat it?` });
    } catch {
      setShare({ url: `${location.origin}/games/${game.slug}`, title: "Challenge a friend", text: `I scored ${scoreText} in ${game.name}. You're not beating this.` });
    }
  };
  const openShare = async () => {
    if (runId) {
      try {
        const { url } = await api<{ url: string }>("/api/challenges", { json: { runId } });
        setShare({ url, title: "Share your score", text: `I scored ${scoreText} in ${game.name}. You're not beating this.` });
        return;
      } catch {
        /* fall back to the game link */
      }
    }
    setShare({ url: `${location.origin}/games/${game.slug}`, title: "Share", text: `${game.name} on FILTER ARCADE — ${game.shortDescription}` });
  };

  const nextGame = related[0] ?? null;
  const target = mode === "challenge" && challenge ? challenge.score : null;

  return (
    <>
      <PreGame
        game={game}
        mode={mode}
        challenge={challenge}
        localBest={localBest}
        onPlay={play}
        favorite={isFavorite(game.slug)}
        onToggleFavorite={() => toggleFavorite(game.slug)}
        boardKey={boardKey}
      />

      {stageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" style={{ touchAction: "none" }}>
          {/* Phone-shaped stage: full screen on phones, centred 9:17 on desktop */}
          <div
            className="relative h-full w-full overflow-hidden md:aspect-[9/17] md:h-[min(92dvh,900px)] md:w-auto md:rounded-[36px] md:border md:border-white/10 md:shadow-2xl"
            style={{ background: `linear-gradient(${game.theme.bg[0]}, ${game.theme.bg[1]})` }}
          >
              <div ref={stageRef} className="absolute inset-0" data-testid="game-stage" />

              {/* HUD */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 pt-[calc(10px+var(--safe-top))]">
                <div className="pointer-events-auto flex gap-1.5">
                  <HudButton label="Exit game" onClick={exit}>✕</HudButton>
                  {phase === "playing" && <HudButton label="Pause" onClick={pause}>❚❚</HudButton>}
                </div>
                {(phase === "playing" || phase === "countdown" || phase === "paused") && (
                  <div className="flex flex-col items-center">
                    <div className="font-display text-5xl font-black leading-none tabular text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]" data-testid="hud-score">
                      {hud.scoreText ?? formatScore(hud.score ?? 0, game.scoreFormat)}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs font-black uppercase text-white/90 drop-shadow">
                      {hud.timeLeft !== undefined && <span className="tabular">⏱ {hud.timeLeft.toFixed(1)}s</span>}
                      {hud.lives !== undefined && <span aria-label={`${hud.lives} lives`}>{"♥".repeat(Math.max(0, hud.lives))}<span className="text-white/30">{"♥".repeat(Math.max(0, (hud.maxLives ?? hud.lives) - hud.lives))}</span></span>}
                      {hud.combo !== undefined && hud.combo > 1 && <span className="text-volt">×{hud.combo}</span>}
                      {hud.level !== undefined && <span>LV {hud.level}</span>}
                      {hud.label && <span>{hud.label}</span>}
                      {target !== null && <span className="text-sun">Beat {formatScore(target, game.scoreFormat)}</span>}
                    </div>
                  </div>
                )}
                <div className="pointer-events-auto flex gap-1.5">
                  <HudButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>{muted ? "🔇" : "🔊"}</HudButton>
                </div>
              </div>

              {/* Camera indicator + live preview (camera games) */}
              <div className={`absolute bottom-[calc(12px+var(--safe-bottom))] right-3 z-20 ${cameraOn ? "" : "hidden"}`}>
                <div className="flex flex-col items-end gap-1.5">
                  <div ref={previewRef} className="h-[92px] w-[70px] overflow-hidden rounded-2xl border-2 border-flare bg-black [&>video]:h-full [&>video]:w-full [&>video]:scale-x-[-1] [&>video]:object-cover" />
                  <button type="button" onClick={stopDevices} className="press rounded-full bg-flare px-2.5 py-1 text-[10px] font-black uppercase text-white">
                    ● Stop camera
                  </button>
                </div>
              </div>

              {phase === "loading" && (
                <Overlay>
                  <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-volt" aria-label="Loading" />
                  {loadingMsg && <p className="mt-4 text-sm font-semibold text-white/85">{loadingMsg}</p>}
                </Overlay>
              )}

              {phase === "ready" && (
                <Overlay>
                  <p className="font-display text-3xl font-black uppercase text-white">{game.name}</p>
                  <p className="mt-2 max-w-xs text-center text-white/80">{game.instructions}</p>
                  <Button size="xl" className="mt-6 px-14" onClick={() => void play()}>▶ Tap to start</Button>
                </Overlay>
              )}

              {phase === "countdown" && (
                <Overlay transparent>
                  <div key={count} className="animate-pop font-display text-[140px] font-black leading-none text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.35)]">
                    {count > 0 ? count : "GO"}
                  </div>
                  <p className="mt-2 rounded-full bg-black/40 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">{game.instructions}</p>
                </Overlay>
              )}

              {phase === "paused" && (
                <Overlay>
                  <p className="font-display text-4xl font-black uppercase text-white">Paused</p>
                  <div className="mt-6 flex w-64 flex-col gap-2">
                    <Button size="lg" onClick={resume}>▶ Resume</Button>
                    <Button size="lg" variant="secondary" onClick={() => { setPhase("over"); retry(); }}>↻ Restart</Button>
                    <Button size="lg" variant="ghost" onClick={exit}>Exit</Button>
                  </div>
                </Overlay>
              )}

              {phase === "permission" && perm.kind !== "none" && <PermissionGate game={game} perm={perm} setPerm={setPerm} onResolved={onPermissionResolved} onCancel={exit} />}

              {phase === "error" && (
                <Overlay>
                  <p className="text-4xl">😵</p>
                  <p className="mt-2 max-w-xs text-center text-white">{errorMsg}</p>
                  <div className="mt-5 flex gap-2">
                    <Button onClick={() => void play()}>Try again</Button>
                    <Button variant="secondary" onClick={exit}>Exit</Button>
                  </div>
                </Overlay>
              )}

              {phase === "over" && result && (
                <ResultPanel
                  game={game}
                  result={result}
                  submit={submit}
                  localBest={localBest}
                  isLocalBest={isLocalBest}
                  mode={mode}
                  challengeTarget={challenge ? { username: challenge.creator.username, score: challenge.score } : null}
                  nextGame={nextGame}
                  armed={armed}
                  showRating={showRating}
                  reducedMotion={reducedMotion.current}
                  onRetry={retry}
                  onExit={exit}
                  onChallenge={() => void openChallenge()}
                  onShare={() => void openShare()}
                />
              )}
              {errorMsg && phase !== "error" && (
                <div className="absolute inset-x-3 bottom-[calc(12px+var(--safe-bottom))] z-40 rounded-2xl bg-sun px-4 py-3 text-sm font-semibold text-black">
                  {errorMsg} <button className="underline" onClick={() => location.reload()}>Refresh</button>
                </div>
              )}
          </div>
        </div>
      )}

      {share && <ShareSheet open onClose={() => setShare(null)} url={share.url} text={share.text} title={share.title} gameId={game.id} runId={runId} />}
    </>
  );
}

function HudButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="press grid h-10 w-10 place-items-center rounded-full bg-black/35 text-sm font-black text-white backdrop-blur">
      {children}
    </button>
  );
}

function Overlay({ children, transparent = false }: { children: React.ReactNode; transparent?: boolean }) {
  return (
    <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center px-6 ${transparent ? "pointer-events-none" : "bg-black/60 backdrop-blur-sm"}`}>
      {children}
    </div>
  );
}

