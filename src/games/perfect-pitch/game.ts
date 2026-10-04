import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** Cents from target, folded into one octave (sing in any octave). */
function foldedCents(hz: number, targetHz: number) {
  let c = 1200 * Math.log2(hz / targetHz);
  c = ((c % 1200) + 1200) % 1200;
  return c > 600 ? c - 1200 : c;
}

class PerfectPitch extends CanvasGame {
  private round = 0;
  private target = 69;
  private roundTime = 0;
  private lock = 0;
  private errSum = 0;
  private errN = 0;
  private cents: number | null = null;
  private fallback = false;
  private sliderCents = 0;
  private result = 0;
  private ticks = 0;

  protected setup() {
    this.round = 0;
    this.fallback = false;
    this.newRound();
  }

  start() {
    super.start();
    this.fallback = !this.ctx.mic?.active;
    this.playReference();
  }

  private newRound() {
    this.target = this.rng.int(B.midiMin, B.midiMax);
    this.roundTime = 0;
    this.lock = 0;
    this.errSum = 0;
    this.errN = 0;
    this.result = 0;
    this.sliderCents = this.rng.range(-400, 400);
  }

  private playReference() {
    this.ctx.audio.tone(midiToHz(this.target), 700, { type: "sine", volume: 1.4 });
  }

  protected onPointerDown(p: PointerInfo) {
    if (!this.fallback) return;
    this.sliderCents = ((this.h * 0.55 - p.y) / (this.h * 0.35)) * 600;
  }
  protected onPointerMove(p: PointerInfo) {
    if (!this.fallback || !this.pointerDown) return;
    this.sliderCents = Math.max(-600, Math.min(600, ((this.h * 0.55 - p.y) / (this.h * 0.35)) * 600));
  }

  private endRound(locked: boolean) {
    const avg = this.errN ? this.errSum / this.errN : 50;
    const speed = Math.max(0, 1 - this.roundTime / B.roundTimeS);
    const pts = locked ? Math.max(0, Math.round(100 - avg * 1.6)) + Math.round(speed * B.speedBonus) : 0;
    this.result = pts;
    this.addScore(pts);
    this.round++;
    if (locked) {
      if (avg < 12) this.stat("perfects");
      this.statMax("accuracy", Math.round(100 - avg));
      this.fx.confetti(this.w / 2, this.h * 0.3, 24);
      this.fx.text(this.w / 2, this.h * 0.18, `+${pts}`, { color: PALETTE.volt, size: 30 });
      this.sound("levelup");
    } else {
      this.fx.text(this.w / 2, this.h * 0.18, "TIME", { color: PALETTE.flare, size: 26 });
      this.sound("miss");
    }
    if (this.round >= B.rounds) {
      this.finish({ reason: "DONE", slowMo: false, ranked: !this.fallback });
      return;
    }
    this.newRound();
    this.playReference();
  }

  protected update(dt: number) {
    if (!this.running) return;
    this.roundTime += dt;
    // Pitch detection is heavier than everything else — sample every other frame.
    this.ticks++;
    if (this.fallback) {
      this.cents = this.sliderCents;
    } else if (this.ticks % 2 === 0) {
      const hz = this.ctx.mic!.readPitch();
      this.cents = hz ? foldedCents(hz, midiToHz(this.target)) : null;
      if (!this.ctx.mic!.active) this.fallback = true;
    }
    if (this.cents !== null && Math.abs(this.cents) <= B.zoneCents) {
      this.lock += dt;
      this.errSum += Math.abs(this.cents) * dt;
      this.errN += dt;
      if (this.ticks % 6 === 0) this.recordAction();
    } else {
      this.lock = Math.max(0, this.lock - dt * 0.6);
    }
    if (this.lock >= B.lockS) this.endRound(true);
    else if (this.roundTime >= B.roundTimeS) this.endRound(false);
  }

  protected render(g: CanvasRenderingContext2D) {
    const cx = this.w / 2;
    const cy = this.h * 0.55;
    const R = 140;
    const name = NAMES[this.target % 12];
    text(g, name, cx, this.h * 0.24, { font: this.font, size: 72, color: "#fff" });
    text(g, `ROUND ${Math.min(this.round + 1, B.rounds)} / ${B.rounds} · ANY OCTAVE`, cx, this.h * 0.24 + 48, { font: this.font, size: 12, color: "rgba(255,255,255,0.7)" });
    // Dial: ±600 cents mapped to ±80°
    const ang = (c: number) => -Math.PI / 2 + (c / 600) * (Math.PI * 0.44);
    g.lineCap = "round";
    g.lineWidth = 26;
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.arc(cx, cy, R, ang(-600), ang(600));
    g.stroke();
    g.strokeStyle = PALETTE.mint;
    g.beginPath();
    g.arc(cx, cy, R, ang(-B.zoneCents), ang(B.zoneCents));
    g.stroke();
    if (this.cents !== null) {
      const a = ang(Math.max(-600, Math.min(600, this.cents)));
      g.strokeStyle = "#fff";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10));
      g.stroke();
    }
    blobCritter(g, cx, cy, 34, PALETTE.flare, { mouth: this.cents !== null ? "o" : "flat", lookY: -1 });
    // Lock meter
    fillRoundRect(g, cx - 110, cy + 70, 220, 14, 7, "rgba(255,255,255,0.15)");
    fillRoundRect(g, cx - 110, cy + 70, 220 * Math.min(1, this.lock / B.lockS), 14, 7, PALETTE.mint);
    const tl = Math.max(0, B.roundTimeS - this.roundTime);
    text(g, this.cents === null ? (this.fallback ? "DRAG UP / DOWN" : "HUM THE NOTE…") : this.cents > B.zoneCents ? "TOO HIGH ↓" : this.cents < -B.zoneCents ? "TOO LOW ↑" : "HOLD IT!", cx, cy + 112, { font: this.font, size: 18, color: "#fff" });
    text(g, `${tl.toFixed(1)}s`, cx, cy + 140, { font: this.font, size: 12, color: "rgba(255,255,255,0.6)" });
    if (this.fallback) text(g, "🎚 SLIDER PRACTICE · NOT RANKED", cx, this.h - 22, { font: this.font, size: 11, color: PALETTE.sun });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new PerfectPitch(def);
export default factory;
