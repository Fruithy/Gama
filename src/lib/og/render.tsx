import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { GameDefinition } from "@/games/core/types";
import { placeholderArt } from "@/games/core/art-kit";
import { BRAND } from "@/lib/brand";

/**
 * Share card / OG image renderer (Satori). Original brand artwork only —
 * game illustration + giant score + rank + CTA.
 */
let fontCache: ArrayBuffer | null = null;
async function displayFont(): Promise<ArrayBuffer> {
  if (!fontCache) {
    const buf = await readFile(path.join(process.cwd(), "node_modules/@fontsource/unbounded/files/unbounded-latin-900-normal.woff"));
    fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  return fontCache;
}

export async function gameArtDataUri(def: GameDefinition): Promise<string> {
  const svg = def.art ? (await def.art()).default : placeholderArt(def.theme.bg, def.name.slice(0, 2));
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export type CardFormat = "story" | "square" | "og";
const SIZES: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  og: { width: 1200, height: 630 },
};

export async function renderScoreCard(opts: {
  def: GameDefinition;
  format: CardFormat;
  scoreText: string;
  unit: string;
  headline: string;
  username?: string;
  rankLine?: string;
  cta?: string;
}): Promise<ImageResponse> {
  const { width, height } = SIZES[opts.format];
  const art = await gameArtDataUri(opts.def);
  const font = await displayFont();
  const story = opts.format === "story";
  const og = opts.format === "og";
  const scale = og ? 0.62 : 1;
  const [c1, c2] = opts.def.theme.bg;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: og ? "row" : "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: og ? 56 : 72,
          background: `linear-gradient(160deg, ${c1} 0%, ${c2} 55%, #0a0a0c 100%)`,
          color: "#fff",
          fontFamily: "Unbounded",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: og ? "flex-start" : "center", flex: og ? 1 : undefined }}>
          <div style={{ display: "flex", fontSize: 30 * scale + 8, letterSpacing: 4, color: "#d4ff3a", background: "rgba(0,0,0,0.45)", padding: "12px 26px", borderRadius: 999 }}>
            {opts.def.name.toUpperCase()}
          </div>
          {opts.username && <div style={{ display: "flex", marginTop: 28 * scale, fontSize: 40 * scale, opacity: 0.9 }}>{opts.username}</div>}
          <div style={{ display: "flex", fontSize: 44 * scale, marginTop: 8, opacity: 0.85 }}>{opts.headline}</div>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: (story ? 300 : 240) * scale, lineHeight: 1, marginTop: 10, letterSpacing: -10 * scale }}>
            {opts.scoreText}
            {opts.unit && <span style={{ fontSize: 60 * scale, marginLeft: 18, opacity: 0.8, letterSpacing: 0 }}>{opts.unit}</span>}
          </div>
          {opts.rankLine && (
            <div style={{ display: "flex", marginTop: 18, fontSize: 46 * scale, background: "#d4ff3a", color: "#0a0a0c", padding: "14px 30px", borderRadius: 999 }}>{opts.rankLine}</div>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={art} width={story ? 760 : og ? 420 : 470} height={story ? 760 : og ? 420 : 470} style={{ borderRadius: 64, transform: "rotate(-4deg)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} />
        {!og && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: story ? 64 : 48 }}>{opts.cta ?? "You're not beating this."}</div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 30, opacity: 0.75, letterSpacing: 6 }}>{BRAND.name}</div>
          </div>
        )}
      </div>
    ),
    { width, height, fonts: [{ name: "Unbounded", data: font, weight: 900, style: "normal" }] },
  );
}
