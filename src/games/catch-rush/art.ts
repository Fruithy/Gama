import { critter, frame, sparkle } from "../core/art-kit";

const fruit = (x: number, y: number, r: number, c: string) =>
  `<circle cx="${x + 4}" cy="${y + 6}" r="${r}" fill="#000" opacity="0.3"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#0b0b0f" stroke-width="5"/><ellipse cx="${x + 6}" cy="${y - r}" rx="10" ry="5" fill="#3dffb0" stroke="#0b0b0f" stroke-width="3" transform="rotate(-30 ${x + 6} ${y - r})"/>`;
export default frame(
  ["#0b2e1a", "#2fa05a"],
  `${fruit(110, 80, 28, "#ff3d7f")}${fruit(280, 60, 24, "#ffc23d")}${fruit(200, 160, 30, "#8b5cff")}
<circle cx="310" cy="190" r="22" fill="#1d1d2a" stroke="#0b0b0f" stroke-width="5"/><path d="M300 180 l20 20 M320 180 l-20 20" stroke="#ff3d7f" stroke-width="6" stroke-linecap="round"/>
<path d="M90 300 h220 l-20 70 h-180z" fill="#c97b2b" stroke="#0b0b0f" stroke-width="7" stroke-linejoin="round"/>
<path d="M140 300 l8 70 M200 300 v70 M260 300 l-8 70" stroke="#8a4f14" stroke-width="5"/>
${critter(200, 268, 36, "#d4ff3a", { mouth: "o", lookY: -1 })}
${sparkle(60, 200, 12)}${sparkle(350, 330, 12)}`,
  { rays: true },
);
