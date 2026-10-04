import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLiveGame, liveGames, relatedGames, toSummary, gamesInCategory } from "@/games/registry";
import { CATEGORIES, getCategory } from "@/games/taxonomy";
import { GameExperience } from "@/components/play/GameExperience";
import { GameRail } from "@/components/game/GameRail";
import { GameCard } from "@/components/game/GameCard";
import { toCard } from "@/components/game/types";
import { BRAND } from "@/lib/brand";
import { siteUrl } from "@/lib/env";

/**
 * /games/<slug> serves BOTH game pages (/games/stack-up) and category
 * landing pages (/games/timing). Everything here comes from the registry, so
 * pages are statically generated and served from the CDN; live data (records,
 * leaderboards) loads client-side.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [...liveGames.map((g) => ({ slug: g.slug })), ...CATEGORIES.map((c) => ({ slug: c.slug }))];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = getLiveGame(slug);
  if (game) {
    const title = `${game.name} — play free online`;
    const description = `${game.shortDescription} ${game.instructions} Free browser game, no download. Global leaderboard, daily challenges and friend challenges.`;
    return {
      title,
      description,
      alternates: { canonical: `/games/${game.slug}` },
      openGraph: { title: `${game.name} · ${BRAND.name}`, description, url: `/games/${game.slug}`, type: "website" },
      twitter: { card: "summary_large_image", title: `${game.name} · ${BRAND.name}`, description },
    };
  }
  const cat = getCategory(slug);
  if (!cat) return {};
  return {
    title: `${cat.title} — free online`,
    description: `${cat.description} Play ${cat.title.toLowerCase()} instantly in your browser and compete on global leaderboards.`,
    alternates: { canonical: `/games/${cat.slug}` },
  };
}

export default async function GameOrCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getLiveGame(slug);
  if (game) {
    const related = relatedGames(slug, 8).map(toCard);
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: game.name,
      description: game.shortDescription,
      url: `${siteUrl()}/games/${game.slug}`,
      image: `${siteUrl()}/games/${game.slug}/opengraph-image`,
      genre: getCategory(game.category)?.label,
      gamePlatform: "Web browser",
      applicationCategory: "Game",
      operatingSystem: "Any",
      playMode: "SinglePlayer",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: BRAND.name },
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <Suspense fallback={<div className="h-[70dvh]" />}>
          <GameExperience game={toSummary(game)} related={related} />
        </Suspense>
        <GameRail title="Play next" emoji="👉" games={related} />
      </>
    );
  }

  const cat = getCategory(slug);
  if (!cat) notFound();
  const games = gamesInCategory(slug).map(toCard);
  return (
    <div className="animate-rise px-4 pt-6 sm:px-0">
      <p className="text-5xl">{cat.emoji}</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none">{cat.title}</h1>
      <p className="mt-2 max-w-xl text-muted">{cat.description}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {games.map((g, i) => (
          <GameCard key={g.slug} game={g} size="lg" priority={i < 4} />
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-2">
        {CATEGORIES.filter((c) => c.slug !== slug).map((c) => (
          <a key={c.slug} href={`/games/${c.slug}`} className="press rounded-full bg-white/5 px-3 py-1.5 text-sm font-bold text-muted hover:text-text">
            {c.emoji} {c.label}
          </a>
        ))}
      </div>
    </div>
  );
}
