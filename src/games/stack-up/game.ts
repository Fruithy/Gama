import { CanvasGame } from "../core/engine";
import { clamp, fillRoundRect, hsl, lerp, text } from "../core/draw";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE } from "./meta";

interface Block {
  x: number;
  w: number;
  level: number;
  hue: number;
}

interface Debris {
  x: number;
  y: number;
  w: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  hue: number;
}

class StackUp extends CanvasGame {
  private stack: Block[] = [];
  private moving: Block = { x: 0, w: 0, level: 1, hue: 0 };
  private dir = 1;
  private speed = BALANCE.startSpeed;
  private debris: Debris[] = [];
  private cam = 0;
  private perfectStreak = 0;
  private hueBase = 0;
  private dropFlash = 0;

  private get baseY() {
    return Math.min(this.h - 110, this.h * 0.74);
  }

  protected setup() {
    this.hueBase = this.rng.int(0, 360);
    const base: Block = { x: (this.w - BALANCE.baseWidth) / 2, w: BALANCE.baseWidth, level: 0, hue: this.hueBase };
    this.stack = [base];
    this.debris = [];
    this.cam = 0;
    this.perfectStreak = 0;
    this.speed = BALANCE.startSpeed;
    this.spawn();
  }

  private spawn() {
    const top = this.stack[this.stack.length - 1];
    const level = top.level + 1;
    this.dir = level % 2 ? 1 : -1;
    this.moving = { x: this.dir > 0 ? -top.w * 0.5 : this.w - top.w * 0.5, w: top.w, level, hue: (this.hueBase + level * 9) % 360 };
    this.speed = Math.min(BALANCE.maxSpeed, BALANCE.startSpeed + (level - 1) * BALANCE.speedPerBlock);
  }

  protected onPointerDown() {
    this.drop();
  }

  private drop() {
    const top = this.stack[this.stack.length - 1];
    const m = this.moving;
    const offset = m.x - top.x;
    const y = this.levelY(m.level);

    if (Math.abs(offset) <= BALANCE.perfectTolerance) {
      // Perfect: snap, keep width, possibly regrow.
      this.perfectStreak++;
      let w = top.w;
      let x = top.x;
      if (this.perfectStreak >= BALANCE.regrowStreak) {
        const grow = Math.min(BALANCE.regrowAmount, BALANCE.baseWidth - w);
        w += grow;
        x -= grow / 2;
      }
      this.stack.push({ x, w, level: m.level, hue: m.hue });
      this.addScore(2);
      this.stat("perfects");
      this.statMax("maxCombo", this.perfectStreak);
      this.fx.text(x + w / 2, y + this.cam - 30, this.perfectStreak > 1 ? `PERFECT ×${this.perfectStreak}` : "PERFECT", { color: "#d4ff3a", size: 24 });
      this.fx.burst(x + w / 2, y + this.cam, { color: ["#d4ff3a", "#fff"], count: 18, speed: 300, spread: Math.PI, angle: -Math.PI / 2 });
      this.fx.pulse(0.03);
      this.dropFlash = 1;
      this.sound("perfect", 1 + Math.min(this.perfectStreak, 12) * 0.06);
      this.ctx.haptics.success();
    } else {
      const left = Math.max(m.x, top.x);
      const right = Math.min(m.x + m.w, top.x + top.w);
      const overlap = right - left;
      this.perfectStreak = 0;
      if (overlap <= 0) {
        this.debris.push({ x: m.x, y, w: m.w, vx: this.dir * 60, vy: 0, rot: 0, vr: this.dir * 2, hue: m.hue });
        this.moving.w = 0;
        this.juiceFail(m.x + m.w / 2, y + this.cam);
        this.finish({ reason: "MISSED THE TOWER" });
        return;
      }
      // Slice the overhang into a falling piece.
      const cutX = m.x < top.x ? m.x : right;
      const cutW = m.w - overlap;
      this.debris.push({ x: cutX, y, w: cutW, vx: (m.x < top.x ? -1 : 1) * 70, vy: -40, rot: 0, vr: (m.x < top.x ? -1 : 1) * 2.5, hue: m.hue });
      this.stack.push({ x: left, w: overlap, level: m.level, hue: m.hue });
      this.addScore(1);
      this.fx.shake(3);
      this.sound("thud", 1 + m.level * 0.004);
      this.sound("cut", 1);
      this.ctx.haptics.tap();
    }
    this.stat("blocks");
    this.spawn();
  }

