import { critter, frame, sparkle, sticker } from "../core/art-kit";

const pegs = [[90, 150], [170, 150], [250, 150], [330, 150], [130, 210], [210, 210], [290, 210]]
  .map(([x, y]) => `<circle cx="${x + 4}" cy="${y + 5}" r="12" fill="#000" opacity="0.35"/><circle cx="${x}" cy="${y}" r="12" fill="#3dd8ff" stroke="#0b0b0f" stroke-width="5"/>`)
  .join("");
export default frame(
  ["#22062e", "#a01d8c"],
  `<rect x="150" y="30" width="100" height="26" rx="13" fill="#fff" stroke="#0b0b0f" stroke-width="6"/>
${pegs}
<g transform="rotate(-20 200 280)"><rect x="130" y="270" width="140" height="18" rx="9" fill="#ffc23d" stroke="#0b0b0f" stroke-width="6"/></g>
${critter(250, 100, 26, "#d4ff3a", { mouth: "o", lookY: 1 })}
${sticker(`<path d="M150 330 h100 l-10 50 h-80z" fill="#3dffb0" stroke="#0b0b0f" stroke-width="6" stroke-linejoin="round"/>`)}
${sparkle(350, 330, 14)}${sparkle(50, 300, 10)}`,
  { grid: true },
);
