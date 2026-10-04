import { beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../helpers/db";
import { play } from "../helpers/runs";
import type { Db } from "@/lib/db/types";
import { syncRegistry } from "@/lib/games/catalog";
import { createAnonymousProfile, type ProfileRow } from "@/lib/players/service";
import { getBoard } from "@/lib/leaderboards/service";

let db: Db;
beforeAll(async () => {
  db = await testDb();
  await syncRegistry(db);
});

const ranks = (rows: Awaited<ReturnType<typeof getBoard>>["rows"]) => rows.filter((r) => !("gap" in r)).map((r) => ("gap" in r ? null : r.score));

describe("leaderboard ordering", () => {
  it("higher is better: descending, personal best only", async () => {
    const a = await createAnonymousProfile(db, { country: "NO" });
    const b = await createAnonymousProfile(db, { country: "SE" });
    const c = await createAnonymousProfile(db, { country: "NO" });
    await play(db, a, "keep-it-up", 30);
    await play(db, b, "keep-it-up", 50);
    await play(db, c, "keep-it-up", 40);
    await play(db, a, "keep-it-up", 10); // worse than PB — must not replace it
    const board = await getBoard(db, { gameId: "keep-it-up", board: "global", limit: 10, playerId: a.id });
    expect(ranks(board.rows)).toEqual([50, 40, 30]);
    expect(board.me).toMatchObject({ rank: 3, score: 30 });
    expect(board.total).toBe(3);
    const no = await getBoard(db, { gameId: "keep-it-up", board: "global", country: "NO", limit: 10 });
    expect(ranks(no.rows)).toEqual([40, 30]);
    const today = await getBoard(db, { gameId: "keep-it-up", board: "today", limit: 10 });
    expect(ranks(today.rows)).toEqual([50, 40, 30]);
    const week = await getBoard(db, { gameId: "keep-it-up", board: "week", limit: 10 });
    expect(week.total).toBe(3);
  });

  it("lower is better: ascending reaction times", async () => {
    const players: ProfileRow[] = [];
    for (const ms of [250, 190, 320]) {
      const p = await createAnonymousProfile(db);
      players.push(p);
      const { res } = await play(db, p, "reaction-flash", ms, { durationMs: 12_000 });
      expect(res.status).toBe("accepted");
    }
    const { res } = await play(db, players[2], "reaction-flash", 200, { durationMs: 12_000 });
    expect(res.personalBest?.isNew).toBe(true);
    expect(res.ranks?.global.rank).toBe(2);
    const board = await getBoard(db, { gameId: "reaction-flash", board: "global", limit: 10 });
    expect(ranks(board.rows)).toEqual([190, 200, 250]);
  });

  it("ties go to whoever got there first", async () => {
    const first = await createAnonymousProfile(db);
    const second = await createAnonymousProfile(db);
    await play(db, first, "tap-rush", 77, { durationMs: 10_000 });
    await new Promise((r) => setTimeout(r, 20));
    await play(db, second, "tap-rush", 77, { durationMs: 10_000 });
    const board = await getBoard(db, { gameId: "tap-rush", board: "global", limit: 10 });
    const ids = board.rows.filter((r) => !("gap" in r)).map((r) => ("gap" in r ? "" : r.playerId));
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
  });

  it("shows top 10, a gap and the player's neighbourhood on big boards", async () => {
    const ps: ProfileRow[] = [];
    for (let i = 0; i < 25; i++) {
      const p = await createAnonymousProfile(db);
      ps.push(p);
      await play(db, p, "flappy-critter", 100 - i, { durationMs: 120_000 });
    }
    const me = ps[20]; // rank 21
    const board = await getBoard(db, { gameId: "flappy-critter", board: "global", limit: 10, playerId: me.id });
    const shape = board.rows.map((r) => ("gap" in r ? "…" : r.rank));
    expect(shape).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "…", 19, 20, 21, 22, 23]);
    expect(board.rows.find((r) => !("gap" in r) && r.isMe)).toMatchObject({ rank: 21 });
  });

  it("friends board contains only followed players + me", async () => {
    const me = await createAnonymousProfile(db);
    const friend = await createAnonymousProfile(db);
    const stranger = await createAnonymousProfile(db);
    await play(db, me, "pop-rush", 300);
    await play(db, friend, "pop-rush", 400);
    await play(db, stranger, "pop-rush", 500);
    await db.query("insert into follows (follower_id, followee_id) values ($1, $2)", [me.id, friend.id]);
    const board = await getBoard(db, { gameId: "pop-rush", board: "friends", playerId: me.id, limit: 10 });
    expect(ranks(board.rows)).toEqual([400, 300]);
  });
});