  private levelY(level: number) {
    return this.baseY - level * BALANCE.blockHeight;
  }

  protected update(dt: number) {
    const m = this.moving;
    if (this.running && m.w > 0) {
      m.x += this.dir * this.speed * dt;
      const min = -m.w * 0.55;
      const max = this.w - m.w * 0.45;
      if (m.x > max) {
        m.x = max;
        this.dir = -1;
      } else if (m.x < min) {
        m.x = min;
        this.dir = 1;
      }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vy += 1400 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      if (d.y + this.cam > this.h + 200) this.debris.splice(i, 1);
    }
    const topLevel = this.stack[this.stack.length - 1].level;
    const targetCam = Math.max(0, this.h * 0.42 - this.levelY(topLevel + 1));
    this.cam = lerp(this.cam, targetCam, clamp(dt * 6, 0, 1));
    this.dropFlash = Math.max(0, this.dropFlash - dt * 3);
  }

  protected renderBackground(g: CanvasRenderingContext2D) {
    // Sky shifts as you climb.
    const level = this.stack.length;
    const shift = Math.min(1, level / 80);
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, hsl(250 - shift * 60, 60, 14 + shift * 4));
    grad.addColorStop(1, hsl(335 - shift * 40, 85, 52 - shift * 18));
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
    // Parallax stars
    g.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % this.w;
      const sy = ((i * 61 + this.cam * 0.25) % (this.h + 40)) - 20;
      g.fillRect(sx, sy, 2, 2);
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const bh = BALANCE.blockHeight;
    g.save();
    g.translate(0, this.cam);
    // Ground
    fillRoundRect(g, -20, this.baseY + bh, this.w + 40, 400, 0, "rgba(10,8,30,0.85)");
    const visibleFrom = Math.max(0, this.stack.length - Math.ceil(this.h / bh) - 4);
    for (let i = visibleFrom; i < this.stack.length; i++) this.drawBlock(g, this.stack[i]);
    if (this.moving.w > 0 && this.state !== "over") this.drawBlock(g, this.moving, true);
    for (const d of this.debris) {
      g.save();
      g.translate(d.x + d.w / 2, d.y + bh / 2);
      g.rotate(d.rot);
      fillRoundRect(g, -d.w / 2, -bh / 2, d.w, bh, 6, hsl(d.hue, 85, 55));
      g.restore();
    }
    g.restore();
  }

  private drawBlock(g: CanvasRenderingContext2D, b: Block, moving = false) {
    const y = this.levelY(b.level);
    const bh = BALANCE.blockHeight;
    fillRoundRect(g, b.x + 4, y + 5, b.w, bh, 6, "rgba(0,0,0,0.25)");
    fillRoundRect(g, b.x, y, b.w, bh, 6, hsl(b.hue, 85, 58));
    fillRoundRect(g, b.x, y, b.w, 7, 4, "rgba(255,255,255,0.35)");
    if (moving) {
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 2;
      g.strokeRect(b.x + 1, y + 1, b.w - 2, bh - 2);
    }
    if (this.dropFlash > 0 && b === this.stack[this.stack.length - 1]) {
      g.globalAlpha = this.dropFlash;
      fillRoundRect(g, b.x - 6, y - 6, b.w + 12, bh + 12, 10, "rgba(212,255,58,0.6)");
      g.globalAlpha = 1;
    }
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") {
      text(g, "TAP TO DROP", this.w / 2, this.h * 0.25, { font: this.font, size: 22, color: "#fff", stroke: "rgba(0,0,0,0.4)" });
    }
  }

  protected hud(): HudState {
    return { score: this.score, combo: this.perfectStreak > 1 ? this.perfectStreak : undefined };
  }
}

const factory: GameFactory = (def) => new StackUp(def);
export default factory;
