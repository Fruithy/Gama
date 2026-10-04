import { eyes, frame, sparkle } from "../core/art-kit";

const cells: string[] = [];
for (let r = 0; r < 4; r++)
  for (let c = 0; c < 4; c++) {
    const odd = r === 2 && c === 1;
    cells.push(`<rect x="${58 + c * 74}" y="${58 + r * 74}" width="64" height="64" rx="14" fill="${odd ? "#ffd56b" : "#ffc23d"}" stroke="#0b0b0f" stroke-width="5"/>`);
  }
export default frame(
  ["#2e2406", "#c49a1d"],
  `${cells.join("")}
<circle cx="164" cy="238" r="58" fill="none" stroke="#fff" stroke-width="9"/>
<path d="M206 280 l60 60" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
${eyes(164, 238, 12, { gap: 18, lookX: 0.5 })}
${sparkle(350, 50, 14)}${sparkle(340, 340, 10)}`,
);
