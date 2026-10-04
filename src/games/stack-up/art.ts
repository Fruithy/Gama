import { critter, frame, sparkle, sticker } from "../core/art-kit";

const colors = ["#3dd8ff", "#8b5cff", "#ff3d7f", "#ff6a3d", "#ffc23d", "#d4ff3a"];
const blocks = colors
  .map((c, i) => {
    const w = 210 - i * 22 + (i % 2 ? 10 : 0);
    const x = 200 - w / 2 + (i % 2 ? 14 : -10);
    const y = 330 - i * 38;
    return sticker(`<rect x="${x}" y="${y}" width="${w}" height="36" rx="8" fill="${c}" stroke="#0b0b0f" stroke-width="6"/>`, 6, 6);
  })
  .join("");

export default frame(
  ["#1a1446", "#ff3d7f"],
  `${blocks}
<g transform="rotate(14 330 160)">${sticker(`<rect x="290" y="140" width="70" height="36" rx="8" fill="#fff" stroke="#0b0b0f" stroke-width="6"/>`, 6, 6)}</g>
${critter(200, 98, 46, "#d4ff3a", { mouth: "o", lookY: 0.6 })}
${sparkle(70, 90, 20)}${sparkle(340, 70, 12)}`,
  { rays: true },
);
