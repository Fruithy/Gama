import { CanvasGame, type PointerInfo } from "../core/engine";
import { circle, fillRoundRect, line, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { Rng } from "../core/rng";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

type Kind = "toggle" | "stroke";

interface Level {
  kind: Kind;
  n: number;
  lit: boolean[];
  blocked: boolean[];
  /** Stroke levels: the start cell. */
  start: number;
}

/** Lights-out style: tapping flips a cell and its 4 neighbours. */
function flip(lit: boolean[], n: number, i: number) {
  const r = Math.floor(i / n);
  const c = i % n;
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) lit[rr * n + cc] = !lit[rr * n + cc];
  }
}

/**
 * Toggle level: start from "all lit" and apply k random presses. Presses are
 * self-inverse, so pressing the same cells again solves it → always solvable.
 */
function makeToggle(rng: Rng, n: number, level: number): Level {
  const lit = new Array(n * n).fill(true);
  const presses = new Set<number>();
  const k = Math.min(n * n - 1, n + Math.floor(level / 2));
  while (presses.size < k) presses.add(rng.int(0, n * n - 1));
  for (const p of presses) flip(lit, n, p);
  if (lit.every(Boolean)) flip(lit, n, rng.int(0, n * n - 1));
  return { kind: "toggle", n, lit, blocked: new Array(n * n).fill(false), start: -1 };
}

/**
 * Stroke level: a self-avoiding walk (Warnsdorff-biased) defines the path, so
 * a one-line solution always exists. Cells off the walk become walls.
 */
function makeStroke(rng: Rng, n: number): Level {
  const total = n * n;
  let best: number[] = [];
  for (let attempt = 0; attempt < 40 && best.length < total * 0.8; attempt++) {
    const start = rng.int(0, total - 1);
    const path = [start];
    const seen = new Set(path);
    for (;;) {
      const cur = path[path.length - 1];
      const nbrs = neighbours(cur, n).filter((x) => !seen.has(x));
      if (!nbrs.length) break;
      // Prefer the neighbour with the fewest onward options (keeps the walk long), random tie-break.
      nbrs.sort((a, b) => neighbours(a, n).filter((x) => !seen.has(x)).length - neighbours(b, n).filter((x) => !seen.has(x)).length || rng.next() - 0.5);
      const pick = rng.chance(0.85) ? nbrs[0] : rng.pick(nbrs);
      path.push(pick);
      seen.add(pick);
    }
    if (path.length > best.length) best = path;
  }
  const blocked = new Array(total).fill(true);
  for (const c of best) blocked[c] = false;
  const lit = new Array(total).fill(false);
  lit[best[0]] = true;
  return { kind: "stroke", n, lit, blocked, start: best[0] };
}

