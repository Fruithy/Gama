import { critter, frame, label, sparkle } from "../core/art-kit";

export default frame(
  ["#2e1a06", "#c48a1d"],
  `<path d="M60 250 A140 140 0 0 1 340 250" fill="none" stroke="#0b0b0f" stroke-width="34" stroke-linecap="round" opacity="0.5"/>
<path d="M60 250 A140 140 0 0 1 340 250" fill="none" stroke="#5a3a0c" stroke-width="28" stroke-linecap="round"/>
<path d="M178 112 A140 140 0 0 1 222 112" fill="none" stroke="#3dffb0" stroke-width="28"/>
<path d="M200 250 L214 128" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
${critter(200, 270, 44, "#ff3d7f", { mouth: "o", lookY: -1 })}
${label("A", 200, 70, 46, "#fff")}
<path d="M290 300 q20 -10 30 10 q10 20 30 10" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>
${sparkle(60, 60, 12)}${sparkle(350, 360, 14)}`,
);
