import { critter, frame, sparkle } from "../core/art-kit";

export default frame(
  ["#120a2e", "#3d1a8a"],
  `<circle cx="200" cy="205" r="130" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="34" transform="translate(8 10)"/>
<circle cx="200" cy="205" r="130" fill="none" stroke="#2a1d5e" stroke-width="34"/>
<circle cx="200" cy="205" r="130" fill="none" stroke="#0b0b0f" stroke-width="6" stroke-dasharray="4 18"/>
<path d="M200 75 A130 130 0 0 1 292 113" fill="none" stroke="#d4ff3a" stroke-width="34" stroke-linecap="round"/>
<path d="M236 80 A130 130 0 0 1 258 89" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round"/>
${critter(200, 205, 62, "#ff3d7f", { mouth: "o", lookX: 0.6, lookY: -0.7 })}
<circle cx="292" cy="113" r="22" fill="#fff" stroke="#0b0b0f" stroke-width="6"/>
${sparkle(330, 70, 16, "#d4ff3a")}${sparkle(70, 330, 12)}${sparkle(60, 90, 9)}`,
  { rays: true },
);
