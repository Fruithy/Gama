import "server-only";
import type { Db } from "@/lib/db";
import { dayKey, weekKey } from "@/lib/time";
import { composeBoard, type BoardEntry, type BoardRow } from "./compose";

/**
 * Leaderboard queries.
 *
 * Every board is a compact "best per player" table with an index on
 * (game, [period], sort_score DESC, achieved_at ASC):
 *  - top-N    → index range scan, LIMIT N
 *  - my rank  → COUNT over the index prefix above my score
 *  - nearby   → two LIMIT 2 index scans around my score
 * No query touches the raw `score_runs` log.
 */

export type BoardKind = "global" | "today" | "week" | "friends" | "daily";

export interface BoardQuery {
  gameId: string;
  board: BoardKind;
  country?: string | null;
  playerId?: string | null;
  dailyChallengeId?: string | null;
  limit?: number;
  /** Day/week keys (defaults: now). */
  day?: string;
  week?: string;
}

interface Source {
  sql: string;
  params: unknown[];
  countKey: string | null;
}

/** A sub-select exposing (player_id, score, sort_score, achieved_at, country). */
function source(q: BoardQuery): Source {
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  let sql: string;
  let countKey: string | null;
  switch (q.board) {
    case "global":
      sql = `select player_id, score, sort_score, achieved_at, country from personal_bests where game_id = ${p(q.gameId)}`;
      countKey = "global";
      break;
    case "today": {
      const k = q.day ?? dayKey();
      sql = `select player_id, score, sort_score, achieved_at, country from period_bests where game_id = ${p(q.gameId)} and period = 'day' and period_key = ${p(k)}::date`;
      countKey = `day:${k}`;
      break;
    }
    case "week": {
      const k = q.week ?? weekKey();
      sql = `select player_id, score, sort_score, achieved_at, country from period_bests where game_id = ${p(q.gameId)} and period = 'week' and period_key = ${p(k)}::date`;
      countKey = `week:${k}`;
      break;
    }
    case "daily":
      if (!q.dailyChallengeId) throw new Error("dailyChallengeId required");
      sql = `select player_id, best_score as score, sort_score, achieved_at, country from daily_challenge_scores where daily_challenge_id = ${p(q.dailyChallengeId)}`;
      countKey = `daily:${q.dailyChallengeId}`;
      break;
    case "friends": {
      const me = q.playerId ?? "00000000-0000-0000-0000-000000000000";
      sql = `select player_id, score, sort_score, achieved_at, country from personal_bests where game_id = ${p(q.gameId)}
             and player_id in (select followee_id from follows where follower_id = ${p(me)} union all select ${p(me)}::uuid)`;
      countKey = null;
      break;
    }
  }
  if (q.country) {
    sql += ` and country = ${p(q.country)}`;
    countKey = null;
  }
  return { sql, params, countKey };
}

interface RawRow {
  player_id: string;
  score: number;
  sort_score: number;
  achieved_at: Date;
  country: string | null;
  username: string;
  avatar: string;
}

function toEntry(r: RawRow, rank: number): BoardEntry {
  return {
    rank,
    playerId: r.player_id,
    username: r.username,
    avatar: r.avatar,
    country: r.country,
    score: Number(r.score),
    achievedAt: new Date(r.achieved_at).toISOString(),
  };
}

