import { eyes, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#0a1a33", "#1f5bd6"],
  `${sticker(`<rect x="40" y="130" width="140" height="140" rx="24" fill="#ff3d7f" stroke="#0b0b0f" stroke-width="7"/>`)}
<path d="M80 170 l60 60 M140 170 l-60 60" stroke="#0b0b0f" stroke-width="14" stroke-linecap="round"/>
${sticker(`<rect x="220" y="130" width="140" height="140" rx="24" fill="#3dffb0" stroke="#0b0b0f" stroke-width="7"/>`)}
<path d="M252 202 l28 28 52 -60" stroke="#0b0b0f" stroke-width="14" stroke-linecap="round" fill="none"/>
${eyes(290, 160, 13, { gap: 22, lookX: -0.8 })}
<rect x="40" y="300" width="320" height="22" rx="11" fill="#0b0b0f" opacity="0.5"/>
<rect x="40" y="300" width="110" height="22" rx="11" fill="#3dd8ff"/>
${sparkle(340, 80, 16)}${sparkle(60, 80, 10, "#3dd8ff")}`,
  { grid: true },
);
