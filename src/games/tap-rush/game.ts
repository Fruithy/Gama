import { CanvasGame } from "../core/engine";
import { blobCritter, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

class TapRush extends CanvasGame {
  private squash = 1;
  private recent: number[] = [];
  private tps = 0;
  private bestTps = 0;
  private hue = 0;

  protected setup() {
    this.minTapIntervalMs = B.minTapIntervalMs;
    this.allowMultiTouch = false;
    this.squash = 1;
    this.recent = [];
    this.tps = 0;
    this.bestTps = 0;
  }

  protected onPointerDown() {
    this.addScore(1);
    this.squash = 1.35;
    const now = this.elapsedMs;
    this.recent.push(now);
    const cx = this.w / 2;
    const cy = this.h * 0.55;
    this.fx.burst(cx + this.rng.range(-60, 60), cy + this.rng.range(-50, 50), { count: 5, color: [PALETTE.sun, "#fff", PALETTE.flare], speed: 260, size: 5 });
    if (this.score % 10 === 0) {
      this.fx.text(cx, cy - 150, String(this.score), { color: PALETTE.sun, size: 34 });
      this.fx.pulse(0.03);
    }
    this.sound("tap", 0.8 + Math.min(1.2, this.tps / 12));
    this.ctx.haptics.tap();
  }

  protected update(dt: number) {
    this.squash += (1 - this.squash) * Math.min(1, dt * 16);
    this.hue = (this.hue + dt * (40 + this.tps * 20)) % 360;
    const now = this.elapsedMs;
    while (this.recent.length && now - this.recent[0] > 1000) this.recent.shift();
    this.tps = this.recent.length;
    if (this.tps > this.bestTps) {
      this.bestTps = this.tps;
      this.statMax("peakTps", this.tps);
    }
    if (this.tps >= 10) this.fx.shake(1.5);
    if (this.running && this.elapsedMs >= B.durationMs) {
      this.stat("taps", this.score);
      this.fx.confetti(this.w / 2, this.h * 0.4, 30);
      this.sound("levelup");
      this.finish({ reason: "TIME!", slowMo: false, delayMs: 400 });
    }
  }

  protected renderBackground(g: CanvasRenderingContext2D) {
    super.renderBackground(g);
    const intensity = Math.min(1, this.tps / 14);
    g.fillStyle = `hsla(${this.hue}, 90%, 60%, ${0.08 + intensity * 0.22})`;
    g.fillRect(0, 0, this.w, this.h);
  }

  protected render(g: CanvasRenderingContext2D) {
    const cx = this.w / 2;
    const cy = this.h * 0.55;
    // Time ring
    const left = Math.max(0, 1 - this.elapsedMs / B.durationMs);
    g.lineWidth = 14;
    g.strokeStyle = "rgba(255,255,255,0.1)";
    g.beginPath();
    g.arc(cx, cy, 150, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = left < 0.3 ? PALETTE.flare : PALETTE.sun;
    g.lineCap = "round";
    g.beginPath();
    g.arc(cx, cy, 150, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    g.stroke();
    blobCritter(g, cx, cy, 100, PALETTE.sun, { squash: this.squash, mouth: this.tps > 8 ? "o" : "smile", lookY: -0.3, blink: this.squash > 1.2 ? 0.6 : 0 });
    text(g, `${this.tps}`, cx, this.h * 0.2, { font: this.font, size: 64, color: "#fff", stroke: "rgba(0,0,0,0.35)" });
    text(g, "TAPS / SEC", cx, this.h * 0.2 + 44, { font: this.font, size: 14, color: "rgba(255,255,255,0.75)" });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "GET READY TO MASH", this.w / 2, this.h * 0.86, { font: this.font, size: 18, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score, timeLeft: Math.max(0, (B.durationMs - this.elapsedMs) / 1000) };
  }
}

const factory: GameFactory = (def) => new TapRush(def);
export default factory;
