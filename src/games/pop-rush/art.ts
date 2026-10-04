import { eyes, frame, sparkle } from "../core/art-kit";

const bubble = (x: number, y: number, r: number, c: string) =>
  `<circle cx="${x + 6}" cy="${y + 8}" r="${r}" fill="#000" opacity="0.3"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#0b0b0f" stroke-width="6"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.4}" rx="${r * 0.28}" ry="${r * 0.16}" fill="#fff" opacity="0.6"/>`;
export default frame(
  ["#0d2a0f", "#3a9c2f"],
  `${bubble(120, 140, 58, "#d4ff3a")}${eyes(120, 132, 13, { gap: 20, lookX: 1 })}
${bubble(280, 110, 40, "#3dd8ff")}${bubble(250, 270, 66, "#ff3d7f")}${eyes(250, 262, 15, { gap: 24, lookY: -1 })}
<g transform="translate(110 300)"><path d="M0 -44 L10 -16 40 -30 22 -4 46 12 16 14 18 44 0 22 -18 44 -16 14 -46 12 -22 -4 -40 -30 -10 -16Z" fill="#1d1d2a" stroke="#0b0b0f" stroke-width="5"/><path d="M-10 -6 l20 20 M10 -6 l-20 20" stroke="#ff3d7f" stroke-width="6" stroke-linecap="round"/></g>
${sparkle(340, 330, 16)}${sparkle(60, 50, 10)}`,
  { rays: true },
);
