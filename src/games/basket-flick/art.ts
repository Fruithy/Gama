import { eyes, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#2e1406", "#ff6a3d"],
  `${sticker(`<rect x="110" y="40" width="180" height="120" rx="12" fill="#fff" stroke="#0b0b0f" stroke-width="7"/>`)}
<rect x="165" y="80" width="70" height="50" fill="none" stroke="#ff3d7f" stroke-width="6"/>
<ellipse cx="200" cy="168" rx="58" ry="14" fill="none" stroke="#ff6a3d" stroke-width="9"/>
<path d="M146 170 l14 60 h80 l14 -60 M170 172 l8 58 M200 174 v56 M230 172 l-8 58" stroke="#fff" stroke-width="4" fill="none" opacity="0.9"/>
<circle cx="210" cy="300" r="62" fill="#000" opacity="0.3"/>
<circle cx="202" cy="290" r="62" fill="#ff8a1d" stroke="#0b0b0f" stroke-width="7"/>
<path d="M140 290 h124 M202 228 v124 M160 245 q42 45 0 90 M244 245 q-42 45 0 90" stroke="#0b0b0f" stroke-width="5" fill="none"/>
${eyes(202, 276, 13, { gap: 22, lookY: -1 })}
<path d="M120 220 q-20 -60 20 -100" stroke="#fff" stroke-width="7" fill="none" stroke-dasharray="10 10" stroke-linecap="round"/>
${sparkle(330, 330, 16)}${sparkle(60, 340, 12, "#ffc23d")}`,
  { rays: true },
);
