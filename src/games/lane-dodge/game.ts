import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter, circle, fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Obstacle {
  lane: number;
  y: number;
  kind: "block" | "coin";
  hue: string;
}

const BLOCK_COLORS = [PALETTE.flare, PALETTE.violet, PALETTE.ember, PALETTE.ion];
const OB_H = 64;

class LaneDodge extends CanvasGame {
  private lane = 1;
  private laneVisual = 1;
  private speed = B.startSpeed;
  private distance = 0;
  private obstacles: Obstacle[] = [];
  private rowTimer = 0;
  private freeLane = 1;
  private coins = 0;
  private stripe = 0;
  private swipeStart: { x: number; y: number } | null = null;

  private laneX(l: number) {
    const w = this.w / B.lanes;
    return w * l + w / 2;
  }
  private get playerY() {
    return this.h * 0.8;
  }

  protected setup() {
    this.lane = 1;
    this.laneVisual = 1;
    this.speed = B.startSpeed;
    this.distance = 0;
    this.obstacles = [];
    this.rowTimer = 1.0;
    this.freeLane = 1;
    this.coins = 0;
  }

  private move(dir: number) {
    const next = Math.max(0, Math.min(B.lanes - 1, this.lane + dir));
    if (next === this.lane) return;
    this.lane = next;
    this.sound("whoosh", 1 + dir * 0.1);
    this.ctx.haptics.tap();
  }

  protected onPointerDown(p: PointerInfo) {
    this.swipeStart = { x: p.x, y: p.y };
  }
  protected onPointerUp(p: PointerInfo) {
    const s = this.swipeStart;
    this.swipeStart = null;
    if (!s) return;
    const dx = p.x - s.x;
    if (Math.abs(dx) > 30) this.move(Math.sign(dx));
    else this.move(p.x < this.w / 2 ? -1 : 1);
  }
  protected onKey(key: string, down: boolean) {
    if (!down) return key === "ArrowLeft" || key === "ArrowRight" || key === "a" || key === "d";
    if (key === "ArrowLeft" || key === "a") this.move(-1);
    else if (key === "ArrowRight" || key === "d") this.move(1);
    else return false;
    return true;
  }

  /**
   * Fairness: each row keeps `freeLane` open, and the free lane only ever
   * moves by one lane between rows, with rows ≥ minRowGapS apart (longer than
   * a lane switch) — so a skilled player can always survive.
   */
  private spawnRow() {
    this.freeLane = Math.max(0, Math.min(B.lanes - 1, this.freeLane + this.rng.int(-1, 1)));
    const doubles = this.t > B.doubleBlockFrom;
    for (let l = 0; l < B.lanes; l++) {
      if (l === this.freeLane) {
        if (this.rng.chance(B.coinChance)) this.obstacles.push({ lane: l, y: -OB_H, kind: "coin", hue: PALETTE.sun });
        continue;
      }
      if (doubles || this.rng.chance(0.55)) this.obstacles.push({ lane: l, y: -OB_H, kind: "block", hue: this.rng.pick(BLOCK_COLORS) });
    }
  }

  protected update(dt: number) {
    this.laneVisual += (this.lane - this.laneVisual) * Math.min(1, dt / B.laneSwitchS * 2.2);
    if (this.state === "idle") {
      this.stripe = (this.stripe + dt * 200) % 80;
      return;
    }
    if (!this.running) return;
    this.speed = Math.min(B.maxSpeed, this.speed + B.speedGain * dt);
    this.distance += (this.speed * dt) / 10;
    this.setScore(this.distance + this.coins * 10);
    this.stripe = (this.stripe + this.speed * dt) % 80;
    this.rowTimer -= dt;
    if (this.rowTimer <= 0) {
      this.spawnRow();
      const progress = (this.speed - B.startSpeed) / (B.maxSpeed - B.startSpeed);
      this.rowTimer = Math.max(B.minRowGapS, B.startRowGapS - progress * (B.startRowGapS - B.minRowGapS));
    }
    const px = this.laneX(this.laneVisual);
    const py = this.playerY;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.y += this.speed * dt;
      if (o.y > this.h + 100) {
        this.obstacles.splice(i, 1);
        if (o.kind === "block") this.stat("dodged");
        continue;
      }
      const ox = this.laneX(o.lane);
      const hitX = Math.abs(ox - px) < this.w / B.lanes / 2 - 12;
      const hitY = o.y + OB_H > py - 24 && o.y < py + 24;
      if (hitX && hitY) {
        if (o.kind === "coin") {
          this.coins++;
          this.obstacles.splice(i, 1);
          this.fx.text(ox, py - 50, "+10", { color: PALETTE.sun, size: 18 });
          this.sound("coin", 1 + (this.coins % 8) * 0.05);
          this.stat("coins");
        } else {
          this.juiceFail(px, py);
          this.finish({ reason: "CRASHED" });
          return;
        }
      }
    }
    this.ctx.audio.setIntensity((this.speed - B.startSpeed) / (B.maxSpeed - B.startSpeed));
  }

  protected render(g: CanvasRenderingContext2D) {
    const lw = this.w / B.lanes;
    for (let l = 1; l < B.lanes; l++) {
      for (let y = -80 + this.stripe; y < this.h; y += 80) fillRoundRect(g, lw * l - 3, y, 6, 40, 3, "rgba(255,194,61,0.55)");
    }
    for (const o of this.obstacles) {
      const x = this.laneX(o.lane);
      if (o.kind === "coin") {
        circle(g, x, o.y + OB_H / 2, 15, PALETTE.sun);
        circle(g, x - 4, o.y + OB_H / 2 - 4, 4, "rgba(255,255,255,0.7)");
      } else {
        fillRoundRect(g, x - lw / 2 + 14 + 4, o.y + 6, lw - 28, OB_H, 14, "rgba(0,0,0,0.35)");
        fillRoundRect(g, x - lw / 2 + 14, o.y, lw - 28, OB_H, 14, o.hue);
        fillRoundRect(g, x - lw / 2 + 24, o.y + 10, lw - 48, 10, 5, "rgba(255,255,255,0.3)");
      }
    }
    const px = this.laneX(this.laneVisual);
    // Speed lines
    if (this.speed > 600) {
      g.strokeStyle = "rgba(255,255,255,0.25)";
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x = ((i * 73 + this.distance * 3) % this.w);
        g.beginPath();
        g.moveTo(x, (i * 131) % this.h);
        g.lineTo(x, ((i * 131) % this.h) + 40);
        g.stroke();
      }
    }
    blobCritter(g, px, this.playerY, 26, PALETTE.volt, { lookY: -1, mouth: this.speed > 700 ? "o" : "smile", rotation: (this.lane - this.laneVisual) * 0.6 });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "◀ TAP SIDES ▶", this.w / 2, this.h * 0.45, { font: this.font, size: 22, color: "#fff" });
  }

  protected hud(): HudState {
    return { score: this.score, label: `${Math.round(this.speed / 10)} KM/H` };
  }
}

const factory: GameFactory = (def) => new LaneDodge(def);
export default factory;
