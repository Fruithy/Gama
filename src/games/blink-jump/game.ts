import { CanvasGame } from "../core/engine";
import { blobCritter, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Obstacle {
  x: number;
  w: number;
  h: number;
  passed: boolean;
}

class BlinkJump extends CanvasGame {
  private y = 0;
  private vy = 0;
  private speed = B.startSpeed;
  private obstacles: Obstacle[] = [];
  private nextX = 0;
  private refractory = 0;
  private wasClosed = false;
  private usedFallback = false;
  private scroll = 0;
  private x = 90;

  private get ground() {
    return this.h * 0.72;
  }
  private cameraDriven() {
    return !!this.ctx.camera?.active;
  }

  protected setup() {
    this.y = 0;
    this.vy = 0;
    this.speed = B.startSpeed;
    this.obstacles = [];
    this.nextX = this.w + 200;
    this.usedFallback = false;
    this.refractory = 0;
    while (this.nextX < this.w * 2.5) this.spawn();
  }

  start() {
    super.start();
    (this.ctx.camera as { calibrate?: () => void } | undefined)?.calibrate?.();
  }

  private spawn() {
    const w = this.rng.range(22, 40);
    const h = this.rng.range(30, 62);
    this.obstacles.push({ x: this.nextX, w, h, passed: false });
    this.nextX += this.speed * this.rng.range(B.minGapS, B.maxGapS) + w;
  }

  private jump() {
    if (this.y < 0 || this.refractory > 0) return;
    this.vy = -B.jumpVelocity;
    this.y = -0.01;
    this.refractory = B.refractoryS;
    this.sound("bounce", 1.1);
  }

  protected onPointerDown() {
    if (!this.cameraDriven()) {
      this.usedFallback = true;
      this.jump();
    }
  }

  protected update(dt: number) {
    this.refractory = Math.max(0, this.refractory - dt);
    if (this.state === "idle") {
      this.scroll = (this.scroll + dt * 120) % 40;
      return;
    }
    if (!this.running) return;
    // Face trigger: rising edge of blink OR mouth open.
    if (this.cameraDriven()) {
      const f = this.ctx.camera!.readFace();
      const closed = f.present && (f.blink > B.blinkThreshold || f.mouthOpen > B.mouthThreshold);
      if (closed && !this.wasClosed) {
        this.recordAction();
        this.jump();
      }
      this.wasClosed = closed;
    } else {
      this.usedFallback = true;
    }
    this.speed = Math.min(B.maxSpeed, this.speed + B.speedGain * dt);
    const dx = this.speed * dt;
    this.scroll = (this.scroll + dx) % 40;
    if (this.y < 0 || this.vy < 0) {
      this.vy += B.gravity * dt;
      this.y += this.vy * dt;
      if (this.y >= 0) {
        this.y = 0;
        this.vy = 0;
      }
    }
    for (const o of this.obstacles) o.x -= dx;
    this.nextX -= dx;
    while (this.obstacles.length && this.obstacles[0].x + this.obstacles[0].w < -20) this.obstacles.shift();
    while (this.nextX < this.w * 2.5) this.spawn();
    const r = 20;
    for (const o of this.obstacles) {
      if (!o.passed && o.x + o.w < this.x - r) {
        o.passed = true;
        this.addScore(1);
        this.sound("coin", 1 + Math.min(this.score, 40) * 0.01);
      }
      const overlapX = this.x + r * 0.8 > o.x && this.x - r * 0.8 < o.x + o.w;
      const feet = this.ground + this.y;
      if (overlapX && feet > this.ground - o.h + 6) {
        this.juiceFail(this.x, this.ground + this.y - r);
        this.finish({ reason: "TRIPPED", ranked: !this.usedFallback });
        return;
      }
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    g.fillStyle = "rgba(11,11,15,0.5)";
    g.fillRect(0, this.ground, this.w, this.h - this.ground);
    g.fillStyle = "rgba(255,255,255,0.15)";
    for (let x = -this.scroll; x < this.w; x += 40) g.fillRect(x, this.ground, 20, 4);
    for (const o of this.obstacles) {
      g.fillStyle = PALETTE.volt;
      g.strokeStyle = "#0b0b0f";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(o.x, this.ground);
      g.lineTo(o.x + o.w / 2, this.ground - o.h);
      g.lineTo(o.x + o.w, this.ground);
      g.closePath();
      g.fill();
      g.stroke();
    }
    const face = this.ctx.camera?.active ? this.ctx.camera.readFace() : null;
    blobCritter(g, this.x, this.ground + this.y - 20, 20, PALETTE.sun, { blink: face?.blink ?? 0, mouth: (face?.mouthOpen ?? 0) > 0.3 || this.y < 0 ? "o" : "smile", squash: this.y < 0 ? 0.9 : 1 });
    const cam = this.cameraDriven();
    text(g, cam ? "😑 BLINK OR 😮 OPEN MOUTH TO JUMP" : "👆 TAP TO JUMP · PRACTICE", this.w / 2, this.h - 24, { font: this.font, size: 11, color: cam ? "rgba(255,255,255,0.8)" : PALETTE.sun });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new BlinkJump(def);
export default factory;
