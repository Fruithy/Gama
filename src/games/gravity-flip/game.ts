import { CanvasGame } from "../core/engine";
import { blobCritter, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Spike {
  x: number;
  side: 1 | -1; // 1 = floor, -1 = ceiling
  count: number;
}

const SPIKE_W = 26;
const SPIKE_H = 34;

class GravityFlip extends CanvasGame {
  private gdir: 1 | -1 = 1;
  private y = 0;
  private vy = 0;
  private speed = B.startSpeed;
  private dist = 0;
  private spikes: Spike[] = [];
  private nextX = 0;
  private lastSide: 1 | -1 = 1;
  private scroll = 0;
  private x = 110;

  private get floor() {
    return this.h / 2 + B.corridor / 2;
  }
  private get ceiling() {
    return this.h / 2 - B.corridor / 2;
  }

  protected setup() {
    this.gdir = 1;
    this.y = this.floor - B.radius;
    this.vy = 0;
    this.speed = B.startSpeed;
    this.dist = 0;
    this.spikes = [];
    this.nextX = this.w + 120;
    this.lastSide = 1;
    while (this.nextX < this.w * 2.5) this.spawn();
  }

  /** Fairness: switching sides requires a gap of at least speed × flipSafetyS. */
  private spawn() {
    const side: 1 | -1 = this.rng.chance(0.5) ? 1 : -1;
    const count = this.rng.int(1, this.dist > 300 ? 3 : 2);
    const minGap = side !== this.lastSide ? Math.max(this.speed * B.flipSafetyS + count * SPIKE_W, this.speed * B.minGapS) : this.speed * B.minGapS;
    const gap = Math.max(minGap, this.speed * this.rng.range(B.minGapS, B.maxGapS));
    this.nextX += gap;
    this.spikes.push({ x: this.nextX, side, count });
    this.nextX += count * SPIKE_W;
    this.lastSide = side;
  }

  protected onPointerDown() {
    this.gdir = this.gdir === 1 ? -1 : 1;
    this.sound("flip", this.gdir === 1 ? 0.9 : 1.2);
    this.ctx.haptics.tap();
  }

  protected update(dt: number) {
    if (this.state === "idle") {
      this.scroll = (this.scroll + dt * 120) % 60;
      return;
    }
    if (!this.running) return;
    this.speed = Math.min(B.maxSpeed, this.speed + B.speedGain * dt);
    const dx = this.speed * dt;
    this.dist += dx / B.pxPerMeter;
    this.scroll = (this.scroll + dx) % 60;
    this.setScore(this.dist);
    this.vy += this.gdir * B.gravity * dt;
    this.y += this.vy * dt;
    const lo = this.ceiling + B.radius;
    const hi = this.floor - B.radius;
    if (this.y > hi) {
      this.y = hi;
      if (this.vy > 300) this.fx.burst(this.x, this.floor, { count: 4, color: PALETTE.volt, speed: 120, spread: Math.PI, angle: -Math.PI / 2 });
      this.vy = 0;
    } else if (this.y < lo) {
      this.y = lo;
      if (this.vy < -300) this.fx.burst(this.x, this.ceiling, { count: 4, color: PALETTE.volt, speed: 120, spread: Math.PI, angle: Math.PI / 2 });
      this.vy = 0;
    }
    for (const s of this.spikes) s.x -= dx;
    this.nextX -= dx;
    while (this.spikes.length && this.spikes[0].x + this.spikes[0].count * SPIKE_W < -40) {
      this.spikes.shift();
      this.stat("dodged");
    }
    while (this.nextX < this.w * 2.5) this.spawn();
    // Collision: circle vs spike row bounding box, trimmed for the triangle shape.
    const r = B.radius * 0.75;
    for (const s of this.spikes) {
      const x1 = s.x + 4;
      const x2 = s.x + s.count * SPIKE_W - 4;
      if (this.x + r < x1 || this.x - r > x2) continue;
      const hit = s.side === 1 ? this.y + r > this.floor - SPIKE_H * 0.7 : this.y - r < this.ceiling + SPIKE_H * 0.7;
      if (hit) {
        this.juiceFail(this.x, this.y);
        this.finish({ reason: "SPIKED" });
        return;
      }
    }
    this.ctx.audio.setIntensity((this.speed - B.startSpeed) / (B.maxSpeed - B.startSpeed));
  }

  protected render(g: CanvasRenderingContext2D) {
    // Corridor
    fillRoundRect(g, -10, this.floor, this.w + 20, this.h - this.floor + 10, 0, "rgba(11,11,15,0.55)");
    fillRoundRect(g, -10, -10, this.w + 20, this.ceiling + 10, 0, "rgba(11,11,15,0.55)");
    g.fillStyle = "rgba(255,255,255,0.12)";
    for (let x = -this.scroll; x < this.w; x += 60) {
      g.fillRect(x, this.floor, 30, 4);
      g.fillRect(x, this.ceiling - 4, 30, 4);
    }
    for (const s of this.spikes) {
      for (let i = 0; i < s.count; i++) {
        const x = s.x + i * SPIKE_W;
        const base = s.side === 1 ? this.floor : this.ceiling;
        g.fillStyle = PALETTE.flare;
        g.strokeStyle = "#0b0b0f";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x + SPIKE_W / 2, base - s.side * SPIKE_H);
        g.lineTo(x + SPIKE_W, base);
        g.closePath();
        g.fill();
        g.stroke();
      }
    }
    blobCritter(g, this.x, this.y, B.radius, PALETTE.volt, { rotation: this.gdir === 1 ? 0 : Math.PI, mouth: Math.abs(this.vy) > 200 ? "o" : "smile", lookX: 1 });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "TAP TO FLIP", this.w / 2, this.ceiling - 40, { font: this.font, size: 22, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new GravityFlip(def);
export default factory;
