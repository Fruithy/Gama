import { CanvasGame, type PointerInfo } from "../core/engine";
import { circle, googlyEyes, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

class KeepItUp extends CanvasGame {
  private x = 200;
  private y = 300;
  private vx = 0;
  private vy = 0;
  private spin = 0;
  private rot = 0;
  private r = B.radius;
  private kicks = 0;
  private combo = 0;
  private windPhase = 0;
  private wind = 0;

  protected setup() {
    this.x = this.w / 2;
    this.y = this.h * 0.4;
    this.vx = 0;
    this.vy = -200;
    this.r = B.radius;
    this.kicks = 0;
    this.combo = 0;
    this.windPhase = this.rng.range(0, Math.PI * 2);
    this.wind = 0;
  }

  protected onPointerDown(p: PointerInfo) {
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    if (Math.hypot(dx, dy) > this.r * B.hitRadius) return;
    // Kick: up, plus sideways away from the tap point.
    this.vy = -B.kickVelocity;
    this.vx = this.vx * 0.35 + dx * B.sideKick;
    this.spin = dx * 0.25;
    this.kicks++;
    const centred = Math.abs(dx) < this.r * B.perfectZone && dy < this.r * 0.2;
    if (centred) {
      this.combo++;
      this.addScore(2);
      this.stat("perfects");
      this.statMax("maxCombo", this.combo);
      this.fx.text(this.x, this.y - this.r - 24, this.combo > 1 ? `PERFECT ×${this.combo}` : "PERFECT", { color: PALETTE.volt, size: 22 });
      this.fx.burst(this.x, this.y + this.r * 0.6, { color: [PALETTE.volt, "#fff"], count: 16, speed: 260, angle: Math.PI / 2, spread: Math.PI });
      this.sound("perfect", 1 + Math.min(12, this.combo) * 0.04);
    } else {
      this.combo = 0;
      this.addScore(1);
      this.fx.burst(this.x, this.y + this.r * 0.6, { color: ["#fff"], count: 8, speed: 180, angle: Math.PI / 2, spread: Math.PI });
      this.sound("bounce", 0.9 + Math.min(1, this.kicks / 60) * 0.4);
    }
    this.r = Math.max(B.minRadius, B.radius - this.kicks * 0.05);
    this.fx.pulse(0.02);
    this.ctx.haptics.tap();
  }

  protected update(dt: number) {
    if (this.state === "idle") {
      this.y = this.h * 0.4 + Math.sin(this.clock * 3) * 10;
      return;
    }
    if (!this.running && this.state !== "ending") return;
    if (this.kicks >= B.windFrom) {
      const strength = Math.min(1, (this.kicks - B.windFrom) / 40) * B.windMax;
      this.wind = Math.sin(this.t * 0.6 + this.windPhase) * strength;
    }
    this.vy += B.gravity * dt;
    this.vx += this.wind * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spin *= Math.pow(0.6, dt);
    this.rot += this.spin * dt;
    if (this.x < this.r) {
      this.x = this.r;
      this.vx = Math.abs(this.vx) * B.restitution;
      this.sound("thud", 1.4, 0.5);
    } else if (this.x > this.w - this.r) {
      this.x = this.w - this.r;
      this.vx = -Math.abs(this.vx) * B.restitution;
      this.sound("thud", 1.4, 0.5);
    }
    if (this.y < this.r) {
      this.y = this.r;
      this.vy = Math.abs(this.vy) * B.restitution;
    }
    if (this.running && this.y - this.r > this.h - 60) {
      this.juiceFail(this.x, this.h - 60);
      this.finish({ reason: "DROPPED IT" });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    // Pitch
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(0, this.h - 60, this.w, 60);
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(this.w / 2, this.h - 60, 70, Math.PI, 0);
    g.stroke();
    // Shadow scales with height
    const hgt = Math.max(0, this.h - 60 - this.y);
    g.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.35 - hgt / 2000)})`;
    g.beginPath();
    g.ellipse(this.x, this.h - 56, this.r * (1 - Math.min(0.6, hgt / 1500)), 8, 0, 0, Math.PI * 2);
    g.fill();
    // Wind indicator
    if (Math.abs(this.wind) > 10) {
      const dir = Math.sign(this.wind);
      g.globalAlpha = Math.min(0.8, Math.abs(this.wind) / B.windMax);
      text(g, dir > 0 ? "WIND ≫" : "≪ WIND", this.w / 2, this.h * 0.18, { font: this.font, size: 16, color: "#fff" });
      g.globalAlpha = 1;
    }
    // Ball
    circle(g, this.x, this.y, this.r, "#ffffff");
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.rot);
    g.fillStyle = "#0b0b0f";
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      g.lineTo(Math.cos(a) * this.r * 0.32, Math.sin(a) * this.r * 0.32);
    }
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = "#0b0b0f";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    g.stroke();
    googlyEyes(g, this.x, this.y + this.r * 0.42, this.r * 0.16, { gap: this.r * 0.24, lookY: this.vy > 0 ? 1 : -1 });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "TAP THE BALL", this.w / 2, this.h * 0.7, { font: this.font, size: 22, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score, combo: this.combo };
  }
}

const factory: GameFactory = (def) => new KeepItUp(def);
export default factory;
