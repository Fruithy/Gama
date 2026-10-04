import { eyes, frame, sparkle, sticker } from "../core/art-kit";

export default frame(
  ["#2a1606", "#a0521d"],
  `${sticker(`<rect x="30" y="285" width="340" height="80" rx="16" fill="#d9924a" stroke="#0b0b0f" stroke-width="7"/>`)}
<path d="M50 310 H350 M50 338 H350" stroke="#a4632b" stroke-width="5"/>
<rect x="192" y="200" width="16" height="100" fill="#cfd3dc" stroke="#0b0b0f" stroke-width="6"/>
<rect x="168" y="188" width="64" height="20" rx="6" fill="#e9ecf2" stroke="#0b0b0f" stroke-width="6"/>
<g transform="rotate(-28 250 120)">
${sticker(`<rect x="232" y="60" width="36" height="170" rx="12" fill="#ff6a3d" stroke="#0b0b0f" stroke-width="7"/>`)}
${sticker(`<rect x="170" y="40" width="160" height="70" rx="16" fill="#9aa3b5" stroke="#0b0b0f" stroke-width="7"/>`)}
${eyes(250, 74, 15, { gap: 26, lookX: -0.6, lookY: 1 })}
</g>
${sparkle(200, 168, 20, "#ffc23d")}${sparkle(80, 120, 12)}${sparkle(340, 220, 10)}`,
  { rays: true },
);
