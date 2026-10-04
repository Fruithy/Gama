import { eyes, frame, label, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#2e0b0b", "#d6452f"],
  `${label("CUT 37%", 200, 90, 46, "#fff")}
${sticker(`<rect x="40" y="170" width="118" height="90" rx="40" fill="#ffc23d" stroke="#0b0b0f" stroke-width="7"/>`)}
${sticker(`<rect x="176" y="170" width="190" height="90" rx="40" fill="#ffc23d" stroke="#0b0b0f" stroke-width="7"/>`)}
<path d="M70 200 l14 30 M110 196 l14 34 M220 196 l14 34 M270 196 l14 34 M320 196 l14 34" stroke="#c98a1d" stroke-width="6" stroke-linecap="round"/>
${eyes(272, 214, 13, { gap: 20, lookX: -1 })}
<path d="M167 140 L167 300" stroke="#fff" stroke-width="7" stroke-dasharray="14 10" stroke-linecap="round"/>
<path d="M150 300 l17 30 17 -30" fill="#fff"/>
${sparkle(330, 330, 16)}${sparkle(60, 330, 10)}`,
);
