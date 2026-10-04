import { critter, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#06231d", "#0f6b52"],
  `${sticker(`<rect x="40" y="215" width="320" height="60" rx="30" fill="#0b0b0f" stroke="#0b0b0f" stroke-width="6"/>`)}
<rect x="40" y="215" width="320" height="60" rx="30" fill="#123c33" stroke="#0b0b0f" stroke-width="6"/>
<rect x="215" y="221" width="70" height="48" rx="12" fill="#3dffb0"/>
<rect x="246" y="205" width="10" height="80" rx="5" fill="#fff" stroke="#0b0b0f" stroke-width="5"/>
${critter(150, 128, 58, "#d4ff3a", { mouth: "o", lookX: 1 })}
<path d="M262 120 l40 -24 M262 140 h46 M262 160 l40 24" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
${sparkle(330, 330, 16, "#3dffb0")}${sparkle(70, 340, 10)}`,
  { grid: true },
);
