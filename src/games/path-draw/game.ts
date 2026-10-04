import { CanvasGame, type PointerInfo } from "../core/engine";
import { circle, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface P {
  x: number;
  y: number;
}

/** Catmull–Rom through control points → dense polyline with cumulative arc length. */
function buildPath(ctrl: P[], samplesPerSeg = 18) {
  const pts: P[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  const len: number[] = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, len };
}

class PathDraw extends CanvasGame {
  private path = buildPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  private width = B.startWidth;
  private progress = 0; // arc length reached
  private drawing = false;
  private trail: P[] = [];
  private devSum = 0;
  private devCount = 0;
  private lives = B.lives;
  private level = 0;
  private levelStart = 0;
  private failAt: P | null = null;
  private pauseT = 0;

  protected setup() {
    this.lives = B.lives;
    this.level = 0;
    this.newLevel();
  }

  private newLevel() {
    const rng = this.rng.fork(`path-${this.level}`);
    this.width = Math.max(B.minWidth, B.startWidth * Math.pow(B.widthDecay, this.level));
    const n = B.controlPoints + Math.min(4, Math.floor(this.level / 2));
    const top = this.h * 0.16;
    const bottom = this.h * 0.86;
    const margin = this.width / 2 + 20;
    const ctrl: P[] = [];
    for (let i = 0; i < n; i++) {
      const y = bottom - ((bottom - top) * i) / (n - 1);
      const x = i === 0 ? rng.range(margin, this.w - margin) : rng.range(margin, this.w - margin);
      ctrl.push({ x, y });
    }
    this.path = buildPath(ctrl);
    this.resetAttempt();
    this.levelStart = this.elapsedMs;
  }

  private resetAttempt() {
    this.progress = 0;
    this.drawing = false;
    this.trail = [];
    this.devSum = 0;
    this.devCount = 0;
  }

  /** Nearest point on the path to (x, y) within an arc-length window. */
  private project(x: number, y: number, from: number, to: number) {
    const { pts, len } = this.path;
    let best = { d: Infinity, s: 0 };
    for (let i = 0; i < pts.length - 1; i++) {
      if (len[i + 1] < from || len[i] > to) continue;
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
      const d = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
      if (d < best.d) best = { d, s: len[i] + t * Math.sqrt(l2) };
    }
    return best;
  }

  private tip(): P {
    const { pts, len } = this.path;
    const i = len.findIndex((l) => l >= this.progress);
    return pts[Math.max(0, i)];
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.pauseT > 0) return;
    const tip = this.tip();
    if (Math.hypot(p.x - tip.x, p.y - tip.y) <= Math.max(B.resumeRadius, this.width / 2 + 8)) {
      this.drawing = true;
      this.trail.push({ x: p.x, y: p.y });
    }
  }

  protected onPointerMove(p: PointerInfo) {
    if (!this.drawing || this.pauseT > 0) return;
    const proj = this.project(p.x, p.y, this.progress - 40, this.progress + B.maxAdvance);
    this.trail.push({ x: p.x, y: p.y });
    if (proj.d > this.width / 2) {
      this.fail(p);
      return;
    }
    this.devSum += proj.d / (this.width / 2);
    this.devCount++;
    this.progress = Math.max(this.progress, proj.s);
    const total = this.path.len[this.path.len.length - 1];
    if (this.progress >= total - 8) this.complete();
  }

  protected onPointerUp() {
    this.drawing = false; // progress is kept; resume from the tip
  }

  private fail(p: P) {
    this.lives--;
    this.failAt = { ...p };
    this.drawing = false;
    this.fx.shake(10);
    this.fx.flash(PALETTE.flare, 0.25);
    this.sound("miss");
    this.ctx.haptics.fail();
    if (this.lives <= 0) {
      this.juiceFail(p.x, p.y);
      this.finish({ reason: "HIT THE WALL" });
      return;
    }
    this.pauseT = 0.6;
  }

  private complete() {
    this.drawing = false;
    const accuracy = this.devCount ? 1 - this.devSum / this.devCount : 1;
    const secs = (this.elapsedMs - this.levelStart) / 1000;
    const speed = Math.max(0, 1 - secs / B.speedBonusWindowS);
    const pts = B.levelPoints + Math.round(accuracy * B.accuracyBonus) + Math.round(speed * B.speedBonus);
    this.addScore(pts);
    this.statMax("accuracy", Math.round(accuracy * 100));
    if (accuracy > 0.75) this.stat("perfects");
    const end = this.path.pts[this.path.pts.length - 1];
    this.fx.text(end.x, end.y + 40, `+${pts}`, { color: PALETTE.volt, size: 26 });
    this.fx.confetti(end.x, end.y, 30);
    this.sound("levelup");
    this.ctx.haptics.success();
    this.level++;
    this.pauseT = 0.5;
    this.failAt = null;
    this.trail = [];
    this.nextIsNewLevel = true;
  }

  private nextIsNewLevel = false;

  protected update(dt: number) {
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      if (this.pauseT <= 0 && this.running) {
        if (this.nextIsNewLevel) {
          this.nextIsNewLevel = false;
          this.newLevel();
        } else {
          this.resetAttempt();
          this.failAt = null;
        }
      }
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const { pts } = this.path;
    const stroke = (width: number, color: string, dash: number[] = []) => {
      g.setLineDash(dash);
      g.lineWidth = width;
      g.strokeStyle = color;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.setLineDash([]);
    };
    stroke(this.width + 10, "rgba(0,0,0,0.35)");
    stroke(this.width + 6, "#0b0b0f");
    stroke(this.width, "#0e2f45");
    stroke(2, "rgba(255,255,255,0.35)", [8, 10]);
    // Progress
    const { len } = this.path;
    g.lineWidth = Math.max(4, this.width * 0.25);
    g.strokeStyle = PALETTE.volt;
    g.beginPath();
    for (let i = 0; i < pts.length && len[i] <= this.progress; i++) (i ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y));
    g.stroke();
    const start = pts[0];
    const end = pts[pts.length - 1];
    circle(g, start.x, start.y, Math.max(16, this.width / 2), PALETTE.mint);
    text(g, "GO", start.x, start.y + 1, { font: this.font, size: 12, color: "#0b0b0f" });
    // Finish flag
    g.fillStyle = "#fff";
    g.fillRect(end.x - 2, end.y - 36, 4, 36);
    g.beginPath();
    g.moveTo(end.x + 2, end.y - 36);
    g.lineTo(end.x + 28, end.y - 28);
    g.lineTo(end.x + 2, end.y - 20);
    g.fill();
    const tip = this.tip();
    if (!this.drawing && this.running && this.pauseT <= 0) {
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(tip.x, tip.y, 18 + Math.sin(this.clock * 6) * 4, 0, Math.PI * 2);
      g.stroke();
    }
    if (this.failAt) {
      circle(g, this.failAt.x, this.failAt.y, 14, PALETTE.flare);
      text(g, "✕", this.failAt.x, this.failAt.y + 1, { font: "system-ui", size: 16, color: "#fff", weight: 900 });
    }
    text(g, `LEVEL ${this.level + 1}`, this.w / 2, this.h - 22, { font: this.font, size: 14, color: "rgba(255,255,255,0.6)" });
  }

  protected hud(): HudState {
    return { score: this.score, lives: this.lives, maxLives: B.lives };
  }
}

const factory: GameFactory = (def) => new PathDraw(def);
export default factory;
