import { CanvasGame } from "../core/engine";
import { blobCritter, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

class StopTheBar extends CanvasGame {
  private x = 0;
  private dir = 1;
  private speed = B.startSpeed;
  private targetX = 0;
  private targetW = B.startTarget;
  private level = 0;
  private combo = 0;
  private freeze = 0;
  private lastHit: { x: number; good: boolean } | null = null;

  private get left() {
    return (this.w - B.trackWidth) / 2;
  }
  private get y() {
    return this.h * 0.55;
  }

  protected setup() {
    this.x = 0;
    this.dir = 1;
    this.speed = B.startSpeed;
    this.targetW = B.startTarget;
    this.level = 0;
    this.combo = 0;
    this.freeze = 0;
    this.lastHit = null;
    this.placeTarget();
  }

  private placeTarget() {
    const margin = 10;
    this.targetX = this.rng.range(margin, B.trackWidth - this.targetW - margin);
  }

  protected onPointerDown() {
    if (this.freeze > 0) return;
    const inside = this.x >= this.targetX && this.x <= this.targetX + this.targetW;
    const sx = this.left + this.x;
    if (!inside) {
      this.lastHit = { x: this.x, good: false };
      this.juiceFail(sx, this.y);
      this.finish({ reason: "OUTSIDE THE BOX" });
      return;
    }
    const centre = this.targetX + this.targetW / 2;
    const precision = 1 - Math.abs(this.x - centre) / (this.targetW / 2);
    const perfect = precision >= 1 - B.perfectFraction;
    this.level++;
    this.combo = perfect ? this.combo + 1 : 0;
    const pts = 50 + Math.round(50 * precision) + (perfect ? 25 * Math.min(this.combo, 6) : 0);
    this.addScore(pts);
    this.statMax("accuracy", Math.round(precision * 100));
    this.lastHit = { x: this.x, good: true };
    if (perfect) {
      this.stat("perfects");
      this.statMax("maxCombo", this.combo);
      this.fx.text(sx, this.y - 70, this.combo > 1 ? `PERFECT ×${this.combo}` : "PERFECT", { color: PALETTE.volt, size: 26 });
      this.fx.burst(sx, this.y, { color: [PALETTE.volt, PALETTE.mint, "#fff"], count: 24, speed: 340 });
      this.fx.pulse(0.04);
      this.sound("perfect", 1 + this.level * 0.02);
    } else {
      this.fx.text(sx, this.y - 64, `+${pts}`, { size: 22 });
      this.juiceHit(sx, this.y, PALETTE.mint);
      this.sound("hit", 1 + this.level * 0.02);
    }
    this.freeze = 0.28; // brief beat to read the result before the next level
    this.speed = Math.min(B.maxSpeed, this.speed * B.speedGrowth);
    this.targetW = Math.max(B.minTarget, this.targetW * B.targetShrink);
    this.ctx.audio.setIntensity(Math.min(1, this.level / 25));
  }

  protected update(dt: number) {
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0 && this.running) this.placeTarget();
      return;
    }
    if (!this.running && this.state !== "idle") return;
    const sp = this.state === "idle" ? B.startSpeed * 0.5 : this.speed;
    this.x += this.dir * sp * dt;
    if (this.x > B.trackWidth) {
      this.x = B.trackWidth;
      this.dir = -1;
    } else if (this.x < 0) {
      this.x = 0;
      this.dir = 1;
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const L = this.left;
    const y = this.y;
    // Track
    fillRoundRect(g, L - 14 + 4, y - 34 + 6, B.trackWidth + 28, 68, 34, "rgba(0,0,0,0.3)");
    fillRoundRect(g, L - 14, y - 34, B.trackWidth + 28, 68, 34, "#0b2a24");
    // Target box
    fillRoundRect(g, L + this.targetX, y - 26, this.targetW, 52, Math.min(12, this.targetW / 2), this.freeze > 0 && this.lastHit?.good ? "#ffffff" : PALETTE.mint);
    const c = L + this.targetX + this.targetW / 2;
    g.fillStyle = "rgba(11,11,15,0.35)";
    g.fillRect(c - 1, y - 26, 2, 52);
    // Marker
    const mx = L + this.x;
    fillRoundRect(g, mx - B.markerWidth / 2 - 3, y - 46, B.markerWidth + 6, 92, 6, "#0b0b0f");
    fillRoundRect(g, mx - B.markerWidth / 2, y - 43, B.markerWidth, 86, 4, "#fff");
    // Mascot watching the marker
    blobCritter(g, this.w / 2, this.h * 0.27, 46, PALETTE.volt, { lookX: (this.x / B.trackWidth) * 2 - 1, mouth: this.freeze > 0 ? "smile" : "o" });
    text(g, `LEVEL ${this.level + 1}`, this.w / 2, y + 80, { font: this.font, size: 16, color: "rgba(255,255,255,0.7)" });
  }

  protected hud(): HudState {
    return { score: this.score, combo: this.combo, level: this.level + 1 };
  }
}

const factory: GameFactory = (def) => new StopTheBar(def);
export default factory;
