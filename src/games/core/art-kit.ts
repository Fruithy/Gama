/**
 * SVG illustration kit for game thumbnails / share cards.
 *
 * Direction: bold, playful, slightly absurd, high contrast, readable at
 * 64px. Every game uses the same ingredients — gradient field, chunky shapes
 * with a hard offset shadow, googly-eyed critters — so the library reads as
 * one brand family while each game keeps its own colours and silhouette.
 *
 * All art is drawn in a 400×400 viewBox and returned as a string so it can be
 * served as a static SVG route, inlined in OG images, or downloaded.
 */

export const ART_SIZE = 400;

export function frame(bg: [string, string], body: string, opts: { grid?: boolean; rays?: boolean } = {}): string {
  const id = Math.abs(hash(bg.join() + body.length)).toString(36);
  const rays = opts.rays
    ? `<g opacity="0.12">${Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x = 200 + Math.cos(a) * 420;
        const y = 200 + Math.sin(a) * 420;
        const a2 = a + Math.PI / 24;
        return `<path d="M200 200 L${x.toFixed(1)} ${y.toFixed(1)} L${(200 + Math.cos(a2) * 420).toFixed(1)} ${(200 + Math.sin(a2) * 420).toFixed(1)}Z" fill="#fff"/>`;
      }).join("")}</g>`
    : "";
  const grid = opts.grid
    ? `<g opacity="0.08" stroke="#fff" stroke-width="2">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 50} 0V400M0 ${i * 50}H400"/>`).join("")}</g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
<radialGradient id="v${id}" cx="0.5" cy="0.35" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient></defs>
<rect width="400" height="400" fill="url(#g${id})"/>${rays}${grid}
${body}
<rect width="400" height="400" fill="url(#v${id})"/>
</svg>`;
}

/** Shape with a hard offset "sticker" shadow. */
export function sticker(shape: string, dx = 8, dy = 10): string {
  return `<g transform="translate(${dx} ${dy})" opacity="0.35" fill="#000">${stripFill(shape)}</g>${shape}`;
}

function stripFill(s: string) {
  return s.replace(/fill="[^"]*"/g, 'fill="#000"').replace(/stroke="[^"]*"/g, 'stroke="#000"');
}

export function eyes(cx: number, cy: number, r: number, opts: { gap?: number; lookX?: number; lookY?: number } = {}): string {
  const gap = opts.gap ?? r * 1.15;
  const lx = (opts.lookX ?? 0.3) * r * 0.4;
  const ly = (opts.lookY ?? 0) * r * 0.4;
  return [-1, 1]
    .map((s) => {
      const ex = cx + s * gap;
      return `<circle cx="${ex}" cy="${cy}" r="${r}" fill="#fff" stroke="#0b0b0f" stroke-width="${Math.max(3, r * 0.16)}"/><circle cx="${ex + lx}" cy="${cy + ly}" r="${r * 0.5}" fill="#0b0b0f"/>`;
    })
    .join("");
}

export function critter(cx: number, cy: number, r: number, color: string, opts: { mouth?: "smile" | "o" | "grin" | "flat"; lookX?: number; lookY?: number; squash?: number } = {}): string {
  const sq = opts.squash ?? 1;
  const mouth = opts.mouth ?? "smile";
  const m =
    mouth === "o"
      ? `<ellipse cx="${cx}" cy="${cy + r * 0.42}" rx="${r * 0.14}" ry="${r * 0.17}" fill="#0b0b0f"/>`
      : mouth === "grin"
        ? `<path d="M${cx - r * 0.3} ${cy + r * 0.28} Q${cx} ${cy + r * 0.7} ${cx + r * 0.3} ${cy + r * 0.28}Z" fill="#0b0b0f"/>`
        : mouth === "flat"
          ? `<path d="M${cx - r * 0.2} ${cy + r * 0.42}H${cx + r * 0.2}" stroke="#0b0b0f" stroke-width="${r * 0.1}" stroke-linecap="round"/>`
          : `<path d="M${cx - r * 0.24} ${cy + r * 0.3} Q${cx} ${cy + r * 0.55} ${cx + r * 0.24} ${cy + r * 0.3}" stroke="#0b0b0f" stroke-width="${r * 0.1}" fill="none" stroke-linecap="round"/>`;
  return `<g transform="translate(${cx} ${cy}) scale(${sq} ${1 / sq}) translate(${-cx} ${-cy})">
<ellipse cx="${cx + 8}" cy="${cy + 12}" rx="${r}" ry="${r}" fill="#000" opacity="0.3"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#0b0b0f" stroke-width="${Math.max(4, r * 0.08)}"/>
<ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.48}" rx="${r * 0.28}" ry="${r * 0.16}" fill="#fff" opacity="0.4" transform="rotate(-30 ${cx - r * 0.38} ${cy - r * 0.48})"/>
${eyes(cx, cy - r * 0.12, r * 0.28, { gap: r * 0.34, lookX: opts.lookX, lookY: opts.lookY })}${m}</g>`;
}

export function sparkle(x: number, y: number, s: number, color = "#fff"): string {
  return `<path d="M${x} ${y - s}Q${x + s * 0.15} ${y - s * 0.15} ${x + s} ${y}Q${x + s * 0.15} ${y + s * 0.15} ${x} ${y + s}Q${x - s * 0.15} ${y + s * 0.15} ${x - s} ${y}Q${x - s * 0.15} ${y - s * 0.15} ${x} ${y - s}Z" fill="${color}"/>`;
}

export function label(textValue: string, x: number, y: number, size: number, color = "#fff", opts: { stroke?: string; anchor?: "middle" | "start" | "end"; rotate?: number } = {}): string {
  const stroke = opts.stroke ?? "#0b0b0f";
  const rot = opts.rotate ? ` transform="rotate(${opts.rotate} ${x} ${y})"` : "";
  return `<text x="${x}" y="${y}" font-family="Unbounded, 'Arial Black', Impact, sans-serif" font-weight="900" font-size="${size}" text-anchor="${opts.anchor ?? "middle"}" fill="${color}" stroke="${stroke}" stroke-width="${Math.max(3, size * 0.12)}" paint-order="stroke" stroke-linejoin="round"${rot}>${escapeXml(textValue)}</text>`;
}

export function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
}

/** Placeholder art for planned (not yet playable) games: theme + glyph. */
export function placeholderArt(bg: [string, string], glyph: string, color = "#fff"): string {
  return frame(
    bg,
    `${sticker(`<rect x="110" y="110" width="180" height="180" rx="44" fill="${color}" stroke="#0b0b0f" stroke-width="8"/>`)}
${label(glyph, 200, 230, 90, "#0b0b0f", { stroke: color })}
${sparkle(315, 95, 18)}${sparkle(80, 320, 12)}`,
    { grid: true },
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
