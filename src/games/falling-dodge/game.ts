import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Block {
  x: number;
  y: number;
  s: number;
  rot: number;
  vr: number;
  color: string;
  passed: boolean;
}

const COLORS = [PALETTE.ember, PALETTE.sun, PALETTE.violet, PALETTE.flare, PALETTE.ion];

class FallingDodge extends CanvasGame {
  private x = 200;
  private target: number | null = null;
  private keys = { l: false, r: false };
  private blocks: Block[] = [];
  private spawn = 0;

  private get py() {
    return this.h * 0.84;
  }
  private ramp() {
    return Math.min(1, this.t / B.rampS);
  }

  protected setup() {
    this.x = this.w / 2;
    this.blocks = [];
    this.spawn = 0.6;
    this.target = null;
  }

  protected onPointerDown(p: PointerInfo) {
    this.target = p.x;
  }
  protected onPointerMove(p: PointerInfo) {
    if (this.pointerDown) this.target = p.x;
  }
  protected onPointerUp() {
    this.target = null;
  }
  protected onKey(key: string, down: boolean) {
    if (key === "ArrowLeft" || key === "a") this.keys.l = down;
    else if (key === "ArrowRight" || key === "d") this.keys.r = down;
    else return false;
    return true;
  }

  private addBlock() {
    const s = this.rng.range(34, 64);
    // Keep a dodgeable gap next to any block still in the top third.
    for (let i = 0; i < 8; i++) {
      const x = this.rng.range(s / 2 + 6, this.w - s / 2 - 6);
      const ok = this.blocks.every((b) => b.y > this.h * 0.35 || Math.abs(b.x - x) > (b.s + s) / 2 + B.minGap);
      if (ok) {
        this.blocks.push({ x, y: -s, s, rot: this.rng.range(0, 6), vr: this.rng.range(-2, 2), color: this.rng.pick(COLORS), passed: false });
        return;
      }
    }
  }

  protected update(dt: number) {
    if (this.state === "idle") return;
    if (!this.running) return;
    const r = this.ramp();
    if (this.target !== null) {
      const d = this.target - this.x;
      this.x += Math.sign(d) * Math.min(Math.abs(d), B.moveSpeed * dt);
    } else {
      this.x += ((this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0)) * B.moveSpeed * dt;
    }
    this.x = Math.max(B.playerRadius, Math.min(this.w - B.playerRadius, this.x));
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.addBlock();
      this.spawn = B.startSpawnS - (B.startSpawnS - B.minSpawnS) * r;
    }
    const fall = B.startFall + (B.maxFall - B.startFall) * r;
    for (const b of this.blocks) {
      b.y += fall * dt * (0.8 + b.s / 160);
      b.rot += b.vr * dt;
      // Circle vs (approximately) square: use a slightly shrunk radius for fairness.
      if (Math.abs(b.x - this.x) < b.s * 0.42 + B.playerRadius * 0.8 && Math.abs(b.y - this.py) < b.s * 0.42 + B.playerRadius * 0.8) {
        this.juiceFail(this.x, this.py);
        this.finish({ reason: "SQUASHED" });
        return;
      }
      if (!b.passed && b.y - b.s / 2 > this.py + B.playerRadius) {
        b.passed = true;
        this.addScore(1);
        if (Math.abs(b.x - this.x) < b.s / 2 + B.playerRadius + 14) {
          this.stat("perfects");
          this.fx.text(this.x, this.py - 40, "CLOSE!", { color: PALETTE.sun, size: 16 });
        }
      }
    }
    this.blocks = this.blocks.filter((b) => b.y < this.h + 80);
    this.ctx.audio.setIntensity(r);
  }

  protected render(g: CanvasRenderingContext2D) {
    for (const b of this.blocks) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      fillRoundRect(g, -b.s / 2 + 4, -b.s / 2 + 5, b.s, b.s, 10, "rgba(0,0,0,0.3)");
      fillRoundRect(g, -b.s / 2, -b.s / 2, b.s, b.s, 10, b.color);
      g.restore();
    }
    g.fillStyle = "rgba(255,255,255,0.06)";
    g.fillRect(0, this.py + B.playerRadius + 4, this.w, this.h);
    const near = this.blocks.some((b) => b.y > this.py - 160 && Math.abs(b.x - this.x) < 80);
    blobCritter(g, this.x, this.py, B.playerRadius, PALETTE.mint, { lookY: -1, mouth: near ? "o" : "smile" });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "DRAG TO DODGE", this.w / 2, this.h * 0.5, { font: this.font, size: 22, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score };
  }
}

const factory: GameFactory = (def) => new FallingDodge(def);
export default factory;
