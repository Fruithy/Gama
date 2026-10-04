import { critter, frame, sparkle } from "../core/art-kit";

const spikes = (y: number, up: boolean, x0: number) =>
  Array.from({ length: 4 }, (_, i) => {
    const x = x0 + i * 30;
    return up ? `<path d="M${x} ${y} l15 -36 15 36z" fill="#ff3d7f" stroke="#0b0b0f" stroke-width="5" stroke-linejoin="round"/>` : `<path d="M${x} ${y} l15 36 15 -36z" fill="#ff3d7f" stroke="#0b0b0f" stroke-width="5" stroke-linejoin="round"/>`;
  }).join("");
export default frame(
  ["#1a0b2e", "#8b5cff"],
  `<rect x="0" y="0" width="400" height="60" fill="#0b0b0f" opacity="0.6"/><rect x="0" y="340" width="400" height="60" fill="#0b0b0f" opacity="0.6"/>
${spikes(340, true, 40)}${spikes(60, false, 230)}
<path d="M120 300 q60 -200 120 -230" stroke="#d4ff3a" stroke-width="7" fill="none" stroke-dasharray="14 12" stroke-linecap="round"/>
<g transform="rotate(180 250 110)">${critter(250, 110, 40, "#d4ff3a", { mouth: "o" })}</g>
${critter(110, 300, 34, "#d4ff3a", { mouth: "smile" })}
${sparkle(350, 200, 14)}`,
);