function neighbours(i: number, n: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

class ImpossibleGrid extends CanvasGame {
  private level!: Level;
  private index = 0;
  private stroke: number[] = [];
  private dragging = false;
  private levelStart = 0;
  private solvedFlash = 0;
  private pulse: number[] = [];

  private layout() {
    const n = this.level.n;
    const size = Math.min(this.w - 50, this.h * 0.55);
    const cell = size / n;
    return { x0: (this.w - size) / 2, y0: this.h * 0.58 - size / 2, cell, n };
  }

  protected setup() {
    this.index = 0;
    this.loadLevel();
  }

  private loadLevel() {
    const [kind, n] = B.levels[Math.min(this.index, B.levels.length - 1)];
    const rng = this.rng.fork(`level-${this.index}`);
    this.level = kind === "toggle" ? makeToggle(rng, n, this.index) : makeStroke(rng, n);
    this.stroke = kind === "stroke" ? [this.level.start] : [];
    this.levelStart = this.elapsedMs;
    this.pulse = new Array(n * n).fill(0);
  }

  private cellAt(x: number, y: number): number {
    const { x0, y0, cell, n } = this.layout();
    const c = Math.floor((x - x0) / cell);
    const r = Math.floor((y - y0) / cell);
    if (c < 0 || r < 0 || c >= n || r >= n) return -1;
    // Only count touches near the centre of a cell (forgiving diagonal drags).
    const cx = x0 + (c + 0.5) * cell;
    const cy = y0 + (r + 0.5) * cell;
    return Math.hypot(x - cx, y - cy) < cell * 0.48 ? r * n + c : -1;
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.solvedFlash > 0) return;
    const i = this.cellAt(p.x, p.y);
    if (i < 0 || this.level.blocked[i]) return;
    if (this.level.kind === "toggle") {
      flip(this.level.lit, this.level.n, i);
      for (const j of [i, ...neighbours(i, this.level.n)]) this.pulse[j] = 1;
      this.sound("tap", 0.9 + (i % 5) * 0.08);
      this.ctx.haptics.tap();
      this.checkSolved();
    } else {
      const last = this.stroke[this.stroke.length - 1];
      if (i === last || i === this.level.start) this.dragging = true;
    }
  }

  protected onPointerMove(p: PointerInfo) {
    if (this.level.kind !== "stroke" || !this.dragging || this.solvedFlash > 0) return;
    const i = this.cellAt(p.x, p.y);
    if (i < 0 || this.level.blocked[i]) return;
    const last = this.stroke[this.stroke.length - 1];
    if (i === last) return;
    if (this.stroke.length > 1 && i === this.stroke[this.stroke.length - 2]) {
      // Backtrack.
      this.stroke.pop();
      this.level.lit[last] = false;
      this.sound("tick", 0.8);
      return;
    }
    if (!neighbours(last, this.level.n).includes(i) || this.level.lit[i]) return;
    this.stroke.push(i);
    this.level.lit[i] = true;
    this.pulse[i] = 1;
    this.recordAction();
    this.sound("tick", 1 + this.stroke.length * 0.03);
    this.checkSolved();
  }

  protected onPointerUp() {
    this.dragging = false;
  }

  private checkSolved() {
    const done = this.level.lit.every((on, i) => on || this.level.blocked[i]);
    if (!done) return;
    const secs = (this.elapsedMs - this.levelStart) / 1000;
    const fast = Math.max(0, Math.round(B.fastBonusMax * (1 - secs / B.fastBonusWindowS)));
    this.addScore(B.levelPoints + this.index * 20 + fast);
    this.stat("levels");
    if (fast > B.fastBonusMax * 0.5) this.stat("perfects");
    this.fx.confetti(this.w / 2, this.h * 0.45, 30);
    this.fx.text(this.w / 2, this.h * 0.3, fast ? `SOLVED +${fast} FAST` : "SOLVED", { color: PALETTE.sun, size: 26 });
    this.sound("levelup");
    this.ctx.haptics.success();
    this.solvedFlash = 0.7;
    this.dragging = false;
  }

  protected update(dt: number) {
    for (let i = 0; i < this.pulse.length; i++) this.pulse[i] = Math.max(0, this.pulse[i] - dt * 4);
    if (this.solvedFlash > 0) {
      this.solvedFlash -= dt;
      if (this.solvedFlash <= 0 && this.running) {
        this.index++;
        this.loadLevel();
      }
    }
    if (this.running && this.elapsedMs >= B.totalTimeMs) {
      this.finish({ reason: "TIME!", slowMo: false });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const { x0, y0, cell, n } = this.layout();
    const rule = this.level.kind === "toggle" ? "TAP: FLIPS A CIRCLE + NEIGHBOURS" : "DRAG: ONE LINE THROUGH EVERY CIRCLE";
    fillRoundRect(g, 20, this.h * 0.17, this.w - 40, 50, 18, "rgba(255,255,255,0.06)");
    text(g, rule, this.w / 2, this.h * 0.17 + 26, { font: this.font, size: 13, color: PALETTE.sun });
    text(g, `LEVEL ${this.index + 1}`, this.w / 2, this.h * 0.17 - 18, { font: this.font, size: 15, color: "rgba(255,255,255,0.6)" });

    if (this.level.kind === "stroke" && this.stroke.length > 1) {
      for (let k = 1; k < this.stroke.length; k++) {
        const a = this.stroke[k - 1];
        const b = this.stroke[k];
        line(g, x0 + ((a % n) + 0.5) * cell, y0 + (Math.floor(a / n) + 0.5) * cell, x0 + ((b % n) + 0.5) * cell, y0 + (Math.floor(b / n) + 0.5) * cell, cell * 0.22, "rgba(255,194,61,0.7)");
      }
    }
    for (let i = 0; i < n * n; i++) {
      const cx = x0 + ((i % n) + 0.5) * cell;
      const cy = y0 + (Math.floor(i / n) + 0.5) * cell;
      const r = cell * 0.36 * (1 + this.pulse[i] * 0.12);
      if (this.level.blocked[i]) {
        fillRoundRect(g, cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, 6, "rgba(255,255,255,0.04)");
        continue;
      }
      circle(g, cx + 3, cy + 4, r, "rgba(0,0,0,0.4)");
      const on = this.level.lit[i];
      circle(g, cx, cy, r, on ? PALETTE.sun : "#1d1d2a");
      if (on) circle(g, cx - r * 0.3, cy - r * 0.35, r * 0.22, "rgba(255,255,255,0.55)");
      g.lineWidth = 3;
      g.strokeStyle = i === this.level.start && this.level.kind === "stroke" ? "#fff" : "#0b0b0f";
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    const left = Math.max(0, B.totalTimeMs - this.elapsedMs) / B.totalTimeMs;
    fillRoundRect(g, 30, this.h - 46, this.w - 60, 8, 4, "rgba(255,255,255,0.1)");
    fillRoundRect(g, 30, this.h - 46, (this.w - 60) * left, 8, 4, left < 0.2 ? PALETTE.flare : PALETTE.sun);
  }

  protected hud(): HudState {
    return { score: this.score, timeLeft: Math.max(0, (B.totalTimeMs - this.elapsedMs) / 1000) };
  }
}

const factory: GameFactory = (def) => new ImpossibleGrid(def);
export default factory;
