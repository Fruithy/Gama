import { evaluateRun } from "@/lib/security/run-validation";
import { Fx, PALETTE } from "./fx";
import { createRng, type Rng } from "./rng";
import type { GameContext, GameDefinition, GameResult, GameRuntime, HudState, LocalValidation, RunMetadata } from "./types";

/**
 * CanvasGame — the shared runtime every FILTER ARCADE game extends.
 *
 * It owns the boring-but-critical parts so individual games stay ~200 lines:
 *  - canvas sizing in a fixed 400-unit-wide logical space (portrait-first),
 *    HiDPI scaling, resize handling
 *  - the RAF loop with clamped delta time and slow-motion support
 *  - pointer / keyboard input with multi-touch exploit guards
 *  - run metadata for anti-cheat (actions, peak rate, score checkpoints)
 *  - juice (particles, popups, shake, flash) via `this.fx`
 *  - the GameRuntime lifecycle contract the platform shell drives
 *
 * Subclasses implement `setup()` (build a fresh run from `this.rng`),
 * `update(dt)` and `render(g)`, plus whichever input hooks they need.
 */

type RunState = "idle" | "running" | "paused" | "ending" | "over";

/** Logical width all games are designed against. Height follows the stage aspect. */
export const LOGICAL_WIDTH = 400;
const MIN_LOGICAL_HEIGHT = 520;
const MAX_LOGICAL_HEIGHT = 900;
/** Never step the simulation more than this per frame (tab switches, hitches). */
const MAX_FRAME_DT = 1 / 20;
const MAX_DPR = 2;
const MAX_CHECKPOINTS = 1500;
const HUD_INTERVAL_MS = 50;

export interface PointerInfo {
  x: number;
  y: number;
  id: number;
  /** Seconds since the run started. */
  t: number;
}

export abstract class CanvasGame implements GameRuntime {
  protected ctx!: GameContext;
  protected def: GameDefinition;
  protected canvas!: HTMLCanvasElement;
  protected g!: CanvasRenderingContext2D;
  protected w = LOGICAL_WIDTH;
  protected h = 711;
  protected rng: Rng = createRng("init");
  protected seed = "init";
  protected score = 0;
  protected state: RunState = "idle";
  /** Active gameplay milliseconds (pauses excluded). */
  protected elapsedMs = 0;
  /** Seconds since mount — for idle animations (keeps running when idle). */
  protected clock = 0;
  /** Multiplier on simulation dt (slow-motion moments). */
  protected timeScale = 1;
  protected fx!: Fx;
  protected font = "system-ui, sans-serif";
  protected stats: Record<string, number> = {};

  /** Set true for games that genuinely need multi-touch. */
  protected allowMultiTouch = false;
  /** Minimum ms between counted presses (debounce + autoclicker guard). */
  protected minTapIntervalMs = 0;
  /** Primary pointer currently held. */
  protected pointerDown = false;
  protected pointerPos = { x: 0, y: 0 };

  private scale = 1;
  private dpr = 1;
  private raf = 0;
  private lastFrame = 0;
  private resizeObs: ResizeObserver | null = null;
  private activePointers = new Set<number>();
  private primaryPointer: number | null = null;
  private lastPressAt = -Infinity;
  private actionTimes: number[] = [];
  private actions = 0;
  private peakAps = 0;
  private checkpoints: Array<[number, number]> = [];
  private input = { pointerDowns: 0, keyDowns: 0, rejectedMultiTouch: 0, rejectedFast: 0 };
  private gameOverCbs: Array<(r: GameResult) => void> = [];
  private lastHud = "";
  private lastHudAt = 0;
  private endTimer = 0;
  private pendingResult: GameResult | null = null;
  private cleanup: Array<() => void> = [];

  constructor(definition: GameDefinition) {
    this.def = definition;
  }

  /* ───────────────────────────── subclass API ───────────────────────────── */

