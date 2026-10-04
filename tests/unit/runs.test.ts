import { beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/db";
import { cookieJar } from "../helpers/next-headers";
import type { Db } from "@/lib/db/types";


import { createAnonymousProfile, ensurePlayer, getProfileById } from "@/lib/players/service";
import { startRun, submitRun } from "@/lib/runs/service";
import { runChecksum } from "@/lib/security/run-validation";
import { getBoard } from "@/lib/leaderboards/service";
import { syncRegistry } from "@/lib/games/catalog";
import type { SubmitRunRequest } from "@/lib/runs/types";

let db: Db;

beforeAll(async () => {
  db = await testDb();
  await syncRegistry(db);
});

function payload(run: { runId: string; nonce: string; seed: string }, score: number, durationMs = 20_000, over: Partial<SubmitRunRequest> = {}): SubmitRunRequest {
  const checkpoints: Array<[number, number]> = [];
  for (let s = 1; s <= score; s++) checkpoints.push([Math.round((s / Math.max(1, score)) * (durationMs - 100)), s]);
  return {
    runId: run.runId,
    gameId: "stack-up",
    gameVersion: 1,
    score,
    completed: true,
    clientTimestamp: Date.now(),
    checksum: runChecksum(run.runId, run.nonce, score, durationMs),
    idempotencyKey: `idem-${run.runId}`,
    metadata: {
      seed: run.seed,
      gameVersion: 1,
      durationMs,
      actions: score + 2,
      peakActionsPerSecond: 3,
      checkpoints,
      stats: { perfects: 0 },
      input: { pointerDowns: score + 2, keyDowns: 0, rejectedMultiTouch: 0, rejectedFast: 0 },
    },
    ...over,
  };
}

describe("anonymous players", () => {
  it("creates an anonymous profile and sets a session cookie", async () => {
    cookieJar.clear();
    const p = await ensurePlayer(db);
    expect(p.username).toMatch(/^[A-Z][a-zA-Z]+\d{4}$/);
    expect(p.username_claimed).toBe(false);
    expect(cookieJar.get("fa_sid")).toBeTruthy();
    const again = await ensurePlayer(db);
    expect(again.id).toBe(p.id);
  });
});

describe("score submission", () => {
  it("accepts a plausible run, sets a PB and ranks it", async () => {
    const player = await createAnonymousProfile(db, { country: "NO" });
    const run = await startRun(db, player, { gameId: "stack-up", gameVersion: 1, mode: "normal" });
    // Server elapsed must cover the claimed duration → backdate start.
    await db.query("update score_runs set started_at = now() - interval '30 seconds' where id = $1", [run.runId]);
    const res = await submitRun(db, player, payload(run, 25));
    expect(res.status).toBe("accepted");
    expect(res.personalBest?.isNew).toBe(true);
    expect(res.ranks?.global.rank).toBe(1);
    expect(res.ranks?.global.tier).toBe("world-record");
    expect(res.xp?.gained).toBeGreaterThan(0);
    expect(res.achievements?.map((a) => a.id)).toContain("first-game");
    const fresh = await getProfileById(db, player.id);
    expect(fresh?.total_plays).toBe(1);
  });

  it("is idempotent for the same submission and rejects duplicates", async () => {
    const player = await createAnonymousProfile(db);
    const run = await startRun(db, player, { gameId: "stack-up", gameVersion: 1, mode: "normal" });
    await db.query("update score_runs set started_at = now() - interval '30 seconds' where id = $1", [run.runId]);
    const body = payload(run, 10);
    const a = await submitRun(db, player, body);
    const b = await submitRun(db, player, body);
    expect(b).toEqual(a);
    await expect(submitRun(db, player, { ...body, idempotencyKey: "different-key-123" })).rejects.toMatchObject({ code: "already_submitted" });
  });

  it("flags impossible scores and keeps them off the leaderboard", async () => {
    const player = await createAnonymousProfile(db);
    const run = await startRun(db, player, { gameId: "stack-up", gameVersion: 1, mode: "normal" });
    await db.query("update score_runs set started_at = now() - interval '30 seconds' where id = $1", [run.runId]);
    const res = await submitRun(db, player, payload(run, 1500, 20_000));
    expect(res.status).toBe("flagged");
    expect(res.reasons).toContain("score_rate_too_high");
    const board = await getBoard(db, { gameId: "stack-up", board: "global", limit: 50 });
    expect(board.rows.some((r) => "playerId" in r && r.playerId === player.id)).toBe(false);
  });

  it("flags a run that claims more time than the server window", async () => {
    const player = await createAnonymousProfile(db);
    const run = await startRun(db, player, { gameId: "stack-up", gameVersion: 1, mode: "normal" });
    const res = await submitRun(db, player, payload(run, 5, 60_000));
    expect(res.status).toBe("flagged");
    expect(res.reasons).toContain("duration_exceeds_server_window");
  });

  it("flags tampered checksums", async () => {
    const player = await createAnonymousProfile(db);
    const run = await startRun(db, player, { gameId: "stack-up", gameVersion: 1, mode: "normal" });
    await db.query("update score_runs set started_at = now() - interval '30 seconds' where id = $1", [run.runId]);
    const res = await submitRun(db, player, { ...payload(run, 12), checksum: "forged" });
    expect(res.status).toBe("flagged");
    expect(res.reasons).toContain("checksum_mismatch");
  });

  it("rejects runs submitted by another player and version mismatches", async () => {
    const a = await createAnonymousProfile(db);
    const b = await createAnonymousProfile(db);
    const run = await startRun(db, a, { gameId: "stack-up", gameVersion: 1, mode: "normal" });
    await expect(submitRun(db, b, payload(run, 3))).rejects.toMatchObject({ code: "not_your_run" });
    await expect(startRun(db, a, { gameId: "stack-up", gameVersion: 99, mode: "normal" })).rejects.toMatchObject({ code: "version_mismatch" });
  });
});
