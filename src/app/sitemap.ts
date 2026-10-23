import type { MetadataRoute } from "next";
import { liveGames } from "@/games/registry";
import { CATEGORIES } from "@/games/taxonomy";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${base}/games`, changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: `${base}/daily`, changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: `${base}/mine`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    ...CATEGORIES.map((c) => ({ url: `${base}/games/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7, lastModified: now })),
    ...liveGames.flatMap((g) => [
      { url: `${base}/games/${g.slug}`, changeFrequency: "weekly" as const, priority: 0.8, lastModified: now },
      { url: `${base}/games/${g.slug}/leaderboard`, changeFrequency: "hourly" as const, priority: 0.5, lastModified: now },
    ]),
  ];
}
