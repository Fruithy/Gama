import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const SIZES = ["180", "192", "512", "maskable-512"];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

/** PNG app icons for the PWA manifest / iOS home screen, drawn from the logo mark. */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  const maskable = size.startsWith("maskable");
  const px = Number(size.replace("maskable-", ""));
  const inner = maskable ? px * 0.62 : px * 0.84;
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0c" }}>
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: inner * 0.28,
            background: "linear-gradient(135deg, #d4ff3a, #3dd8ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div style={{ width: inner * 0.56, height: inner * 0.56, borderRadius: inner, border: `${inner * 0.08}px solid #0a0a0c`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 0, height: 0, borderTop: `${inner * 0.12}px solid transparent`, borderBottom: `${inner * 0.12}px solid transparent`, borderLeft: `${inner * 0.2}px solid #0a0a0c`, marginLeft: inner * 0.05 }} />
          </div>
          <div style={{ position: "absolute", top: inner * 0.12, right: inner * 0.12, width: inner * 0.13, height: inner * 0.13, borderRadius: inner, background: "#ff3d7f", border: `${inner * 0.035}px solid #0a0a0c` }} />
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
