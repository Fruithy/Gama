import { allGames, getGame } from "@/games/registry";
import { placeholderArt } from "@/games/core/art-kit";

export const dynamic = "force-static";

export function generateStaticParams() {
  return allGames.map((g) => ({ file: `${g.slug}.svg` }));
}

/** Programmatic game artwork, rendered once at build and served from the CDN. */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const slug = file.replace(/\.svg$/, "");
  const def = getGame(slug);
  if (!def) return new Response("Not found", { status: 404 });
  const svg = def.art ? (await def.art()).default : placeholderArt(def.theme.bg, def.name.slice(0, 2).toUpperCase());
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
