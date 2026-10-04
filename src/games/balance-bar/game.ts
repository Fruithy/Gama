import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

class BalanceBar extends CanvasGame {
  private x = 0; // ball offset from bar centre
  private v = 0;
  private zoneC = 0;
  private zoneW = B.startZone;
  private outside = 0;
  private input = 0;
  private keys = { left: false, right: false };
  private gustPhase: number[] = [0, 0, 0];
  private tilt = 0;

  protected setup() {
    this.x = this.rng.range(-8, 8);
    this.v = 0;
    this.zoneC = 0;
    this.zoneW = B.startZone;
    this.outside = 0;
    this.input = 0;
    this.gustPhase = [this.rng.range(0, 6), this.rng.range(0, 6), this.rng.range(0, 6)];
  }

  protected onPointerDown(p: PointerInfo) {
    this.input = p.x < this.w / 2 ? -1 : 1;
  }
  protected onPointerMove(p: PointerInfo) {
    if (this.pointerDown) this.input = p.x < this.w / 2 ? -1 : 1;
  }
  protected onPointerUp() {
    this.input = 0;
  }
  protected onKey(key: string, down: boolean) {
    if (key === "ArrowLeft" || key === "a") this.keys.left = down;
    else if (key === "ArrowRight" || key === "d") this.keys.right = down;
    else return false;
    this.input = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    return true;
  }

  /** Smooth, seeded "wind": sum of slow sines — fair because it's continuous, never a jolt. */
  private gust(t: number) {
    const [a, b, c] = this.gustPhase;
    return (Math.sin(t * 0.9 + a) * 0.6 + Math.sin(t * 1.7 + b) * 0.3 + Math.sin(t * 3.1 + c) * 0.1) * B.gustStrength * Math.min(1, t / 6);
  }

  protected update(dt: number) {
    if (this.state === "idle") {
      this.x = Math.sin(this.clock * 2) * 20;
      return;
    }
    if (!this.running) return;
    const t = this.t;
    const k = B.startInstability + t * B.instabilityGrowth;
    const a = k * (this.x - this.zoneC) + this.gust(t) + this.input * B.pushForce;
    this.v = (this.v + a * dt) * Math.pow(B.damping, dt * 60);
    this.x += this.v * dt;
    const half = B.barWidth / 2;
    if (this.x < -half || this.x > half) {
      this.x = Math.max(-half, Math.min(half, this.x));
      this.v *= -0.3;
    }
    this.zoneW = Math.max(B.minZone, B.startZone - t * B.zoneShrinkPerSecond);
    // The zone wanders slowly once it's small enough to make that matter.
    const wander = Math.max(0, (half - this.zoneW / 2) * 0.55);
    this.zoneC = Math.sin(t * 0.35 + this.gustPhase[0]) * wander * Math.min(1, t / 20);
    this.tilt += ((this.x / half) * 0.25 - this.tilt) * Math.min(1, dt * 8);

    const inZone = Math.abs(this.x - this.zoneC) <= this.zoneW / 2;
    this.outside = inZone ? 0 : this.outside + dt;
    if (!inZone && this.outside > 0.05) this.fx.flash("#ff3d7f", 0.08);
    this.setScore(this.elapsedMs / 10);
    if (Math.floor(t) % 5 === 0 && Math.floor(t - dt) % 5 !== 0 && t > 1) {
      this.fx.text(this.w / 2, this.h * 0.3, `${Math.floor(t)}s`, { color: PALETTE.ion, size: 30 });
      this.sound("tick", 1.4);
    }
    this.ctx.audio.setIntensity(Math.min(1, t / 60));
    if (this.outside > B.graceS) {
      this.juiceFail(this.w / 2 + this.x, this.h * 0.5);
      this.finish({ reason: "LOST BALANCE" });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const cx = this.w / 2;
    const cy = this.h * 0.55;
    const half = B.barWidth / 2;
    g.save();
    g.translate(cx, cy);
    g.rotate(this.tilt);
    fillRoundRect(g, -half - 6 + 4, -18 + 6, B.barWidth + 12, 36, 18, "rgba(0,0,0,0.35)");
    fillRoundRect(g, -half - 6, -18, B.barWidth + 12, 36, 18, "#0b2f3a");
    const danger = this.outside > 0;
    fillRoundRect(g, this.zoneC - this.zoneW / 2, -14, this.zoneW, 28, 14, danger ? PALETTE.flare : PALETTE.ion);
    blobCritter(g, this.x, -42, 26, PALETTE.flare, { lookX: Math.max(-1, Math.min(1, this.v / 200)), mouth: danger ? "o" : "flat", rotation: this.x / 30 });
    g.restore();
    // Fulcrum
    g.fillStyle = PALETTE.sun;
    g.strokeStyle = "#0b0b0f";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, cy + 20);
    g.lineTo(cx - 34, cy + 80);
    g.lineTo(cx + 34, cy + 80);
    g.closePath();
    g.fill();
    g.stroke();
    // Touch hints
    g.globalAlpha = this.input < 0 ? 0.35 : 0.12;
    text(g, "◀", 40, this.h * 0.82, { font: "system-ui", size: 40 });
    g.globalAlpha = this.input > 0 ? 0.35 : 0.12;
    text(g, "▶", this.w - 40, this.h * 0.82, { font: "system-ui", size: 40 });
    g.globalAlpha = 1;
  }

  protected hud(): HudState {
    return { score: this.score, scoreText: `${(this.elapsedMs / 1000).toFixed(2)}`, label: "SECONDS" };
  }
}

const factory: GameFactory = (def) => new BalanceBar(def);
export default factory;
