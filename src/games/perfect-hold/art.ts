import { critter, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#06232e", "#1da0a0"],
  `${sticker(`<rect x="150" y="40" width="100" height="320" rx="30" fill="#0b2f3a" stroke="#0b0b0f" stroke-width="7"/>`)}
<rect x="158" y="160" width="84" height="192" rx="24" fill="#ffc23d"/>
<path d="M120 150 H280" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
<path d="M290 150 l-14 -10 v20z" fill="#fff"/>
${critter(200, 270, 34, "#ff3d7f", { mouth: "o", lookY: -1 })}
<path d="M80 300 q-20 -30 0 -60 M330 260 q20 -30 0 -60" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.6"/>
${sparkle(330, 80, 16)}${sparkle(70, 90, 10, "#ffc23d")}`,
);
