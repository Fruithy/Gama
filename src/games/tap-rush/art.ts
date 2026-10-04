import { critter, frame, label, sparkle } from "../core/art-kit";

export default frame(
  ["#2b0a1a", "#ff3d7f"],
  `${critter(200, 220, 105, "#ffc23d", { mouth: "grin", lookY: -0.4, squash: 1.18 })}
<g fill="#fff" stroke="#0b0b0f" stroke-width="6" stroke-linejoin="round">
<path d="M300 60 l12 34 34 -10 -24 28 26 22 -34 -2 -6 34 -14 -32 -32 14 20 -28 -26 -22 34 4z" transform="scale(0.8) translate(80 0)"/>
</g>
${label("TAP!", 92, 104, 52, "#fff", { rotate: -12 })}
${label("TAP!", 318, 352, 40, "#d4ff3a", { rotate: 10 })}
${sparkle(72, 300, 14)}${sparkle(340, 200, 10, "#d4ff3a")}`,
  { rays: true },
);