  /** Build a fresh run. `this.rng` is already seeded. */
  protected abstract setup(): void;
  /** Advance the simulation. `dt` is in seconds and already time-scaled. */
  protected abstract update(dt: number): void;
  /** Draw the world. Camera shake/zoom is applied by the engine. */
  protected abstract render(g: CanvasRenderingContext2D): void;

  protected onPointerDown(_p: PointerInfo): void {}
  protected onPointerMove(_p: PointerInfo): void {}
  protected onPointerUp(_p: PointerInfo): void {}
  /** Return true when handled. Default maps Space/Enter/↑ to a centre tap. */
  protected onKey(_key: string, _down: boolean): boolean {
    return false;
  }
  /** HUD snapshot shown by the platform shell. */
  protected hud(): HudState {
    return { score: this.score };
  }
  protected onResize(): void {}
  /** Background painted before camera transforms (no shake). */
  protected renderBackground(g: CanvasRenderingContext2D) {
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, this.def.theme.bg[0]);
    grad.addColorStop(1, this.def.theme.bg[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
  }
  /** Overlay drawn after world + fx, without camera transforms. */
  protected renderOverlay(_g: CanvasRenderingContext2D): void {}

  /* ───────────────────────────── helpers for games ───────────────────────── */

  protected get running() {
    return this.state === "running";
  }

  /** Seconds of active play. */
  protected get t() {
    return this.elapsedMs / 1000;
  }

  protected addScore(points: number) {
    if (points === 0) return;
    this.score = Math.max(0, Math.round(this.score + points));
    this.checkpoint();
  }

  /** For continuous scores (distance, height). Checkpoints are rate-limited. */
  protected setScore(value: number) {
    const v = Math.max(0, Math.round(value));
    if (v === this.score) return;
    this.score = v;
    const last = this.checkpoints[this.checkpoints.length - 1];
    if (!last || this.elapsedMs - last[0] >= 250) this.checkpoint();
  }

  protected stat(name: string, delta = 1) {
    this.stats[name] = (this.stats[name] ?? 0) + delta;
  }

  protected statMax(name: string, value: number) {
    this.stats[name] = Math.max(this.stats[name] ?? 0, value);
  }

  /** Count a deliberate player action for anti-cheat rate tracking. */
  protected recordAction() {
    this.actions++;
    const now = this.elapsedMs;
    this.actionTimes.push(now);
    while (this.actionTimes.length && now - this.actionTimes[0] > 1000) this.actionTimes.shift();
    this.peakAps = Math.max(this.peakAps, this.actionTimes.length);
  }

  /**
   * End the run. With `slowMo`, the world keeps animating at reduced speed for
   * `delayMs` before the platform is told — the "almost made it" beat.
   */
  protected finish(opts: { completed?: boolean; reason?: string; delayMs?: number; slowMo?: boolean } = {}) {
    if (this.state !== "running") return;
    this.checkpoint();
    const result: GameResult = {
      score: this.score,
      completed: opts.completed ?? true,
      reason: opts.reason,
      metadata: this.getRunMetadata(),
    };
    this.pendingResult = result;
    const delay = opts.delayMs ?? 550;
    if (opts.slowMo !== false && !this.ctx.reducedMotion) this.timeScale = 0.3;
    this.state = "ending";
    this.endTimer = delay / 1000;
    this.emitHud(true);
  }

  protected sound(name: Parameters<GameContext["audio"]["play"]>[0], pitch = 1, volume = 1) {
    this.ctx.audio.play(name, { pitch, volume });
  }

  /** Common "good hit" feedback bundle. */
  protected juiceHit(x: number, y: number, color: string = PALETTE.volt, label?: string) {
    this.fx.burst(x, y, { color: [color, "#fff"], count: 12, speed: 260 });
    if (label) this.fx.text(x, y - 30, label, { color });
    this.ctx.haptics.tap();
  }

  /** Common failure feedback bundle. */
  protected juiceFail(x = this.w / 2, y = this.h / 2) {
    this.fx.shake(14);
    this.fx.flash("#ff3d7f", 0.3);
    this.fx.burst(x, y, { color: ["#ff3d7f", "#fff"], count: 20, speed: 320 });
    this.sound("fail");
    this.ctx.haptics.fail();
  }

  /* ───────────────────────────── GameRuntime ─────────────────────────────── */

  async initialize(ctx: GameContext) {
    this.ctx = ctx;
    this.fx = new Fx(ctx.reducedMotion);
    const css = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    if (css) this.font = `${css}, system-ui, sans-serif`;

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block;";
    this.canvas.setAttribute("aria-label", `${this.def.name} game area`);
    this.canvas.setAttribute("role", "application");
    ctx.container.appendChild(this.canvas);
    const g = this.canvas.getContext("2d", { alpha: false });
    if (!g) throw new Error("Canvas 2D not supported");
    this.g = g;

    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(ctx.container);
    this.bindInput();

    this.reset(ctx.seed);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  start() {
    if (this.state !== "idle") return;
    this.state = "running";
    this.lastFrame = performance.now();
    this.emitHud(true);
  }

  pause() {
    if (this.state === "running") this.state = "paused";
  }

  resume() {
    if (this.state === "paused") {
      this.state = "running";
      this.lastFrame = performance.now();
    }
  }

  reset(seed?: string) {
    if (seed) this.seed = seed;
    this.rng = createRng(this.seed);
    this.score = 0;
    this.elapsedMs = 0;
    this.timeScale = 1;
    this.stats = {};
    this.actions = 0;
    this.peakAps = 0;
    this.actionTimes = [];
    this.checkpoints = [];
    this.input = { pointerDowns: 0, keyDowns: 0, rejectedMultiTouch: 0, rejectedFast: 0 };
    this.pendingResult = null;
    this.endTimer = 0;
    this.pointerDown = false;
    this.activePointers.clear();
    this.primaryPointer = null;
    this.lastPressAt = -Infinity;
    this.fx?.clear();
    this.state = "idle";
    this.setup();
    this.emitHud(true);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    this.canvas?.remove();
    this.gameOverCbs = [];
  }

  getScore() {
    return this.score;
  }

  getRunMetadata(): RunMetadata {
    return {
      seed: this.seed,
      gameVersion: this.def.version,
      durationMs: Math.round(this.elapsedMs),
      actions: this.actions,
      peakActionsPerSecond: this.peakAps,
      checkpoints: this.checkpoints.slice(),
      stats: { ...this.stats },
      input: { ...this.input },
    };
  }

  validateLocalRun(): LocalValidation {
    const meta = this.getRunMetadata();
    const result = evaluateRun(this.def, { score: this.score, completed: this.pendingResult?.completed ?? true, metadata: meta });
    return { ok: result.verdict === "accepted", issues: [...result.rejections, ...result.flags] };
  }

  onGameOver(cb: (result: GameResult) => void) {
    this.gameOverCbs.push(cb);
  }

  /* ───────────────────────────── internals ───────────────────────────────── */

  private checkpoint() {
    if (this.checkpoints.length >= MAX_CHECKPOINTS) {
      // Keep the shape of the curve: drop every other point, keep the latest.
      this.checkpoints = this.checkpoints.filter((_, i) => i % 2 === 0);
    }
    this.checkpoints.push([Math.round(this.elapsedMs), this.score]);
  }

  private resize() {
    const rect = this.ctx.container.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    this.scale = cssW / LOGICAL_WIDTH;
    this.h = Math.min(MAX_LOGICAL_HEIGHT, Math.max(MIN_LOGICAL_HEIGHT, cssH / this.scale));
    this.dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.onResize();
  }

  private toLogical(e: PointerEvent): PointerInfo {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.scale,
      y: (e.clientY - rect.top) / this.scale,
      id: e.pointerId,
      t: this.t,
    };
  }

  private bindInput() {
    const c = this.canvas;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      if (this.state !== "running") return;
      this.input.pointerDowns++;
      if (!this.allowMultiTouch && this.activePointers.size > 0) {
        this.input.rejectedMultiTouch++;
        return;
      }
      const now = this.elapsedMs;
      if (now - this.lastPressAt < this.minTapIntervalMs) {
        this.input.rejectedFast++;
        return;
      }
      this.lastPressAt = now;
      this.activePointers.add(e.pointerId);
      if (this.primaryPointer === null) this.primaryPointer = e.pointerId;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events can't be captured */
      }
      const p = this.toLogical(e);
      this.pointerDown = true;
      this.pointerPos = { x: p.x, y: p.y };
      this.recordAction();
      this.onPointerDown(p);
    };
    const move = (e: PointerEvent) => {
      if (this.state !== "running") return;
      if (this.primaryPointer !== null && e.pointerId !== this.primaryPointer) return;
      const p = this.toLogical(e);
      this.pointerPos = { x: p.x, y: p.y };
      this.onPointerMove(p);
    };
    const up = (e: PointerEvent) => {
      const wasActive = this.activePointers.delete(e.pointerId);
      if (e.pointerId === this.primaryPointer) this.primaryPointer = null;
      if (!wasActive) return;
      this.pointerDown = this.activePointers.size > 0;
      if (this.state !== "running") return;
      this.onPointerUp(this.toLogical(e));
    };
    const key = (e: KeyboardEvent, isDown: boolean) => {
      if (e.repeat) return;
      const k = e.key === " " ? "Space" : e.key;
      if (!["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(k)) return;
      e.preventDefault();
      if (this.state !== "running") return;
      if (isDown) {
        this.input.keyDowns++;
        const now = this.elapsedMs;
        if (now - this.lastPressAt < this.minTapIntervalMs) {
          this.input.rejectedFast++;
          return;
        }
        this.lastPressAt = now;
        this.recordAction();
      }
      if (this.onKey(k, isDown)) return;
      if (k === "Space" || k === "Enter" || k === "ArrowUp" || k === "w") {
        const p: PointerInfo = { x: this.w / 2, y: this.h / 2, id: -1, t: this.t };
        if (isDown) {
          this.pointerDown = true;
          this.onPointerDown(p);
        } else {
          this.pointerDown = false;
          this.onPointerUp(p);
        }
      }
    };
    const kd = (e: KeyboardEvent) => key(e, true);
    const ku = (e: KeyboardEvent) => key(e, false);
    const ctxMenu = (e: Event) => e.preventDefault();

    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("contextmenu", ctxMenu);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    this.cleanup.push(() => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.removeEventListener("contextmenu", ctxMenu);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    });
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const rawDt = Math.min(MAX_FRAME_DT, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.clock += rawDt;

    if (this.state === "running" || this.state === "ending") {
      const dt = rawDt * this.timeScale;
      if (this.state === "running") this.elapsedMs += rawDt * 1000;
      this.update(dt);
      this.fx.update(dt);
      if (this.state === "ending") {
        this.endTimer -= rawDt;
        this.timeScale += (1 - this.timeScale) * Math.min(1, rawDt * 2);
        if (this.endTimer <= 0) this.completeEnd();
      }
    } else if (this.state === "over" || this.state === "idle") {
      this.fx.update(rawDt);
    }

    this.draw();
    if (this.state === "running") this.emitHud(false);
  };

  private completeEnd() {
    this.state = "over";
    this.timeScale = 1;
    const result = this.pendingResult;
    if (!result) return;
    for (const cb of this.gameOverCbs) cb(result);
  }

  private draw() {
    const g = this.g;
    const s = this.scale * this.dpr;
    g.setTransform(s, 0, 0, s, 0, 0);
    this.renderBackground(g);
    g.save();
    this.fx.applyCamera(g, this.w, this.h);
    this.render(g);
    this.fx.render(g, this.font);
    g.restore();
    this.renderOverlay(g);
    this.fx.renderFlash(g, this.w, this.h);
  }

  private emitHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHudAt < HUD_INTERVAL_MS) return;
    const hud = this.hud();
    const key = JSON.stringify(hud);
    if (!force && key === this.lastHud) return;
    this.lastHud = key;
    this.lastHudAt = now;
    this.ctx.onHud(hud);
  }
}
