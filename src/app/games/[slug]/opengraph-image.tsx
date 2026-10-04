import { CATEGORIES, getCategory } from "@/games/taxonomy";
import { getLiveGame, liveGames } from "@/games/registry";
import { renderScoreCard } from "@/lib/og/render";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FILTER ARCADE game";

export function generateStaticParams() {
  return [...liveGames.map((g) => ({ slug: g.slug })), ...CATEGORIES.map((c) => ({ slug: c.slug }))];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getLiveGame(slug) ?? liveGames.find((g) => getCategory(slug)?.match(g)) ?? liveGames[0];
  const cat = getCategory(slug);
  return renderScoreCard({
    def,
    format: "og",
    scoreText: cat ? cat.emoji : "#1",
    unit: "",
    headline: cat ? cat.title : def.shortDescription,
    rankLine: cat ? "PLAY FREE" : "CAN YOU TAKE IT?",
  });
}