function shift(sql: string, by: number) {
  return sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + by}`);
}

export async function boardTotal(db: Db, q: BoardQuery): Promise<number> {
  const src = source(q);
  if (src.countKey) {
    const rows = await db.query<{ entries: number }>("select entries from leaderboard_counts where game_id = $1 and board = $2", [q.gameId, src.countKey]);
    if (rows[0]) return Number(rows[0].entries);
  }
  const rows = await db.query<{ n: number }>(`select count(*)::int as n from (${src.sql}) s`, src.params);
  return rows[0]?.n ?? 0;
}

export async function topEntries(db: Db, q: BoardQuery, limit: number): Promise<BoardEntry[]> {
  const src = source(q);
  const rows = await db.query<RawRow>(
    `select s.*, p.username, p.avatar from (${src.sql}) s join profiles p on p.id = s.player_id
     order by s.sort_score desc, s.achieved_at asc limit $${src.params.length + 1}`,
    [...src.params, limit],
  );
  return rows.map((r, i) => toEntry(r, i + 1));
}

/** 1-based rank of a (sort_score, achieved_at) pair on a board. */
export async function rankOf(db: Db, q: BoardQuery, sortScore: number, achievedAt: Date | string, excludePlayerId?: string): Promise<number> {
  const src = source(q);
  const n = src.params.length;
  const rows = await db.query<{ rank: number }>(
    `select count(*)::int + 1 as rank from (${src.sql}) s
     where (s.sort_score > $${n + 1} or (s.sort_score = $${n + 1} and s.achieved_at < $${n + 2}))
       and s.player_id is distinct from $${n + 3}::uuid`,
    [...src.params, sortScore, new Date(achievedAt), excludePlayerId ?? null],
  );
  return rows[0]?.rank ?? 1;
}

export async function playerEntry(db: Db, q: BoardQuery, playerId: string): Promise<BoardEntry | null> {
  const src = source(q);
  const n = src.params.length;
  const rows = await db.query<RawRow>(
    `select s.*, p.username, p.avatar from (${src.sql}) s join profiles p on p.id = s.player_id where s.player_id = $${n + 1}`,
    [...src.params, playerId],
  );
  if (!rows[0]) return null;
  const rank = await rankOf(db, q, Number(rows[0].sort_score), rows[0].achieved_at);
  return toEntry(rows[0], rank);
}

/** Entries just above and below a position (for the "…, you, …" tail). */
export async function neighbours(db: Db, q: BoardQuery, me: BoardEntry & { sortScore: number }, span = 2): Promise<BoardEntry[]> {
  const src = source(q);
  const n = src.params.length;
  const base = `select s.*, p.username, p.avatar from (${src.sql}) s join profiles p on p.id = s.player_id`;
  const at = new Date(me.achievedAt);
  const [above, below] = await Promise.all([
    db.query<RawRow>(
      `${base} where s.sort_score > $${n + 1} or (s.sort_score = $${n + 1} and s.achieved_at < $${n + 2})
       order by s.sort_score asc, s.achieved_at desc limit $${n + 3}`,
      [...src.params, me.sortScore, at, span],
    ),
    db.query<RawRow>(
      `${base} where s.sort_score < $${n + 1} or (s.sort_score = $${n + 1} and s.achieved_at > $${n + 2})
       order by s.sort_score desc, s.achieved_at asc limit $${n + 3}`,
      [...src.params, me.sortScore, at, span],
    ),
  ]);
  return [
    ...above.map((r, i) => toEntry(r, me.rank - 1 - i)).reverse(),
    me,
    ...below.map((r, i) => toEntry(r, me.rank + 1 + i)),
  ];
}

export interface BoardResult {
  board: BoardKind;
  country: string | null;
  rows: BoardRow[];
  total: number;
  me: BoardEntry | null;
}

export async function getBoard(db: Db, q: BoardQuery): Promise<BoardResult> {
  const limit = Math.min(100, Math.max(1, q.limit ?? 10));
  const [top, total] = await Promise.all([topEntries(db, q, limit), boardTotal(db, q)]);
  let me: BoardEntry | null = null;
  let around: BoardEntry[] = [];
  if (q.playerId) {
    const src = source(q);
    const n = src.params.length;
    const mine = await db.query<RawRow>(
      `select s.*, p.username, p.avatar from (${src.sql}) s join profiles p on p.id = s.player_id where s.player_id = $${n + 1}`,
      [...src.params, q.playerId],
    );
    if (mine[0]) {
      const rank = await rankOf(db, q, Number(mine[0].sort_score), mine[0].achieved_at);
      me = toEntry(mine[0], rank);
      if (rank > limit) around = await neighbours(db, q, { ...me, sortScore: Number(mine[0].sort_score) });
    }
  }
  return { board: q.board, country: q.country ?? null, rows: composeBoard(top, around, q.playerId ?? null), total, me };
}

// Exported for tests / admin tools.
export const _internal = { source, shift };
