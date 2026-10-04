import { CanvasGame, type PointerInfo } from "../core/engine";
import { fillRoundRect, roundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

type Shape = "circle" | "square" | "triangle" | "star";
type Rule = "shape" | "biggest" | "tick" | "count";

interface Tile {
  x: number;
  y: number;
  s: number;
  shape: Shape;
  size: number;
  mark: "tick" | "cross" | null;
  count: number;
  safe: boolean;
}

const SHAPES: Shape[] = ["circle", "square", "triangle", "star"];
const SHAPE_GLYPH: Record<Shape, string> = { circle: "●", square: "■", triangle: "▲", star: "★" };

class SafeTile extends CanvasGame {
  private tiles: Tile[] = [];
  private rule: Rule = "tick";
  private ruleText = "";
  private target: Shape = "circle";
  private targetCount = 1;
  private windowMs = B.startWindowMs;
  private remaining = 0;
  private round = 0;
  private reveal = 0;
  private flash: { tile: Tile; ok: boolean } | null = null;

  protected setup() {
    this.windowMs = B.startWindowMs;
    this.round = 0;
    this.flash = null;
    this.nextRound();
  }

  private nextRound() {
    const n = this.round >= B.fourTilesFrom ? 4 : this.round >= B.threeTilesFrom ? 3 : 2;
    const rules: Rule[] = this.round < 2 ? ["tick"] : ["tick", "shape", "biggest", "count"];
    this.rule = this.rng.pick(rules);
    const safeIdx = this.rng.int(0, n - 1);
    const cols = n <= 2 ? 2 : 2;
    const rows = Math.ceil(n / cols);
    const size = n <= 2 ? 150 : 140;
    const gap = 18;
    const totalW = cols * size + (cols - 1) * gap;
    const totalH = rows * size + (rows - 1) * gap;
    const x0 = (this.w - totalW) / 2;
    const y0 = this.h * 0.56 - totalH / 2;
    this.target = this.rng.pick(SHAPES);
    this.targetCount = this.rng.int(1, 4);
    const decoys = SHAPES.filter((s) => s !== this.target);
    const counts = [1, 2, 3, 4].filter((c) => c !== this.targetCount);
    const baseShape = this.rng.pick(SHAPES);
    const sizes = this.rng.shuffle([0.45, 0.6, 0.72, 0.85]).slice(0, n);
    const biggest = Math.max(...sizes);
    this.tiles = [];
    for (let i = 0; i < n; i++) {
      const safe = i === safeIdx;
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Centre a lone last tile in an odd row.
      const rowCount = Math.min(cols, n - row * cols);
      const offset = rowCount < cols ? (size + gap) / 2 : 0;
      const t: Tile = { x: x0 + col * (size + gap) + offset, y: y0 + row * (size + gap), s: size, shape: baseShape, size: 0.6, mark: null, count: 0, safe };
      switch (this.rule) {
        case "tick":
          t.mark = safe ? "tick" : "cross";
          break;
        case "shape":
          t.shape = safe ? this.target : this.rng.pick(decoys);
          break;
        case "biggest":
          t.size = sizes[i];
          break;
        case "count":
          t.count = safe ? this.targetCount : this.rng.pick(counts);
          break;
      }
      this.tiles.push(t);
    }
    if (this.rule === "biggest") {
      // Make the safe tile the biggest.
      const bi = sizes.indexOf(biggest);
      [this.tiles[bi].size, this.tiles[safeIdx].size] = [this.tiles[safeIdx].size, this.tiles[bi].size];
    }
    this.ruleText =
      this.rule === "tick" ? "TAP THE ✓" : this.rule === "shape" ? `TAP THE ${SHAPE_GLYPH[this.target]}` : this.rule === "biggest" ? "TAP THE BIGGEST" : `TAP THE ${this.targetCount}`;
    this.remaining = this.windowMs;
    this.reveal = 0;
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.flash) return;
    const tile = this.tiles.find((t) => p.x >= t.x && p.x <= t.x + t.s && p.y >= t.y && p.y <= t.y + t.s);
    if (!tile) return;
    if (!tile.safe) {
      this.flash = { tile, ok: false };
      this.juiceFail(tile.x + tile.s / 2, tile.y + tile.s / 2);
      this.finish({ reason: "WRONG TILE" });
      return;
    }
    const speed = this.remaining / this.windowMs;
    this.round++;
    this.addScore(10 + Math.round(speed * 10));
    this.statMax("accuracy", 100);
    if (speed > 0.6) {
      this.stat("perfects");
      this.fx.text(tile.x + tile.s / 2, tile.y - 10, "FAST", { color: PALETTE.volt });
    }
    this.flash = { tile, ok: true };
    this.juiceHit(tile.x + tile.s / 2, tile.y + tile.s / 2, PALETTE.mint);
    this.sound("pop", 1 + this.round * 0.015);
    this.windowMs = Math.max(B.minWindowMs, this.windowMs * B.windowDecay);
    this.ctx.audio.setIntensity(Math.min(1, this.round / 30));
  }

  protected update(dt: number) {
    this.reveal = Math.min(1, this.reveal + (dt * 1000) / B.revealMs);
    if (this.flash) {
      if (this.flash.ok) {
        this.flash = null;
        this.nextRound();
      }
      return;
    }
    if (!this.running) return;
    this.remaining -= dt * 1000;
    if (this.remaining <= 0) {
      this.remaining = 0;
      const safe = this.tiles.find((t) => t.safe)!;
      this.flash = { tile: safe, ok: false };
      this.juiceFail();
      this.finish({ reason: "TOO SLOW" });
    }
  }

  private drawShape(g: CanvasRenderingContext2D, shape: Shape, cx: number, cy: number, r: number) {
    g.fillStyle = "#0b0b0f";
    g.beginPath();
    if (shape === "circle") g.arc(cx, cy, r, 0, Math.PI * 2);
    else if (shape === "square") roundRect(g, cx - r, cy - r, r * 2, r * 2, r * 0.2);
    else if (shape === "triangle") {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 1.05, cy + r * 0.8);
      g.lineTo(cx - r * 1.05, cy + r * 0.8);
      g.closePath();
    } else {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
    }
    g.fill();
  }

  protected render(g: CanvasRenderingContext2D) {
    // Rule banner
    fillRoundRect(g, 30, this.h * 0.2, this.w - 60, 64, 22, "rgba(0,0,0,0.35)");
    text(g, this.ruleText, this.w / 2, this.h * 0.2 + 33, { font: this.font, size: 26, color: "#fff" });
    // Window bar
    const frac = this.remaining / this.windowMs;
    fillRoundRect(g, 40, this.h * 0.2 + 80, this.w - 80, 10, 5, "rgba(255,255,255,0.12)");
    fillRoundRect(g, 40, this.h * 0.2 + 80, (this.w - 80) * Math.max(0, frac), 10, 5, frac < 0.3 ? PALETTE.flare : PALETTE.ion);

    const pop = 0.85 + 0.15 * this.reveal;
    for (const t of this.tiles) {
      const cx = t.x + t.s / 2;
      const cy = t.y + t.s / 2;
      g.save();
      g.translate(cx, cy);
      g.scale(pop, pop);
      g.translate(-cx, -cy);
      const flashColor = this.flash?.tile === t ? (this.flash.ok ? PALETTE.mint : PALETTE.flare) : null;
      fillRoundRect(g, t.x + 4, t.y + 6, t.s, t.s, 24, "rgba(0,0,0,0.35)");
      fillRoundRect(g, t.x, t.y, t.s, t.s, 24, flashColor ?? "#f5f5f7");
      if (this.rule === "tick") {
        text(g, t.mark === "tick" ? "✓" : "✕", cx, cy + 4, { font: "system-ui, sans-serif", size: 84, color: "#0b0b0f", weight: 900 });
      } else if (this.rule === "count") {
        const r = 11;
        const pos = [[0, 0]], two = [[-22, 0], [22, 0]], three = [[-26, 18], [26, 18], [0, -22]], four = [[-22, -22], [22, -22], [-22, 22], [22, 22]];
        for (const [dx, dy] of [pos, two, three, four][t.count - 1]) this.drawShape(g, "circle", cx + dx, cy + dy, r);
      } else {
        this.drawShape(g, t.shape, cx, cy, (t.s / 2) * t.size * 0.85);
      }
      g.restore();
    }
  }

  protected hud(): HudState {
    return { score: this.score, label: `ROUND ${this.round + 1}` };
  }
}

const factory: GameFactory = (def) => new SafeTile(def);
export default factory;
