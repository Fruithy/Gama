import { eyes, frame, sparkle } from "../core/art-kit";

export default frame(
  ["#2e1206", "#c4561d"],
  `<g transform="translate(205 170)">
<circle r="120" fill="#000" opacity="0.3" transform="translate(8 10)"/>
<circle r="120" fill="#fff" stroke="#0b0b0f" stroke-width="7"/><circle r="94" fill="#ff3d7f"/><circle r="68" fill="#fff"/><circle r="44" fill="#ff3d7f"/><circle r="20" fill="#ffc23d" stroke="#0b0b0f" stroke-width="5"/>
${eyes(0, -60, 14, { gap: 24, lookX: -0.4, lookY: 1 })}
</g>
<path d="M60 380 L196 176" stroke="#0b0b0f" stroke-width="10" stroke-linecap="round"/>
<path d="M60 380 L196 176" stroke="#ffc23d" stroke-width="5" stroke-linecap="round"/>
<path d="M50 390 l14 -34 M50 390 l34 -12" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
${sparkle(340, 340, 16)}${sparkle(60, 60, 12, "#ffc23d")}`,
);
