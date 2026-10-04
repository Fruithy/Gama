import { critter, frame, label, sparkle } from "../core/art-kit";

export default frame(
  ["#2e0606", "#c4162a"],
  `<path d="M0 0 H200 L150 400 H0Z" fill="#3dffb0" opacity="0.92"/>
${critter(200, 210, 92, "#ffc23d", { mouth: "o", lookX: -0.8 })}
<path d="M300 60 l-40 90 h44 l-30 90 80 -120 h-46 l34 -60z" fill="#fff" stroke="#0b0b0f" stroke-width="7" stroke-linejoin="round"/>
${label("187ms", 105, 370, 46, "#fff")}
${sparkle(60, 60, 14)}`,
);
