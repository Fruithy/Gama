import { ERA_HUES, RIGS, type RigShape } from "./config";

/**
 * NEON RIG renderer — pure eye candy on a 2D canvas.
 *
 * Layers (back → front): nebula sky, swirling stars, hex rain, synthwave
 * floor, orbit paths, far satellites, the crystal hash core, near
 * satellites, hash streams, drones, the blockchain ribbon, comets, bursts
 * and floating text.
 *
 * Glows are pre-rendered radial sprites drawn with additive blending, so a
 * frame costs a few hundred drawImage calls and no shadowBlur.
 */

export interface SceneFocus {
  /** Core centre and radius (CSS px). */
  x: number;
  y: number;
  r: number;
  /** Baseline of the blockchain ribbon. */
  chainY: number;
  /** Vertical band comets fly through. */
  skyTop: number;
  skyBottom: number;
}

export interface SceneFrame {
  era: number;
  income: number;
  blockProgress: number;
  height: number;
  rigs: readonly number[];
  /** Remaining bull-run fraction (0 = none). */
  bull: number;
  drones: number;
  comet: { id: number; age: number; life: number; seed: number } | null;
}

type RGB = [number, number, number];

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function hexRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslRgb(h: number, s: number, l: number): RGB {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h.toFixed(1)},${s}%,${l}%,${a})`;

/* ───────────────────────── icosahedron ───────────────────────── */

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V: [number, number, number][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l] as [number, number, number];
});
const ICO_E: [number, number][] = [];
for (let i = 0; i < 12; i++)
  for (let j = i + 1; j < 12; j++) {
    const [a, b] = [ICO_V[i], ICO_V[j]];
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1.1) ICO_E.push([i, j]);
  }
const ICO_F: [number, number, number][] = [];
const adj = (a: number, b: number) => ICO_E.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
for (let i = 0; i < 12; i++)
  for (let j = i + 1; j < 12; j++)
    for (let k = j + 1; k < 12; k++) if (adj(i, j) && adj(j, k) && adj(i, k)) ICO_F.push([i, j, k]);

/* ───────────────────────── entities ───────────────────────── */

interface Star { d: number; a: number; size: number; phase: number; speed: number; warm: boolean }
interface Stream { x0: number; y0: number; cx: number; cy: number; t: number; dur: number; color: RGB; size: number; bright: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: RGB; drag: number; gravity: number; diamond: boolean; rot: number }
interface Ring { x: number; y: number; r: number; vr: number; life: number; max: number; color: RGB; width: number }
interface FloatText { x: number; y: number; text: string; color: string; size: number; life: number; max: number }
interface Zap { from: [number, number]; life: number }
interface HexLine { x: number; y: number; speed: number; text: string; alpha: number }
interface Streak { x: number; y: number; len: number; speed: number; life: number }

const MAX_SPARKS = 320;
const MAX_STREAMS = 140;

function randomHex(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789abcdef"[(Math.random() * 16) | 0];
  return s;
}

export class MineScene {
  private g: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private t = 0;
  private font = "system-ui, sans-serif";
  private mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

  private focus: SceneFocus = { x: 200, y: 300, r: 60, chainY: 500, skyTop: 80, skyBottom: 400 };
  private target: SceneFocus | null = null;

  private hue = ERA_HUES[0] as number;
  private sprites = new Map<string, HTMLCanvasElement>();
  private vignette: HTMLCanvasElement | null = null;

  private stars: Star[] = [];
  private streams: Stream[] = [];
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private texts: FloatText[] = [];
  private zaps: Zap[] = [];
  private hexes: HexLine[] = [];
  private streaks: Streak[] = [];
  private sats: { x: number; y: number; color: RGB; rig: number }[] = [];
  private satPos: { x: number; y: number; z: number; rig: number; angle: number }[] = [];
  private drones: [number, number][] = [];
  private orbitFlash: number[] = RIGS.map(() => 0);
  private rigRgb: RGB[] = RIGS.map((r) => hexRgb(r.color));

  private pulse = 0;
  private energy = 0;
  private flash = 0;
  private flashColor: RGB = [255, 255, 255];
  private beam = 0;
  private chainOffset = 0;
  private chainSolid = 0;
  private streamClock = 0;
  private streakClock = 0;
  private gridScroll = 0;
  private spin = 0;
  private cometTrail: [number, number][] = [];
  private cometId = -1;
  private cometPos: [number, number] | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private reducedMotion = false,
  ) {
    const g = canvas.getContext("2d", { alpha: false });
    if (!g) throw new Error("Canvas 2D unavailable");
    this.g = g;
    const css = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    if (css) this.font = `${css}, system-ui, sans-serif`;
    for (let i = 0; i < 230; i++) {
      this.stars.push({
        d: Math.pow(Math.random(), 0.7),
        a: Math.random() * TAU,
        size: Math.random() < 0.08 ? 1.8 + Math.random() * 1.4 : 0.6 + Math.random() * 1.1,
        phase: Math.random() * TAU,
        speed: 0.6 + Math.random() * 2.4,
        warm: Math.random() < 0.25,
      });
    }
    for (let i = 0; i < 16; i++) this.hexes.push(this.newHex(true));
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    // Keep giant screens under ~5 MP of backing store.
    while (dpr > 1 && this.w * this.h * dpr * dpr > 5e6) dpr -= 0.25;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.vignette = null;
  }

  /** Current core centre (CSS px). */
  get core() {
    return { x: this.focus.x, y: this.focus.y };
  }

  setFocus(f: SceneFocus, instant = false) {
    if (instant) {
      this.focus = { ...f };
      this.target = null;
    } else this.target = { ...f };
  }

  /* ───────────── sprites ───────────── */

  private sprite(c: RGB, hot = false): HTMLCanvasElement {
    const key = `${c[0] | 0},${c[1] | 0},${c[2] | 0},${hot ? 1 : 0}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const size = 96;
    s = document.createElement("canvas");
    s.width = s.height = size;
    const g = s.getContext("2d")!;
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    if (hot) {
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.12, rgba(c, 0.95));
      grd.addColorStop(0.4, rgba(c, 0.32));
      grd.addColorStop(0.7, rgba(c, 0.08));
    } else {
      grd.addColorStop(0, rgba(c, 1));
      grd.addColorStop(0.25, rgba(c, 0.5));
      grd.addColorStop(0.6, rgba(c, 0.12));
    }
    grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    if (this.sprites.size > 160) this.sprites.clear();
    this.sprites.set(key, s);
    return s;
  }

  private hueRgb(h: number, s = 1, l = 0.6): RGB {
    return hslRgb(Math.round(h / 4) * 4, s, l);
  }

  private glow(c: RGB, x: number, y: number, size: number, alpha = 1, hot = false) {
    if (size <= 0.5 || alpha <= 0.01) return;
    const g = this.g;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(this.sprite(c, hot), x - size / 2, y - size / 2, size, size);
  }

  /* ───────────── events from the game ───────────── */

  tapAt(x: number, y: number, label: string) {
    const c = this.hueRgb(this.hue + 50, 1, 0.65);
    this.burst(x, y, 7, [c, [255, 255, 255]], 160, 0.5, true);
    this.text(x + (Math.random() - 0.5) * 34, y - 18 - Math.random() * 14, label, "#ffffff", 20);
    this.stream(x, y, [255, 255, 255], true);
    this.pulse = Math.min(0.32, this.pulse + 0.05);
  }

  autoTap(label: string) {
    const d = this.drones[(Math.random() * this.drones.length) | 0];
    if (!d) return;
    this.zaps.push({ from: [d[0], d[1]], life: 0.18 });
    this.pulse = Math.min(0.3, this.pulse + 0.025);
    if (Math.random() < 0.35) this.text(d[0], d[1] - 10, label, "rgba(180,240,255,0.9)", 13);
  }

  blockFound(height: number, label: string) {
    const f = this.focus;
    const c = this.hueRgb(this.hue + 40, 1, 0.65);
    this.rings.push({ x: f.x, y: f.y, r: f.r * 0.9, vr: f.r * 5, life: 0.9, max: 0.9, color: c, width: 4 });
    this.rings.push({ x: f.x, y: f.y, r: f.r * 0.6, vr: f.r * 3, life: 1.2, max: 1.2, color: [255, 255, 255], width: 2 });
    this.burst(f.x, f.y, 26, [c, this.hueRgb(this.hue - 40, 1, 0.7), [255, 255, 255]], 340, 1, false);
    this.pulse = 0.4;
    this.beam = 1;
    this.flash = Math.max(this.flash, 0.1);
    this.flashColor = c;
    this.text(f.x, f.y - f.r * 1.9, `BLOCK #${height.toLocaleString("en-US")}`, hsla(this.hue + 40, 100, 78, 1), 15);
    this.text(f.x, f.y - f.r * 1.9 + 22, label, "#ffffff", 22);
    this.chainOffset = 1;
    this.chainSolid = 1;
  }

  rigBought(index: number) {
    this.orbitFlash[index] = 1;
    const sat = this.sats.filter((s) => s.rig === index).at(-1);
    const f = this.focus;
    const [x, y] = sat ? [sat.x, sat.y] : [f.x, f.y];
    this.burst(x, y, 16, [this.rigRgb[index], [255, 255, 255]], 220, 0.7, true);
    this.rings.push({ x, y, r: 4, vr: 90, life: 0.5, max: 0.5, color: this.rigRgb[index], width: 2 });
  }

  upgradeBought(color: string) {
    const f = this.focus;
    const c = hexRgb(color);
    this.rings.push({ x: f.x, y: f.y, r: f.r * 1.2, vr: f.r * 2.4, life: 0.8, max: 0.8, color: c, width: 3 });
    this.burst(f.x, f.y, 20, [c, [255, 255, 255]], 260, 0.9, true);
    this.pulse = Math.min(0.4, this.pulse + 0.15);
  }

  /** True if (x, y) hits the comet currently on screen. */
  cometHit(x: number, y: number): boolean {
    if (!this.cometPos) return false;
    return Math.hypot(x - this.cometPos[0], y - this.cometPos[1]) < Math.max(44, this.focus.r * 0.7);
  }

  cometCaught(kind: "whale" | "bull", label: string) {
    const [x, y] = this.cometPos ?? [this.focus.x, this.focus.y];
    const gold: RGB = [255, 204, 77];
    this.burst(x, y, 44, [gold, [255, 255, 255], [255, 140, 60]], 420, 1.3, true);
    this.rings.push({ x, y, r: 10, vr: 320, life: 0.8, max: 0.8, color: gold, width: 5 });
    this.flash = 0.22;
    this.flashColor = gold;
    this.text(x, y - 26, kind === "bull" ? "BULL RUN!" : "WHALE DROP!", "#ffd24d", 22);
    this.text(x, y + 2, label, "#ffffff", 18);
    this.cometPos = null;
    this.cometTrail = [];
  }

  forked() {
    const f = this.focus;
    this.flash = 0.8;
    this.flashColor = [255, 255, 255];
    for (let i = 0; i < 3; i++) this.rings.push({ x: f.x, y: f.y, r: f.r * (0.5 + i * 0.4), vr: f.r * (6 + i * 2), life: 1.4, max: 1.4, color: [255, 255, 255], width: 4 - i });
    this.burst(f.x, f.y, 60, [[255, 255, 255], this.hueRgb(this.hue, 1, 0.7)], 520, 1.6, false);
  }

  /* ───────────── particles ───────────── */

  private burst(x: number, y: number, count: number, colors: RGB[], speed: number, life: number, diamond: boolean) {
    const n = Math.round(count * (this.reducedMotion ? 0.4 : 1));
    for (let i = 0; i < n; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.7);
      const l = life * (0.6 + Math.random() * 0.6);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: l,
        max: l,
        size: diamond ? 3 + Math.random() * 3 : 2 + Math.random() * 3,
        color: colors[i % colors.length],
        drag: 2.2,
        gravity: diamond ? 120 : 0,
        diamond,
        rot: Math.random() * TAU,
      });
    }
  }

  private text(x: number, y: number, text: string, color: string, size: number) {
    if (this.texts.length > 26) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life: 1.1, max: 1.1 });
  }

  private stream(x: number, y: number, color: RGB, bright: boolean) {
    if (this.streams.length >= MAX_STREAMS) this.streams.shift();
    const f = this.focus;
    const mx = (x + f.x) / 2;
    const my = (y + f.y) / 2;
    const dx = f.x - x;
    const dy = f.y - y;
    const bend = (Math.random() - 0.5) * 0.9;
    this.streams.push({
      x0: x,
      y0: y,
      cx: mx - dy * bend,
      cy: my + dx * bend,
      t: 0,
      dur: 0.55 + Math.random() * 0.6,
      color,
      size: bright ? 14 : 7 + Math.random() * 5,
      bright,
    });
  }

  private newHex(scatter: boolean): HexLine {
    return {
      x: Math.random() * this.w,
      y: scatter ? Math.random() * this.h : this.h + 20,
      speed: 8 + Math.random() * 18,
      text: (Math.random() < 0.3 ? "0000" : "") + randomHex(8 + ((Math.random() * 10) | 0)),
      alpha: 0.035 + Math.random() * 0.06,
    };
  }

  /* ───────────── frame ───────────── */

  frame(dt: number, s: SceneFrame) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const g = this.g;
    if (this.target) {
      const k = 1 - Math.exp(-dt * 7);
      const f = this.focus;
      const tg = this.target;
      f.x = lerp(f.x, tg.x, k);
      f.y = lerp(f.y, tg.y, k);
      f.r = lerp(f.r, tg.r, k);
      f.chainY = lerp(f.chainY, tg.chainY, k);
      f.skyTop = lerp(f.skyTop, tg.skyTop, k);
      f.skyBottom = lerp(f.skyBottom, tg.skyBottom, k);
      if (Math.abs(f.x - tg.x) + Math.abs(f.y - tg.y) + Math.abs(f.r - tg.r) + Math.abs(f.chainY - tg.chainY) < 0.3) this.target = null;
    }
    // Era hue eases toward its target; bull runs pull everything to gold.
    const eraHue = ERA_HUES[s.era % ERA_HUES.length];
    let dh = ((eraHue - this.hue + 540) % 360) - 180;
    this.hue = (this.hue + dh * Math.min(1, dt * 1.5) + 360) % 360;
    const bull = clamp(s.bull > 0 ? 0.35 + s.bull * 0.65 : 0, 0, 1);
    dh = ((45 - this.hue + 540) % 360) - 180;
    const hue = (this.hue + dh * bull * 0.85 + 360) % 360;

    this.pulse *= Math.exp(-dt * 4);
    this.energy *= Math.exp(-dt * 3);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.beam = Math.max(0, this.beam - dt * 1.8);
    this.chainOffset *= Math.exp(-dt * 6);
    this.chainSolid = Math.max(0, this.chainSolid - dt * 1.5);
    for (let i = 0; i < this.orbitFlash.length; i++) this.orbitFlash[i] = Math.max(0, this.orbitFlash[i] - dt * 1.4);
    const spinRate = this.reducedMotion ? 0.4 : 1;
    this.spin += dt * spinRate * (1 + bull * 1.5 + this.pulse * 3);

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;

    this.drawSky(hue, bull);
    g.globalCompositeOperation = "lighter";
    this.drawStars(hue);
    this.drawHexRain(dt, hue);
    this.drawGrid(dt, hue, bull);
    if (bull > 0) this.drawStreaks(dt, bull);
    else this.streaks.length = 0;

    this.layoutSatellites(s);
    this.drawOrbits(s, false);
    this.drawSatellites(false);
    this.drawCore(s, hue);
    this.drawOrbits(s, true);
    this.drawSatellites(true);
    this.updateStreams(dt, s);
    this.drawDrones(dt, s);
    this.drawChain(s, hue);
    this.drawComet(dt, s);
    this.drawSparks(dt);

    g.globalCompositeOperation = "source-over";
    this.drawVignette(bull);
    this.drawTexts(dt);
    if (this.flash > 0) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = this.flash * 0.5;
      g.fillStyle = rgba(this.flashColor, 1);
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
  }

  private drawSky(hue: number, bull: number) {
    const { g, w, h } = this;
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, hsla(hue + 10, 70, 5 + bull * 2, 1));
    sky.addColorStop(0.55, hsla(hue + 35, 65, 9 + bull * 3, 1));
    sky.addColorStop(1, hsla(hue + 70, 75, 7, 1));
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    // Nebula clouds drifting around the core.
    g.globalCompositeOperation = "lighter";
    const f = this.focus;
    const big = Math.max(w, h);
    const t = this.t * 0.05;
    const clouds: [number, number, number, number, number][] = [
      [f.x + Math.cos(t) * w * 0.3, f.y + Math.sin(t * 1.3) * h * 0.15, big * 0.9, hue, 0.2],
      [f.x + Math.cos(t * 0.7 + 2) * w * 0.4, f.y + Math.sin(t * 0.9 + 1) * h * 0.25, big * 0.75, hue + 60, 0.16],
      [f.x + Math.cos(t * 0.5 + 4) * w * 0.35, h * 0.85 + Math.sin(t) * h * 0.08, big * 0.8, hue - 50, 0.14],
      [w * 0.15 + Math.sin(t * 0.8) * w * 0.1, h * 0.1, big * 0.55, hue + 120, 0.1],
    ];
    for (const [x, y, size, ch, a] of clouds) this.glow(this.hueRgb(ch, 0.9, 0.42), x, y, size, a);
    // Soft halo behind the core.
    this.glow(this.hueRgb(hue + 20, 1, 0.5), f.x, f.y, f.r * 9, 0.22 + this.pulse * 0.3);
    g.globalCompositeOperation = "source-over";
  }

  private drawStars(hue: number) {
    const { g, w, h } = this;
    const f = this.focus;
    const reach = Math.hypot(Math.max(f.x, w - f.x), Math.max(f.y, h - f.y)) * 1.05;
    const rot = this.t * 0.012;
    const cool = this.hueRgb(hue + 30, 0.6, 0.85);
    const warm: RGB = [255, 214, 170];
    for (const st of this.stars) {
      const a = st.a + rot * (1.4 - st.d);
      const x = f.x + Math.cos(a) * st.d * reach;
      const y = f.y + Math.sin(a) * st.d * reach * 0.8;
      if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
      const tw = 0.45 + 0.55 * Math.sin(this.t * st.speed + st.phase);
      const c = st.warm ? warm : cool;
      if (st.size > 1.7) {
        this.glow(c, x, y, st.size * 7, 0.35 * tw);
        g.globalAlpha = 0.9 * tw;
      } else g.globalAlpha = 0.25 + 0.6 * tw;
      g.fillStyle = rgba(c, 1);
      g.fillRect(x - st.size / 2, y - st.size / 2, st.size, st.size);
    }
  }

  private drawHexRain(dt: number, hue: number) {
    const g = this.g;
    g.font = `500 10px ${this.mono}`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = hsla(hue + 40, 90, 75, 1);
    for (let i = 0; i < this.hexes.length; i++) {
      const hx = this.hexes[i];
      hx.y -= hx.speed * dt;
      if (hx.y < -20) this.hexes[i] = this.newHex(false);
      g.globalAlpha = hx.alpha;
      g.fillText(hx.text, hx.x, hx.y);
    }
  }

  private horizonY() {
    const f = this.focus;
    return clamp(f.chainY + 34, this.h * 0.5, this.h - 20);
  }

  private drawGrid(dt: number, hue: number, bull: number) {
    const { g, w, h } = this;
    const hy = this.horizonY();
    if (hy >= h - 4) return;
    this.gridScroll = (this.gridScroll + dt * (0.35 + bull * 1.2)) % 1;
    const vx = this.focus.x;
    const depth = h - hy;
    // Floor wash.
    g.globalCompositeOperation = "source-over";
    const floor = g.createLinearGradient(0, hy, 0, h);
    floor.addColorStop(0, hsla(hue + 50, 90, 30, 0.35));
    floor.addColorStop(1, hsla(hue + 70, 80, 6, 0.0));
    g.globalAlpha = 1;
    g.fillStyle = floor;
    g.fillRect(0, hy, w, depth);
    g.globalCompositeOperation = "lighter";

    const line = hsla(hue + 60, 100, 65, 1);
    g.strokeStyle = line;
    g.lineWidth = 1;
    const spread = w / 7;
    const n = Math.ceil(w / spread) + 6;
    g.beginPath();
    for (let k = -n; k <= n; k++) {
      g.moveTo(vx + k * spread * 0.05, hy);
      g.lineTo(vx + k * spread * 1.6, h + 40);
    }
    g.globalAlpha = 0.18;
    g.stroke();
    for (let j = 0; j < 14; j++) {
      const z = (j + this.gridScroll) / 14;
      const y = hy + depth * z * z;
      g.globalAlpha = 0.06 + z * 0.32;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    // Horizon glow line.
    g.globalAlpha = 0.5;
    g.drawImage(this.sprite(this.hueRgb(hue + 60, 1, 0.6)), -w * 0.1, hy - 26, w * 1.2, 52);
    g.globalAlpha = 0.7;
    g.fillStyle = hsla(hue + 60, 100, 75, 1);
    g.fillRect(0, hy - 0.5, w, 1);
  }

  private drawStreaks(dt: number, bull: number) {
    const { g, w, h } = this;
    this.streakClock += dt * (this.reducedMotion ? 6 : 18) * bull;
    while (this.streakClock > 1) {
      this.streakClock -= 1;
      this.streaks.push({ x: Math.random() * w, y: h + 20, len: 30 + Math.random() * 80, speed: 300 + Math.random() * 500, life: 2 });
    }
    g.lineWidth = 2;
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.y -= s.speed * dt;
      s.life -= dt;
      if (s.y + s.len < 0 || s.life <= 0) {
        this.streaks.splice(i, 1);
        continue;
      }
      const grd = g.createLinearGradient(s.x, s.y, s.x, s.y + s.len);
      grd.addColorStop(0, "rgba(255,230,140,0.9)");
      grd.addColorStop(1, "rgba(255,170,40,0)");
      g.globalAlpha = 0.5 * bull;
      g.strokeStyle = grd;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x, s.y + s.len);
      g.stroke();
    }
  }

  /* ───────────── orbits ───────────── */

  private orbit(i: number) {
    const r = this.focus.r;
    return {
      R: r * (1.6 + 1.9 * Math.sqrt(i / (RIGS.length - 1))),
      squash: 0.26 + (i % 3) * 0.06,
      tilt: [-0.22, 0.16, -0.06, 0.28, -0.32, 0.08, -0.16, 0.24, -0.1, 0.34, -0.26][i] ?? 0,
      speed: (0.32 / (1 + i * 0.16)) * (i % 2 ? -1 : 1),
    };
  }

  private layoutSatellites(s: SceneFrame) {
    this.sats.length = 0;
    this.satPos.length = 0;
    const f = this.focus;
    for (let i = 0; i < RIGS.length; i++) {
      const owned = s.rigs[i] ?? 0;
      if (owned <= 0) continue;
      const o = this.orbit(i);
      // Representative, not literal: a dozen GPUs read better than sixty.
      const n = Math.min(owned, 9, Math.ceil(Math.sqrt(owned) * 1.2));
      const base = this.t * o.speed + i * 1.7;
      const cos = Math.cos(o.tilt);
      const sin = Math.sin(o.tilt);
      for (let k = 0; k < n; k++) {
        const a = base + (k * TAU) / n;
        const lx = Math.cos(a) * o.R;
        const ly = Math.sin(a) * o.R * o.squash;
        const z = Math.sin(a);
        const x = f.x + lx * cos - ly * sin;
        const y = f.y + lx * sin + ly * cos;
        this.satPos.push({ x, y, z, rig: i, angle: a });
        this.sats.push({ x, y, color: this.rigRgb[i], rig: i });
      }
    }
  }

  private drawOrbits(s: SceneFrame, front: boolean) {
    const g = this.g;
    const f = this.focus;
    g.lineWidth = 1;
    for (let i = 0; i < RIGS.length; i++) {
      const fl = this.orbitFlash[i];
      if ((s.rigs[i] ?? 0) <= 0) continue;
      const o = this.orbit(i);
      g.strokeStyle = rgba(this.rigRgb[i], 1);
      g.globalAlpha = (front ? 0.22 : 0.08) + fl * 0.6;
      g.beginPath();
      if (front) g.ellipse(f.x, f.y, o.R, o.R * o.squash, o.tilt, 0, Math.PI);
      else g.ellipse(f.x, f.y, o.R, o.R * o.squash, o.tilt, Math.PI, TAU);
      g.stroke();
    }
  }

  private drawSatellites(front: boolean) {
    const g = this.g;
    for (const p of this.satPos) {
      if (front !== p.z >= 0) continue;
      const rig = RIGS[p.rig];
      const c = this.rigRgb[p.rig];
      const depth = 0.72 + 0.28 * (p.z + 1) * 0.5 + (front ? 0.12 : 0);
      const size = (2.8 + p.rig * 0.38) * depth * (this.focus.r / 60) ** 0.5;
      const alpha = front ? 1 : 0.55;
      this.glow(c, p.x, p.y, size * 7, 0.55 * alpha);
      g.globalAlpha = alpha;
      g.fillStyle = rgba(c, 1);
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 1;
      this.shape(rig.shape, p.x, p.y, size, p.angle * 2 + this.t);
    }
  }

  private shape(kind: RigShape, x: number, y: number, s: number, rot: number) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    const poly = (n: number, r: number, off = 0) => {
      for (let i = 0; i < n; i++) {
        const a = off + (i * TAU) / n;
        if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
    };
    switch (kind) {
      case "square":
        g.rect(-s, -s, s * 2, s * 2);
        break;
      case "diamond":
        poly(4, s * 1.3);
        break;
      case "hex":
        poly(6, s * 1.15);
        break;
      case "tri":
        poly(3, s * 1.35, -Math.PI / 2);
        break;
      case "ring":
        g.arc(0, 0, s * 1.1, 0, TAU);
        g.fill();
        g.stroke();
        g.beginPath();
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.arc(0, 0, s * 0.45, 0, TAU);
        break;
      case "star":
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? s * 0.55 : s * 1.45;
          const a = (i * TAU) / 10;
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        break;
      case "cross":
        g.rect(-s * 1.4, -s * 0.4, s * 2.8, s * 0.8);
        g.rect(-s * 0.4, -s * 0.9, s * 0.8, s * 1.8);
        break;
      case "orb":
        g.arc(0, 0, s * 1.15, 0, TAU);
        break;
    }
    g.fill();
    if (kind !== "ring") g.stroke();
    g.restore();
  }

  /* ───────────── core ───────────── */

  private drawCore(s: SceneFrame, hue: number) {
    const g = this.g;
    const f = this.focus;
    const r = f.r * (1 + this.pulse * 0.22);
    const main = this.hueRgb(hue + 20, 1, 0.62);
    const accent = this.hueRgb(hue + 60, 1, 0.7);
    const deep = this.hueRgb(hue - 30, 1, 0.55);

    this.glow(main, f.x, f.y, r * 5.2, 0.55 + this.pulse * 0.6 + this.energy * 0.2, true);

    // Progress ring + ticks.
    const ringR = f.r * 1.34;
    g.lineWidth = 2;
    g.globalAlpha = 0.16;
    g.strokeStyle = rgba(accent, 1);
    g.beginPath();
    g.arc(f.x, f.y, ringR, 0, TAU);
    g.stroke();
    const p = clamp(s.blockProgress, 0, 1);
    const start = -Math.PI / 2;
    g.globalAlpha = 0.95;
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.arc(f.x, f.y, ringR, start, start + TAU * p);
    g.stroke();
    g.lineCap = "butt";
    const hx = f.x + Math.cos(start + TAU * p) * ringR;
    const hy = f.y + Math.sin(start + TAU * p) * ringR;
    this.glow(accent, hx, hy, 26, 0.9, true);

    g.globalAlpha = 0.35;
    g.lineWidth = 1;
    g.beginPath();
    const tickR = f.r * 1.5;
    const off = -this.spin * 0.15;
    for (let i = 0; i < 72; i++) {
      const a = off + (i * TAU) / 72;
      const len = i % 6 === 0 ? 7 : 3;
      g.moveTo(f.x + Math.cos(a) * tickR, f.y + Math.sin(a) * tickR);
      g.lineTo(f.x + Math.cos(a) * (tickR + len), f.y + Math.sin(a) * (tickR + len));
    }
    g.stroke();

    // Dashed gyroscope rings.
    g.setLineDash([4, 7]);
    for (let i = 0; i < 2; i++) {
      g.globalAlpha = 0.35;
      g.strokeStyle = rgba(i ? deep : accent, 1);
      g.beginPath();
      g.ellipse(f.x, f.y, r * 1.12, r * (0.3 + 0.12 * Math.sin(this.spin * 0.6 + i)), this.spin * (i ? -0.35 : 0.27) + i, 0, TAU);
      g.stroke();
    }
    g.setLineDash([]);

    // Crystal.
    this.drawIco(f.x, f.y, r * 0.95, this.spin * 0.42, this.spin * 0.27, hue, 1);
    this.drawIco(f.x, f.y, r * 0.42, -this.spin * 0.8, this.spin * 0.55, hue + 50, 0.9);
    this.glow([255, 255, 255], f.x, f.y, r * (0.9 + this.energy * 0.6 + this.pulse), 0.55 + this.energy * 0.3, true);
    this.glow(accent, f.x, f.y, r * 1.8, 0.35, true);
  }

  private drawIco(cx: number, cy: number, r: number, ay: number, ax: number, hue: number, alpha: number) {
    const g = this.g;
    const cyA = Math.cos(ay);
    const syA = Math.sin(ay);
    const cxA = Math.cos(ax);
    const sxA = Math.sin(ax);
    const pts: [number, number, number][] = ICO_V.map(([x, y, z]) => {
      const x1 = x * cyA + z * syA;
      const z1 = -x * syA + z * cyA;
      const y2 = y * cxA - z1 * sxA;
      const z2 = y * sxA + z1 * cxA;
      const persp = 3.4 / (3.4 - z2);
      return [cx + x1 * r * persp, cy + y2 * r * persp, z2];
    });
    // Faces (additive glass).
    for (const [a, b, c] of ICO_F) {
      const z = (pts[a][2] + pts[b][2] + pts[c][2]) / 3;
      g.globalAlpha = (z > 0 ? 0.06 + z * 0.14 : 0.025) * alpha;
      g.fillStyle = hsla(hue + z * 40, 100, 60, 1);
      g.beginPath();
      g.moveTo(pts[a][0], pts[a][1]);
      g.lineTo(pts[b][0], pts[b][1]);
      g.lineTo(pts[c][0], pts[c][1]);
      g.closePath();
      g.fill();
    }
    // Edges.
    g.lineWidth = 1.4;
    for (const [a, b] of ICO_E) {
      const z = (pts[a][2] + pts[b][2]) / 2;
      g.globalAlpha = (0.25 + 0.75 * (z + 1) * 0.5) * alpha;
      g.strokeStyle = hsla(hue + 30 + z * 30, 100, 72 + z * 12, 1);
      g.beginPath();
      g.moveTo(pts[a][0], pts[a][1]);
      g.lineTo(pts[b][0], pts[b][1]);
      g.stroke();
    }
    const vc = this.hueRgb(hue + 40, 1, 0.8);
    for (const p of pts) if (p[2] > -0.2) this.glow(vc, p[0], p[1], 7 + p[2] * 6, (0.5 + p[2] * 0.5) * alpha, true);
  }

  /* ───────────── streams, drones ───────────── */

  private updateStreams(dt: number, s: SceneFrame) {
    const f = this.focus;
    if (this.sats.length > 0) {
      const rate = clamp(3 + Math.log10(s.income + 1) * 4.5, 3, 46) * (this.reducedMotion ? 0.35 : 1);
      this.streamClock += dt * rate;
      while (this.streamClock > 1) {
        this.streamClock -= 1;
        const sat = this.sats[(Math.random() * this.sats.length) | 0];
        this.stream(sat.x, sat.y, sat.color, false);
      }
    }
    const g = this.g;
    for (let i = this.streams.length - 1; i >= 0; i--) {
      const p = this.streams[i];
      p.t += dt / p.dur;
      if (p.t >= 1) {
        this.energy = Math.min(1, this.energy + (p.bright ? 0.12 : 0.03));
        this.streams.splice(i, 1);
        continue;
      }
      const e = p.t * p.t;
      const u = 1 - e;
      const x = u * u * p.x0 + 2 * u * e * p.cx + e * e * f.x;
      const y = u * u * p.y0 + 2 * u * e * p.cy + e * e * f.y;
      // Short comet tail.
      const e2 = Math.max(0, p.t - 0.08) ** 2;
      const u2 = 1 - e2;
      const tx = u2 * u2 * p.x0 + 2 * u2 * e2 * p.cx + e2 * e2 * f.x;
      const ty = u2 * u2 * p.y0 + 2 * u2 * e2 * p.cy + e2 * e2 * f.y;
      const a = Math.sin(p.t * Math.PI) * (p.bright ? 1 : 0.8);
      g.globalAlpha = a * 0.6;
      g.strokeStyle = rgba(p.color, 1);
      g.lineWidth = p.bright ? 2.4 : 1.4;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(x, y);
      g.stroke();
      this.glow(p.color, x, y, p.size, a, p.bright);
    }
  }

  private drawDrones(dt: number, s: SceneFrame) {
    const g = this.g;
    const f = this.focus;
    const n = s.drones > 0 ? Math.min(7, Math.ceil(s.drones)) : 0;
    this.drones.length = 0;
    for (let i = 0; i < n; i++) {
      const a = this.t * 1.4 + (i * TAU) / n;
      const x = f.x + Math.cos(a) * f.r * 1.95;
      const y = f.y + Math.sin(a) * f.r * 0.62 - f.r * 0.15;
      this.drones.push([x, y]);
      this.glow([140, 230, 255], x, y, 16, 0.8, true);
      g.globalAlpha = 0.9;
      g.fillStyle = "#dff8ff";
      g.fillRect(x - 3.5, y - 0.8, 7, 1.6);
    }
    g.lineWidth = 1.6;
    for (let i = this.zaps.length - 1; i >= 0; i--) {
      const z = this.zaps[i];
      z.life -= dt;
      if (z.life <= 0) {
        this.zaps.splice(i, 1);
        continue;
      }
      g.globalAlpha = z.life / 0.18;
      g.strokeStyle = "rgba(170,240,255,1)";
      g.beginPath();
      g.moveTo(z.from[0], z.from[1]);
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        g.lineTo(lerp(z.from[0], f.x, t) + (Math.random() - 0.5) * 10, lerp(z.from[1], f.y, t) + (Math.random() - 0.5) * 10);
      }
      g.lineTo(f.x, f.y);
      g.stroke();
    }
  }

  /* ───────────── blockchain ribbon ───────────── */

  private cube(x: number, y: number, s: number, hue: number, alpha: number, solid: number) {
    const g = this.g;
    const k = 0.87 * s;
    const faces: [number, [number, number][]][] = [
      [72, [[x, y - s], [x + k, y - s * 0.5], [x, y], [x - k, y - s * 0.5]]],
      [52, [[x - k, y - s * 0.5], [x, y], [x, y + s], [x - k, y + s * 0.5]]],
      [38, [[x, y], [x + k, y - s * 0.5], [x + k, y + s * 0.5], [x, y + s]]],
    ];
    for (const [l, pts] of faces) {
      g.globalAlpha = alpha;
      g.fillStyle = hsla(hue, 90, l + solid * 20, 1);
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.fill();
    }
    g.globalAlpha = alpha * 0.9;
    g.strokeStyle = hsla(hue + 20, 100, 85, 1);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + k, y - s * 0.5);
    g.lineTo(x + k, y + s * 0.5);
    g.lineTo(x, y + s);
    g.lineTo(x - k, y + s * 0.5);
    g.lineTo(x - k, y - s * 0.5);
    g.closePath();
    g.moveTo(x, y);
    g.lineTo(x, y + s);
    g.moveTo(x, y);
    g.lineTo(x - k, y - s * 0.5);
    g.moveTo(x, y);
    g.lineTo(x + k, y - s * 0.5);
    g.stroke();
  }

  private drawChain(s: SceneFrame, hue: number) {
    const g = this.g;
    const f = this.focus;
    const size = clamp(f.r * 0.2, 9, 15);
    const sp = size * 3.4;
    const y = f.chainY;
    const cx = f.x;
    const shift = this.chainOffset * sp;
    const ch = hue + 40;

    // Beam from the core to the freshly sealed block.
    if (this.beam > 0) {
      const top = f.y + f.r * 1.4;
      const bottom = y - size;
      if (bottom > top) {
        const grd = g.createLinearGradient(0, top, 0, bottom);
        grd.addColorStop(0, hsla(ch, 100, 80, 0));
        grd.addColorStop(1, hsla(ch, 100, 80, 1));
        g.globalAlpha = this.beam;
        g.strokeStyle = grd;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx, top);
        g.lineTo(cx, bottom);
        g.stroke();
        g.globalAlpha = this.beam * 0.5;
        g.drawImage(this.sprite(this.hueRgb(ch, 1, 0.65)), cx - 18, top, 36, bottom - top);
      }
    }

    // Links + travelling data packets.
    const count = Math.min(Math.ceil(cx / sp) + 2, s.height);
    g.lineWidth = 1.5;
    for (let k = 0; k < count; k++) {
      const x = cx - sp * k + shift;
      const x2 = x - sp;
      g.globalAlpha = 0.45;
      g.strokeStyle = hsla(ch, 100, 70, 1);
      g.beginPath();
      g.moveTo(x - size * 0.9, y);
      g.lineTo(x2 + size * 0.9, y);
      g.stroke();
      const u = (this.t * 0.7 + k * 0.37) % 1;
      this.glow(this.hueRgb(ch, 1, 0.75), lerp(x - size * 0.9, x2 + size * 0.9, u), y, 9, 0.8, true);
    }
    // Sealed blocks.
    for (let k = 1; k <= count; k++) {
      const x = cx - sp * k + shift;
      if (x < -sp) break;
      const fade = clamp(1 - (k - 1) / Math.max(4, cx / sp + 1), 0.25, 1);
      const solid = k === 1 ? this.chainSolid : 0;
      this.cube(x, y, size, ch, fade, solid);
      if (k === 1) {
        this.glow(this.hueRgb(ch, 1, 0.6), x, y, size * 6, 0.25 + solid * 0.6);
      }
    }
    // Pending block, filling with hashes.
    const px = cx + shift;
    const p = clamp(s.blockProgress, 0, 1);
    g.save();
    g.beginPath();
    g.rect(px - size * 2, y + size - size * 2 * p, size * 4, size * 2 * p + 1);
    g.clip();
    this.cube(px, y, size, ch, 0.85, 0.2);
    g.restore();
    g.globalAlpha = 0.5;
    g.setLineDash([3, 3]);
    g.strokeStyle = hsla(ch, 100, 80, 1);
    g.lineWidth = 1;
    const k = 0.87 * size;
    g.beginPath();
    g.moveTo(px, y - size);
    g.lineTo(px + k, y - size * 0.5);
    g.lineTo(px + k, y + size * 0.5);
    g.lineTo(px, y + size);
    g.lineTo(px - k, y + size * 0.5);
    g.lineTo(px - k, y - size * 0.5);
    g.closePath();
    g.stroke();
    g.setLineDash([]);
    this.glow(this.hueRgb(ch, 1, 0.7), px, y, size * 5, 0.2 + p * 0.35);

    // Height label under the newest block.
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.75;
    g.font = `600 10px ${this.mono}`;
    g.textAlign = "center";
    g.textBaseline = "top";
    g.fillStyle = hsla(ch, 100, 85, 1);
    g.fillText(`#${(s.height + 1).toLocaleString("en-US")}`, px, y + size + 6);
    g.globalCompositeOperation = "lighter";
  }

  /* ───────────── comet ───────────── */

  private drawComet(dt: number, s: SceneFrame) {
    const c = s.comet;
    if (!c) {
      this.cometPos = null;
      this.cometTrail.length = 0;
      this.cometId = -1;
      return;
    }
    if (c.id !== this.cometId) {
      this.cometId = c.id;
      this.cometTrail.length = 0;
    }
    const f = this.focus;
    const u = clamp(c.age / c.life, 0, 1);
    const ltr = c.seed < 0.5;
    const top = Math.min(f.skyTop, f.skyBottom - 40);
    const band = Math.max(40, f.skyBottom - top);
    const yBase = top + band * (0.25 + ((c.seed * 7.3) % 1) * 0.5);
    const amp = Math.min(band * 0.3, 60);
    const ease = u < 0.5 ? 2 * u * u * 0.3 + u * 0.7 : u; // brief slow entry
    const x = ltr ? lerp(-50, this.w + 50, ease) : lerp(this.w + 50, -50, ease);
    const y = yBase + Math.sin(u * TAU * 1.2 + c.seed * 9) * amp;
    this.cometPos = [x, y];
    this.cometTrail.unshift([x, y]);
    if (this.cometTrail.length > 28) this.cometTrail.length = 28;

    const gold: RGB = [255, 200, 70];
    const hot: RGB = [255, 240, 190];
    for (let i = this.cometTrail.length - 1; i > 0; i--) {
      const [tx, ty] = this.cometTrail[i];
      const k = 1 - i / this.cometTrail.length;
      this.glow(gold, tx, ty, 10 + k * 34, k * 0.5);
    }
    if (Math.random() < dt * 30) {
      this.sparks.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.8, max: 0.8, size: 2.5, color: hot, drag: 1.5, gravity: 40, diamond: true, rot: 0 });
    }
    const beat = 0.5 + 0.5 * Math.sin(this.t * 7);
    this.glow(gold, x, y, 90 + beat * 20, 0.7, true);
    const g = this.g;
    g.globalAlpha = 0.6 * (1 - beat * 0.5);
    g.strokeStyle = "rgba(255,220,120,1)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 26 + beat * 10, 0, TAU);
    g.stroke();
    // Gem.
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(this.t * 3) * 0.3);
    g.globalAlpha = 1;
    g.fillStyle = "#ffe38a";
    g.beginPath();
    g.moveTo(0, -15);
    g.lineTo(12, -3);
    g.lineTo(0, 16);
    g.lineTo(-12, -3);
    g.closePath();
    g.fill();
    g.fillStyle = "#fff8de";
    g.beginPath();
    g.moveTo(0, -15);
    g.lineTo(5, -3);
    g.lineTo(0, 16);
    g.lineTo(-5, -3);
    g.closePath();
    g.fill();
    g.restore();
  }

  /* ───────────── sparks, text, vignette ───────────── */

  private drawSparks(dt: number) {
    const g = this.g;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 4;
      const a = p.life / p.max;
      this.glow(p.color, p.x, p.y, p.size * 5, a * 0.6);
      if (p.diamond) {
        g.globalAlpha = a;
        g.fillStyle = rgba(p.color, 1);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.beginPath();
        g.moveTo(0, -p.size);
        g.lineTo(p.size * 0.7, 0);
        g.lineTo(0, p.size);
        g.lineTo(-p.size * 0.7, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      r.r += r.vr * dt;
      r.vr *= Math.exp(-dt * 2.2);
      const a = r.life / r.max;
      g.globalAlpha = a * 0.8;
      g.strokeStyle = rgba(r.color, 1);
      g.lineWidth = r.width * a + 0.5;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, TAU);
      g.stroke();
    }
  }

  private drawTexts(dt: number) {
    const g = this.g;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y -= dt * 38;
      const k = t.life / t.max;
      const pop = 1 + Math.max(0, (k - 0.82) / 0.18) * 0.3;
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `800 ${Math.round(t.size * pop)}px ${this.font}`;
      g.lineWidth = 5;
      g.strokeStyle = "rgba(6,4,20,0.6)";
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
  }

  private drawVignette(bull: number) {
    const { g, w, h } = this;
    if (!this.vignette) {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const vg = c.getContext("2d")!;
      const grd = vg.createRadialGradient(128, 128, 60, 128, 128, 182);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.6)");
      vg.fillStyle = grd;
      vg.fillRect(0, 0, 256, 256);
      this.vignette = c;
    }
    g.globalAlpha = 1;
    g.drawImage(this.vignette, 0, 0, w, h);
    if (bull > 0) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = bull * (0.05 + 0.03 * Math.sin(this.t * 4));
      g.fillStyle = "rgb(255,180,40)";
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
    }
  }
}
