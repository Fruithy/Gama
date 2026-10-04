import { CanvasGame } from "../core/engine";
import { blobCritter, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

type Phase = "wait" | "go" | "result";

/**
 * Timing note: `goAt` is stamped with performance.now() in the first frame
 * that actually paints the GO screen, and the tap time is read in the input
 * handler — so the measurement covers what the player saw, not when we
 * decided to flip the colour.
 */
class ReactionFlash extends CanvasGame {
  private phase: Phase = "wait";
  private round = 0;
  private delay = 0;
  private timer = 0;
  private goAt = 0;
  private goPainted = false;
  private times: number[] = [];
  private last = 0;

  protected setup() {
    this.round = 0;
    this.times = [];
    this.startWait();
  }

  private startWait() {
    this.phase = "wait";
    this.timer = 0;
    this.delay = this.rng.range(B.minDelayS, B.maxDelayS);
    this.goPainted = false;
  }

  protected onPointerDown() {
    if (this.phase === "wait") {
      this.fx.flash("#ff3d7f", 0.5);
      this.juiceFail();
      this.finish({ completed: false, reason: "TOO EARLY" });
      return;
    }
    if (this.phase === "go" && this.goPainted) this.register(performance.now() - this.goAt);
  }

  private register(ms: number) {
    const t = Math.min(B.timeoutMs, Math.round(ms));
    this.times.push(t);
    this.last = t;
    this.round++;
    this.phase = "result";
    this.timer = 0;
    this.statMax("worst", t);
    this.stats.best = Math.min(this.stats.best ?? Infinity, t);
    if (t < 220) {
      this.stat("perfects");
      this.fx.confetti(this.w / 2, this.h * 0.45, 24);
      this.sound("perfect");
    } else {
      this.sound("hit");
    }
    this.ctx.haptics.success();
    this.setScore(Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length));
  }

  protected update(dt: number) {
    if (!this.running) return;
    this.timer += dt;
    if (this.phase === "wait" && this.timer >= this.delay) {
      this.phase = "go";
      this.timer = 0;
      this.sound("go");
    } else if (this.phase === "go" && this.goPainted && performance.now() - this.goAt > B.timeoutMs) {
      this.register(B.timeoutMs);
    } else if (this.phase === "result" && this.timer >= B.resultPauseS) {
      if (this.round >= B.rounds) {
        this.finish({ completed: true, reason: "DONE", slowMo: false, delayMs: 200 });
      } else this.startWait();
    }
  }

  protected renderBackground(g: CanvasRenderingContext2D) {
    const color = this.phase === "go" ? "#16c26b" : this.phase === "result" ? "#141a2e" : "#a3121f";
    g.fillStyle = this.state === "idle" ? "#141a2e" : color;
    g.fillRect(0, 0, this.w, this.h);
  }

  protected render(g: CanvasRenderingContext2D) {
    const cx = this.w / 2;
    if (this.phase === "go" && !this.goPainted && this.running) {
      this.goPainted = true;
      this.goAt = performance.now();
    }
    if (this.state === "idle") {
      text(g, "WAIT FOR GREEN", cx, this.h * 0.5, { font: this.font, size: 26, color: "#fff" });
      return;
    }
    if (this.phase === "wait") {
      blobCritter(g, cx, this.h * 0.42, 70, PALETTE.sun, { blink: 0.9, mouth: "flat" });
      text(g, "WAIT…", cx, this.h * 0.62, { font: this.font, size: 46, color: "#fff" });
      text(g, "don't you dare", cx, this.h * 0.62 + 40, { font: this.font, size: 14, color: "rgba(255,255,255,0.7)" });
    } else if (this.phase === "go") {
      blobCritter(g, cx, this.h * 0.42, 80, PALETTE.sun, { mouth: "o", lookY: -0.4 });
      text(g, "TAP!", cx, this.h * 0.64, { font: this.font, size: 90, color: "#fff", stroke: "rgba(0,0,0,0.25)" });
    } else {
      text(g, `${this.last}`, cx, this.h * 0.45, { font: this.font, size: 96, color: this.last < 250 ? PALETTE.mint : "#fff" });
      text(g, "MS", cx, this.h * 0.45 + 62, { font: this.font, size: 18, color: "rgba(255,255,255,0.7)" });
    }
    // Round pips
    for (let i = 0; i < B.rounds; i++) {
      g.fillStyle = i < this.round ? "#fff" : "rgba(255,255,255,0.25)";
      g.beginPath();
      g.arc(cx - (B.rounds - 1) * 13 + i * 26, this.h * 0.84, 7, 0, Math.PI * 2);
      g.fill();
    }
    if (this.times.length) {
      text(g, this.times.join(" · "), cx, this.h * 0.84 + 30, { font: this.font, size: 12, color: "rgba(255,255,255,0.7)" });
    }
  }

  protected hud(): HudState {
    const avg = this.times.length ? Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length) : null;
    return { score: this.score, scoreText: avg === null ? "—" : `${avg}`, label: `ROUND ${Math.min(this.round + 1, B.rounds)}/${B.rounds} · AVG MS` };
  }
}

const factory: GameFactory = (def) => new ReactionFlash(def);
export default factory;
