import { CanvasGame, type PointerInfo } from "../core/engine";
import { fillRoundRect, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";
import { drawFace, FACES, LOOKALIKES, type Face } from "./faces";

interface Cell {
  face: Face;
  offset: number; // horizontal drift for its row
}

class EmojiMatch extends CanvasGame {
  private target: Face = "happy";
  private cells: Cell[] = [];
  private timeLeft = B.durationS;
  private matches = 0;
  private combo = 0;
  private drift = [0, 0, 0];
  private driftDir = [1, -1, 1];
  private bump = 0;

  private cellGeom(i: number) {
    const size = Math.min(112, (this.w - 50) / B.grid);
    const total = size * B.grid;
    const x0 = (this.w - total) / 2;
    const y0 = this.h * 0.42;
    const row = Math.floor(i / B.grid);
    const col = i % B.grid;
    let x = x0 + col * size + this.drift[row];
    // Wrap rows horizontally once drifting.
    const span = total;
    x = x0 + ((((x - x0) % span) + span) % span);
    return { x, y: y0 + row * size, s: size };
  }

  protected setup() {
    this.timeLeft = B.durationS;
    this.matches = 0;
    this.combo = 0;
    this.drift = [0, 0, 0];
    this.newRound();
  }

  private newRound() {
    const pool = FACES.slice(0, Math.min(B.maxFaces, B.startFaces + Math.floor(this.matches / 3)));
    this.target = this.rng.pick(pool);
    const n = B.grid * B.grid;
    const correct = this.rng.int(0, n - 1);
    const hard = this.matches > 12;
    this.cells = Array.from({ length: n }, (_, i) => {
      if (i === correct) return { face: this.target, offset: 0 };
      let f: Face;
      do {
        f = hard && this.rng.chance(0.4) ? LOOKALIKES[this.target] : this.rng.pick(pool);
      } while (f === this.target);
      return { face: f, offset: 0 };
    });
    this.driftDir = [this.rng.chance(0.5) ? 1 : -1, this.rng.chance(0.5) ? 1 : -1, this.rng.chance(0.5) ? 1 : -1];
  }

  protected onPointerDown(p: PointerInfo) {
    for (let i = 0; i < this.cells.length; i++) {
      const g = this.cellGeom(i);
      if (p.x < g.x || p.x > g.x + g.s || p.y < g.y || p.y > g.y + g.s) continue;
      if (this.cells[i].face === this.target) {
        this.matches++;
        this.combo++;
        const mult = 1 + Math.floor(this.combo / B.comboStep);
        this.addScore(mult);
        this.statMax("maxCombo", this.combo);
        this.fx.text(g.x + g.s / 2, g.y, `+${mult}`, { color: PALETTE.volt, size: 22 });
        this.juiceHit(g.x + g.s / 2, g.y + g.s / 2, PALETTE.sun);
        this.sound("pop", 1 + Math.min(20, this.combo) * 0.03);
        if (this.combo % B.comboStep === 0) {
          this.fx.text(this.w / 2, this.h * 0.36, `×${mult + 0} COMBO`, { color: PALETTE.flare, size: 26 });
          this.stat("perfects");
        }
        this.bump = 1;
        this.newRound();
      } else {
        this.combo = 0;
        this.timeLeft -= B.wrongPenaltyS;
        this.fx.text(g.x + g.s / 2, g.y, `-${B.wrongPenaltyS}s`, { color: PALETTE.flare, size: 22 });
        this.fx.shake(8);
        this.sound("miss");
        this.ctx.haptics.fail();
      }
      return;
    }
  }

  protected update(dt: number) {
    this.bump = Math.max(0, this.bump - dt * 5);
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.matches >= B.driftFrom) {
      const sp = B.driftSpeed * (1 + (this.matches - B.driftFrom) * 0.04);
      for (let r = 0; r < 3; r++) this.drift[r] += this.driftDir[r] * sp * dt * (r === 1 ? 1.3 : 1);
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.fx.confetti(this.w / 2, this.h * 0.3, 24);
      this.finish({ reason: "TIME!", slowMo: false });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    // Target card
    const s = 1 + this.bump * 0.15;
    fillRoundRect(g, this.w / 2 - 74, this.h * 0.15 - 4, 148, 148, 30, "rgba(11,11,15,0.25)");
    drawFace(g, this.target, this.w / 2, this.h * 0.15 + 70, 56 * s);
    text(g, "FIND ME", this.w / 2, this.h * 0.15 - 20, { font: this.font, size: 14, color: "rgba(11,11,15,0.7)" });
    g.save();
    const first = this.cellGeom(0);
    const total = first.s * B.grid;
    const x0 = (this.w - total) / 2;
    g.beginPath();
    g.rect(x0 - 4, first.y - 4, total + 8, first.s * B.grid + 8);
    g.clip();
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cellGeom(i);
      fillRoundRect(g, c.x + 5, c.y + 5, c.s - 10, c.s - 10, 22, "rgba(255,255,255,0.35)");
      drawFace(g, this.cells[i].face, c.x + c.s / 2, c.y + c.s / 2, c.s * 0.34);
      // Wrapped copy for smooth sliding.
      if (this.matches >= B.driftFrom) drawFace(g, this.cells[i].face, c.x + c.s / 2 - total, c.y + c.s / 2, c.s * 0.34);
    }
    g.restore();
  }

  protected hud(): HudState {
    return { score: this.score, timeLeft: Math.max(0, this.timeLeft), combo: this.combo };
  }
}

const factory: GameFactory = (def) => new EmojiMatch(def);
export default factory;
