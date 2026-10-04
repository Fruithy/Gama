import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter, circle, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameDefinition, HudState } from "../core/types";
import { CATCH_BALANCE } from "./balance";

/**
 * Shared "catch the falling things" game, reused by Catch Rush (touch) and
 * Head Catch (camera). Only the controller differs — a good example of
 * building new games from existing mechanics without platform changes.
 */
export { CATCH_BALANCE };

type Kind = "fruit" | "star" | "bomb";

interface Item {
  x: number;
  y: number;
  r: number;
  kind: Kind;
  color: string;
  rot: number;
}

const FRUIT = [PALETTE.flare, PALETTE.sun, PALETTE.mint, PALETTE.ember, PALETTE.violet];

export class CatcherGame extends CanvasGame {
  private bx = 200;
  private target: number | null = null;
  private items: Item[] = [];
  private spawn = 0;
  private timeLeft = CATCH_BALANCE.durationS;
  private combo = 0;
  private bounce = 0;
  private usedFallback = false;

  constructor(
    def: GameDefinition,
    private control: "touch" | "head",
  ) {
    super(def);
  }

  private get by() {
    return this.h * 0.84;
  }
  private progress() {
    return Math.min(1, (CATCH_BALANCE.durationS - this.timeLeft) / CATCH_BALANCE.durationS);
  }
  /** Head mode only counts as ranked while the camera actually drives the basket. */
  private headActive() {
    return this.control === "head" && !!this.ctx.camera?.active;
  }

  protected setup() {
    this.bx = this.w / 2;
    this.items = [];
    this.spawn = 0.5;
    this.timeLeft = CATCH_BALANCE.durationS;
    this.combo = 0;
    this.usedFallback = false;
    this.target = null;
  }

  start() {
    super.start();
    if (this.control === "head") (this.ctx.camera as { calibrate?: () => void } | undefined)?.calibrate?.();
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
    if (!down) return false;
    if (key === "ArrowLeft" || key === "a") this.target = Math.max(0, this.bx - 120);
    else if (key === "ArrowRight" || key === "d") this.target = Math.min(this.w, this.bx + 120);
    else return false;
    return true;
  }

  private spawnItem() {
    const roll = this.rng.next();
    const kind: Kind = roll < CATCH_BALANCE.starChance ? "star" : roll < CATCH_BALANCE.starChance + CATCH_BALANCE.bombChance * (0.5 + this.progress()) ? "bomb" : "fruit";
    const r = kind === "star" ? 18 : this.rng.range(16, 24);
    this.items.push({ x: this.rng.range(r + 10, this.w - r - 10), y: -r, r, kind, color: this.rng.pick(FRUIT), rot: this.rng.range(0, 6) });
  }

