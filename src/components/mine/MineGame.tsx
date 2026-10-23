"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { COIN, COIN_GLYPH, ERA_NAMES, GAME_NAME, RIGS, TUNING, UPGRADE_BY_ID } from "@/mine/config";
import { availableUpgrades, baseIncome, hashrate, newState, parseSave, pendingTokens, serialize, type MineState, type OfflineReport } from "@/mine/economy";
import { fmt, fmtDuration, fmtHash } from "@/mine/format";
import { MineScene, type SceneFocus } from "@/mine/scene";
import { MineSession, type MineEvent } from "@/mine/session";
import { getAudio } from "@/games/core/audio";
import { haptics } from "@/games/core/haptics";
import { useHydrated, useReducedMotion } from "@/lib/client/hooks";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/components/ui/cn";
import { ForkPanel, RigList, UpgradeList, type BuyQty, type PanelSnap } from "./panels";

const SAVE_KEY = "fa:mine:v1";
const SAVE_EVERY_S = 5;
const UI_EVERY_S = 0.1;
const DESKTOP = 1024;
const PANEL_W = 400;
const PANEL_MINI = 72;

type Tab = "rigs" | "upgrades" | "fork";

interface Snap extends PanelSnap {
  hash: number;
  hype: number;
  hypeHistory: number[];
  bullLeft: number;
  bullTotal: number;
  tap: number;
}

interface Toast {
  id: number;
  icon: string;
  text: string;
  tone: "gold" | "cyan" | "lime" | "pink";
}

function readSave(): string | null {
  try {
    return window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function writeSave(s: MineState) {
  try {
    window.localStorage.setItem(SAVE_KEY, serialize(s));
  } catch {
    /* storage full / private mode — the session keeps running */
  }
}

function panelHeight(h: number) {
  return Math.min(h * 0.46, 430);
}

/** Where the core, chain and comet band sit for the current layout (CSS px). */
function computeFocus(w: number, h: number, zen: boolean, collapsed: boolean): SceneFocus {
  const desktop = w >= DESKTOP;
  const right = desktop && !zen ? w - PANEL_W : w;
  const top = zen ? 70 : desktop ? 190 : 168;
  const bottom = zen ? h : desktop ? h : h - (collapsed ? PANEL_MINI : panelHeight(h));
  const chainY = bottom - (zen || desktop ? Math.max(90, h * 0.16) : 46);
  const r = Math.max(28, Math.min(130, right * 0.13, (chainY - top - 50) / 4.2));
  const y = top + (chainY - 36 - top) / 2;
  return { x: right / 2, y, r, chainY, skyTop: top + 6, skyBottom: chainY - 40 };
}

function snapshot(session: MineSession): Snap {
  const s = session.state;
  return {
    state: { ...s, rigs: [...s.rigs], upgrades: [...s.upgrades] },
    mods: session.mods,
    income: session.income,
    baseIncome: baseIncome(s, session.mods),
    hash: hashrate(s, session.mods) * session.hype * session.bullMult,
    upgrades: availableUpgrades(s),
    pending: pendingTokens(s),
    hype: session.hype,
    hypeHistory: [...session.hypeHistory],
    bullLeft: session.bullLeft,
    bullTotal: session.bullTotal,
    tap: session.tapValue,
  };
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.05, max - min);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 64).toFixed(1)},${(18 - ((v - min) / span) * 16).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[Math.max(0, values.length - 12)];
  const c = up ? "#3dffb0" : "#ff5c8a";
  return (
    <svg width="64" height="20" viewBox="0 0 64 20" aria-hidden="true" className="overflow-visible">
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
    </svg>
  );
}

const TONES: Record<Toast["tone"], string> = {
  gold: "border-[#ffd24d]/50 bg-[#3a2a05]/80 text-[#ffe9a3]",
  cyan: "border-[#3dd8ff]/40 bg-[#062a3a]/80 text-[#bff3ff]",
  lime: "border-[#d4ff3a]/40 bg-[#26300a]/80 text-[#efffb8]",
  pink: "border-[#ff3d7f]/40 bg-[#3a0a1c]/80 text-[#ffc4d8]",
};

/** Client-only entry: the game reads localStorage and the canvas on first render. */
export function MineApp() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="fixed inset-0 z-50 bg-[#07051a]" aria-busy="true" />;
  return <MineGame />;
}

function MineGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balanceRef = useRef<HTMLSpanElement>(null);
  const sessionRef = useRef<MineSession | null>(null);
  const sceneRef = useRef<MineScene | null>(null);
  const layoutRef = useRef({ zen: false, collapsed: false });
  // Survives effect re-runs (StrictMode mounts twice; the offline credit happens once).
  const welcomeRef = useRef<OfflineReport | null>(null);
  const toastId = useRef(0);
  const reducedMotion = useReducedMotion();

  const [snap, setSnap] = useState<Snap | null>(null);
  const [welcome, setWelcome] = useState<OfflineReport | null>(null);
  const [tab, setTab] = useState<Tab>("rigs");
  const [qty, setQty] = useState<BuyQty>(1);
  const [zen, setZen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmFork, setConfirmFork] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Rendered only after hydration (see MineApp), so reading the saved preference lazily is safe.
  const [muted, setMuted] = useState(() => getAudio().muted);

  const toast = useCallback((icon: string, text: string, tone: Toast["tone"] = "cyan") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, icon, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refreshSnap = useCallback(() => {
    const s = sessionRef.current;
    if (s) setSnap(snapshot(s));
  }, []);

  // Boot: load the save, credit time away, start the render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    document.body.classList.add("game-lock");
    const audio = getAudio();
    const session = new MineSession(parseSave(readSave(), Date.now()), Date.now());
    const scene = new MineScene(canvas, reducedMotion);
    sessionRef.current = session;
    sceneRef.current = scene;
    if (session.offline) {
      welcomeRef.current = session.offline;
      session.offline = null;
    }

    const relayout = (instant: boolean) => {
      const { zen: z, collapsed: c } = layoutRef.current;
      scene.setFocus(computeFocus(window.innerWidth, window.innerHeight, z, c), instant);
    };
    const onResize = () => {
      scene.resize(window.innerWidth, window.innerHeight);
      relayout(true);
    };
    onResize();

    const save = () => {
      session.touch(Date.now());
      writeSave(session.state);
    };

    const handle = (e: MineEvent) => {
      switch (e.type) {
        case "tap":
          if (e.auto) scene.autoTap(`+${fmt(e.value)}`);
          break;
        case "block":
          scene.blockFound(e.height, `+${fmt(e.reward)}`);
          audio.play("coin", { volume: 0.45, pitch: 0.9 + Math.random() * 0.2 });
          break;
        case "rig":
          scene.rigBought(e.index);
          audio.play("pop", { pitch: 0.8 + e.index * 0.05 });
          break;
        case "upgrade":
          scene.upgradeBought(UPGRADE_BY_ID.get(e.id)?.color ?? "#ffffff");
          audio.play("levelup", { volume: 0.7 });
          break;
        case "unlock":
          toast(RIGS[e.index].icon, `New rig discovered: ${RIGS[e.index].name}`, "lime");
          break;
        case "comet-spawn":
          audio.play("whoosh", { volume: 0.8 });
          if (!session.mods.autoComet) toast("🐋", "A whale comet! Tap it before it's gone.", "gold");
          break;
        case "comet-catch":
          scene.cometCaught(e.kind, e.kind === "bull" ? `×${e.amount} income` : `+${fmt(e.amount)}`);
          audio.play("perfect");
          haptics.success();
          toast(
            e.kind === "bull" ? "🚀" : "🐋",
            e.kind === "bull" ? `BULL RUN — everything ×${e.amount} for ${Math.round(session.bullLeft)}s` : `Whale drop: +${fmt(e.amount)} ${COIN}${e.auto ? " (net)" : ""}`,
            "gold",
          );
          break;
        case "bull-end":
          toast("📉", "The bull run cooled off.", "pink");
          break;
        case "fork":
          scene.forked();
          audio.play("go");
          toast("🔷", `Hard fork! +${fmt(e.tokens)} tokens. Welcome to the ${ERA_NAMES[session.state.forks % ERA_NAMES.length]}.`, "cyan");
          break;
        default:
          break;
      }
    };

    let raf = 0;
    let last = performance.now();
    let uiClock = UI_EVERY_S;
    let saveClock = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      session.tick(dt);
      for (const e of session.drain()) handle(e);
      const st = session.state;
      scene.frame(dt, {
        era: st.forks,
        income: session.income,
        blockProgress: st.blockProgress,
        height: st.height,
        rigs: st.rigs,
        bull: session.bullLeft > 0 ? session.bullLeft / Math.max(1, session.bullTotal) : 0,
        drones: session.mods.autoTapsPerSecond,
        comet: session.comet,
      });
      if (balanceRef.current) balanceRef.current.textContent = fmt(st.glint, 4);
      uiClock += dt;
      if (uiClock >= UI_EVERY_S) {
        uiClock = 0;
        setSnap(snapshot(session));
        if (session.offline) {
          welcomeRef.current = session.offline;
          session.offline = null;
        }
        if (welcomeRef.current) {
          setWelcome(welcomeRef.current);
          welcomeRef.current = null;
        }
      }
      saveClock += dt;
      if (saveClock >= SAVE_EVERY_S) {
        saveClock = 0;
        save();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
      else {
        session.resume(Date.now());
        last = performance.now();
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);

    return () => {
      cancelAnimationFrame(raf);
      save();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
      document.body.classList.remove("game-lock");
      sessionRef.current = null;
      sceneRef.current = null;
    };
  }, [reducedMotion, toast]);

  // Glide the core to its new spot when the panel opens/closes or zen toggles.
  useEffect(() => {
    layoutRef.current = { zen, collapsed };
    sceneRef.current?.setFocus(computeFocus(window.innerWidth, window.innerHeight, zen, collapsed));
  }, [zen, collapsed]);

  const tapAt = useCallback((x: number, y: number) => {
    const session = sessionRef.current;
    const scene = sceneRef.current;
    if (!session || !scene) return;
    const audio = getAudio();
    audio.unlock();
    if (session.comet && scene.cometHit(x, y)) {
      session.catchComet();
      return;
    }
    const value = session.tap();
    scene.tapAt(x, y, `+${fmt(value)}`);
    audio.play("tap", { pitch: 0.85 + Math.random() * 0.35, volume: 0.4 });
  }, []);

  // Keyboard: Space/Enter taps the core, Z toggles zen, M mutes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("button, input, dialog, a")) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        const scene = sceneRef.current;
        if (scene) tapAt(scene.core.x + (Math.random() - 0.5) * 30, scene.core.y + (Math.random() - 0.5) * 30);
      } else if (e.key === "z" || e.key === "Z") setZen((z) => !z);
      else if (e.key === "Escape") setZen(false);
      else if (e.key === "m" || e.key === "M") {
        const a = getAudio();
        a.setMuted(!a.muted);
        setMuted(a.muted);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tapAt]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    tapAt(e.clientX, e.clientY);
  };

  const buyRig = (i: number, n: number) => {
    getAudio().unlock();
    if (sessionRef.current?.buyRig(i, n)) {
      haptics.tap();
      refreshSnap();
    }
  };
  const buyUpgrade = (id: string) => {
    getAudio().unlock();
    if (sessionRef.current?.buyUpgrade(id)) {
      haptics.tap();
      refreshSnap();
    }
  };
  const buyAll = () => {
    const s = sessionRef.current;
    if (!s) return;
    for (const u of availableUpgrades(s.state)) if (u.cost <= s.state.glint) s.buyUpgrade(u.id);
    refreshSnap();
  };
  const doFork = () => {
    setConfirmFork(false);
    if (sessionRef.current?.fork()) {
      writeSave(sessionRef.current.state);
      setTab("rigs");
      refreshSnap();
    }
  };
  const doReset = () => {
    setConfirmReset(false);
    const s = sessionRef.current;
    if (!s) return;
    Object.assign(s.state, newState(Date.now()));
    s.resetLive();
    writeSave(s.state);
    refreshSnap();
    toast("🧹", "Fresh start. Your potato laptop awaits.", "pink");
  };
  const toggleMute = () => {
    const a = getAudio();
    a.setMuted(!a.muted);
    setMuted(a.muted);
  };

  const st = snap?.state;
  const bullOn = !!snap && snap.bullLeft > 0;
  const hypeUp = (snap?.hype ?? 1) >= 1;

  return (
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-[#07051a] text-white" style={{ touchAction: "none" }}>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} className="absolute inset-0 h-full w-full cursor-pointer" aria-label="Mining core — tap to mine" role="img" />

      {/* Top bar */}
      <header className={cn("pointer-events-none absolute inset-x-0 top-0 z-10 pt-[var(--safe-top)] transition-opacity duration-500 lg:right-[400px]", zen && "opacity-0")}>
        <div className="flex items-center justify-between px-3 pt-2">
          <Link href="/" className="press pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-lg backdrop-blur" aria-label="Back to the arcade">
            ←
          </Link>
          <div className="text-center leading-none">
            <p className="font-display text-[13px] font-black tracking-[0.18em] text-white/90">{GAME_NAME}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">{st ? ERA_NAMES[st.forks % ERA_NAMES.length] : "Genesis"} era</p>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <button type="button" onClick={toggleMute} className="press grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] backdrop-blur" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? "🔇" : "🔊"}
            </button>
            <button type="button" onClick={() => setZen(true)} className="press grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] backdrop-blur" aria-label="Zen mode — hide the interface">
              ✦
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-col items-center px-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
            <span className="text-[#ffd24d]">{COIN_GLYPH}</span> {COIN} balance
          </p>
          <p className="tabular font-display text-[40px] font-black leading-[1.05] tracking-tight lg:text-[52px]" style={{ textShadow: "0 0 24px rgba(160,120,255,0.65), 0 0 2px #fff" }}>
            <span ref={balanceRef}>0</span>
          </p>
          <p className="tabular mt-0.5 text-[13px] font-bold text-white/75">
            +{fmt(snap?.income ?? 0)}/s <span className="text-white/35">·</span> {fmtHash(snap?.hash ?? 0)}
          </p>
          <div className="pointer-events-auto mt-2 flex items-center gap-1.5">
            <span className={cn("tabular flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold backdrop-blur", hypeUp ? "border-[#3dffb0]/30 bg-[#3dffb0]/10 text-[#9dffd6]" : "border-[#ff5c8a]/30 bg-[#ff5c8a]/10 text-[#ffb0c6]")}>
              {hypeUp ? "▲" : "▼"} Market ×{(snap?.hype ?? 1).toFixed(2)}
              {snap && <Sparkline values={snap.hypeHistory} />}
            </span>
            {bullOn && snap && (
              <span className="tabular relative flex h-7 items-center overflow-hidden rounded-full border border-[#ffd24d]/60 bg-[#3a2a05]/70 px-2.5 text-[11px] font-black text-[#ffe9a3] backdrop-blur">
                <span className="absolute inset-y-0 left-0 bg-[#ffd24d]/25" style={{ width: `${(snap.bullLeft / Math.max(1, snap.bullTotal)) * 100}%` }} />
                <span className="relative">🚀 ×{TUNING.bullMultiplier} · {Math.ceil(snap.bullLeft)}s</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Toasts */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(172px+var(--safe-top))] z-20 flex flex-col items-center gap-1.5 px-4 lg:right-[400px]" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={cn("animate-pop flex max-w-sm items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-bold shadow-lg backdrop-blur-md", TONES[t.tone])}>
            <span aria-hidden="true">{t.icon}</span>
            {t.text}
          </p>
        ))}
      </div>

      {/* Zen exit */}
      {zen && (
        <button
          type="button"
          onClick={() => setZen(false)}
          className="press absolute bottom-[calc(18px+var(--safe-bottom))] right-4 z-30 flex h-11 items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 text-[12px] font-bold text-white/80 backdrop-blur"
        >
          <span className="tabular">{COIN_GLYPH} {fmt(st?.glint ?? 0)}</span>
          <span className="text-white/40">·</span> Exit zen
        </button>
      )}

      {/* Shop panel: bottom sheet on phones, side column on desktop */}
      <section
        aria-label="Mining shop"
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#0b0820]/72 backdrop-blur-xl transition-[transform,height] duration-300 ease-out",
          "lg:inset-y-0 lg:left-auto lg:right-0 lg:!h-full lg:w-[400px] lg:rounded-none lg:border-l lg:border-t-0",
          zen && "translate-y-full lg:translate-x-full lg:translate-y-0",
        )}
        style={{ height: collapsed ? PANEL_MINI : "min(46dvh, 430px)" }}
      >
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="mx-auto block w-full pb-1 pt-2 lg:hidden" aria-label={collapsed ? "Expand shop" : "Collapse shop"} aria-expanded={!collapsed}>
          <span className="mx-auto block h-1.5 w-11 rounded-full bg-white/25" />
        </button>
        <div className="flex items-center gap-1.5 px-3 pb-2 lg:pt-4">
          {(
            [
              ["rigs", "⛏️", "Rigs"],
              ["upgrades", "⚡", "Upgrades"],
              ["fork", "🔷", "Fork"],
            ] as const
          ).map(([id, icon, label]) => {
            const badge = id === "upgrades" ? (snap?.upgrades.filter((u) => u.cost <= (st?.glint ?? 0)).length ?? 0) : id === "fork" ? (snap?.pending ?? 0) : 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setCollapsed(false);
                }}
                className={cn(
                  "press relative flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl font-display text-[11px] font-black uppercase tracking-tight",
                  tab === id ? "bg-white text-[#140b33]" : "bg-white/[0.06] text-white/75",
                )}
                aria-pressed={tab === id}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
                {badge > 0 && <span className="tabular absolute -right-1 -top-1 min-w-5 rounded-full bg-[#ff3d7f] px-1 text-[10px] leading-5 text-white">{id === "upgrades" && badge > 99 ? "99+" : fmt(badge)}</span>}
              </button>
            );
          })}
        </div>
        {tab === "rigs" && !collapsed && (
          <div className="flex items-center justify-between px-4 pb-2 text-[11px] font-bold text-white/55">
            <span className="tabular">Tap power +{fmt(snap?.tap ?? 1)}</span>
            <div className="flex gap-1" role="group" aria-label="Buy quantity">
              {([1, 10, 100, "max"] as const).map((q) => (
                <button key={q} type="button" onClick={() => setQty(q)} className={cn("press h-7 rounded-full px-2.5 font-display text-[10px] font-black uppercase", qty === q ? "bg-[#d4ff3a] text-black" : "bg-white/[0.07] text-white/70")} aria-pressed={qty === q}>
                  {q === "max" ? "Max" : `×${q}`}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(14px+var(--safe-bottom))]", collapsed && "hidden lg:block")} style={{ touchAction: "pan-y" }}>
          {snap ? (
            tab === "rigs" ? (
              <RigList snap={snap} qty={qty} onBuy={buyRig} />
            ) : tab === "upgrades" ? (
              <UpgradeList snap={snap} onBuy={buyUpgrade} onBuyAll={buyAll} />
            ) : (
              <ForkPanel snap={snap} onFork={() => setConfirmFork(true)} onReset={() => setConfirmReset(true)} muted={muted} onToggleMute={toggleMute} />
            )
          ) : (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[68px] rounded-[20px] opacity-30" />
              ))}
            </div>
          )}
        </div>
      </section>

      <Sheet open={!!welcome} onClose={() => setWelcome(null)} title="Welcome back, miner" className="bg-[#120c2e]">
        {welcome && (
          <div className="text-center">
            <p className="text-sm text-white/65">
              Your rigs kept humming for <b className="text-white">{fmtDuration(welcome.seconds)}</b>
              {welcome.capped ? " (storage full — upgrade it to bank longer)" : ""}.
            </p>
            <p className="tabular my-4 font-display text-4xl font-black text-[#ffd24d]" style={{ textShadow: "0 0 24px rgba(255,200,60,0.6)" }}>
              +{COIN_GLYPH} {fmt(welcome.earned, 4)}
            </p>
            <p className="text-xs text-white/50">{welcome.blocks.toLocaleString("en-US")} blocks sealed while you were away.</p>
            <button type="button" onClick={() => setWelcome(null)} className="press mt-5 h-12 w-full rounded-2xl bg-[#d4ff3a] font-display font-black uppercase text-black shadow-[0_6px_0_0_#7f9a12] active:translate-y-[4px] active:shadow-[0_2px_0_0_#7f9a12]">
              Collect
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={confirmFork} onClose={() => setConfirmFork(false)} title="Fork the chain?" className="bg-[#120c2e]">
        <p className="text-sm text-white/70">
          Rigs, upgrades and your {COIN} balance reset. You keep <b className="text-white">🔷 {fmt((st?.tokens ?? 0) + (snap?.pending ?? 0))} Fork Tokens</b> — a permanent ×{(1 + ((st?.tokens ?? 0) + (snap?.pending ?? 0)) * TUNING.forkBonus).toFixed(2)} on everything you mine.
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setConfirmFork(false)} className="press h-12 flex-1 rounded-2xl bg-white/10 font-display text-sm font-black uppercase">
            Not yet
          </button>
          <button type="button" onClick={doFork} className="press h-12 flex-1 rounded-2xl bg-white font-display text-sm font-black uppercase text-[#140b33]">
            Fork it
          </button>
        </div>
      </Sheet>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Wipe your save?" className="bg-[#120c2e]">
        <p className="text-sm text-white/70">Everything goes — rigs, tokens, the whole chain. This can&apos;t be undone.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setConfirmReset(false)} className="press h-12 flex-1 rounded-2xl bg-white/10 font-display text-sm font-black uppercase">
            Keep it
          </button>
          <button type="button" onClick={doReset} className="press h-12 flex-1 rounded-2xl bg-[#ff3d7f] font-display text-sm font-black uppercase text-white">
            Wipe
          </button>
        </div>
      </Sheet>
    </div>
  );
}
