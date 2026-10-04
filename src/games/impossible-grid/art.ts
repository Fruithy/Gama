import { eyes, frame, sparkle } from "../core/art-kit";

const cells: string[] = [];
const lit = [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0];
for (let r = 0; r < 4; r++)
  for (let c = 0; c < 4; c++) {
    const on = lit[r * 4 + c];
    const x = 80 + c * 80;
    const y = 80 + r * 80;
    cells.push(`<circle cx="${x + 5}" cy="${y + 6}" r="30" fill="#000" opacity="0.35"/><circle cx="${x}" cy="${y}" r="30" fill="${on ? "#ffc23d" : "#1d1d2a"}" stroke="#0b0b0f" stroke-width="6"/>`);
  }
export default frame(
  ["#0b0b0f", "#2a2a3d"],
  `${cells.join("")}
<path d="M160 160 H240 V240" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
${eyes(240, 240, 11, { gap: 13, lookX: -1, lookY: -1 })}
${sparkle(360, 40, 14, "#ffc23d")}${sparkle(40, 360, 12)}`,
  { rays: true },
);
