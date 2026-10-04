import { CanvasGame, type PointerInfo } from "../core/engine";
import { circle, googlyEyes, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

type Kind = "bubble" | "bomb" | "gold";

interface Target {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  kind: Kind;
  hue: string;
}

const HUES = [PALETTE.volt, PALETTE.ion, PALETTE.flare, PALETTE.violet, PALETTE.ember];

class PopRush extends CanvasGame {
  private targets: Target[] = [];
  private timeLeft = B.durationS;
  private spawnTimer = 0;
  private combo = 0;
  private popped = 0;

  private difficulty() {
    return Math.min(1, (B.durationS - this.timeLeft + this.popped * 0.15) / B.durationS);
  }

  protected setup() {
    this.targets = [];
    this.timeLeft = B.durationS;
    this.spawnTimer = 0.2;
    this.combo = 0;
    this.popped = 0;
  }

  private spawn() {
    const d = this.difficulty();
    const r = B.startRadius - (B.startRadius - B.minRadius) * d;
    const roll = this.rng.next();
    const kind: Kind = roll < B.goldChance ? "gold" : roll < B.goldChance + B.bombChance * d + 0.04 ? "bomb" : "bubble";
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = this.rng.range(r + 10, this.w - r - 10);
      const y = this.rng.range(this.h * 0.18 + r, this.h - r - 30);
      if (this.targets.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r + 8)) {
        this.targets.push({ x, y, r, age: 0, life: B.startLifeS - (B.startLifeS - B.minLifeS) * d, kind, hue: this.rng.pick(HUES) });
        return;
      }
    }
  }

  protected onPointerDown(p: PointerInfo) {
    // Hit test smallest-first so overlapping edges favour the intended target.
    const hit = this.targets
      .filter((t) => Math.hypot(t.x - p.x, t.y - p.y) <= t.r * 1.12)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!hit) {
      this.timeLeft -= B.missPenaltyS;
      this.combo = 0;
      this.fx.text(p.x, p.y, `-${B.missPenaltyS}s`, { color: PALETTE.flare, size: 20 });
      this.sound("miss", 1.2, 0.5);
      return;
    }
    this.targets.splice(this.targets.indexOf(hit), 1);
    if (hit.kind === "bomb") {
      this.timeLeft -= B.bombPenaltyS;
      this.combo = 0;
      this.fx.text(hit.x, hit.y - 20, `BOOM -${B.bombPenaltyS}s`, { color: PALETTE.flare, size: 24 });
      this.fx.burst(hit.x, hit.y, { color: ["#1d1d2a", PALETTE.flare, "#fff"], count: 26, speed: 380 });
      this.fx.shake(14);
      this.sound("fail", 1.4);
      this.ctx.haptics.fail();
      return;
    }
    this.popped++;
    this.combo++;
    const quick = 1 - hit.age / hit.life;
    const pts = 10 + Math.round(quick * 10) + Math.min(10, Math.floor(this.combo / 5) * 2);
    this.addScore(pts);
    this.statMax("maxCombo", this.combo);
    if (quick > 0.75) this.stat("perfects");
    if (hit.kind === "gold") {
      this.timeLeft += B.goldBonusS;
      this.fx.text(hit.x, hit.y - 26, `+${B.goldBonusS}s`, { color: PALETTE.sun, size: 26 });
      this.sound("coin");
    } else {
      this.fx.text(hit.x, hit.y - 20, `+${pts}`, { size: 18 });
      this.sound("pop", 0.9 + Math.min(this.combo, 20) * 0.03);
    }
    this.fx.burst(hit.x, hit.y, { color: [hit.kind === "gold" ? PALETTE.sun : hit.hue, "#fff"], count: 14, speed: 280 });
    this.ctx.haptics.tap();
  }

  protected update(dt: number) {
    for (const t of this.targets) t.age += dt;
    const before = this.targets.length;
    this.targets = this.targets.filter((t) => t.age < t.life);
    if (this.targets.length < before && this.running) {
      // Missing bubbles breaks the combo (bombs expiring is fine).
      this.combo = 0;
    }
    if (!this.running) return;
    this.timeLeft -= dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.targets.length < B.maxAlive) {
      this.spawn();
      const d = this.difficulty();
      this.spawnTimer = B.startSpawnS - (B.startSpawnS - B.minSpawnS) * d;
    }
    this.ctx.audio.setIntensity(this.difficulty());
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.fx.confetti(this.w / 2, this.h * 0.4, 30);
      this.finish({ reason: "TIME!", slowMo: false });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    for (const t of this.targets) {
      const k = t.age / t.life;
      const appear = Math.min(1, t.age / 0.12);
      const r = t.r * appear * (1 - Math.max(0, k - 0.75) * 1.2);
      if (t.kind === "bomb") {
        g.save();
        g.translate(t.x, t.y);
        g.rotate(this.clock * 2);
        g.fillStyle = "#1d1d2a";
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const rr = i % 2 ? r * 0.72 : r;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.restore();
        text(g, "✕", t.x, t.y + 2, { font: "system-ui", size: r * 0.9, color: PALETTE.flare, weight: 900 });
        continue;
      }
      circle(g, t.x + 4, t.y + 6, r, "rgba(0,0,0,0.25)");
      circle(g, t.x, t.y, r, t.kind === "gold" ? PALETTE.sun : t.hue);
      // Life ring
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(t.x, t.y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k));
      g.stroke();
      googlyEyes(g, t.x, t.y - r * 0.1, r * 0.22, { gap: r * 0.3, lookY: k > 0.6 ? -1 : 0 });
      if (t.kind === "gold") text(g, "+2s", t.x, t.y + r * 0.45, { font: this.font, size: r * 0.35, color: "#0b0b0f" });
    }
  }

  protected hud(): HudState {
    return { score: this.score, timeLeft: Math.max(0, this.timeLeft), combo: this.combo };
  }
}

const factory: GameFactory = (def) => new PopRush(def);
export default factory;
