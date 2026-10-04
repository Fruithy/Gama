import { eyes, frame, label, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#0b0b0f", "#2f2f45"],
  `${sticker(`<rect x="40" y="70" width="320" height="130" rx="28" fill="#f5f5f7" stroke="#0b0b0f" stroke-width="7"/>`)}
${label("7×8=54", 200, 160, 52, "#0b0b0f", { stroke: "#f5f5f7" })}
${sticker(`<rect x="40" y="240" width="150" height="100" rx="26" fill="#3dffb0" stroke="#0b0b0f" stroke-width="7"/>`)}
${sticker(`<rect x="210" y="240" width="150" height="100" rx="26" fill="#ff3d7f" stroke="#0b0b0f" stroke-width="7"/>`)}
${label("✓", 115, 312, 60, "#0b0b0f", { stroke: "#3dffb0" })}${label("✕", 285, 312, 60, "#0b0b0f", { stroke: "#ff3d7f" })}
${eyes(330, 70, 13, { gap: 20, lookX: -1, lookY: 1 })}
${sparkle(60, 40, 12)}`,
);
