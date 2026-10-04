import { critter, frame, sparkle, sticker } from "../core/art-kit";

const plat = (x: number, y: number, c: string) => sticker(`<rect x="${x}" y="${y}" width="96" height="22" rx="11" fill="${c}" stroke="#0b0b0f" stroke-width="6"/>`, 5, 6);
export default frame(
  ["#0b1d3a", "#5b8cff"],
  `${plat(40, 330, "#d4ff3a")}${plat(230, 270, "#d4ff3a")}${plat(90, 190, "#ff6a3d")}${plat(250, 110, "#d4ff3a")}${plat(60, 50, "#3dd8ff")}
<path d="M270 262 q8 -16 0 -30 q-8 -14 0 -28" stroke="#fff" stroke-width="7" fill="none"/>
${critter(170, 140, 46, "#ff3d7f", { mouth: "grin", lookY: -1, squash: 0.86 })}
<path d="M150 200 v40 M190 200 v30" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
${sparkle(340, 360, 14)}${sparkle(360, 40, 10, "#d4ff3a")}`,
);
