import { critter, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#04212b", "#0b7a8c"],
  `${sticker(`<rect x="30" y="250" width="340" height="34" rx="17" fill="#0b2f3a" stroke="#0b0b0f" stroke-width="6"/>`)}
<rect x="130" y="250" width="140" height="34" rx="17" fill="#3dd8ff" stroke="#0b0b0f" stroke-width="6"/>
<path d="M200 300 l-40 70 h80 z" fill="#ffc23d" stroke="#0b0b0f" stroke-width="7" stroke-linejoin="round"/>
<g transform="rotate(-12 200 200)">${critter(238, 196, 52, "#ff3d7f", { mouth: "o", lookX: -1 })}</g>
<path d="M60 170 q20 -20 40 0 t40 0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.7"/>
${sparkle(340, 90, 14)}${sparkle(80, 80, 10, "#3dd8ff")}`,
  { grid: true },
);
