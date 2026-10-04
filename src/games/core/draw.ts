/**
 * Canvas drawing helpers shared by every game. The "mascot" helpers (googly
 * eyes, blobs) give the whole library one consistent, slightly absurd
 * illustration language without copying any existing characters.
 */

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function fillRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  g.fillStyle = color;
  roundRect(g, x, y, w, h, r);
  g.fill();
}

export function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  g.fill();
}

export function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, width: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  g.stroke();
}

export function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

export function text(
  g: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: { size?: number; color?: string; font: string; weight?: number; align?: CanvasTextAlign; stroke?: string; baseline?: CanvasTextBaseline },
) {
  g.font = `${opts.weight ?? 800} ${opts.size ?? 20}px ${opts.font}`;
  g.textAlign = opts.align ?? "center";
  g.textBaseline = opts.baseline ?? "middle";
  if (opts.stroke) {
    g.lineWidth = Math.max(3, (opts.size ?? 20) * 0.18);
    g.strokeStyle = opts.stroke;
    g.lineJoin = "round";
    g.strokeText(value, x, y);
  }
  g.fillStyle = opts.color ?? "#fff";
  g.fillText(value, x, y);
}

export function verticalGradient(g: CanvasRenderingContext2D, h: number, top: string, bottom: string) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  return grad;
}

/** A pair of googly eyes — the house style for every game character. */
export function googlyEyes(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts: { lookX?: number; lookY?: number; gap?: number; blink?: number; color?: string } = {},
) {
  const gap = opts.gap ?? r * 1.15;
  const lx = (opts.lookX ?? 0) * r * 0.38;
  const ly = (opts.lookY ?? 0) * r * 0.38;
  const blink = opts.blink ?? 0;
  for (const side of [-1, 1]) {
    const ex = cx + side * gap;
    g.fillStyle = "#fff";
    g.beginPath();
    g.ellipse(ex, cy, r, r * (1 - blink * 0.9), 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = Math.max(1.5, r * 0.14);
    g.strokeStyle = "#0b0b0f";
    g.stroke();
    if (blink < 0.7) circle(g, ex + lx, cy + ly, r * 0.48, opts.color ?? "#0b0b0f");
  }
}

/** Squishy blob body with eyes. `squash` > 1 flattens it (landing). */
export function blobCritter(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  opts: { squash?: number; lookX?: number; lookY?: number; rotation?: number; mouth?: "smile" | "o" | "flat" | "none"; blink?: number } = {},
) {
  const squash = opts.squash ?? 1;
  g.save();
  g.translate(x, y);
  if (opts.rotation) g.rotate(opts.rotation);
  g.scale(squash, 1 / squash);
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.beginPath();
  g.ellipse(0, r * 0.92, r * 0.8, r * 0.18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.28)";
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0, Math.PI * 2);
  g.fill();
  googlyEyes(g, 0, -r * 0.12, r * 0.3, { lookX: opts.lookX, lookY: opts.lookY, gap: r * 0.36, blink: opts.blink });
  const mouth = opts.mouth ?? "smile";
  g.strokeStyle = "#0b0b0f";
  g.lineWidth = Math.max(2, r * 0.09);
  g.lineCap = "round";
  if (mouth === "smile") {
    g.beginPath();
    g.arc(0, r * 0.28, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  } else if (mouth === "o") {
    circle(g, 0, r * 0.42, r * 0.13, "#0b0b0f");
  } else if (mouth === "flat") {
    line(g, -r * 0.18, r * 0.42, r * 0.18, r * 0.42, Math.max(2, r * 0.09), "#0b0b0f");
  }
  g.restore();
}

export function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Distance from point to segment (used by cut / path / collision checks). */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Segment–segment intersection test (used for rope cutting). */
export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (d === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** HSL helper for procedural colour work (Odd One Out etc.). */
export function hsl(h: number, s: number, l: number) {
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}
