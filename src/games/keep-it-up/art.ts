import { eyes, frame, sparkle } from "../core/art-kit";

export default frame(
  ["#06260f", "#1f9c4a"],
  `<ellipse cx="208" cy="372" rx="90" ry="14" fill="#000" opacity="0.3"/>
<circle cx="208" cy="180" r="100" fill="#000" opacity="0.3"/>
<circle cx="200" cy="170" r="100" fill="#fff" stroke="#0b0b0f" stroke-width="8"/>
<path d="M200 110 l38 28 -14 44 h-48 l-14 -44z" fill="#0b0b0f"/>
<path d="M200 70 v40 M238 138 l52 -16 M224 182 l30 46 M176 182 l-30 46 M162 138 l-52 -16" stroke="#0b0b0f" stroke-width="7"/>
${eyes(200, 222, 16, { gap: 30, lookY: -1 })}
<path d="M120 320 q40 -40 80 -40" stroke="#ffc23d" stroke-width="10" fill="none" stroke-linecap="round"/>
${sparkle(330, 80, 18, "#ffc23d")}${sparkle(70, 70, 12)}`,
  { rays: true },
);
