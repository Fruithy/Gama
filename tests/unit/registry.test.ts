import { describe, expect, it } from "vitest";
import { allGames, getGame, liveGames, relatedGames } from "@/games/registry";
import { CATEGORIES } from "@/games/taxonomy";

describe("game registry", () => {
  it("ships at least 24 playable games with unique slugs", () => {
    expect(liveGames.length).toBeGreaterThanOrEqual(24);
    expect(new Set(allGames.map((g) => g.slug)).size).toBe(allGames.length);
  });

  it("includes every game from the initial brief", () => {
    const required = ["perfect-tap", "tap-rush", "stop-the-bar", "nail-hit", "safe-tile", "impossible-grid", "rope-drop", "balance-bar", "stack-up", "precision-cut", "pop-rush", "reaction-flash", "lane-dodge", "platform-hop", "flappy-critter", "gravity-flip", "keep-it-up", "target-shot", "basket-flick", "memory-flash", "odd-one-out", "emoji-match", "path-draw", "physics-drop"];
    const missing = required.filter((s) => !getGame(s) || getGame(s)!.status !== "live");
    expect(missing).toEqual([]);
  });

  it.each(liveGames.map((g) => [g.slug, g] as const))("%s has complete, sane metadata", (_slug, g) => {
    expect(g.load).toBeTypeOf("function");
    expect(g.art).toBeTypeOf("function");
    expect(g.name.length).toBeGreaterThan(2);
    expect(g.shortDescription.length).toBeLessThanOrEqual(70);
    expect(g.instructions.length).toBeGreaterThan(10);
    expect(g.version).toBeGreaterThanOrEqual(1);
    expect(g.validation.maxDurationMs).toBeGreaterThan(g.validation.minDurationMs);
    expect(g.validation.maxActionsPerSecond).toBeGreaterThan(0);
    const { good, great, legendary } = g.milestones;
    if (g.scoreDirection === "higher") expect(good < great && great < legendary).toBe(true);
    else expect(good > great && great > legendary).toBe(true);
    if (g.usesCamera || g.usesMicrophone) expect(g.dailyEligible).toBe(false);
    expect(CATEGORIES.some((c) => c.match(g))).toBe(true);
  });

  it.each(liveGames.map((g) => [g.slug, g] as const))("%s has valid SVG artwork and a constructible runtime", async (_slug, g) => {
    const art = (await g.art!()).default;
    expect(art.startsWith("<svg")).toBe(true);
    expect(art).toContain("</svg>");
    const mod = await g.load!();
    const runtime = mod.default(g);
    for (const fn of ["initialize", "start", "pause", "resume", "reset", "destroy", "getScore", "getRunMetadata", "validateLocalRun", "onGameOver"] as const) {
      expect(runtime[fn]).toBeTypeOf("function");
    }
    expect(runtime.getScore()).toBe(0);
  });

  it("suggests related games without the current one", () => {
    const rel = relatedGames("stack-up", 5);
    expect(rel).toHaveLength(5);
    expect(rel.some((g) => g.slug === "stack-up")).toBe(false);
  });
});
