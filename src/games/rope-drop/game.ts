import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter, circle, fillRoundRect, line, segmentsIntersect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

/** Verlet point: velocity is implicit in (x - px, y - py). */
interface Pt {
  x: number;
  y: number;
  px: number;
  py: number;
}

interface Rope {
  anchor: { x: number; y: number };
  pts: Pt[]; // pts[0] is pinned to the anchor; the object hangs from the last link
  links: boolean[]; // links[k] joins pts[k]→pts[k+1] (or →object for the last)
  rest: number;
}

const SUBSTEPS = 2;

class RopeDrop extends CanvasGame {
  private ropes: Rope[] = [];
  private obj: Pt = { x: 0, y: 0, px: 0, py: 0 };
  private cup = { x: 200, y: 600, vx: 0 };
  private lives = B.lives;
  private level = 0;
  private levelTime = 0;
  private resolved = false;
  private landed = false;
  private trail: Array<{ x: number; y: number; life: number }> = [];
  private lastPtr: { x: number; y: number } | null = null;
  private combo = 0;

  protected setup() {
    this.lives = B.lives;
    this.level = 0;
    this.combo = 0;
    this.buildLevel();
  }

  private buildLevel() {
    const rng = this.rng.fork(`lvl-${this.level}`);
    const count = this.level < 2 ? 1 : this.level < 5 ? 2 : rng.int(1, 3);
    const objX = rng.range(130, this.w - 130);
    const objY = this.h * 0.38 + rng.range(-20, 30);
    this.obj = { x: objX, y: objY, px: objX, py: objY };
    // Initial sideways shove so the pendulum swings (timing matters).
    const shove = rng.range(3.5, 6.5) * (rng.chance(0.5) ? 1 : -1) * (count === 1 ? 1 : 0.6);
    this.obj.px = objX - shove;
    this.ropes = [];
    for (let i = 0; i < count; i++) {
      const ax = count === 1 ? objX + rng.range(-60, 60) : 60 + ((this.w - 120) * i) / (count - 1) + rng.range(-20, 20);
      const ay = this.h * 0.13 + rng.range(0, 30);
      const len = Math.hypot(objX - ax, objY - ay);
      const pts: Pt[] = [];
      for (let k = 0; k < B.segments; k++) {
        const t = k / B.segments;
        const x = ax + (objX - ax) * t;
        const y = ay + (objY - ay) * t;
        pts.push({ x, y, px: x, py: y });
      }
      this.ropes.push({ anchor: { x: ax, y: ay }, pts, links: new Array(B.segments).fill(true), rest: len / B.segments });
    }
    this.cup = { x: rng.range(90, this.w - 90), y: this.h - 130, vx: 0 };
    if (this.level >= B.cupSpeedFromLevel) this.cup.vx = (B.cupSpeedBase + this.level * B.cupSpeedPerLevel) * (rng.chance(0.5) ? 1 : -1);
    this.levelTime = 0;
    this.resolved = false;
    this.landed = false;
  }

  private attached(): boolean {
    return this.ropes.some((r) => r.links.every(Boolean));
  }

  protected onPointerDown(p: PointerInfo) {
    this.lastPtr = { x: p.x, y: p.y };
  }

  protected onPointerMove(p: PointerInfo) {
    if (!this.pointerDown || !this.lastPtr) return;
    const a = this.lastPtr;
    this.trail.push({ x: p.x, y: p.y, life: 0.25 });
    for (const r of this.ropes) {
      for (let k = 0; k < r.links.length; k++) {
        if (!r.links[k]) continue;
        const p1 = r.pts[k];
        const p2 = k + 1 < r.pts.length ? r.pts[k + 1] : this.obj;
        if (segmentsIntersect(a.x, a.y, p.x, p.y, p1.x, p1.y, p2.x, p2.y)) {
          r.links[k] = false;
          this.fx.burst((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { color: ["#e8d5a8", "#fff"], count: 10, speed: 200, shape: "spark" });
          this.sound("cut", 1 + this.rng.range(-0.1, 0.1));
          this.ctx.haptics.tap();
          this.recordAction();
        }
      }
    }
    this.lastPtr = { x: p.x, y: p.y };
  }

  protected onPointerUp() {
    this.lastPtr = null;
  }

  private integrate(p: Pt, dt: number) {
    const vx = (p.x - p.px) * B.damping;
    const vy = (p.y - p.py) * B.damping;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + B.gravity * dt * dt;
  }

  private satisfy(a: Pt, b: Pt, rest: number, pinnedA: boolean, wa: number) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const diff = (d - rest) / d;
    if (pinnedA) {
      b.x -= dx * diff;
      b.y -= dy * diff;
    } else {
      a.x += dx * diff * wa;
      a.y += dy * diff * wa;
      b.x -= dx * diff * (1 - wa);
      b.y -= dy * diff * (1 - wa);
    }
  }

