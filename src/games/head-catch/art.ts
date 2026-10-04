import { eyes, frame, sparkle } from "../core/art-kit";

export default frame(
  ["#06222e", "#1d8ac4"],
  `<rect x="80" y="60" width="240" height="190" rx="36" fill="#0b0b0f" opacity="0.4"/>
<rect x="70" y="50" width="240" height="190" rx="36" fill="#0e3a52" stroke="#0b0b0f" stroke-width="7"/>
<circle cx="190" cy="140" r="62" fill="#ffc23d" stroke="#0b0b0f" stroke-width="7"/>
${eyes(190, 128, 14, { gap: 24, lookX: 1 })}
<path d="M168 162 q22 18 44 0" stroke="#0b0b0f" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M100 140 l-30 0 M280 140 l30 0" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
<path d="M60 140 l16 -12 v24z M320 140 l-16 -12 v24z" fill="#fff"/>
<circle cx="290" cy="74" r="10" fill="#ff3d7f"/>
<path d="M120 300 h160 l-16 60 h-128z" fill="#c97b2b" stroke="#0b0b0f" stroke-width="7" stroke-linejoin="round"/>
<circle cx="200" cy="280" r="18" fill="#ff3d7f" stroke="#0b0b0f" stroke-width="5"/>
${sparkle(350, 330, 14)}`,
  { grid: true },
);
