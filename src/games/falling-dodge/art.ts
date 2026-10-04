import { critter, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#140b2e", "#3d2fa0"],
  `${sticker(`<rect x="60" y="40" width="80" height="80" rx="14" fill="#ff6a3d" stroke="#0b0b0f" stroke-width="7" transform="rotate(12 100 80)"/>`)}
${sticker(`<rect x="250" y="20" width="70" height="70" rx="14" fill="#ffc23d" stroke="#0b0b0f" stroke-width="7" transform="rotate(-10 285 55)"/>`)}
${sticker(`<rect x="180" y="150" width="90" height="90" rx="16" fill="#8b5cff" stroke="#0b0b0f" stroke-width="7" transform="rotate(20 225 195)"/>`)}
<path d="M100 130 v30 M285 100 v30 M225 250 v20" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
${critter(120, 320, 46, "#3dffb0", { mouth: "o", lookY: -1, lookX: 0.6 })}
${sparkle(340, 330, 14)}`,
);
