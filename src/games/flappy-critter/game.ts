import { CanvasGame } from "../core/engine";
import { fillRoundRect, googlyEyes, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Pillar {
  x: number;
  gapY: number; // centre
  gap: number;
  passed: boolean;
}

class FlappyCritter extends CanvasGame {
  private y = 0;
  private vy = 0;
  private x = 120;
  private pillars: Pillar[] = [];
  private speed = B.startSpeed;
  private wing = 0;
  private lastGapY = 0;
  private ground = 0;

  protected setup() {
    this.y = this.h * 0.45;
    this.vy = 0;
    this.speed = B.startSpeed;
    this.pillars = [];
    this.lastGapY = this.h * 0.45;
    for (let i = 0; i < 4; i++) this.addPillar(this.w + 140 + i * B.spacing);
  }

  private addPillar(x: number) {
    const gates = this.score + this.pillars.length;
    const gap = Math.max(B.minGap, B.startGap - gates * B.gapShrink);
    const lo = Math.max(this.h * 0.18 + gap / 2, this.lastGapY - B.maxGapShift);
    const hi = Math.min(this.h * 0.82 - gap / 2, this.lastGapY + B.maxGapShift);
    const gapY = this.rng.range(lo, hi);
    this.lastGapY = gapY;
    this.pillars.push({ x, gapY, gap, passed: false });
  }

  protected onPointerDown() {
    this.vy = -B.flapVelocity;
    this.wing = 1;
    this.sound("flip", 1.1);
    this.fx.burst(this.x - 14, this.y + 8, { count: 3, color: "#fff", speed: 90, size: 3, gravity: 200, life: 0.3 });
  }

  protected update(dt: number) {
    this.wing = Math.max(0, this.wing - dt * 5);
    if (this.state === "idle") {
      this.y = this.h * 0.45 + Math.sin(this.clock * 3) * 12;
      return;
    }
    if (!this.running) {
      this.vy += B.gravity * dt;
      this.y = Math.min(this.h - 40, this.y + this.vy * dt);
      return;
    }
    this.vy += B.gravity * dt;
    this.y += this.vy * dt;
    this.ground = (this.ground + this.speed * dt) % 40;
    for (const p of this.pillars) {
      p.x -= this.speed * dt;
      if (!p.passed && p.x + B.pillarWidth < this.x - B.radius) {
        p.passed = true;
        this.addScore(1);
        this.speed = Math.min(B.maxSpeed, this.speed + B.speedGain);
        this.sound("coin", 1 + Math.min(this.score, 40) * 0.01);
        if (this.score % 10 === 0) {
          this.fx.text(this.w / 2, this.h * 0.25, `${this.score}!`, { color: PALETTE.sun, size: 40 });
          this.fx.confetti(this.w / 2, this.h * 0.25, 20);
        }
      }
    }
    if (this.pillars[0] && this.pillars[0].x < -B.pillarWidth) {
      this.pillars.shift();
      this.addPillar(this.pillars[this.pillars.length - 1].x + B.spacing);
    }
    // Collisions (slightly forgiving hitbox: 80% of the drawn radius).
    const r = B.radius * 0.8;
    let dead = this.y - r < 0 || this.y + r > this.h - 40;
    for (const p of this.pillars) {
      if (this.x + r > p.x && this.x - r < p.x + B.pillarWidth) {
        if (this.y - r < p.gapY - p.gap / 2 || this.y + r > p.gapY + p.gap / 2) dead = true;
      }
    }
    if (dead) {
      this.juiceFail(this.x, this.y);
      this.finish({ reason: "BONK" });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    for (const p of this.pillars) {
      const top = p.gapY - p.gap / 2;
      const bot = p.gapY + p.gap / 2;
      fillRoundRect(g, p.x + 5, -20, B.pillarWidth, top + 20, 16, "rgba(0,0,0,0.22)");
      fillRoundRect(g, p.x, -20, B.pillarWidth, top + 20, 16, PALETTE.mint);
      fillRoundRect(g, p.x - 6, top - 26, B.pillarWidth + 12, 26, 10, "#2bd99a");
      fillRoundRect(g, p.x, bot, B.pillarWidth, this.h - bot, 16, PALETTE.mint);
      fillRoundRect(g, p.x - 6, bot, B.pillarWidth + 12, 26, 10, "#2bd99a");
    }
    // Ground
    g.fillStyle = "#0b2440";
    g.fillRect(0, this.h - 40, this.w, 40);
    g.fillStyle = "rgba(255,255,255,0.15)";
    for (let x = -this.ground; x < this.w; x += 40) g.fillRect(x, this.h - 40, 20, 6);
    // Critter: round moth with flapping wings
    const tilt = Math.max(-0.5, Math.min(1.1, this.vy / 700));
    g.save();
    g.translate(this.x, this.y);
    g.rotate(tilt);
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.ellipse(-10, -4 - this.wing * 10, 16, 9 + this.wing * 4, -0.6 - this.wing * 0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.sun;
    g.beginPath();
    g.arc(0, 0, B.radius, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#0b0b0f";
    g.lineWidth = 3;
    g.stroke();
    googlyEyes(g, 4, -4, 6, { gap: 7, lookX: 1, lookY: this.vy > 0 ? 0.6 : -0.6 });
    g.fillStyle = PALETTE.ember;
    g.beginPath();
    g.moveTo(B.radius - 2, 2);
    g.lineTo(B.radius + 10, 6);
    g.lineTo(B.radius - 2, 10);
    g.fill();
    g.restore();
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "TAP TO FLAP", this.w / 2, this.h * 0.3, { font: this.font, size: 24, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new FlappyCritter(def);
export default factory;
