import { describe, expect, it } from "vitest";
import { computeRunXp, DEFAULT_XP, levelFromXp, xpForLevel } from "@/lib/xp/rules";
import { evaluateAchievements, type AchievementContext } from "@/lib/achievements/evaluate";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import { dailySeed, nextStreak, selectDailyGame, selectDailySequence } from "@/lib/daily/select";
import { composeBoard, percentileBetterThan, rankTier } from "@/lib/leaderboards/compose";
import { trendingScore } from "@/lib/analytics/trending";
import { generateUsername, validateUsername } from "@/lib/players/username";
import { flagEmoji, normalizeCountry } from "@/lib/country";
import { createRng } from "@/games/core/rng";
import { formatScore, isBetter, toSortScore } from "@/games/core/format";
import { addDays, weekKey } from "@/lib/time";
import { shouldShowInterstitial } from "@/lib/config/monetization";

describe("XP", () => {
  const base = { durationMs: 10_000, paidRunsToday: 0, firstPlayOfDay: false, isPersonalBest: false, firstTimeGame: false, firstDailyRunToday: false, challengeWon: false, accepted: true };
  it("pays completion XP and stacks bonuses", () => {
    expect(computeRunXp(base).total).toBe(DEFAULT_XP.completion);
    const all = computeRunXp({ ...base, firstPlayOfDay: true, isPersonalBest: true, firstDailyRunToday: true, challengeWon: true, firstTimeGame: true });
    expect(all.total).toBe(DEFAULT_XP.completion + DEFAULT_XP.firstPlayOfDay + DEFAULT_XP.personalBest + DEFAULT_XP.dailyChallenge + DEFAULT_XP.challengeWin + DEFAULT_XP.newGameBonus);
  });
  it("blocks farming: meaningless runs and daily caps", () => {
    expect(computeRunXp({ ...base, durationMs: 500 }).total).toBe(0);
    expect(computeRunXp({ ...base, paidRunsToday: DEFAULT_XP.maxPaidRunsPerGamePerDay }).total).toBe(0);
    expect(computeRunXp({ ...base, accepted: false, isPersonalBest: true }).total).toBe(0);
  });
  it("has a monotonic level curve", () => {
    expect(levelFromXp(0)).toBe(1);
    for (let l = 2; l < 50; l++) {
      expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      expect(levelFromXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
  });
});

describe("achievements", () => {
  const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
    player: { total_plays: 1, games_played: 1, daily_streak: 0, challenge_wins: 0, daily_wins: 0, categories_played: 1, level: 1 },
    personalBestCount: 0,
    ...over,
  });
  it("unlocks rule-based achievements once", () => {
    const first = evaluateAchievements(ACHIEVEMENTS, ctx(), new Set());
    expect(first.map((a) => a.id)).toEqual(["first-game"]);
    expect(evaluateAchievements(ACHIEVEMENTS, ctx(), new Set(["first-game"]))).toEqual([]);
  });
  it("handles rank, run stat and impossible-win rules", () => {
    const ids = evaluateAchievements(
      ACHIEVEMENTS,
      ctx({ run: { score: 2000, scoreFormat: "points", scoreDirection: "higher", difficulty: "impossible", legendary: 1600, stats: { perfects: 12 }, globalRank: 1, dailyRank: 1 } }),
      new Set(["first-game"]),
    ).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["world-record", "global-top-10", "global-top-100", "daily-1", "perfect-10", "impossible-win", "score-100"]));
  });
  it("respects challenge win and streak thresholds", () => {
    const ids = evaluateAchievements(ACHIEVEMENTS, ctx({ player: { total_plays: 5, games_played: 1, daily_streak: 10, challenge_wins: 10, daily_wins: 0, categories_played: 1, level: 3 } }), new Set()).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["streak-10", "streak-3", "challenge-winner", "beat-10-friends"]));
  });
});

describe("daily challenge selection", () => {
  const games = ["a", "b", "c", "d", "e", "f", "g", "h"];
  it("is deterministic per day and independent of input order", () => {
    expect(selectDailyGame("2026-10-04", games)).toBe(selectDailyGame("2026-10-04", [...games].reverse()));
    expect(dailySeed("2026-10-04", "a")).toBe(dailySeed("2026-10-04", "a"));
    expect(dailySeed("2026-10-04", "a")).not.toBe(dailySeed("2026-10-05", "a"));
  });
  it("never repeats a game inside the cooldown window", () => {
    const days = Array.from({ length: 60 }, (_, i) => addDays("2026-01-01", i));
    const seq = selectDailySequence(days, games, 5);
    for (let i = 0; i < days.length; i++) {
      const window = days.slice(Math.max(0, i - 5), i).map((d) => seq[d]);
      expect(window).not.toContain(seq[days[i]]);
    }
  });
  it("computes streaks across consecutive days", () => {
    expect(nextStreak(null, 0, "2026-10-04")).toBe(1);
    expect(nextStreak("2026-10-03", 4, "2026-10-04")).toBe(5);
    expect(nextStreak("2026-10-01", 4, "2026-10-04")).toBe(1);
    expect(nextStreak("2026-10-04", 4, "2026-10-04")).toBe(4);
  });
  it("uses Monday-based week keys", () => {
    expect(weekKey(new Date("2026-10-04T12:00:00Z"))).toBe("2026-09-28"); // Sunday → previous Monday
    expect(weekKey(new Date("2026-09-28T00:00:00Z"))).toBe("2026-09-28");
  });
});

