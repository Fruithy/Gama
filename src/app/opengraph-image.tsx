import { liveGames } from "@/games/registry";
import { renderScoreCard } from "@/lib/og/render";
import { BRAND } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = BRAND.name;

export default async function Image() {
  const def = liveGames.find((g) => g.featured) ?? liveGames[0];
  return renderScoreCard({ def, format: "og", scoreText: "#1", unit: "", headline: BRAND.tagline, rankLine: BRAND.subline.toUpperCase() });
}
