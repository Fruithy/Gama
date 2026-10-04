import { CanvasGame, type PointerInfo } from "../core/engine";
import { fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { Rng } from "../core/rng";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Problem {
  text: string;
  truth: boolean;
}

/** Wrong answers are near-misses (±1, ±2, ±10, digit swaps) — never obviously silly. */
function makeProblem(rng: Rng, tier: number): Problem {
  const ops = tier < 1 ? ["+"] : tier < 2 ? ["+", "-"] : tier < 4 ? ["+", "-", "×"] : ["+", "-", "×", "×"];
  const op = rng.pick(ops);
  const big = 10 + tier * 12;
  let a = rng.int(1, op === "×" ? 4 + tier * 2 : big);
  let b = rng.int(1, op === "×" ? 9 + tier : big);
  if (op === "-" && b > a) [a, b] = [b, a];
  const real = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const truth = rng.chance(0.5);
  let shown = real;
  if (!truth) {
    const tricks = [1, -1, 2, -2, 10, -10];
    shown = real + rng.pick(tricks);
    if (real >= 10 && rng.chance(0.25)) {
      const s = String(real).split("").reverse().join("");
      if (Number(s) !== real) shown = Number(s);
    }
    if (shown === real || shown < 0) shown = real + 1;
  }
  return { text: `${a} ${op} ${b} = ${shown}`, truth };
}

class QuickMath extends CanvasGame {
  private p: Problem = { text: "", truth: true };
  private timeLeft = B.durationS;
  private correct = 0;
  private combo = 0;
  private flash: { ok: boolean; t: number } | null = null;

  protected setup() {
    this.timeLeft = B.durationS;
    this.correct = 0;
    this.combo = 0;
    this.p = makeProblem(this.rng, 0);
  }

  private answer(said: boolean) {
    if (said === this.p.truth) {
      this.correct++;
      this.combo++;
      const mult = 1 + Math.floor(this.combo / B.comboStep);
      this.addScore(mult);
      this.statMax("maxCombo", this.combo);
      this.flash = { ok: true, t: 0.18 };
      this.sound("pop", 1 + Math.min(this.combo, 20) * 0.03);
      if (this.combo % B.comboStep === 0) this.fx.text(this.w / 2, this.h * 0.3, `×${mult} STREAK`, { color: PALETTE.mint, size: 26 });
    } else {
      this.combo = 0;
      this.timeLeft -= B.wrongPenaltyS;
      this.flash = { ok: false, t: 0.3 };
      this.fx.text(this.w / 2, this.h * 0.3, `-${B.wrongPenaltyS}s`, { color: PALETTE.flare, size: 26 });
      this.fx.shake(8);
      this.sound("miss");
      this.ctx.haptics.fail();
    }
    this.p = makeProblem(this.rng, Math.floor(this.correct / B.tierEvery));
  }

  protected onPointerDown(p: PointerInfo) {
    if (p.y < this.h * 0.5) return;
    this.answer(p.x < this.w / 2);
  }
  protected onKey(key: string, down: boolean) {
    if (key === "Space" || key === "Enter" || key === "ArrowUp") return true; // no accidental answers
    if (!down) return key === "ArrowLeft" || key === "ArrowRight";
    if (key === "ArrowLeft" || key === "a") this.answer(true);
    else if (key === "ArrowRight" || key === "d") this.answer(false);
    else return false;
    return true;
  }

  protected update(dt: number) {
    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
    }
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish({ reason: "TIME!", slowMo: false });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const card = this.flash ? (this.flash.ok ? PALETTE.mint : PALETTE.flare) : "#f5f5f7";
    fillRoundRect(g, 24, this.h * 0.2 + 6, this.w - 48, 150, 30, "rgba(0,0,0,0.4)");
    fillRoundRect(g, 24, this.h * 0.2, this.w - 48, 150, 30, card);
    text(g, this.state === "idle" ? "READY?" : this.p.text, this.w / 2, this.h * 0.2 + 75, { font: this.font, size: this.p.text.length > 12 ? 38 : 46, color: "#0b0b0f" });
    const by = this.h * 0.58;
    const bh = this.h * 0.3;
    fillRoundRect(g, 20, by, this.w / 2 - 30, bh, 30, PALETTE.mint);
    fillRoundRect(g, this.w / 2 + 10, by, this.w / 2 - 30, bh, 30, PALETTE.flare);
    text(g, "✓", this.w * 0.25, by + bh / 2 - 12, { font: "system-ui", size: 80, color: "#0b0b0f", weight: 900 });
    text(g, "TRUE", this.w * 0.25, by + bh / 2 + 52, { font: this.font, size: 18, color: "#0b0b0f" });
    text(g, "✕", this.w * 0.75, by + bh / 2 - 12, { font: "system-ui", size: 80, color: "#0b0b0f", weight: 900 });
    text(g, "FALSE", this.w * 0.75, by + bh / 2 + 52, { font: this.font, size: 18, color: "#0b0b0f" });
  }

  protected hud(): HudState {
    return { score: this.score, timeLeft: Math.max(0, this.timeLeft), combo: this.combo };
  }
}

const factory: GameFactory = (def) => new QuickMath(def);
export default factory;
