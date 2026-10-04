import { CanvasGame } from "../core/engine";
import { circle, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

const TAU = Math.PI * 2;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;
/** Signed shortest angular distance a→b in (-π, π]. */
const angDiff = (a: number, b: number) => {
  let d = norm(b - a);
  if (d > Math.PI) d -= TAU;
  return d;
};

class PerfectTap extends CanvasGame {
  private angle = 0;
  private dir = 1;
  private speed = B.startSpeed;
  private zoneCenter = 0;
  private zoneWidth = B.startZone;
  private round = 0;
  private combo = 0;
  private travelSinceZone = 0;
  private ringPulse = 0;
  private zoneFlash = 0;

  private get cx() {
    return this.w / 2;
  }
  private get cy() {
    return this.h * 0.52;
  }

  protected setup() {
    this.angle = -Math.PI / 2;
    this.dir = 1;
    this.speed = B.startSpeed;
    this.zoneWidth = B.startZone;
    this.round = 0;
    this.combo = 0;
    this.placeZone();
  }

  private placeZone() {
    // Always at least a quarter-turn ahead so there is time to react.
    const ahead = this.rng.range(Math.PI * 0.55, Math.PI * 1.45);
    this.zoneCenter = norm(this.angle + this.dir * ahead);
    this.travelSinceZone = 0;
  }

  protected onPointerDown() {
    const d = Math.abs(angDiff(this.angle, this.zoneCenter)) / (this.zoneWidth / 2);
    const mx = this.cx + Math.cos(this.angle) * B.ringRadius;
    const my = this.cy + Math.sin(this.angle) * B.ringRadius;
    if (d > 1) {
      this.juiceFail(mx, my);
      this.finish({ reason: "MISSED" });
      return;
    }
    this.round++;
    if (d <= B.perfectFraction) {
      this.combo++;
      const pts = B.perfectBase + Math.min(this.combo, B.maxComboBonus) * B.comboBonus;
      this.addScore(pts);
      this.stat("perfects");
      this.statMax("maxCombo", this.combo);
      this.fx.text(mx, my - 40, this.combo > 1 ? `PERFECT ×${this.combo}` : "PERFECT", { color: PALETTE.volt, size: 26 });
      this.fx.burst(mx, my, { color: [PALETTE.volt, "#fff"], count: 22, speed: 340 });
      this.fx.pulse(0.05);
      this.sound("perfect", 1 + Math.min(this.combo, 12) * 0.05);
      this.ctx.haptics.success();
    } else {
      this.combo = 0;
      const pts = Math.round(60 * (1 - d)) + 10;
      this.addScore(pts);
      this.fx.text(mx, my - 36, `+${pts}`, { color: "#fff", size: 22 });
      this.juiceHit(mx, my, PALETTE.ion);
      this.sound("hit", 1 + this.round * 0.01);
    }
    this.stat("hits");
    this.statMax("accuracy", Math.round((1 - d) * 100));
    this.ringPulse = 1;
    this.zoneFlash = 1;
    this.speed = Math.min(B.maxSpeed, this.speed + B.speedPerRound);
    this.zoneWidth = Math.max(B.minZone, this.zoneWidth * B.zoneShrink);
    // After round 6, the direction may flip — fair because it's telegraphed by the arrow.
    if (this.round > 6 && this.rng.chance(0.3)) this.dir *= -1;
    this.ctx.audio.setIntensity(Math.min(1, this.round / 30));
    this.placeZone();
  }

  protected update(dt: number) {
    if (!this.running) return;
    const step = this.dir * this.speed * dt;
    this.angle = norm(this.angle + step);
    this.travelSinceZone += Math.abs(step);
    // Passed the zone a full extra lap without tapping → miss.
    if (this.travelSinceZone > TAU * (B.graceLaps + 1)) {
      const mx = this.cx + Math.cos(this.angle) * B.ringRadius;
      const my = this.cy + Math.sin(this.angle) * B.ringRadius;
      this.juiceFail(mx, my);
      this.finish({ reason: "TOO SLOW" });
    }
    this.ringPulse = Math.max(0, this.ringPulse - dt * 4);
    this.zoneFlash = Math.max(0, this.zoneFlash - dt * 3);
  }

  protected render(g: CanvasRenderingContext2D) {
    const { cx, cy } = this;
    const R = B.ringRadius;
    const glow = g.createRadialGradient(cx, cy, 10, cx, cy, R * 1.8);
    glow.addColorStop(0, "rgba(139,92,255,0.35)");
    glow.addColorStop(1, "rgba(139,92,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, this.w, this.h);

    // Track
    g.lineCap = "butt";
    g.lineWidth = 34 + this.ringPulse * 6;
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.stroke();
    // Ticks
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.lineWidth = 2;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22));
      g.lineTo(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16));
      g.stroke();
    }
    // Zone + perfect core
    const half = this.zoneWidth / 2;
    g.lineCap = "round";
    g.lineWidth = 34;
    g.strokeStyle = this.zoneFlash > 0 ? "#fff" : "rgba(212,255,58,0.85)";
    g.beginPath();
    g.arc(cx, cy, R, this.zoneCenter - half, this.zoneCenter + half);
    g.stroke();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 34;
    const ph = half * B.perfectFraction;
    g.beginPath();
    g.arc(cx, cy, R, this.zoneCenter - ph, this.zoneCenter + ph);
    g.stroke();

    // Marker critter
    const mx = cx + Math.cos(this.angle) * R;
    const my = cy + Math.sin(this.angle) * R;
    circle(g, mx + 3, my + 4, 21, "rgba(0,0,0,0.3)");
    circle(g, mx, my, 21, "#ff3d7f");
    g.lineWidth = 4;
    g.strokeStyle = "#0b0b0f";
    g.beginPath();
    g.arc(mx, my, 21, 0, TAU);
    g.stroke();
    const look = this.dir;
    circle(g, mx - 6, my - 3, 6, "#fff");
    circle(g, mx + 6, my - 3, 6, "#fff");
    circle(g, mx - 6 + Math.cos(this.angle + (look * Math.PI) / 2) * 2.5, my - 3 + Math.sin(this.angle + (look * Math.PI) / 2) * 2.5, 3, "#0b0b0f");
    circle(g, mx + 6 + Math.cos(this.angle + (look * Math.PI) / 2) * 2.5, my - 3 + Math.sin(this.angle + (look * Math.PI) / 2) * 2.5, 3, "#0b0b0f");

    // Centre: round + direction arrow
    text(g, String(this.round), cx, cy - 6, { font: this.font, size: 56, color: "#fff" });
    text(g, this.dir > 0 ? "↻" : "↺", cx, cy + 40, { font: "system-ui", size: 26, color: "rgba(255,255,255,0.55)" });
    if (this.combo > 1) text(g, `COMBO ×${this.combo}`, cx, cy + R + 52, { font: this.font, size: 18, color: PALETTE.volt });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "TAP IN THE ZONE", this.w / 2, this.h * 0.18, { font: this.font, size: 20, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score, combo: this.combo, label: `ROUND ${this.round + 1}` };
  }
}

const factory: GameFactory = (def) => new PerfectTap(def);
export default factory;
