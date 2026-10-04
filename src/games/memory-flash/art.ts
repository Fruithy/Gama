import { eyes, frame, label, sparkle } from "../core/art-kit";

const cols = ["#ff3d7f", "#ffc23d", "#3dffb0", "#3dd8ff", "#8b5cff", "#ff6a3d", "#d4ff3a", "#f5f5f7", "#5b8cff"];
const lit = new Set([2, 4, 6]);
const pads = cols
  .map((c, i) => {
    const x = 70 + (i % 3) * 92;
    const y = 70 + Math.floor(i / 3) * 92;
    return `<rect x="${x + 5}" y="${y + 6}" width="80" height="80" rx="18" fill="#000" opacity="0.35"/><rect x="${x}" y="${y}" width="80" height="80" rx="18" fill="${c}" opacity="${lit.has(i) ? 1 : 0.35}" stroke="#0b0b0f" stroke-width="6"/>`;
  })
  .join("");
export default frame(
  ["#170b33", "#5a2fd6"],
  `${pads}${eyes(200, 200, 14, { gap: 22, lookX: 1, lookY: -1 })}
${label("1", 154, 128, 32, "#0b0b0f", { stroke: "#fff" })}${label("2", 246, 220, 32, "#0b0b0f", { stroke: "#fff" })}${label("3", 154, 312, 32, "#0b0b0f", { stroke: "#fff" })}
${sparkle(360, 360, 14)}${sparkle(40, 40, 10, "#ff3d7f")}`,
);
