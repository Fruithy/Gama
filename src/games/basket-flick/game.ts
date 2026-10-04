import { CanvasGame, type PointerInfo } from "../core/engine";
import { circle, fillRoundRect, googlyEyes, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Ball {
  x: number;
  z: number; // depth: 0 = at the player, hoopZ = at the rim
  hgt: number; // height above the floor
  vx: number;
  vz: number;
  vh: number;
  scored: boolean;
  done: boolean;
}

/**
 * 2.5D basketball. World: x (sideways), z (depth), hgt (height). The camera
 * projects with a simple 1/(1 + z·k) perspective. Scoring happens when the
 * ball crosses the rim plane while falling and inside the rim.
 */
class BasketFlick extends CanvasGame {
  private ball: Ball | null = null;
  private hoop = { x: 200, z: B.hoopZ, vx: 0 };
  private swipe: { x: number; y: number } | null = null;
  private misses = 0;
  private shots = 0;
  private streak = 0;
  private resetTimer = 0;
  private netWiggle = 0;

  private proj(x: number, z: number, h: number) {
    const s = 1 / (1 + z * B.perspective);
    const groundY = this.h - 120;
    const horizon = this.h * 0.12;
    return { x: this.w / 2 + (x - this.w / 2) * s, y: horizon + (groundY - horizon) * s - h * s, s };
  }

  protected setup() {
    this.misses = 0;
    this.shots = 0;
    this.streak = 0;
    this.ball = null;
    this.hoop = { x: this.w / 2, z: B.hoopZ, vx: 0 };
  }

  private nextHoop() {
    const rng = this.rng.fork(`hoop-${this.score}-${this.shots}`);
    this.hoop.z = this.score >= B.distanceFrom ? rng.range(B.hoopZ - 70, B.hoopZ + 110) : B.hoopZ;
    this.hoop.x = this.score >= B.distanceFrom ? rng.range(110, this.w - 110) : this.w / 2;
    this.hoop.vx = this.score >= B.moveFrom ? rng.range(40, 50 + this.score * 3) * (rng.chance(0.5) ? 1 : -1) : 0;
  }

  protected onPointerDown(p: PointerInfo) {
    if (this.ball) return;
    this.swipe = { x: p.x, y: p.y };
  }

  protected onPointerUp(p: PointerInfo) {
    const s = this.swipe;
    this.swipe = null;
    if (!s || this.ball) return;
    const dx = p.x - s.x;
    const dy = s.y - p.y;
    if (dy < 30) return; // must flick upward
    const len = Math.hypot(dx, dy);
    const T = B.flightTime;
    const depth = Math.max(B.minDepth, Math.min(B.maxDepth, len * B.depthPerPx));
    // Solve for the launch so the ball falls through rim height exactly at `depth` after T seconds.
    const vh = (B.hoopHeight - 20 + 0.5 * B.gravity * T * T) / T;
    const vx = ((dx / dy) * depth * B.aimFactor) / T;
    this.ball = { x: this.w / 2, z: 0, hgt: 20, vx, vz: depth / T, vh, scored: false, done: false };
    this.shots++;
    this.sound("whoosh", 0.9);
  }

  protected update(dt: number) {
    this.netWiggle = Math.max(0, this.netWiggle - dt * 2);
    if (this.hoop.vx) {
      this.hoop.x += this.hoop.vx * dt;
      if (this.hoop.x < 90 || this.hoop.x > this.w - 90) this.hoop.vx *= -1;
    }
    const b = this.ball;
    if (!b) return;
    if (b.done) {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) {
        this.ball = null;
        if (this.running) this.nextHoop();
      }
      return;
    }
    const prevZ = b.z;
    const prevH = b.hgt;
    b.vh -= B.gravity * dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.hgt += b.vh * dt;

    // Backboard just behind the rim: bounce back (bank shots are legal).
    const boardZ = this.hoop.z + 34;
    if (b.z >= boardZ && prevZ < boardZ && b.hgt > B.hoopHeight - 10 && b.hgt < B.hoopHeight + 150 && Math.abs(b.x - this.hoop.x) < 95) {
      b.z = boardZ - 1;
      b.vz = -Math.abs(b.vz) * 0.45;
      b.vx *= 0.6;
      this.sound("thud", 1.1);
    }
    // Falling through rim height: in or out depends on distance from the rim centre.
    if (!b.scored && prevH >= B.hoopHeight && b.hgt < B.hoopHeight && b.vh < 0 && Math.abs(b.z - this.hoop.z) < B.rimRadius * 2) {
      const off = Math.hypot(b.x - this.hoop.x, (b.z - this.hoop.z) * 1.4);
      if (off < B.rimRadius - B.ballRadius * 0.45) {
        b.scored = true;
        const swish = off < B.rimRadius * B.swishFraction;
        this.streak = swish ? this.streak + 1 : 0;
        const pts = swish ? 3 : 2;
        this.addScore(pts);
        this.stat("baskets");
        this.netWiggle = 1;
        const at = this.proj(this.hoop.x, this.hoop.z, B.hoopHeight);
        if (swish) {
          this.stat("perfects");
          this.statMax("maxCombo", this.streak);
          this.fx.text(at.x, at.y - 50, this.streak > 1 ? `SWISH ×${this.streak}` : "SWISH", { color: PALETTE.sun, size: 26 });
          this.fx.confetti(at.x, at.y, 26);
          this.sound("perfect");
        } else {
          this.fx.text(at.x, at.y - 46, `+${pts}`, { size: 24 });
          this.sound("coin");
        }
        this.ctx.haptics.success();
      } else if (off < B.rimRadius + B.ballRadius) {
        // Clanked the rim: deflect.
        b.vh = Math.abs(b.vh) * 0.35;
        b.vx += (b.x - this.hoop.x) * 4;
        this.sound("thud", 1.6);
        this.fx.shake(4);
      }
    }
    // Ball finished: hit the floor or left the court.
    if (b.hgt <= 0 || b.z < -60 || b.z > this.hoop.z + 400 || Math.abs(b.x - this.w / 2) > 600) {
      b.done = true;
      this.resetTimer = b.scored ? 0.35 : 0.6;
      if (!b.scored) {
        this.misses++;
        this.streak = 0;
        this.sound("miss");
        this.ctx.haptics.fail();
        if (this.misses >= B.misses && this.running) {
          this.juiceFail(this.w / 2, this.h * 0.6);
          this.finish({ reason: "SHOT CLOCK" });
        }
      }
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    // Court floor (perspective trapezoid)
    const a = this.proj(-200, 0, 0);
    const b = this.proj(this.w + 200, 0, 0);
    const c = this.proj(this.w + 200, 900, 0);
    const d = this.proj(-200, 900, 0);
    g.fillStyle = "rgba(255,170,90,0.22)";
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.fill();
    const key = this.proj(this.hoop.x, this.hoop.z - 120, 0);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(key.x, key.y, 120 * key.s, 40 * key.s, 0, 0, Math.PI * 2);
    g.stroke();

    const ball = this.ball;
    const rim = this.proj(this.hoop.x, this.hoop.z, B.hoopHeight);
    const board = this.proj(this.hoop.x, this.hoop.z + 34, B.hoopHeight + 70);
    // Pole + board
    const pole = this.proj(this.hoop.x, this.hoop.z + 60, 0);
    fillRoundRect(g, pole.x - 5 * pole.s, board.y, 10 * pole.s, pole.y - board.y, 3, "#2a2a33");
    fillRoundRect(g, board.x - 95 * board.s, board.y - 70 * board.s, 190 * board.s, 120 * board.s, 8, "#ffffff");
    g.strokeStyle = PALETTE.flare;
    g.lineWidth = 4 * board.s;
    g.strokeRect(board.x - 32 * board.s, board.y - 20 * board.s, 64 * board.s, 46 * board.s);

    const behind = ball && ball.z > this.hoop.z;
    if (ball && behind) this.drawBall(g, ball);
    // Back rim
    g.strokeStyle = PALETTE.ember;
    g.lineWidth = 6 * rim.s;
    g.beginPath();
    g.ellipse(rim.x, rim.y, B.rimRadius * rim.s * 1.05, 12 * rim.s, 0, Math.PI, Math.PI * 2);
    g.stroke();
    // Net
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 2;
    const wig = Math.sin(this.clock * 30) * 4 * this.netWiggle;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(rim.x + i * 13 * rim.s, rim.y);
      g.lineTo(rim.x + i * 8 * rim.s + wig, rim.y + 52 * rim.s);
      g.stroke();
    }
    if (ball && !behind) this.drawBall(g, ball);
    // Front rim
    g.strokeStyle = PALETTE.ember;
    g.lineWidth = 6 * rim.s;
    g.beginPath();
    g.ellipse(rim.x, rim.y, B.rimRadius * rim.s * 1.05, 12 * rim.s, 0, 0, Math.PI);
    g.stroke();

    if (!ball) {
      const p = this.proj(this.w / 2, 0, 20);
      circle(g, p.x, this.h - 110, B.ballRadius * 1.2, "rgba(0,0,0,0.25)");
      this.drawBallAt(g, p.x, p.y, B.ballRadius, 0);
      if (this.state !== "over") text(g, "SWIPE UP ↑", this.w / 2, this.h - 40, { font: this.font, size: 16, color: "rgba(255,255,255,0.8)" });
    }
  }

  private drawBall(g: CanvasRenderingContext2D, b: Ball) {
    const shadow = this.proj(b.x, b.z, 0);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(shadow.x, shadow.y, B.ballRadius * shadow.s, 7 * shadow.s, 0, 0, Math.PI * 2);
    g.fill();
    const p = this.proj(b.x, b.z, b.hgt);
    this.drawBallAt(g, p.x, p.y, B.ballRadius * p.s, b.z * 0.02);
  }

  private drawBallAt(g: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
    circle(g, x, y, r, "#ff8a1d");
    g.save();
    g.translate(x, y);
    g.rotate(spin);
    g.strokeStyle = "#0b0b0f";
    g.lineWidth = Math.max(1.5, r * 0.08);
    g.beginPath();
    g.moveTo(-r, 0);
    g.lineTo(r, 0);
    g.moveTo(0, -r);
    g.lineTo(0, r);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    googlyEyes(g, x, y - r * 0.15, r * 0.2, { gap: r * 0.32, lookY: -1 });
  }

  protected hud(): HudState {
    return { score: this.score, lives: B.misses - this.misses, maxLives: B.misses, combo: this.streak };
  }
}

const factory: GameFactory = (def) => new BasketFlick(def);
export default factory;
