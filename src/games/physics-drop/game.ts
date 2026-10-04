import { CanvasGame } from "../core/engine";
import { blobCritter, circle, fillRoundRect, line, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Peg {
  x: number;
  y: number;
  baseX: number;
  amp: number;
  phase: number;
  speed: number;
}

interface Bar {
  x: number;
  y: number;
  angle: number;
  spin: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  age: number;
}

class PhysicsDrop extends CanvasGame {
  private pegs: Peg[] = [];
  private bars: Bar[] = [];
  private cup = { x: 200, w: B.cupWidth, vx: 0 };
  private dropX = 200;
  private dropDir = 1;
  private ball: Ball | null = null;
  private balls = B.balls;
  private level = 0;
  private settle = 0;

  private get cupY() {
    return this.h - 90;
  }

  protected setup() {
    this.balls = B.balls;
    this.level = 0;
    this.ball = null;
    this.buildLevel();
  }

  private buildLevel() {
    const rng = this.rng.fork(`drop-${this.level}`);
    const rows = Math.min(6, 3 + Math.floor(this.level / 2));
    const top = this.h * 0.24;
    const bottom = this.h * 0.68;
    this.pegs = [];
    for (let r = 0; r < rows; r++) {
      const y = top + ((bottom - top) * r) / Math.max(1, rows - 1);
      const cols = r % 2 ? 4 : 5;
      for (let c = 0; c < cols; c++) {
        if (rng.chance(0.18)) continue; // gaps make routes
        const x = (this.w / (cols + 1)) * (c + 1) + rng.range(-12, 12);
        const moving = this.level >= 3 && rng.chance(0.3);
        this.pegs.push({ x, y, baseX: x, amp: moving ? rng.range(18, 40) : 0, phase: rng.range(0, 6.28), speed: rng.range(1, 2.2) });
      }
    }
    this.bars = [];
    const barCount = this.level < 1 ? 0 : Math.min(3, 1 + Math.floor(this.level / 3));
    for (let i = 0; i < barCount; i++) {
      this.bars.push({ x: rng.range(90, this.w - 90), y: rng.range(top + 30, bottom), angle: rng.range(0, Math.PI), spin: rng.range(1.2, 2.2 + this.level * 0.12) * (rng.chance(0.5) ? 1 : -1) });
    }
    const cw = Math.max(B.minCupWidth, B.cupWidth - this.level * 4);
    this.cup = { x: rng.range(cw / 2 + 20, this.w - cw / 2 - 20), w: cw, vx: this.level >= 4 ? rng.range(30, 50 + this.level * 4) * (rng.chance(0.5) ? 1 : -1) : 0 };
  }

  protected onPointerDown() {
    if (this.ball || this.balls <= 0 || this.settle > 0) return;
    this.ball = { x: this.dropX, y: this.h * 0.14, vx: 0, vy: 0, alive: true, age: 0 };
    this.balls--;
    this.sound("whoosh", 0.8);
  }

  /** Circle vs circle with restitution (pegs are kinematic). */
  private collideCircle(b: Ball, cx: number, cy: number, r: number) {
    const dx = b.x - cx;
    const dy = b.y - cy;
    const d = Math.hypot(dx, dy);
    const min = r + B.ballRadius;
    if (d >= min || d === 0) return false;
    const nx = dx / d;
    const ny = dy / d;
    b.x = cx + nx * min;
    b.y = cy + ny * min;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + B.restitution) * vn * nx;
      b.vy -= (1 + B.restitution) * vn * ny;
    }
    return true;
  }

  /** Circle vs rotating segment: push out along the normal, reflect, add the bar's surface velocity. */
  private collideBar(b: Ball, bar: Bar) {
    const hx = Math.cos(bar.angle) * (B.barLength / 2);
    const hy = Math.sin(bar.angle) * (B.barLength / 2);
    const ax = bar.x - hx;
    const ay = bar.y - hy;
    const bx = bar.x + hx;
    const by = bar.y + hy;
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(0, Math.min(1, ((b.x - ax) * vx + (b.y - ay) * vy) / (vx * vx + vy * vy)));
    const px = ax + vx * t;
    const py = ay + vy * t;
    const dx = b.x - px;
    const dy = b.y - py;
    const d = Math.hypot(dx, dy);
    const min = B.ballRadius + 6;
    if (d >= min || d === 0) return false;
    const nx = dx / d;
    const ny = dy / d;
    b.x = px + nx * min;
    b.y = py + ny * min;
    // Surface velocity of the spinning bar at the contact point.
    const sx = -(py - bar.y) * bar.spin;
    const sy = (px - bar.x) * bar.spin;
    const rvx = b.vx - sx;
    const rvy = b.vy - sy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      b.vx -= (1 + B.restitution) * vn * nx;
      b.vy -= (1 + B.restitution) * vn * ny;
    }
    return true;
  }

  protected update(dt: number) {
    // World motion
    this.dropX += this.dropDir * (B.dropperSpeed + this.level * 6) * dt;
    if (this.dropX < 40 || this.dropX > this.w - 40) {
      this.dropDir *= -1;
      this.dropX = Math.max(40, Math.min(this.w - 40, this.dropX));
    }
    for (const p of this.pegs) if (p.amp) p.x = p.baseX + Math.sin(this.clock * p.speed + p.phase) * p.amp;
    for (const b of this.bars) b.angle += b.spin * dt;
    if (this.cup.vx) {
      this.cup.x += this.cup.vx * dt;
      if (this.cup.x < this.cup.w / 2 + 10 || this.cup.x > this.w - this.cup.w / 2 - 10) this.cup.vx *= -1;
    }
    if (this.settle > 0) {
      this.settle -= dt;
      if (this.settle <= 0 && this.running) {
        if (this.balls <= 0) {
          this.juiceFail(this.w / 2, this.h * 0.5);
          this.finish({ reason: "OUT OF BALLS" });
        }
      }
    }
    const b = this.ball;
    if (!b || !this.running) return;
    const h = dt / B.substeps;
    let bumped = false;
    for (let s = 0; s < B.substeps; s++) {
      b.vy += B.gravity * h;
      b.x += b.vx * h;
      b.y += b.vy * h;
      for (const p of this.pegs) bumped = this.collideCircle(b, p.x, p.y, B.pegRadius) || bumped;
      for (const bar of this.bars) bumped = this.collideBar(b, bar) || bumped;
      if (b.x < B.ballRadius) {
        b.x = B.ballRadius;
        b.vx = Math.abs(b.vx) * B.restitution;
      } else if (b.x > this.w - B.ballRadius) {
        b.x = this.w - B.ballRadius;
        b.vx = -Math.abs(b.vx) * B.restitution;
      }
    }
    if (bumped && Math.abs(b.vy) > 120) this.sound("tick", 1.5 + this.rng.range(-0.2, 0.2), 0.6);
    b.age += dt;
    // Landing
    const top = this.cupY - 40;
    if (b.y + B.ballRadius >= top && b.y - b.vy * dt + B.ballRadius < top) {
      const off = Math.abs(b.x - this.cup.x);
      if (off < this.cup.w / 2 - B.ballRadius * 0.5) {
        const precision = 1 - off / (this.cup.w / 2);
        const pts = B.levelPoints + this.level * 15 + Math.round(precision * 40);
        this.addScore(pts);
        this.stat("levels");
        if (precision > 0.7) this.stat("perfects");
        this.fx.text(this.cup.x, top - 40, `+${pts}`, { color: PALETTE.volt, size: 26 });
        this.fx.confetti(this.cup.x, top, 30);
        this.sound("levelup");
        this.ctx.haptics.success();
        this.level++;
        if (this.level % B.refundEvery === 0) {
          this.balls++;
          this.fx.text(this.w / 2, this.h * 0.12, "+1 BALL", { color: PALETTE.ion, size: 22 });
        }
        this.ball = null;
        this.buildLevel();
        return;
      }
    }
    if (b.y > this.h + 40 || b.age > 12) {
      this.ball = null;
      this.sound("miss");
      this.ctx.haptics.fail();
      this.fx.shake(6);
      if (this.balls <= 0) this.settle = 0.4;
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    // Dropper
    const dy = this.h * 0.14;
    fillRoundRect(g, this.dropX - 34, dy - 30, 68, 20, 10, "#ffffff");
    if (!this.ball && this.balls > 0) blobCritter(g, this.dropX, dy, B.ballRadius, PALETTE.volt, { mouth: "o", lookY: 1 });
    // Pegs & bars
    for (const p of this.pegs) {
      circle(g, p.x + 2, p.y + 3, B.pegRadius, "rgba(0,0,0,0.3)");
      circle(g, p.x, p.y, B.pegRadius, p.amp ? PALETTE.sun : PALETTE.ion);
    }
    for (const bar of this.bars) {
      const hx = Math.cos(bar.angle) * (B.barLength / 2);
      const hy = Math.sin(bar.angle) * (B.barLength / 2);
      line(g, bar.x - hx, bar.y - hy, bar.x + hx, bar.y + hy, 12, PALETTE.sun);
      circle(g, bar.x, bar.y, 6, "#0b0b0f");
    }
    // Cup
    const top = this.cupY - 40;
    g.fillStyle = PALETTE.mint;
    g.strokeStyle = "#0b0b0f";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(this.cup.x - this.cup.w / 2, top);
    g.lineTo(this.cup.x + this.cup.w / 2, top);
    g.lineTo(this.cup.x + this.cup.w / 2 - 10, this.cupY);
    g.lineTo(this.cup.x - this.cup.w / 2 + 10, this.cupY);
    g.closePath();
    g.fill();
    g.stroke();
    if (this.ball) blobCritter(g, this.ball.x, this.ball.y, B.ballRadius, PALETTE.volt, { mouth: "o", lookX: this.ball.vx / 300, lookY: 1 });
    // Remaining balls
    for (let i = 0; i < this.balls; i++) circle(g, 24 + i * 22, this.h - 28, 8, PALETTE.volt);
    text(g, `LEVEL ${this.level + 1}`, this.w - 70, this.h - 28, { font: this.font, size: 13, color: "rgba(255,255,255,0.7)" });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "TAP TO DROP", this.w / 2, this.h * 0.5, { font: this.font, size: 22, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score, label: `${this.balls} BALLS` };
  }
}

const factory: GameFactory = (def) => new PhysicsDrop(def);
export default factory;
