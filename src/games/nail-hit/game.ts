import { CanvasGame } from "../core/engine";
import { fillRoundRect, googlyEyes, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

const NAIL_LENGTH = 70;

class NailHit extends CanvasGame {
  private hx = 0;
  private dir = 1;
  private speed = B.startSpeed;
  private tol = B.startTolerance;
  private nailX = 200;
  private depth = 0; // 0 = sticking out, 1 = flush
  private lives = B.lives;
  private nails = 0;
  private swing = 0; // 0..1 swing animation progress
  private swinging = false;
  private combo = 0;
  private bent = 0;

  private get boardY() {
    return this.h * 0.62;
  }

  protected setup() {
    this.hx = 60;
    this.dir = 1;
    this.speed = B.startSpeed;
    this.tol = B.startTolerance;
    this.lives = B.lives;
    this.nails = 0;
    this.combo = 0;
    this.newNail();
  }

  private newNail() {
    this.nailX = this.rng.range(70, this.w - 70);
    this.depth = 0;
    this.bent = 0;
  }

  protected onPointerDown() {
    if (this.swinging) return;
    this.swinging = true;
    this.swing = 0;
  }

  private resolve() {
    const dx = Math.abs(this.hx - this.nailX);
    const ny = this.boardY - NAIL_LENGTH * (1 - this.depth);
    if (dx > this.tol) {
      this.lives--;
      this.combo = 0;
      this.stat("misses");
      this.fx.text(this.hx, ny - 50, "OUCH", { color: PALETTE.flare, size: 28 });
      this.fx.shake(10);
      this.sound("thud", 0.7);
      this.ctx.haptics.fail();
      this.bent = Math.sign(this.hx - this.nailX) * 0.25;
      if (this.lives <= 0) {
        this.juiceFail(this.hx, ny);
        this.finish({ reason: "OUT OF SWINGS" });
      }
      return;
    }
    const p = 1 - dx / this.tol;
    const perfect = p >= 1 - B.perfectFraction;
    this.depth = Math.min(1, this.depth + (perfect ? 1 : 0.35 + 0.4 * p));
    const pts = 10 + Math.round(30 * p) + (perfect ? 15 * Math.min(this.combo + 1, 5) : 0);
    this.addScore(pts);
    this.statMax("accuracy", Math.round(p * 100));
    this.fx.burst(this.nailX, ny, { color: ["#ffc23d", "#fff", "#cfd3dc"], count: perfect ? 22 : 10, speed: 300, shape: "spark" });
    this.fx.shake(perfect ? 7 : 4);
    this.sound("thud", 1 + p * 0.3);
    this.sound("hit", 1.2 + p * 0.4, 0.6);
    if (perfect) {
      this.combo++;
      this.stat("perfects");
      this.statMax("maxCombo", this.combo);
      this.fx.text(this.nailX, ny - 56, this.combo > 1 ? `PERFECT ×${this.combo}` : "PERFECT", { color: PALETTE.volt, size: 26 });
      this.ctx.haptics.success();
    } else {
      this.combo = 0;
      this.fx.text(this.nailX, ny - 50, `+${pts}`, { size: 22 });
      this.ctx.haptics.tap();
    }
    if (this.depth >= 1) {
      this.nails++;
      this.addScore(25);
      this.fx.pulse(0.03);
      this.speed = Math.min(B.maxSpeed, this.speed * B.speedGrowth);
      this.tol = Math.max(B.minTolerance, this.tol * B.toleranceShrink);
      this.ctx.audio.setIntensity(Math.min(1, this.nails / 25));
      this.newNail();
    }
  }

  protected update(dt: number) {
    if (this.swinging) {
      this.swing += dt / B.swingTime;
      if (this.swing >= 1 && this.swing - dt / B.swingTime < 1) this.resolve();
      if (this.swing >= 1.8) {
        this.swinging = false;
        this.swing = 0;
      }
      return;
    }
    if (this.state === "over") return;
    const sp = this.state === "idle" ? B.startSpeed * 0.5 : this.speed;
    this.hx += this.dir * sp * dt;
    if (this.hx > this.w - 40) {
      this.hx = this.w - 40;
      this.dir = -1;
    } else if (this.hx < 40) {
      this.hx = 40;
      this.dir = 1;
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const by = this.boardY;
    // Board
    fillRoundRect(g, 14, by + 6, this.w - 28, 130, 18, "rgba(0,0,0,0.35)");
    fillRoundRect(g, 10, by, this.w - 20, 130, 18, "#d9924a");
    g.fillStyle = "#b8743a";
    for (let i = 0; i < 4; i++) g.fillRect(10, by + 22 + i * 28, this.w - 20, 4);
    // Nail
    const top = by - NAIL_LENGTH * (1 - this.depth);
    g.save();
    g.translate(this.nailX, by);
    g.rotate(this.bent);
    fillRoundRect(g, -5, top - by, 10, by - top + 4, 2, "#cfd3dc");
    fillRoundRect(g, -20, top - by - 8, 40, 12, 4, "#e9ecf2");
    g.restore();
    // Tolerance guide
    g.fillStyle = "rgba(255,194,61,0.18)";
    g.fillRect(this.nailX - this.tol, top - 18, this.tol * 2, 4);
    // Hammer: swings down from above
    const swingAngle = this.swinging ? Math.sin(Math.min(1, this.swing) * Math.PI * 0.5) * 1.25 - (this.swing > 1 ? (this.swing - 1) * 1.5 : 0) : 0;
    // Pivot chosen so the head lands exactly on the nail at the end of the swing (angle 0.05 rad).
    const pivotY = top - 148;
    g.save();
    g.translate(this.hx + Math.sin(0.05) * 120, pivotY);
    g.rotate(-1.2 + swingAngle);
    fillRoundRect(g, -8, -10, 16, 120, 7, "#ff6a3d");
    fillRoundRect(g, -38, 100, 76, 40, 10, "#9aa3b5");
    googlyEyes(g, 0, 118, 8, { gap: 14, lookY: 1 });
    g.restore();
    // aim line
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.setLineDash([4, 6]);
    g.beginPath();
    g.moveTo(this.hx, pivotY + 60);
    g.lineTo(this.hx, by);
    g.stroke();
    g.setLineDash([]);
    text(g, `NAILS ${this.nails}`, this.w / 2, by + 170, { font: this.font, size: 16, color: "rgba(255,255,255,0.75)" });
  }

  protected hud(): HudState {
    return { score: this.score, lives: this.lives, maxLives: B.lives, combo: this.combo };
  }
}

const factory: GameFactory = (def) => new NailHit(def);
export default factory;
