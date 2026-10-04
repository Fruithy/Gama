/**
 * "Juice" layer shared by every canvas game: particles, floating score text,
 * screen shake, flashes and zoom pulses. All effects respect reduced motion
 * (shake/zoom disabled, fewer particles) and are capped to protect 60 fps.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  shape: "circle" | "square" | "spark";
  rot: number;
  vr: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  vy: number;
}

const MAX_PARTICLES = 260;
const MAX_TEXTS = 24;

export const PALETTE = {
  white: "#ffffff",
  ink: "#0b0b0f",
  volt: "#d4ff3a",
  flare: "#ff3d7f",
  ion: "#3dd8ff",
  sun: "#ffc23d",
  violet: "#8b5cff",
  mint: "#3dffb0",
  ember: "#ff6a3d",
};

const CONFETTI = [PALETTE.volt, PALETTE.flare, PALETTE.ion, PALETTE.sun, PALETTE.violet, PALETTE.mint];

export class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  shakeAmp = 0;
  flashAlpha = 0;
  flashColor = "#fff";
  zoom = 1;
  constructor(private reducedMotion: boolean) {}

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.shakeAmp = 0;
    this.flashAlpha = 0;
    this.zoom = 1;
  }

  burst(
    x: number,
    y: number,
    opts: { count?: number; color?: string | string[]; speed?: number; size?: number; gravity?: number; life?: number; shape?: Particle["shape"]; spread?: number; angle?: number } = {},
  ) {
    const count = Math.round((opts.count ?? 14) * (this.reducedMotion ? 0.4 : 1));
    const colors = Array.isArray(opts.color) ? opts.color : [opts.color ?? PALETTE.white];
    const speed = opts.speed ?? 220;
    const spread = opts.spread ?? Math.PI * 2;
    const base = opts.angle ?? -Math.PI / 2;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = base - spread / 2 + Math.random() * spread;
      const s = speed * (0.35 + Math.random() * 0.65);
      const life = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        size: (opts.size ?? 5) * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length],
        gravity: opts.gravity ?? 520,
        shape: opts.shape ?? "circle",
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  confetti(x: number, y: number, count = 40) {
    this.burst(x, y, { count, color: CONFETTI, speed: 420, size: 7, gravity: 600, life: 1.4, shape: "square" });
  }

  text(x: number, y: number, text: string, opts: { color?: string; size?: number; life?: number } = {}) {
    if (this.texts.length >= MAX_TEXTS) this.texts.shift();
    const life = opts.life ?? 0.8;
    this.texts.push({ x, y, text, color: opts.color ?? PALETTE.white, size: opts.size ?? 26, life, maxLife: life, vy: -70 });
  }

  shake(amount = 8) {
    if (this.reducedMotion) return;
    this.shakeAmp = Math.min(24, Math.max(this.shakeAmp, amount));
  }

  flash(color = "#fff", alpha = 0.35) {
    this.flashColor = color;
    this.flashAlpha = this.reducedMotion ? alpha * 0.4 : alpha;
  }

  pulse(amount = 0.04) {
    if (this.reducedMotion) return;
    this.zoom = Math.min(1.12, this.zoom + amount);
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 1 - 2.5 * dt;
    }
    this.shakeAmp *= Math.pow(0.0008, dt); // fast exponential decay
    if (this.shakeAmp < 0.2) this.shakeAmp = 0;
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);
    this.zoom += (1 - this.zoom) * Math.min(1, dt * 10);
  }

  /** Camera transform: call before drawing the world. */
  applyCamera(g: CanvasRenderingContext2D, w: number, h: number) {
    if (this.zoom !== 1) {
      g.translate(w / 2, h / 2);
      g.scale(this.zoom, this.zoom);
      g.translate(-w / 2, -h / 2);
    }
    if (this.shakeAmp > 0) {
      g.translate((Math.random() - 0.5) * this.shakeAmp * 2, (Math.random() - 0.5) * this.shakeAmp * 2);
    }
  }

  render(g: CanvasRenderingContext2D, font: string) {
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      g.globalAlpha = a;
      g.fillStyle = p.color;
      if (p.shape === "square") {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        g.restore();
      } else if (p.shape === "spark") {
        g.strokeStyle = p.color;
        g.lineWidth = Math.max(1, p.size * 0.4);
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.maxLife * 0.5));
      const pop = 1 + Math.max(0, (t.life - t.maxLife * 0.8) / (t.maxLife * 0.2)) * 0.35;
      g.globalAlpha = a;
      g.font = `900 ${Math.round(t.size * pop)}px ${font}`;
      g.lineWidth = 6;
      g.strokeStyle = "rgba(0,0,0,0.55)";
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
    g.globalAlpha = 1;
  }

  renderFlash(g: CanvasRenderingContext2D, w: number, h: number) {
    if (this.flashAlpha <= 0) return;
    g.globalAlpha = this.flashAlpha;
    g.fillStyle = this.flashColor;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
  }
}
