import { CanvasGame, type PointerInfo } from "../core/engine";
import { fillRoundRect, googlyEyes, line, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

const SKINS = [
  { fill: "#ffc23d", stripe: "#c98a1d" }, // loaf
  { fill: "#ff3d7f", stripe: "#b8195a" }, // candy bar
  { fill: "#3dffb0", stripe: "#1fae74" }, // cucumber
  { fill: "#8b5cff", stripe: "#5a33c4" }, // eggplant-ish log
];

class PrecisionCut extends CanvasGame {
  private round = 0;
  private target = 50;
  private x = 0; // object left edge
  private width = 300;
  private height = 80;
  private vx = 0;
  private skin = SKINS[0];
  private swipe: { x: number; y: number } | null = null;
  private trail: Array<{ x: number; y: number }> = [];
  private cut: { at: number; pct: number; pts: number; t: number } | null = null;

  private get y() {
    return this.h * 0.52;
  }

  protected setup() {
    this.round = 0;
    this.newRound();
  }

  private newRound() {
    this.target = this.rng.int(B.targetMin, B.targetMax);
    this.width = this.rng.range(220, Math.min(340, this.w - 40));
    this.height = this.rng.range(64, 96);
    this.x = (this.w - this.width) / 2 + this.rng.range(-20, 20);
    this.vx = this.round >= B.movingFrom ? B.driftSpeed * (1 + (this.round - B.movingFrom) * 0.25) * (this.rng.chance(0.5) ? 1 : -1) : 0;
    this.skin = this.rng.pick(SKINS);
    this.cut = null;
    this.trail = [];
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.cut) return;
    this.swipe = { x: p.x, y: p.y };
    this.trail = [{ x: p.x, y: p.y }];
  }

  protected onPointerMove(p: PointerInfo) {
    if (!this.swipe || this.cut) return;
    const prev = this.trail[this.trail.length - 1];
    this.trail.push({ x: p.x, y: p.y });
    // Where does this move segment cross the object's centre line?
    const cy = this.y;
    if ((prev.y - cy) * (p.y - cy) <= 0 && prev.y !== p.y) {
      const t = (cy - prev.y) / (p.y - prev.y);
      const cx = prev.x + (p.x - prev.x) * t;
      if (cx >= this.x && cx <= this.x + this.width) this.resolve(cx);
    }
  }

  protected onPointerUp() {
    this.swipe = null;
  }

  private resolve(cx: number) {
    const pct = ((cx - this.x) / this.width) * 100;
    const err = Math.abs(pct - this.target);
    const perfect = err <= B.perfectWithin;
    const pts = Math.max(0, Math.round(100 - err * B.pointsPerPctError)) + (perfect ? B.perfectBonus : 0);
    this.cut = { at: cx - this.x, pct, pts, t: 0 };
    this.swipe = null;
    this.addScore(pts);
    this.statMax("accuracy", Math.round(Math.max(0, 100 - err)));
    this.sound("cut", 1.2);
    this.fx.shake(4);
    if (perfect) {
      this.stat("perfects");
      this.fx.text(cx, this.y - 90, "PERFECT", { color: PALETTE.volt, size: 30 });
      this.fx.confetti(cx, this.y, 30);
      this.sound("perfect");
      this.ctx.haptics.success();
    } else {
      this.fx.burst(cx, this.y, { color: [this.skin.fill, "#fff"], count: 14, speed: 240 });
      this.ctx.haptics.tap();
    }
  }

  protected update(dt: number) {
    if (this.vx && !this.cut && this.running) {
      this.x += this.vx * dt;
      if (this.x < 10 || this.x + this.width > this.w - 10) this.vx *= -1;
    }
    if (this.cut) {
      this.cut.t += dt;
      if (this.cut.t >= B.revealS && this.running) {
        this.round++;
        if (this.round >= B.rounds) this.finish({ reason: "DONE", slowMo: false, delayMs: 200 });
        else this.newRound();
      }
    }
  }

  private drawPiece(g: CanvasRenderingContext2D, x: number, w: number, dx: number, rot: number) {
    const y = this.y - this.height / 2;
    g.save();
    g.translate(x + w / 2 + dx, this.y);
    g.rotate(rot);
    g.translate(-(x + w / 2), -this.y);
    fillRoundRect(g, x + 4, y + 6, w, this.height, Math.min(this.height / 2, w / 2), "rgba(0,0,0,0.3)");
    fillRoundRect(g, x, y, w, this.height, Math.min(this.height / 2, w / 2), this.skin.fill);
    g.strokeStyle = this.skin.stripe;
    g.lineWidth = 5;
    g.lineCap = "round";
    for (let sx = this.x + 26; sx < this.x + this.width - 20; sx += 30) {
      if (sx < x + 6 || sx > x + w - 10) continue;
      g.beginPath();
      g.moveTo(sx, y + 18);
      g.lineTo(sx + 10, y + this.height - 18);
      g.stroke();
    }
    g.restore();
  }

  protected render(g: CanvasRenderingContext2D) {
    text(g, `CUT ${this.target}%`, this.w / 2, this.h * 0.22, { font: this.font, size: 48, color: "#fff", stroke: "rgba(0,0,0,0.3)" });
    text(g, `ROUND ${Math.min(this.round + 1, B.rounds)} / ${B.rounds}`, this.w / 2, this.h * 0.22 + 42, { font: this.font, size: 13, color: "rgba(255,255,255,0.7)" });
    if (this.cut) {
      const k = Math.min(1, this.cut.t * 3);
      this.drawPiece(g, this.x, this.cut.at, -18 * k, -0.08 * k);
      this.drawPiece(g, this.x + this.cut.at, this.width - this.cut.at, 18 * k, 0.08 * k);
      const cx = this.x + this.cut.at;
      text(g, `${this.cut.pct.toFixed(1)}%`, cx, this.y + this.height / 2 + 40, { font: this.font, size: 28, color: Math.abs(this.cut.pct - this.target) <= 2 ? PALETTE.volt : "#fff" });
      text(g, `+${this.cut.pts}`, cx, this.y + this.height / 2 + 74, { font: this.font, size: 16, color: "rgba(255,255,255,0.8)" });
      // Where the target actually was
      const tx = this.x + (this.target / 100) * this.width;
      g.setLineDash([6, 6]);
      line(g, tx, this.y - this.height / 2 - 20, tx, this.y + this.height / 2 + 20, 2, "rgba(255,255,255,0.6)");
      g.setLineDash([]);
    } else {
      this.drawPiece(g, this.x, this.width, 0, 0);
      googlyEyes(g, this.x + this.width - 48, this.y - 6, 10, { gap: 16, lookX: this.swipe ? Math.sign(this.pointerPos.x - (this.x + this.width - 48)) : 0 });
    }
    // Ends labelled 0 / 100 only — no ruler, that's the point.
    text(g, "0%", this.x, this.y - this.height / 2 - 18, { font: this.font, size: 12, color: "rgba(255,255,255,0.6)" });
    text(g, "100%", this.x + this.width, this.y - this.height / 2 - 18, { font: this.font, size: 12, color: "rgba(255,255,255,0.6)" });
    for (let i = 1; i < this.trail.length; i++) line(g, this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i].x, this.trail[i].y, 4, "rgba(255,255,255,0.85)");
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "SWIPE DOWN TO CUT", this.w / 2, this.h * 0.75, { font: this.font, size: 20, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new PrecisionCut(def);
export default factory;
