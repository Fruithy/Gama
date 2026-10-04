import { CanvasGame, type PointerInfo } from "../core/engine";
import { fillRoundRect, hsl, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

class OddOneOut extends CanvasGame {
  private n = B.startGrid;
  private odd = 0;
  private hue = 0;
  private sat = 70;
  private light = 55;
  private delta = B.startDelta;
  private level = 0;
  private lives = B.lives;
  private timeLeft = B.startTimeS;
  private timeMax = B.startTimeS;
  private reveal = 0;
  private wrong = -1;

  private layout() {
    const size = Math.min(this.w - 40, this.h * 0.56);
    const gap = Math.max(4, 12 - this.n);
    const cell = (size - gap * (this.n - 1)) / this.n;
    return { x0: (this.w - size) / 2, y0: this.h * 0.57 - size / 2, cell, gap };
  }

  protected setup() {
    this.level = 0;
    this.lives = B.lives;
    this.nextLevel();
  }

  private nextLevel() {
    this.n = Math.min(B.maxGrid, B.startGrid + Math.floor(this.level / B.levelsPerGrow));
    this.delta = Math.max(B.minDelta, B.startDelta * Math.pow(B.deltaDecay, this.level));
    this.hue = this.rng.range(0, 360);
    this.sat = this.rng.range(55, 85);
    this.light = this.rng.range(40, 62);
    this.odd = this.rng.int(0, this.n * this.n - 1);
    this.timeMax = Math.max(B.minTimeS, B.startTimeS - this.level * 0.12);
    this.timeLeft = this.timeMax;
    this.reveal = 0;
    this.wrong = -1;
  }

  private loseLife(reason: string) {
    this.lives--;
    this.fx.shake(10);
    this.sound("miss");
    this.ctx.haptics.fail();
    if (this.lives <= 0) {
      this.juiceFail();
      this.finish({ reason });
    } else {
      this.reveal = -0.6; // brief beat showing the answer
    }
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.reveal < 0) return;
    const { x0, y0, cell, gap } = this.layout();
    const c = Math.floor((p.x - x0) / (cell + gap));
    const r = Math.floor((p.y - y0) / (cell + gap));
    if (c < 0 || r < 0 || c >= this.n || r >= this.n) return;
    const i = r * this.n + c;
    if (i === this.odd) {
      const speed = this.timeLeft / this.timeMax;
      const pts = 10 + Math.round(speed * 15);
      this.addScore(pts);
      this.statMax("accuracy", Math.round(speed * 100));
      if (speed > 0.7) this.stat("perfects");
      const cx = x0 + c * (cell + gap) + cell / 2;
      const cy = y0 + r * (cell + gap) + cell / 2;
      this.fx.text(cx, cy - cell * 0.6, `+${pts}`, { color: "#fff", size: 22 });
      this.juiceHit(cx, cy, PALETTE.sun);
      this.sound("pop", 1 + this.level * 0.02);
      this.level++;
      this.nextLevel();
    } else {
      this.wrong = i;
      this.loseLife("WRONG ONE");
    }
  }

  protected update(dt: number) {
    if (!this.running) return;
    if (this.reveal < 0) {
      this.reveal += dt;
      if (this.reveal >= 0) {
        this.level++;
        this.nextLevel();
      }
      return;
    }
    this.reveal = Math.min(1, this.reveal + dt * 6);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.loseLife("TOO SLOW");
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const { x0, y0, cell, gap } = this.layout();
    const base = hsl(this.hue, this.sat, this.light);
    const odd = hsl(this.hue, this.sat, this.light + this.delta);
    const showAnswer = this.reveal < 0;
    const pop = showAnswer ? 1 : 0.9 + 0.1 * Math.max(0, this.reveal);
    for (let i = 0; i < this.n * this.n; i++) {
      const c = i % this.n;
      const r = Math.floor(i / this.n);
      const x = x0 + c * (cell + gap);
      const y = y0 + r * (cell + gap);
      const s = cell * pop;
      const off = (cell - s) / 2;
      fillRoundRect(g, x + off, y + off, s, s, Math.min(18, s * 0.22), i === this.odd ? odd : base);
      if (showAnswer && i === this.odd) {
        g.strokeStyle = "#fff";
        g.lineWidth = 5;
        g.strokeRect(x - 3, y - 3, cell + 6, cell + 6);
      }
      if (i === this.wrong && showAnswer) text(g, "✕", x + cell / 2, y + cell / 2, { font: "system-ui", size: cell * 0.6, color: "#0b0b0f", weight: 900 });
    }
    const frac = Math.max(0, this.timeLeft / this.timeMax);
    fillRoundRect(g, 30, this.h * 0.17, this.w - 60, 10, 5, "rgba(255,255,255,0.15)");
    fillRoundRect(g, 30, this.h * 0.17, (this.w - 60) * frac, 10, 5, frac < 0.3 ? PALETTE.flare : "#fff");
    text(g, `LEVEL ${this.level + 1} · ${this.n}×${this.n}`, this.w / 2, this.h * 0.17 - 22, { font: this.font, size: 14, color: "rgba(255,255,255,0.75)" });
  }

  protected hud(): HudState {
    return { score: this.score, lives: this.lives, maxLives: B.lives };
  }
}

const factory: GameFactory = (def) => new OddOneOut(def);
export default factory;
