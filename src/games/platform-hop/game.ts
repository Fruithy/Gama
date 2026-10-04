import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

type PType = "normal" | "moving" | "breaking";

interface Platform {
  x: number;
  y: number; // world y (up is negative)
  type: PType;
  vx: number;
  broken: boolean;
  spring: boolean;
  fall: number;
}

class PlatformHop extends CanvasGame {
  private px = 200;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private plats: Platform[] = [];
  private topY = 0; // world y of highest generated platform
  private camY = 0; // world y at the top of the screen
  private best = 0;
  private dir = 0;
  private dragX: number | null = null;
  private keys = { l: false, r: false };
  private squash = 1;

  protected setup() {
    this.px = this.w / 2;
    this.py = 0;
    this.vx = 0;
    this.vy = -B.jumpVelocity;
    this.plats = [{ x: this.w / 2 - B.platformWidth / 2, y: 40, type: "normal", vx: 0, broken: false, spring: false, fall: 0 }];
    this.topY = 40;
    this.camY = -this.h * 0.6;
    this.best = 0;
    this.dir = 0;
    this.dragX = null;
    this.generate();
  }

  /** Procedural, seeded generation. A normal/moving platform always lies within jump reach. */
  private generate() {
    while (this.topY > this.camY - this.h) {
      const height = -this.topY;
      const ramp = Math.min(1, height / B.gapRampHeight);
      const maxGap = B.maxGapStart + (B.maxGapEnd - B.maxGapStart) * ramp;
      this.topY -= this.rng.range(B.minGap, maxGap);
      const moving = height > B.movingFrom && this.rng.chance(0.18 + ramp * 0.25);
      this.plats.push({
        x: this.rng.range(8, this.w - B.platformWidth - 8),
        y: this.topY,
        type: moving ? "moving" : "normal",
        vx: moving ? this.rng.range(50, 90 + ramp * 80) * (this.rng.chance(0.5) ? 1 : -1) : 0,
        broken: false,
        spring: this.rng.chance(B.springChance),
        fall: 0,
      });
      // Decoy breaking platforms are extras, never part of the guaranteed chain.
      if (height > B.breakingFrom && this.rng.chance(0.35)) {
        this.plats.push({ x: this.rng.range(8, this.w - B.platformWidth - 8), y: this.topY + this.rng.range(20, 50), type: "breaking", vx: 0, broken: false, spring: false, fall: 0 });
      }
    }
  }

  protected onPointerDown(p: PointerInfo) {
    this.dragX = p.x;
  }
  protected onPointerMove(p: PointerInfo) {
    if (this.pointerDown) this.dragX = p.x;
  }
  protected onPointerUp() {
    this.dragX = null;
  }
  protected onKey(key: string, down: boolean) {
    if (key === "ArrowLeft" || key === "a") this.keys.l = down;
    else if (key === "ArrowRight" || key === "d") this.keys.r = down;
    else return false;
    return true;
  }

  protected update(dt: number) {
    for (const p of this.plats) {
      if (p.type === "moving") {
        p.x += p.vx * dt;
        if (p.x < 4 || p.x > this.w - B.platformWidth - 4) p.vx *= -1;
      }
      if (p.broken) p.fall += 900 * dt;
    }
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);
    if (this.state === "idle") {
      this.py = 40 - 30 * Math.abs(Math.sin(this.clock * 3));
      return;
    }
    if (!this.running) return;

