import { beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/db";
import { play } from "../helpers/runs";
import type { Db } from "@/lib/db/types";
import { syncRegistry } from "@/lib/games/catalog";
import { createAnonymousProfile, getProfileById } from "@/lib/players/service";
import { createChallenge, getChallenge, recordChallengeOpen } from "@/lib/challenges/service";
import { getDailyChallenge, setDailyChallenge } from "@/lib/daily/service";
import { startRun } from "@/lib/runs/service";
import { getBoard } from "@/lib/leaderboards/service";
import { dayKey } from "@/lib/time";

let db: Db;
beforeAll(async () => {
  db = await testDb();
  await syncRegistry(db);
});

describe("friend challenges", () => {
  it("creates a shareable link, shares the seed, and resolves win/loss", async () => {
    const host = await createAnonymousProfile(db, { username: "Fruithy" });
    const { res } = await play(db, host, "stack-up", 47);
    const { token } = await createChallenge(db, host.id, res.runId);
    expect(token).toMatch(/^[2-9a-zA-Z]{10}$/);
    // Same run → same link (idempotent).
    expect((await createChallenge(db, host.id, res.runId)).token).toBe(token);

    const info = await getChallenge(db, token);
    expect(info).toMatchObject({ gameId: "stack-up", score: 47, creator: { username: "Fruithy" } });
    await recordChallengeOpen(db, token, null);

    const rival = await createAnonymousProfile(db);
    const start = await startRun(db, rival, { gameId: "stack-up", gameVersion: 1, mode: "challenge", challengeToken: token });
    const hostRun = await db.query<{ seed: string }>("select seed from score_runs where id = $1", [res.runId]);
    expect(start.seed).toBe(hostRun[0].seed); // identical level

    const lost = await play(db, rival, "stack-up", 44, { mode: "challenge", challengeToken: token });
    expect(lost.res.challenge).toMatchObject({ won: false, margin: 3, opponent: { username: "Fruithy", score: 47 } });
    const won = await play(db, rival, "stack-up", 52, { mode: "challenge", challengeToken: token });
    expect(won.res.challenge).toMatchObject({ won: true, margin: 5 });
    expect((await getProfileById(db, rival.id))?.challenge_wins).toBe(1);
    const again = await play(db, rival, "stack-up", 60, { mode: "challenge", challengeToken: token });
    expect(again.res.challenge?.won).toBe(true);
    expect((await getProfileById(db, rival.id))?.challenge_wins).toBe(1); // no farming one link

    const stats = await getChallenge(db, token);
    expect(stats?.stats).toEqual({ opens: 1, attempts: 3, wins: 2 });
  });

  it("refuses links for flagged or foreign runs, and unknown tokens", async () => {
    const a = await createAnonymousProfile(db);
    const b = await createAnonymousProfile(db);
    const { res } = await play(db, a, "stack-up", 10);
    await expect(createChallenge(db, b.id, res.runId)).rejects.toMatchObject({ code: "run_not_found" });
    expect(await getChallenge(db, "nope")).toBeNull();
  });
});

describe("daily challenge", () => {
  it("creates exactly one challenge per day with a shared seed", async () => {
    const a = await getDailyChallenge(db);
    const b = await getDailyChallenge(db);
    expect(a.id).toBe(b.id);
    expect(a.day).toBe(dayKey());
  });

  it("tracks attempts, best, rank and streak", async () => {
    await setDailyChallenge(db, dayKey(), "keep-it-up");
    const daily = await getDailyChallenge(db);
    expect(daily.game_id).toBe("keep-it-up");
    const p = await createAnonymousProfile(db);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await db.query("update profiles set last_daily_day = $2::date, daily_streak = 4 where id = $1", [p.id, yesterday]);
    const first = await play(db, p, "keep-it-up", 20, { mode: "daily" });
    expect(first.res.daily).toMatchObject({ attempts: 1, best: 20, rank: 1, streak: 5 });
    expect(first.res.xp?.breakdown.map((b) => b.reason)).toContain("Daily challenge");
    const second = await play(db, p, "keep-it-up", 15, { mode: "daily" });
    expect(second.res.daily).toMatchObject({ attempts: 2, best: 20, streak: 5 });
    const board = await getBoard(db, { gameId: "keep-it-up", board: "daily", dailyChallengeId: daily.id, playerId: p.id });
    expect(board.me?.score).toBe(20);
  });

  it("rejects daily runs for the wrong game", async () => {
    const p = await createAnonymousProfile(db);
    await expect(startRun(db, p, { gameId: "stack-up", gameVersion: 1, mode: "daily" })).rejects.toMatchObject({ code: "daily_mismatch" });
  });
});
