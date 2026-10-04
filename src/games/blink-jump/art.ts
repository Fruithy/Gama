import { frame, sparkle } from "../core/art-kit";

export default frame(
  ["#2e0b22", "#c41d7a"],
  `<rect x="0" y="320" width="400" height="80" fill="#0b0b0f" opacity="0.5"/>
<path d="M260 320 l20 -60 20 60z M300 320 l16 -44 16 44z" fill="#d4ff3a" stroke="#0b0b0f" stroke-width="6" stroke-linejoin="round"/>
<circle cx="150" cy="170" r="70" fill="#000" opacity="0.3" transform="translate(6 8)"/>
<circle cx="150" cy="170" r="70" fill="#ffc23d" stroke="#0b0b0f" stroke-width="7"/>
<path d="M112 160 q14 10 28 0 M160 160 q14 10 28 0" stroke="#0b0b0f" stroke-width="7" fill="none" stroke-linecap="round"/>
<ellipse cx="150" cy="205" rx="16" ry="12" fill="#0b0b0f"/>
<path d="M150 260 v40 M120 250 l-16 30 M180 250 l16 30" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
<path d="M260 120 q20 -30 40 0 M300 90 q14 -20 28 0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>
${sparkle(350, 60, 14)}${sparkle(60, 60, 10, "#d4ff3a")}`,
);
