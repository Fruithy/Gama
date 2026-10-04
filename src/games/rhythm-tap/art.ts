import { critter, frame, sparkle } from "../core/art-kit";

const note = (x: number, y: number, r: number, c: string) => `<circle cx="${x + 4}" cy="${y + 5}" r="${r}" fill="#000" opacity="0.3"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#0b0b0f" stroke-width="5"/>`;
export default frame(
  ["#1a0633", "#7a1dc4"],
  `<path d="M200 0 V400" stroke="#fff" stroke-width="70" opacity="0.07"/>
${note(200, 50, 22, "#3dd8ff")}${note(200, 120, 22, "#ff3d7f")}${note(200, 190, 22, "#3dd8ff")}
<circle cx="200" cy="300" r="52" fill="none" stroke="#fff" stroke-width="10"/>
${critter(200, 300, 34, "#d4ff3a", { mouth: "grin" })}
<path d="M80 260 q-20 40 0 80 M320 260 q20 40 0 80 M56 240 q-30 60 0 120 M344 240 q30 60 0 120" stroke="#3dd8ff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.7"/>
${sparkle(340, 70, 14)}${sparkle(60, 90, 10, "#3dd8ff")}`,
  { rays: true },
);