    // Steering: drag follows the finger; hold-left/right or keys accelerate.
    this.dir = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0);
    if (this.dragX !== null) {
      const target = this.dragX - this.px;
      this.vx += Math.max(-1, Math.min(1, target / 60)) * B.moveAccel * dt;
    } else if (this.dir) {
      this.vx += this.dir * B.moveAccel * dt;
    } else {
      this.vx *= Math.pow(B.friction, dt * 60);
    }
    this.vx = Math.max(-B.maxMoveSpeed, Math.min(B.maxMoveSpeed, this.vx));
    this.px += this.vx * dt;
    if (this.px < -20) this.px = this.w + 20;
    if (this.px > this.w + 20) this.px = -20;

    const prevY = this.py;
    this.vy += B.gravity * dt;
    this.py += this.vy * dt;

    // Land only while falling, crossing a platform top this frame.
    if (this.vy > 0) {
      for (const p of this.plats) {
        if (p.broken) continue;
        const feet = this.py + 18;
        const prevFeet = prevY + 18;
        if (prevFeet <= p.y && feet >= p.y && this.px > p.x - 14 && this.px < p.x + B.platformWidth + 14) {
          if (p.type === "breaking") {
            p.broken = true;
            this.sound("cut", 0.6);
            this.fx.burst(p.x + B.platformWidth / 2, p.y - this.camY, { color: ["#ff6a3d", "#fff"], count: 10, speed: 160 });
            continue;
          }
          this.py = p.y - 18;
          this.vy = -(p.spring ? B.springVelocity : B.jumpVelocity);
          this.squash = 1.35;
          if (p.spring) {
            this.sound("levelup", 1.2);
            this.fx.text(this.px, this.py - this.camY - 40, "BOING", { color: PALETTE.volt, size: 22 });
            this.stat("springs");
          } else {
            this.sound("bounce", 0.9 + Math.min(0.6, -this.py / 20000));
          }
          break;
        }
      }
    }

    // Camera only moves up.
    const targetCam = this.py - this.h * 0.42;
    if (targetCam < this.camY) this.camY = targetCam;
    this.best = Math.max(this.best, -this.py);
    this.setScore(this.best / B.pxPerMeter);
    this.generate();
    this.plats = this.plats.filter((p) => p.y - this.camY < this.h + 120 && p.fall < 800);

    if (this.py - this.camY > this.h + 40) {
      this.juiceFail(this.px, this.h - 40);
      this.finish({ reason: "FELL" });
    }
  }

  protected renderBackground(g: CanvasRenderingContext2D) {
    super.renderBackground(g);
    // Parallax clouds
    g.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 8; i++) {
      const y = ((i * 170 - this.camY * 0.3) % (this.h + 200)) - 100;
      fillRoundRect(g, (i * 97) % (this.w - 80), y, 120, 34, 17, "rgba(255,255,255,0.07)");
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    for (const p of this.plats) {
      const y = p.y - this.camY + p.fall;
      const color = p.type === "breaking" ? "#ff6a3d" : p.type === "moving" ? PALETTE.ion : PALETTE.volt;
      fillRoundRect(g, p.x + 3, y + 5, B.platformWidth, 16, 8, "rgba(0,0,0,0.25)");
      fillRoundRect(g, p.x, y, B.platformWidth, 16, 8, color);
      if (p.type === "breaking") {
        g.strokeStyle = "#0b0b0f";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p.x + 30, y);
        g.lineTo(p.x + 38, y + 8);
        g.lineTo(p.x + 32, y + 16);
        g.stroke();
      }
      if (p.spring) {
        g.strokeStyle = "#fff";
        g.lineWidth = 4;
        g.beginPath();
        const sx = p.x + B.platformWidth / 2;
        g.moveTo(sx - 8, y);
        g.lineTo(sx + 8, y - 6);
        g.lineTo(sx - 8, y - 12);
        g.lineTo(sx + 8, y - 18);
        g.stroke();
      }
    }
    blobCritter(g, this.px, this.py - this.camY, 20, PALETTE.flare, { squash: this.squash, lookX: this.vx / B.maxMoveSpeed, lookY: this.vy > 0 ? 1 : -1, mouth: this.vy > 400 ? "o" : "smile" });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "HOLD ◀ ▶ TO STEER", this.w / 2, this.h * 0.25, { font: this.font, size: 20, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new PlatformHop(def);
export default factory;
