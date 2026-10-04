import { critter, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#1b0f2e", "#6b2fa0"],
  `<circle cx="120" cy="40" r="12" fill="#fff" stroke="#0b0b0f" stroke-width="5"/>
<circle cx="290" cy="50" r="12" fill="#fff" stroke="#0b0b0f" stroke-width="5"/>
<path d="M120 40 Q150 120 195 160" stroke="#e8d5a8" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M290 50 Q270 90 252 108" stroke="#e8d5a8" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M232 128 Q236 140 220 158" stroke="#e8d5a8" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M226 96 L264 140" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
${critter(205, 185, 44, "#3dffb0", { mouth: "o", lookY: 1 })}
${sticker(`<path d="M150 300 h110 l-12 70 h-86 z" fill="#ffc23d" stroke="#0b0b0f" stroke-width="7" stroke-linejoin="round"/>`)}
<path d="M150 300 h110" stroke="#0b0b0f" stroke-width="7"/>
${sparkle(330, 260, 14, "#3dffb0")}${sparkle(60, 230, 11)}`,
  { rays: true },
);