  private physics(dt: number) {
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const r of this.ropes) for (let k = 1; k < r.pts.length; k++) this.integrate(r.pts[k], h);
      this.integrate(this.obj, h);
      for (let it = 0; it < B.constraintIterations; it++) {
        for (const r of this.ropes) {
          r.pts[0].x = r.anchor.x;
          r.pts[0].y = r.anchor.y;
          for (let k = 0; k < r.links.length; k++) {
            if (!r.links[k]) continue;
            const a = r.pts[k];
            const isLast = k + 1 >= r.pts.length;
            const b = isLast ? this.obj : r.pts[k + 1];
            // The gem is ~4× heavier than a rope node: it moves less when corrected.
            this.satisfy(a, b, r.rest, k === 0, isLast ? 0.8 : 0.5);
          }
        }
      }
    }
  }

  protected update(dt: number) {
    for (let i = this.trail.length - 1; i >= 0; i--) if ((this.trail[i].life -= dt) <= 0) this.trail.splice(i, 1);
    if (this.state === "idle") return;
    const prevY = this.obj.y;
    this.physics(dt);
    // Cup motion (bounces between walls).
    this.cup.x += this.cup.vx * dt;
    if (this.cup.x < 70 || this.cup.x > this.w - 70) {
      this.cup.vx *= -1;
      this.cup.x = Math.max(70, Math.min(this.w - 70, this.cup.x));
    }
    if (!this.running || this.resolved) {
      if (this.resolved && this.running) {
        this.levelTime += dt;
        if (this.levelTime > 0.8) {
          this.level++;
          this.buildLevel();
        }
      }
      return;
    }
    this.levelTime += dt;
    const R = B.objectRadius;
    const half = B.cupWidth / 2;
    const top = this.cup.y - B.cupDepth;
    if (!this.attached() && prevY + R < top + 6 && this.obj.y + R >= top + 6) {
      const off = Math.abs(this.obj.x - this.cup.x);
      if (off < half - R * 0.35) {
        this.landed = true;
        this.resolved = true;
        const precision = 1 - off / half;
        const swish = off < half * B.swishFraction;
        this.combo = swish ? this.combo + 1 : 0;
        const pts = 100 + Math.round(precision * 50) + this.level * 10 + (swish ? 25 * this.combo : 0);
        this.addScore(pts);
        this.stat("drops");
        this.statMax("accuracy", Math.round(precision * 100));
        if (swish) {
          this.stat("perfects");
          this.statMax("maxCombo", this.combo);
        }
        this.fx.text(this.cup.x, top - 40, swish ? `SWISH +${pts}` : `+${pts}`, { color: swish ? PALETTE.volt : "#fff", size: 26 });
        this.fx.confetti(this.cup.x, top, swish ? 36 : 18);
        this.sound(swish ? "perfect" : "coin");
        this.ctx.haptics.success();
        this.levelTime = 0;
        // Settle the gem into the cup.
        this.obj.x = this.cup.x + (this.obj.x - this.cup.x) * 0.5;
        this.obj.px = this.obj.x;
        this.obj.y = this.cup.y - R - 4;
        this.obj.py = this.obj.y;
        return;
      }
    }
    const lost = this.obj.y > this.h + 80 || this.obj.x < -80 || this.obj.x > this.w + 80 || this.levelTime > B.levelTimeS;
    if (lost) {
      this.lives--;
      this.combo = 0;
      this.resolved = true;
      this.levelTime = 0;
      this.fx.shake(8);
      this.sound("miss");
      this.ctx.haptics.fail();
      if (this.lives <= 0) {
        this.juiceFail(this.w / 2, this.h * 0.7);
        this.finish({ reason: "OUT OF GEMS" });
      }
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    // Cup
    const half = B.cupWidth / 2;
    const top = this.cup.y - B.cupDepth;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.moveTo(this.cup.x - half + 6, top + 8);
    g.lineTo(this.cup.x + half + 6, top + 8);
    g.lineTo(this.cup.x + half - 10 + 6, this.cup.y + 8);
    g.lineTo(this.cup.x - half + 10 + 6, this.cup.y + 8);
    g.fill();
    g.fillStyle = PALETTE.sun;
    g.strokeStyle = "#0b0b0f";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(this.cup.x - half, top);
    g.lineTo(this.cup.x + half, top);
    g.lineTo(this.cup.x + half - 10, this.cup.y);
    g.lineTo(this.cup.x - half + 10, this.cup.y);
    g.closePath();
    g.fill();
    g.stroke();
    fillRoundRect(g, this.cup.x - half * B.swishFraction, top - 3, half * 2 * B.swishFraction, 4, 2, "rgba(255,255,255,0.7)");

    // Ropes
    for (const r of this.ropes) {
      circle(g, r.anchor.x, r.anchor.y, 9, "#fff");
      for (let k = 0; k < r.links.length; k++) {
        if (!r.links[k]) continue;
        const a = r.pts[k];
        const b = k + 1 < r.pts.length ? r.pts[k + 1] : this.obj;
        line(g, a.x, a.y, b.x, b.y, 6, "#e8d5a8");
      }
    }
    const vx = this.obj.x - this.obj.px;
    blobCritter(g, this.obj.x, this.obj.y, B.objectRadius, PALETTE.mint, { lookX: Math.max(-1, Math.min(1, vx / 4)), lookY: 0.6, mouth: this.landed ? "smile" : "o", rotation: vx * 0.03 });

    // Swipe trail
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      line(g, a.x, a.y, b.x, b.y, 6 * (b.life / 0.25), `rgba(255,255,255,${b.life * 3})`);
    }
    text(g, `LEVEL ${this.level + 1}`, this.w / 2, this.h - 50, { font: this.font, size: 14, color: "rgba(255,255,255,0.6)" });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "SWIPE TO CUT", this.w / 2, this.h * 0.6, { font: this.font, size: 22, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score, lives: this.lives, maxLives: B.lives, level: this.level + 1 };
  }
}

const factory: GameFactory = (def) => new RopeDrop(def);
export default factory;