describe("leaderboard presentation", () => {
  const e = (rank: number, id = `p${rank}`) => ({ rank, playerId: id, username: id, avatar: "b0-c0", country: null, score: 100 - rank, achievedAt: "2026-10-04T00:00:00Z" });
  it("shows top N, a gap, then the player's neighbourhood", () => {
    const rows = composeBoard([e(1), e(2), e(3)], [e(12480), e(12481, "me"), e(12482)], "me");
    expect(rows.map((r) => ("gap" in r ? "…" : r.rank))).toEqual([1, 2, 3, "…", 12480, 12481, 12482]);
    expect(rows.find((r) => !("gap" in r) && r.isMe)).toMatchObject({ rank: 12481 });
  });
  it("omits the gap when the neighbourhood touches the top", () => {
    const rows = composeBoard([e(1), e(2), e(3)], [e(3), e(4, "me"), e(5)], "me");
    expect(rows.map((r) => ("gap" in r ? "…" : r.rank))).toEqual([1, 2, 3, 4, 5]);
  });
  it("labels rank tiers", () => {
    expect(rankTier(1, 10)).toBe("world-record");
    expect(rankTier(7, 1000)).toBe("top-10");
    expect(rankTier(80, 1000)).toBe("top-100");
    expect(rankTier(842, 100_000)).toBe("top-1000");
    expect(rankTier(30, 20)).toBe(null);
    expect(rankTier(5, 12)).toBe(null);
    expect(percentileBetterThan(1, 100)).toBe(100);
  });
});

describe("score formatting & direction", () => {
  it("sorts both directions with one descending index", () => {
    expect(toSortScore(10, "higher")).toBeGreaterThan(toSortScore(5, "higher"));
    expect(toSortScore(180, "lower")).toBeGreaterThan(toSortScore(250, "lower"));
    expect(isBetter(180, 250, "lower")).toBe(true);
    expect(isBetter(10, 5, "higher")).toBe(true);
  });
  it("formats integers per score format", () => {
    expect(formatScore(1234, "points")).toBe("1,234");
    expect(formatScore(1234, "centiseconds")).toBe("12.34");
    expect(formatScore(987, "percent10")).toBe("98.7%");
  });
});

describe("trending", () => {
  it("weights recent activity more than old activity", () => {
    const day = (ageDays: number, plays: number) => ({ ageDays, plays, shares: 0, challenges: 0, favorites: 0, completions: plays, retries: 0 });
    expect(trendingScore([day(0, 100)], 0)).toBeGreaterThan(trendingScore([day(5, 100)], 0));
    expect(trendingScore([day(0, 10)], 50)).toBeGreaterThan(trendingScore([day(0, 10)], 0));
  });
});

describe("usernames & countries", () => {
  it("validates length, characters, reserved names and profanity (with leetspeak)", () => {
    expect(validateUsername("Fruithy").ok).toBe(true);
    expect(validateUsername("ab").ok).toBe(false);
    expect(validateUsername("a".repeat(25)).ok).toBe(false);
    expect(validateUsername("bad name").ok).toBe(false);
    expect(validateUsername("1startsWithDigit").ok).toBe(false);
    expect(validateUsername("Admin").ok).toBe(false);
    expect(validateUsername("sh1tlord").ok).toBe(false);
    expect(validateUsername("f4ggot").ok).toBe(false);
    expect(validateUsername("Raven2199").ok).toBe(true);
    expect(validateUsername("double__under").ok).toBe(false);
  });
  it("generates valid guest names", () => {
    const rng = createRng("names");
    for (let i = 0; i < 200; i++) expect(validateUsername(generateUsername(() => rng.next())).ok).toBe(true);
  });
  it("only accepts ISO country codes", () => {
    expect(normalizeCountry("no")).toBe("NO");
    expect(normalizeCountry("XX")).toBe(null);
    expect(flagEmoji("NO")).toBe("🇳🇴");
  });
});

describe("seeded randomness", () => {
  it("replays identically for the same seed", () => {
    const a = createRng("daily-seed");
    const b = createRng("daily-seed");
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
    expect(createRng("x").next()).not.toBe(createRng("y").next());
  });
});

describe("monetization policy", () => {
  it("never interrupts gameplay and respects frequency", () => {
    const base = { adsEnabled: true, inGameplay: false, lifetimeRuns: 50, runsSinceLastAd: 10, secondsSinceLastAd: 999, premium: false };
    expect(shouldShowInterstitial(base)).toBe(true);
    expect(shouldShowInterstitial({ ...base, inGameplay: true })).toBe(false);
    expect(shouldShowInterstitial({ ...base, adsEnabled: false })).toBe(false);
    expect(shouldShowInterstitial({ ...base, runsSinceLastAd: 1 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, lifetimeRuns: 2 })).toBe(false);
  });
});
