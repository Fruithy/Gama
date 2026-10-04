import { critter, frame, sparkle } from "../core/art-kit";

export default frame(
  ["#0b1f2e", "#1d6fa0"],
  `<path d="M70 360 C 60 240, 330 300, 300 190 S 90 120, 320 50" stroke="#0b0b0f" stroke-width="74" fill="none" stroke-linecap="round" opacity="0.5" transform="translate(6 8)"/>
<path d="M70 360 C 60 240, 330 300, 300 190 S 90 120, 320 50" stroke="#0e2f45" stroke-width="74" fill="none" stroke-linecap="round"/>
<path d="M70 360 C 60 240, 330 300, 300 190 S 90 120, 320 50" stroke="#fff" stroke-width="4" fill="none" stroke-dasharray="10 12" opacity="0.5"/>
<path d="M70 360 C 60 240, 330 300, 300 190" stroke="#d4ff3a" stroke-width="10" fill="none" stroke-linecap="round"/>
<circle cx="70" cy="360" r="22" fill="#3dffb0" stroke="#0b0b0f" stroke-width="6"/>
<path d="M320 50 v-40 l30 12 -30 12" fill="#fff" stroke="#0b0b0f" stroke-width="5" stroke-linejoin="round"/>
${critter(300, 190, 26, "#d4ff3a", { mouth: "o", lookX: -1, lookY: -1 })}
${sparkle(60, 60, 14)}`,
);
