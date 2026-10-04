import { CanvasGame, type PointerInfo } from "../core/engine";
import { circle, googlyEyes, line, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Arrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
  life: number;
}

/**
 * Portrait archery: you shoot "up the range". The target plane is a fixed
 * screen height; the arrow's x at that plane decides the ring. Gravity acts
 * as drop (slows the arrow's climb) so power matters, and wind drifts it
 * sideways for longer flights.
 */
class TargetShot extends CanvasGame {
  private aim: { sx: number; sy: number; x: number; y: number } | null = null;
  private arrow: Arrow | null = null;
  private target = { x: 200, y: 200, r: B.targetRadius, vx: 0 };
  private wind = 0;
  private shots = 0;
  private misses = 0;
  private bullStreak = 0;
  private hitMarks: Array<{ dx: number; dy: number }> = [];

  private get origin() {
    return { x: this.w / 2, y: this.h - 110 };
  }

  protected setup() {
    this.shots = 0;
    this.misses = 0;
    this.bullStreak = 0;
    this.arrow = null;
    this.aim = null;
    this.nextTarget();
  }

  private nextTarget() {
    const r = Math.max(B.minTargetRadius, B.targetRadius - this.shots * 2);
    this.target = { x: this.rng.range(r + 20, this.w - r - 20), y: this.h * this.rng.range(0.2, 0.32), r, vx: 0 };
    if (this.shots >= B.movingFrom) this.target.vx = this.rng.range(40, 60 + this.shots * 4) * (this.rng.chance(0.5) ? 1 : -1);
    this.wind = this.shots >= B.windFrom ? this.rng.range(-1, 1) * Math.min(B.windMax, 60 + this.shots * 18) : 0;
    this.hitMarks = [];
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.arrow && !this.arrow.stuck) return;
    this.aim = { sx: p.x, sy: p.y, x: p.x, y: p.y };
  }

  protected onPointerMove(p: PointerInfo) {
    if (this.aim) {
      this.aim.x = p.x;
      this.aim.y = p.y;
    }
  }

  private launchVelocity() {
    if (!this.aim) return null;
    const dx = this.aim.sx - this.aim.x;
    const dy = this.aim.sy - this.aim.y;
    const pull = Math.hypot(dx, dy);
    if (pull < 18) return null;
    const power = Math.max(B.minPower, Math.min(B.maxPower, pull * B.powerPerPx));
    return { vx: (dx / pull) * power, vy: (dy / pull) * power };
  }

  protected onPointerUp() {
    const v = this.launchVelocity();
    this.aim = null;
    if (!v || v.vy >= -50) return; // must shoot up-range
    const o = this.origin;
    this.arrow = { x: o.x, y: o.y, vx: v.vx, vy: v.vy, stuck: false, life: 0 };
    this.shots++;
    this.sound("whoosh", 1.2);
  }

  private resolve(a: Arrow) {
    const t = this.target;
    const off = Math.abs(a.x - t.x);
    const ringW = t.r / B.rings.length;
    const ring = Math.floor(off / ringW);
    if (ring >= B.rings.length) {
      this.misses++;
      this.bullStreak = 0;
      this.fx.text(a.x, t.y - 30, "MISS", { color: PALETTE.flare, size: 24 });
      this.sound("miss");
      this.ctx.haptics.fail();
      if (this.misses >= B.misses) {
        this.juiceFail(a.x, t.y);
        this.finish({ reason: "OUT OF ARROWS" });
        return;
      }
    } else {
      const pts = B.rings[ring];
      const bull = ring === 0;
      this.bullStreak = bull ? this.bullStreak + 1 : 0;
      const bonus = bull ? 5 * Math.min(this.bullStreak, 5) : 0;
      this.addScore(pts + bonus);
      this.statMax("accuracy", Math.round((1 - off / t.r) * 100));
      this.hitMarks.push({ dx: a.x - t.x, dy: 0 });
      if (bull) {
        this.stat("perfects");
        this.statMax("maxCombo", this.bullStreak);
        this.fx.text(t.x, t.y - t.r - 20, this.bullStreak > 1 ? `BULLSEYE ×${this.bullStreak}` : "BULLSEYE", { color: PALETTE.sun, size: 26 });
        this.fx.confetti(t.x, t.y, 30);
        this.sound("perfect");
      } else {
        this.fx.text(t.x, t.y - t.r - 16, `+${pts}`, { size: 22 });
        this.sound("thud", 1.3);
      }
      this.fx.shake(5);
      this.ctx.haptics.success();
    }
    a.stuck = true;
    a.life = 0;
  }

  protected update(dt: number) {
    const t = this.target;
    if (t.vx) {
      t.x += t.vx * dt;
      if (t.x < t.r + 10 || t.x > this.w - t.r - 10) t.vx *= -1;
    }
    const a = this.arrow;
    if (!a) return;
    if (a.stuck) {
      a.life += dt;
      a.x += t.vx * dt; // ride along with the moving target
      if (a.life > 0.6 && this.running) {
        this.arrow = null;
        this.nextTarget();
      }
      return;
    }
    const prevY = a.y;
    a.vy += B.gravity * dt;
    a.vx += this.wind * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (prevY > t.y && a.y <= t.y) {
      a.y = t.y;
      this.resolve(a);
    } else if (a.vy > 0 || a.x < -60 || a.x > this.w + 60) {
      // Fell short or flew wide.
      a.stuck = true;
      a.life = 0;
      this.misses++;
      this.bullStreak = 0;
      this.fx.text(this.w / 2, this.h * 0.5, "SHORT", { color: PALETTE.flare, size: 24 });
      this.sound("miss");
      if (this.misses >= B.misses) {
        this.juiceFail();
        this.finish({ reason: "OUT OF ARROWS" });
      }
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const t = this.target;
    // Target board (seen from behind the shooter: rings as a flattened ellipse)
    const colors = ["#ffc23d", PALETTE.flare, "#fff", PALETTE.flare, "#fff"];
    for (let i = B.rings.length - 1; i >= 0; i--) {
      g.fillStyle = colors[i];
      g.beginPath();
      g.ellipse(t.x, t.y, (t.r * (i + 1)) / B.rings.length, ((t.r * (i + 1)) / B.rings.length) * 0.42, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "#0b0b0f";
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(t.x, t.y, t.r, t.r * 0.42, 0, 0, Math.PI * 2);
    g.stroke();
    googlyEyes(g, t.x, t.y - t.r * 0.42 - 16, 9, { gap: 14, lookX: this.arrow ? Math.sign(this.arrow.x - t.x) : 0, lookY: 1 });
    // Range lines
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = 2;
    for (let y = t.y + 60; y < this.h; y += 70) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.w, y);
      g.stroke();
    }
    // Wind
    if (Math.abs(this.wind) > 5) {
      const s = Math.round(Math.abs(this.wind) / 30);
      text(g, `${this.wind > 0 ? "WIND ▶" : "◀ WIND"} ${s}`, this.w / 2, this.h * 0.1, { font: this.font, size: 15, color: "#fff" });
    }
    // Aim preview (only the first part of the flight)
    const o = this.origin;
    const v = this.launchVelocity();
    if (this.aim && v) {
      let x = o.x;
      let y = o.y;
      let vx = v.vx;
      let vy = v.vy;
      const step = 1 / 60;
      for (let s = 0; s < B.previewS / step; s++) {
        vy += B.gravity * step;
        vx += this.wind * step;
        x += vx * step;
        y += vy * step;
        if (s % 3 === 0) circle(g, x, y, 3, "rgba(255,255,255,0.8)");
      }
      line(g, this.aim.sx, this.aim.sy, this.aim.x, this.aim.y, 3, "rgba(255,255,255,0.3)");
    }
    // Bow
    const pull = this.aim ? Math.min(60, Math.hypot(this.aim.x - this.aim.sx, this.aim.y - this.aim.sy) / 3) : 0;
    g.strokeStyle = "#5a2d0c";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(o.x, o.y + 40, 70, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    line(g, o.x - 57, o.y, o.x, o.y + pull, 2, "#fff");
    line(g, o.x + 57, o.y, o.x, o.y + pull, 2, "#fff");
    // Arrow
    const a = this.arrow;
    if (a) {
      const ang = a.stuck ? -Math.PI / 2 : Math.atan2(a.vy, a.vx);
      line(g, a.x - Math.cos(ang) * 36, a.y - Math.sin(ang) * 36, a.x, a.y, 4, "#ffc23d");
      circle(g, a.x, a.y, 4, "#0b0b0f");
    } else if (!this.aim && this.running) {
      line(g, o.x, o.y + 10, o.x, o.y - 30, 4, "#ffc23d");
    }
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "DRAG DOWN, RELEASE", this.w / 2, this.h * 0.6, { font: this.font, size: 20, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score, lives: B.misses - this.misses, maxLives: B.misses, label: `SHOT ${this.shots + (this.arrow && !this.arrow.stuck ? 0 : 1)}` };
  }
}

const factory: GameFactory = (def) => new TargetShot(def);
export default factory;
