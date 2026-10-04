import { critter, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#1d1d24", "#3a3a48"],
  `<path d="M60 0 L20 400 M200 0 V400 M340 0 L380 400" stroke="#fff" stroke-width="6" opacity="0.25"/>
<path d="M130 0 L110 400 M270 0 L290 400" stroke="#ffc23d" stroke-width="8" stroke-dasharray="30 30" opacity="0.8"/>
${sticker(`<rect x="70" y="70" width="90" height="70" rx="14" fill="#ff3d7f" stroke="#0b0b0f" stroke-width="7"/>`)}
${sticker(`<rect x="240" y="150" width="90" height="70" rx="14" fill="#8b5cff" stroke="#0b0b0f" stroke-width="7"/>`)}
<circle cx="200" cy="110" r="16" fill="#ffc23d" stroke="#0b0b0f" stroke-width="5"/>
${critter(200, 300, 52, "#d4ff3a", { mouth: "grin", lookY: -1 })}
<path d="M120 300 h-40 M120 320 h-30" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
${sparkle(350, 360, 12)}`,
);
