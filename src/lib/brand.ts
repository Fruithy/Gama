/**
 * BRAND — the only place the product name, voice and palette live.
 * Rename / re-skin the whole platform by editing this file (+ the logo mark
 * in components/brand/Logo.tsx and the colour tokens in globals.css).
 */
export const BRAND = {
  name: "FILTER ARCADE",
  shortName: "Filter Arcade",
  /** Used in <title> templates: "Stack Up · FILTER ARCADE". */
  titleSuffix: "FILTER ARCADE",
  tagline: "HOW HIGH CAN YOU RANK?",
  subline: "Quick games. Global scores. No download.",
  description: "Viral one-tap mini-games turned into a real competitive arcade. Play instantly, beat the world, challenge your friends.",
  cta: "PLAY NOW",
  colors: {
    background: "#0a0a0c",
    surface: "#131317",
    volt: "#d4ff3a",
    flare: "#ff3d7f",
    ion: "#3dd8ff",
    sun: "#ffc23d",
    violet: "#8b5cff",
  },
  /** Rotating provocations used on result screens and share cards. */
  taunts: ["You're not beating this.", "Top 1%. Prove it.", "One more try.", "Beat the world.", "Your move.", "Bet you can't."],
  social: { twitter: "", tiktok: "", instagram: "" },
} as const;

export function pickTaunt(seed: number): string {
  return BRAND.taunts[Math.abs(Math.floor(seed)) % BRAND.taunts.length];
}