  protected update(dt: number) {
    this.bounce = Math.max(0, this.bounce - dt * 5);
    if (!this.running) return;
    // Controller
    if (this.headActive()) {
      const face = this.ctx.camera!.readFace();
      if (face.present) {
        const goal = this.w / 2 + face.x * (this.w / 2 - CATCH_BALANCE.basketWidth / 2);
        this.bx += (goal - this.bx) * Math.min(1, dt * 14);
      }
    } else {
      if (this.control === "head") this.usedFallback = true;
      if (this.target !== null) {
        const d = this.target - this.bx;
        this.bx += Math.sign(d) * Math.min(Math.abs(d), CATCH_BALANCE.touchSpeed * dt);
      }
    }
    const half = CATCH_BALANCE.basketWidth / 2;
    this.bx = Math.max(half, Math.min(this.w - half, this.bx));

    this.timeLeft -= dt;
    this.spawn -= dt;
    const p = this.progress();
    if (this.spawn <= 0) {
      this.spawnItem();
      this.spawn = CATCH_BALANCE.startSpawnS - (CATCH_BALANCE.startSpawnS - CATCH_BALANCE.minSpawnS) * p;
    }
    const fall = CATCH_BALANCE.startFall + (CATCH_BALANCE.maxFall - CATCH_BALANCE.startFall) * p;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += fall * dt;
      it.rot += dt * 2;
      const caught = it.y + it.r >= this.by - 14 && it.y - it.r <= this.by + 6 && Math.abs(it.x - this.bx) < half;
      if (caught) {
        this.items.splice(i, 1);
        if (it.kind === "bomb") {
          this.timeLeft -= CATCH_BALANCE.bombPenaltyS;
          this.combo = 0;
          this.fx.text(this.bx, this.by - 50, `BOOM -${CATCH_BALANCE.bombPenaltyS}s`, { color: PALETTE.flare, size: 22 });
          this.fx.burst(this.bx, this.by, { color: ["#1d1d2a", PALETTE.flare], count: 24, speed: 340 });
          this.fx.shake(12);
          this.sound("fail", 1.4);
          this.ctx.haptics.fail();
        } else {
          this.combo++;
          const mult = 1 + Math.floor(this.combo / CATCH_BALANCE.comboStep);
          const pts = (it.kind === "star" ? 5 : 1) * mult;
          this.addScore(pts);
          this.statMax("maxCombo", this.combo);
          if (it.kind === "star") this.stat("perfects");
          this.fx.text(it.x, this.by - 40, `+${pts}`, { color: it.kind === "star" ? PALETTE.sun : "#fff", size: 18 });
          this.fx.burst(it.x, this.by - 10, { color: [it.kind === "star" ? PALETTE.sun : it.color, "#fff"], count: 8, speed: 200 });
          this.sound(it.kind === "star" ? "coin" : "pop", 1 + Math.min(this.combo, 30) * 0.02);
          this.bounce = 1;
        }
        continue;
      }
      if (it.y - it.r > this.h) {
        this.items.splice(i, 1);
        if (it.kind !== "bomb") this.combo = 0;
      }
    }
    this.ctx.audio.setIntensity(p);
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.fx.confetti(this.w / 2, this.h * 0.4, 26);
      this.finish({ reason: "TIME!", slowMo: false, ranked: this.control === "touch" || !this.usedFallback });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    for (const it of this.items) {
      if (it.kind === "bomb") {
        circle(g, it.x, it.y, it.r, "#1d1d2a");
        g.strokeStyle = PALETTE.flare;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(it.x, it.y - it.r);
        g.quadraticCurveTo(it.x + 8, it.y - it.r - 12, it.x + 4, it.y - it.r - 16);
        g.stroke();
        text(g, "✕", it.x, it.y + 1, { font: "system-ui", size: it.r, color: PALETTE.flare, weight: 900 });
      } else if (it.kind === "star") {
        g.save();
        g.translate(it.x, it.y);
        g.rotate(it.rot);
        g.fillStyle = PALETTE.sun;
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const rr = k % 2 ? it.r * 0.45 : it.r;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.restore();
      } else {
        circle(g, it.x + 2, it.y + 3, it.r, "rgba(0,0,0,0.25)");
        circle(g, it.x, it.y, it.r, it.color);
        circle(g, it.x - it.r * 0.35, it.y - it.r * 0.35, it.r * 0.22, "rgba(255,255,255,0.6)");
        g.fillStyle = "#3dffb0";
        g.beginPath();
        g.ellipse(it.x + 4, it.y - it.r, 6, 3, -0.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Basket critter
    const half = CATCH_BALANCE.basketWidth / 2;
    const lift = this.bounce * 6;
    fillRoundRect(g, this.bx - half + 3, this.by - 8 + 5, half * 2, 40, 14, "rgba(0,0,0,0.3)");
    fillRoundRect(g, this.bx - half, this.by - 8 - lift, half * 2, 40, 14, "#c97b2b");
    g.strokeStyle = "#8a4f14";
    g.lineWidth = 3;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(this.bx - half + (k * half * 2) / 4, this.by - 8 - lift);
      g.lineTo(this.bx - half + (k * half * 2) / 4, this.by + 32 - lift);
      g.stroke();
    }
    blobCritter(g, this.bx, this.by - 30 - lift, 18, PALETTE.volt, { mouth: this.bounce > 0.3 ? "o" : "smile", lookY: -1 });
    if (this.control === "head") {
      const cam = this.headActive();
      text(g, cam ? "🙂 MOVE YOUR HEAD ← →" : "👆 TOUCH MODE · PRACTICE", this.w / 2, this.h - 18, { font: this.font, size: 11, color: cam ? "rgba(255,255,255,0.75)" : PALETTE.sun });
    }
  }

  protected hud(): HudState {
    return { score: this.score, timeLeft: Math.max(0, this.timeLeft), combo: this.combo };
  }
}
