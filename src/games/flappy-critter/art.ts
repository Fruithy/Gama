import { critter, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#0b2440", "#1f8ad6"],
  `${sticker(`<rect x="270" y="-20" width="80" height="150" rx="16" fill="#3dffb0" stroke="#0b0b0f" stroke-width="7"/>`)}
${sticker(`<rect x="270" y="280" width="80" height="150" rx="16" fill="#3dffb0" stroke="#0b0b0f" stroke-width="7"/>`)}
<path d="M120 170 q-60 -60 -70 10 q30 10 70 10z" fill="#fff" stroke="#0b0b0f" stroke-width="6"/>
<path d="M120 230 q-60 50 -60 -10z" fill="#ffffff" opacity="0.8" stroke="#0b0b0f" stroke-width="6"/>
${critter(160, 205, 62, "#ffc23d", { mouth: "o", lookX: 1, lookY: -0.3 })}
<path d="M206 205 l26 10 -26 10z" fill="#ff6a3d" stroke="#0b0b0f" stroke-width="5" stroke-linejoin="round"/>
${sparkle(60, 340, 12)}${sparkle(240, 60, 10)}`,
);
