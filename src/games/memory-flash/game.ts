import { CanvasGame, type PointerInfo } from "../core/engine";
import { fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

const COLORS = ["#ff3d7f", "#ffc23d", "#3dffb0", "#3dd8ff", "#8b5cff", "#ff6a3d", "#d4ff3a", "#f5f5f7", "#5b8cff"];
const SYMBOLS = ["●", "▲", "■", "★", "◆", "♥", "✚", "☾", "✿"];
// Pentatonic-ish scale so any sequence sounds musical.
const TONES = [262, 294, 330, 392, 440, 523, 587, 659, 784];

type Phase = "show" | "input" | "pause";

class MemoryFlash extends CanvasGame {
  private seq: number[] = [];
  private length = 1;
  private phase: Phase = "pause";
  private showIdx = 0;
  private timer = 0;
  private inputIdx = 0;
  private lit = -1;
  private litTimer = 0;

  private padRect(i: number) {
    const size = Math.min(110, (this.w - 60) / 3);
    const gap = 14;
    const total = size * 3 + gap * 2;
    const x0 = (this.w - total) / 2;
    const y0 = this.h * 0.58 - total / 2;
    return { x: x0 + (i % 3) * (size + gap), y: y0 + Math.floor(i / 3) * (size + gap), s: size };
  }

  protected setup() {
    this.seq = Array.from({ length: B.maxLength }, () => this.rng.int(0, B.pads - 1));
    this.length = 1;
    this.phase = "pause";
    this.timer = 0.4;
    this.lit = -1;
  }

  private flashMs() {
    return Math.max(B.minFlashMs, B.startFlashMs - (this.length - 1) * B.flashDecayPerRound);
  }

  private light(i: number, ms: number) {
    this.lit = i;
    this.litTimer = ms / 1000;
    this.ctx.audio.tone(TONES[i], ms * 0.9, { type: "triangle", volume: 1 });
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.phase !== "input") return;
    for (let i = 0; i < B.pads; i++) {
      const r = this.padRect(i);
      if (p.x < r.x || p.x > r.x + r.s || p.y < r.y || p.y > r.y + r.s) continue;
      this.light(i, 180);
      if (i !== this.seq[this.inputIdx]) {
        const want = this.padRect(this.seq[this.inputIdx]);
        this.fx.text(want.x + want.s / 2, want.y - 10, "THIS ONE", { color: PALETTE.flare, size: 18 });
        this.juiceFail(r.x + r.s / 2, r.y + r.s / 2);
        this.finish({ reason: "WRONG PAD" });
        return;
      }
      this.inputIdx++;
      this.ctx.haptics.tap();
      if (this.inputIdx >= this.length) {
        this.addScore(1);
        this.statMax("longest", this.length);
        this.fx.text(this.w / 2, this.h * 0.2, `${this.length} ✓`, { color: PALETTE.mint, size: 30 });
        this.sound("levelup", 1 + this.length * 0.02);
        if (this.length % 5 === 0) this.fx.confetti(this.w / 2, this.h * 0.3, 30);
        this.length = Math.min(B.maxLength, this.length + 1);
        this.phase = "pause";
        this.timer = 0.7;
      }
      return;
    }
  }

  protected update(dt: number) {
    if (this.litTimer > 0) {
      this.litTimer -= dt;
      if (this.litTimer <= 0) this.lit = -1;
    }
    if (!this.running) return;
    this.timer -= dt;
    if (this.phase === "pause" && this.timer <= 0) {
      this.phase = "show";
      this.showIdx = 0;
      this.timer = 0;
    }
    if (this.phase === "show" && this.timer <= 0) {
      if (this.showIdx >= this.length) {
        this.phase = "input";
        this.inputIdx = 0;
        return;
      }
      const ms = this.flashMs();
      this.light(this.seq[this.showIdx], ms);
      this.showIdx++;
      this.timer = (ms + B.gapMs) / 1000;
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const label = this.phase === "show" ? "WATCH…" : this.phase === "input" ? "YOUR TURN" : this.running ? "GET READY" : "";
    text(g, label, this.w / 2, this.h * 0.2, { font: this.font, size: 26, color: this.phase === "input" ? PALETTE.volt : "#fff" });
    if (this.phase === "input") {
      text(g, `${this.inputIdx} / ${this.length}`, this.w / 2, this.h * 0.2 + 34, { font: this.font, size: 14, color: "rgba(255,255,255,0.65)" });
    }
    for (let i = 0; i < B.pads; i++) {
      const r = this.padRect(i);
      const on = this.lit === i;
      fillRoundRect(g, r.x + 4, r.y + 6, r.s, r.s, 22, "rgba(0,0,0,0.35)");
      g.globalAlpha = on ? 1 : 0.32;
      fillRoundRect(g, r.x, r.y - (on ? 3 : 0), r.s, r.s, 22, COLORS[i]);
      g.globalAlpha = 1;
      text(g, SYMBOLS[i], r.x + r.s / 2, r.y + r.s / 2 - (on ? 3 : 0), { font: "system-ui, sans-serif", size: r.s * 0.38, color: on ? "#0b0b0f" : "rgba(11,11,15,0.55)", weight: 900 });
    }
  }

  protected hud(): HudState {
    return { score: this.score, label: `LENGTH ${this.length}` };
  }
}

const factory: GameFactory = (def) => new MemoryFlash(def);
export default factory;
