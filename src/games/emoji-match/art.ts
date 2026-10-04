import { frame, sparkle } from "../core/art-kit";

const face = (x: number, y: number, r: number, mouth: string, fill = "#ffd23d") =>
  `<circle cx="${x + 6}" cy="${y + 8}" r="${r}" fill="#000" opacity="0.3"/><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#0b0b0f" stroke-width="6"/>${mouth}`;
export default frame(
  ["#331a06", "#ffb21d"],
  `${face(200, 120, 70, `<circle cx="174" cy="106" r="9"/><circle cx="226" cy="106" r="9"/><path d="M166 132 q34 36 68 0" stroke="#0b0b0f" stroke-width="8" fill="none" stroke-linecap="round"/>`)}
<path d="M200 205 v30 l-14 -14 M200 235 l14 -14" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/>
${face(100, 310, 50, `<circle cx="84" cy="300" r="7"/><circle cx="116" cy="300" r="7"/><path d="M84 330 q16 -14 32 0" stroke="#0b0b0f" stroke-width="6" fill="none"/>`)}
${face(200, 310, 50, `<circle cx="184" cy="300" r="7"/><circle cx="216" cy="300" r="7"/><path d="M178 318 q22 24 44 0" stroke="#0b0b0f" stroke-width="6" fill="none"/>`)}
<circle cx="200" cy="310" r="62" fill="none" stroke="#ff3d7f" stroke-width="8"/>
${face(300, 310, 50, `<path d="M276 296 h18 M306 296 h18" stroke="#0b0b0f" stroke-width="10"/><path d="M286 324 q14 10 28 0" stroke="#0b0b0f" stroke-width="6" fill="none"/>`, "#ff7a3d")}
${sparkle(340, 70, 14)}${sparkle(60, 80, 10)}`,
  { rays: true },
);
