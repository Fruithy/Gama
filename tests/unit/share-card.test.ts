import { describe, expect, it } from "vitest";
import { renderScoreCard } from "@/lib/og/render";
import { getGame } from "@/games/registry";

describe("share cards", () => {
  it.each(["story", "square", "og"] as const)("renders a %s PNG with and without a unit", async (format) => {
    const def = getGame("keep-it-up")!;
    for (const unit of ["", "kicks"]) {
      const res = await renderScoreCard({ def, format, scoreText: "47", unit, headline: "I scored", username: "@Fruithy", rankLine: "TOP 100 · #84", cta: "One more try." });
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.subarray(1, 4).toString()).toBe("PNG");
    }
  });
});
