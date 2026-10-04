import { CanvasGame } from "../core/engine";
import { blobCritter, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

class PerfectHold extends CanvasGame {
  private round = 0;
  private target = 50;
  private fill = 0;
  private speed = 50;
  private vel = 0;
  private holding = false;
  private result: { diff: number; pts: number; burst: boolean } | null = null;
  private pauseT = 0;

  protected setup() {
    this.round = 0;
    this.nextRound();
  }

  private nextRound() {
    this.target = Math.round(this.rng.range(B.targetMin, B.targetMax) * 10) / 10;
    this.speed = this.rng.range(B.minSpeed, B.maxSpeed);
    this.fill = 0;
    this.vel = this.speed;
    this.holding = false;
    this.result = null;
  }

  protected onPointerDown() {
    if (this.result || this.pauseT > 0) return;
    this.holding = true;
    this.sound("tick", 0.8);
  }

  protected onPointerUp() {
    if (!this.holding) return;
    this.holding = false;
    this.score_(false);
  }

  private score_(burst: boolean) {
    const diff = Math.abs(this.fill - this.target);
    const pts = burst ? 0 : Math.max(0, Math.round(100 - diff * B.pointsPerPct)) + (diff <= B.perfectWithin ? 30 : 0);
    this.result = { diff, pts, burst };
    this.addScore(pts);
    this.round++;
    const y = this.barY() + this.barH() * (1 - this.fill / 100);
    if (burst) {
      this.fx.burst(this.w / 2, this.barY(), { color: [PALETTE.flare, "#fff"], count: 30, speed: 380 });
      this.fx.shake(10);
      this.sound("fail", 1.3);
      this.ctx.haptics.fail();
    } else if (diff <= B.perfectWithin) {
      this.stat("perfects");
      this.fx.text(this.w / 2, y - 30, "PERFECT", { color: PALETTE.volt, size: 28 });
      this.fx.confetti(this.w / 2, y, 24);
      this.sound("perfect");
      this.ctx.haptics.success();
    } else {
      this.fx.text(this.w / 2, y - 30, `${diff.toFixed(1)}% off`, { size: 20 });
      this.sound("hit", 1 + (1 - Math.min(1, diff / 20)) * 0.4);
    }
    this.statMax("accuracy", Math.round(Math.max(0, 100 - diff)));
    this.pauseT = 1.0;
  }

  private barY() {
    return this.h * 0.2;
  }
  private barH() {
    return this.h * 0.58;
  }

  protected update(dt: number) {
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      if (this.pauseT <= 0 && this.running) {
        if (this.round >= B.rounds) this.finish({ reason: "DONE", slowMo: false, delayMs: 200 });
        else this.nextRound();
      }
      return;
    }
    if (!this.running || !this.holding) return;
    if (this.round >= B.accelFromRound) this.vel += B.accel * dt;
    this.fill += this.vel * dt;
    if (this.fill >= 100) {
      this.fill = 100;
      this.holding = false;
      this.score_(true);
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const bw = 120;
    const x = (this.w - bw) / 2;
    const y = this.barY();
    const h = this.barH();
    fillRoundRect(g, x + 5, y + 7, bw, h, 36, "rgba(0,0,0,0.35)");
    fillRoundRect(g, x, y, bw, h, 36, "#0b2f3a");
    const fh = (h - 16) * (this.fill / 100);
    if (fh > 0) fillRoundRect(g, x + 8, y + h - 8 - fh, bw - 16, fh, 28, this.result?.burst ? PALETTE.flare : PALETTE.sun);
    // Target line
    const ty = y + 8 + (h - 16) * (1 - this.target / 100);
    g.fillStyle = "#fff";
    g.fillRect(x - 30, ty - 2, bw + 60, 4);
    text(g, `${this.target.toFixed(1)}%`, x + bw + 44, ty, { font: this.font, size: 14, color: "#fff", align: "left" });
    blobCritter(g, x - 50, ty, 18, PALETTE.flare, { lookX: 1, mouth: this.holding ? "o" : "smile" });
    text(g, `${this.fill.toFixed(1)}%`, this.w / 2, y + h + 40, { font: this.font, size: 30, color: "#fff" });
    text(g, `ROUND ${Math.min(this.round + 1, B.rounds)} / ${B.rounds}`, this.w / 2, y - 26, { font: this.font, size: 14, color: "rgba(255,255,255,0.7)" });
    if (!this.holding && !this.result && this.running) text(g, "HOLD", this.w / 2, y + h / 2, { font: this.font, size: 22, color: "rgba(255,255,255,0.5)" });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new PerfectHold(def);
export default factory;
