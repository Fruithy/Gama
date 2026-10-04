import "server-only";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api/http";
import { allGames, getGame } from "@/games/registry";
import { dayKey, weekKey } from "@/lib/time";
import { invalidateCatalogCache } from "@/lib/home/service";
import { setDailyChallenge } from "@/lib/daily/service";

/* ════════════════════════════ overview ════════════════════════════ */

export async function overview(db: Db) {
  const today = dayKey();
  const [plays, uniques, newPlayers, accounts, rollup, challenges, daily, series, top, growth] = await Promise.all([
    db.query<{ n: number }>("select coalesce(sum(starts),0)::int n from game_daily_stats where day = $1::date", [today]),
    db.query<{ n: number; runs: number }>(
      "select count(distinct player_id)::int n, count(*)::int runs from score_runs where started_at >= $1::date",
      [today],
    ),
    db.query<{ n: number }>("select count(*)::int n from profiles where created_at >= $1::date and not is_seed", [today]),
    db.query<{ n: number }>("select count(*)::int n from profiles where auth_user_id is not null and updated_at >= $1::date", [today]),
    db.query<{ retries: number; starts: number; shares: number; challenges: number }>(
      "select coalesce(sum(retries),0)::int retries, coalesce(sum(starts),0)::int starts, coalesce(sum(shares),0)::int shares, coalesce(sum(challenges_created),0)::int challenges from game_daily_stats where day = $1::date",
      [today],
    ),
    db.query<{ opens: number; attempts: number; conversions: number }>(
      "select coalesce(sum(opens),0)::int opens, coalesce(sum(attempts),0)::int attempts, coalesce(sum(conversions),0)::int conversions from challenges where created_at >= now() - interval '7 days'",
    ),
    db.query<{ n: number }>(
      "select count(*)::int n from daily_challenge_scores s join daily_challenges d on d.id = s.daily_challenge_id where d.day = $1::date",
      [today],
    ),
    db.query<{ day: string; plays: number }>(
      `select d::date::text as day, coalesce((select sum(starts) from game_daily_stats s where s.day = d::date), 0)::int as plays
       from generate_series($1::date - 6, $1::date, interval '1 day') d order by d`,
      [today],
    ),
    db.query<{ game_id: string; plays: number }>(
      "select game_id, sum(starts)::int plays from game_daily_stats where day = $1::date group by game_id order by plays desc limit 5",
      [today],
    ),
    db.query<{ game_id: string; recent: number; prior: number }>(
      `select game_id,
         coalesce(sum(starts) filter (where day > $1::date - 3), 0)::int recent,
         coalesce(sum(starts) filter (where day <= $1::date - 3 and day > $1::date - 6), 0)::int prior
       from game_daily_stats where day > $1::date - 6 group by game_id`,
      [today],
    ),
  ]);
  const u = uniques[0];
  const r = rollup[0];
  const c = challenges[0];
  const fastest = growth
    .filter((g) => g.recent >= 5)
    .map((g) => ({ gameId: g.game_id, growth: g.prior ? (g.recent - g.prior) / g.prior : 1 }))
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 5);
  return {
    today,
    playsToday: plays[0].n,
    uniquePlayers: u.n,
    newPlayers: newPlayers[0].n,
    newAccounts: accounts[0].n,
    gamesPerPlayer: u.n ? u.runs / u.n : 0,
    retryRate: r.starts ? r.retries / r.starts : 0,
    shares: r.shares,
    challengeLinks: r.challenges,
    challengeConversion: c.opens ? c.attempts / c.opens : 0,
    challengeConversions: c.conversions,
    dailyParticipation: daily[0].n,
    series,
    mostPlayed: top.map((t) => ({ gameId: t.game_id, plays: t.plays })),
    fastestGrowing: fastest,
  };
}

/* ════════════════════════════ per-game analytics ════════════════════════════ */

export async function gameAnalytics(db: Db, gameId: string) {
  const def = getGame(gameId);
  if (!def) throw new ApiError(404, "game_not_found");
  const [totals, runs, d1, series, dist] = await Promise.all([
    db.query<{ starts: number; completions: number; retries: number; shares: number; challenges: number; opens: number; impressions: number; favorites: number }>(
      `select coalesce(sum(starts),0)::int starts, coalesce(sum(completions),0)::int completions, coalesce(sum(retries),0)::int retries,
              coalesce(sum(shares),0)::int shares, coalesce(sum(challenges_created),0)::int challenges, coalesce(sum(opens),0)::int opens,
              coalesce(sum(impressions),0)::int impressions, coalesce(sum(favorites),0)::int favorites
       from game_daily_stats where game_id = $1 and day >= (now() at time zone 'utc')::date - 6`,
      [gameId],
    ),
    db.query<{ players: number; avg_ms: number | null; median_ms: number | null; flagged: number }>(
      `select count(distinct player_id)::int players, avg(duration_ms)::float8 avg_ms,
              percentile_cont(0.5) within group (order by duration_ms)::float8 median_ms,
              count(*) filter (where status = 'flagged')::int flagged
       from score_runs where game_id = $1 and submitted_at >= now() - interval '7 days'`,
      [gameId],
    ),
    // D1 return proxy: of players who played on day X, the share who played again on X+1 (last 7 days).
    db.query<{ ratio: number | null }>(
      `with days as (select distinct player_id, (started_at at time zone 'utc')::date d from score_runs where game_id = $1 and started_at >= now() - interval '8 days')
       select (count(*) filter (where exists (select 1 from days b where b.player_id = a.player_id and b.d = a.d + 1)))::float8 / nullif(count(*), 0) as ratio
       from days a where a.d < (now() at time zone 'utc')::date`,
      [gameId],
    ),
    db.query<{ day: string; plays: number }>(
      `select d::date::text as day, coalesce((select starts from game_daily_stats s where s.game_id = $1 and s.day = d::date), 0)::int plays
       from generate_series((now() at time zone 'utc')::date - 6, (now() at time zone 'utc')::date, interval '1 day') d order by d`,
      [gameId],
    ),
    db.query<{ lo: number; hi: number }>("select min(score)::float8 lo, max(score)::float8 hi from personal_bests where game_id = $1", [gameId]),
  ]);
  let histogram: Array<{ from: number; to: number; count: number }> = [];
  const { lo, hi } = dist[0] ?? { lo: null, hi: null };
  if (lo !== null && hi !== null) {
    const buckets = 12;
    const width = Math.max(1, Math.ceil((hi - lo + 1) / buckets));
    const rows = await db.query<{ b: number; n: number }>(
      "select least($3 - 1, floor((score - $2) / $4))::int b, count(*)::int n from personal_bests where game_id = $1 group by 1 order by 1",
      [gameId, lo, buckets, width],
    );
    histogram = Array.from({ length: buckets }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width - 1, count: rows.find((r) => r.b === i)?.n ?? 0 }));
  }
  const t = totals[0];
  const rr = runs[0];
  return {
    gameId,
    plays7d: t.starts,
    uniquePlayers7d: rr.players,
    avgSessionMs: rr.avg_ms,
    medianSessionMs: rr.median_ms,
    retryRate: t.starts ? t.retries / t.starts : 0,
    completionRate: t.starts ? t.completions / t.starts : 0,
    shareRate: t.completions ? t.shares / t.completions : 0,
    challengeRate: t.completions ? t.challenges / t.completions : 0,
    openRate: t.impressions ? t.opens / t.impressions : 0,
    favorites7d: t.favorites,
    d1Return: d1[0]?.ratio ?? null,
    flagged7d: rr.flagged,
    series,
    histogram,
  };
}

/* ════════════════════════════ games ════════════════════════════ */

export async function listGames(db: Db) {
  const rows = await db.query<Record<string, unknown>>(
    `select g.id, g.name, g.category, g.difficulty, g.enabled, g.featured, g.trending_override, g.is_new, g.thumbnail_url,
            g.short_description, g.sort_order, g.status, g.current_version,
            coalesce((select sum(starts) from game_daily_stats s where s.game_id = g.id and s.day >= (now() at time zone 'utc')::date - 6), 0)::int plays7d,
            coalesce((select entries from leaderboard_counts c where c.game_id = g.id and c.board = 'global'), 0)::int players,
            (select count(*) filter (where fun)::float8 / nullif(count(*), 0) from ratings r where r.game_id = g.id) as fun_ratio
     from games g order by g.status, g.sort_order`,
  );
  return rows;
}

const GAME_FIELDS: Record<string, string> = {
  enabled: "enabled",
  featured: "featured",
  trendingOverride: "trending_override",
  isNew: "is_new",
  category: "category",
  difficulty: "difficulty",
  thumbnailUrl: "thumbnail_url",
  name: "name",
  shortDescription: "short_description",
  sortOrder: "sort_order",
};

export async function updateGame(db: Db, id: string, patch: Record<string, unknown>) {
  if (!getGame(id)) throw new ApiError(404, "game_not_found");
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [k, v] of Object.entries(patch)) {
    const col = GAME_FIELDS[k];
    if (!col) continue;
    params.push(v === "" ? null : v);
    sets.push(`${col} = $${params.length}`);
  }
  if (!sets.length) return;
  await db.query(`update games set ${sets.join(", ")}, updated_at = now() where id = $1`, params);
  invalidateCatalogCache();
}

/* ════════════════════════════ players ════════════════════════════ */

export async function searchPlayers(db: Db, q: string) {
  return db.query(
    `select id, username, username_claimed, country, xp, level, total_plays, role, is_banned, ban_reason, is_seed,
            (auth_user_id is not null) as has_account, created_at, last_seen_at
     from profiles where ($1 = '' or username ilike '%' || $1 || '%') order by last_seen_at desc limit 50`,
    [q.trim()],
  );
}

/** Ban: hide from boards (bests removed, runs marked removed) and block future submissions. */
export async function setBan(db: Db, playerId: string, banned: boolean, reason: string | null) {
  await db.tx(async (tx) => {
    await tx.query("update profiles set is_banned = $2, ban_reason = $3, session_version = session_version + case when $2 then 1 else 0 end where id = $1", [playerId, banned, reason]);
    if (banned) {
      await tx.query("update score_runs set status = 'removed' where player_id = $1 and status in ('accepted','flagged')", [playerId]);
      await tx.query("delete from personal_bests where player_id = $1", [playerId]);
      await tx.query("delete from period_bests where player_id = $1", [playerId]);
      await tx.query("delete from daily_challenge_scores where player_id = $1", [playerId]);
    }
  });
  await recountAll(db);
}

export async function setRole(db: Db, playerId: string, role: "player" | "admin") {
  await db.query("update profiles set role = $2 where id = $1", [playerId, role]);
}

/* ════════════════════════════ scores / leaderboards ════════════════════════════ */

export async function flaggedRuns(db: Db) {
  return db.query(
    `select r.id, r.game_id, r.score, r.duration_ms, r.server_elapsed_ms, r.actions, r.peak_aps, r.flags, r.submitted_at, r.stats,
            p.username, p.id as player_id
     from score_runs r join profiles p on p.id = r.player_id
     where r.status = 'flagged' order by r.submitted_at desc limit 100`,
  );
}

export async function topRuns(db: Db, gameId: string) {
  return db.query(
    `select pb.run_id as id, pb.score, pb.achieved_at, p.username, p.id as player_id, r.flags, r.duration_ms, r.peak_aps
     from personal_bests pb join profiles p on p.id = pb.player_id left join score_runs r on r.id = pb.run_id
     where pb.game_id = $1 order by pb.sort_score desc, pb.achieved_at asc limit 50`,
    [gameId],
  );
}

/** Approve a flagged run: it becomes a normal accepted score on the boards. */
export async function approveRun(db: Db, runId: string, adminId: string | null) {
  await db.tx(async (tx) => {
    const rows = await tx.query<{ player_id: string; game_id: string; score: number; sort_score: number; country: string | null; submitted_at: Date; status: string }>(
      "select player_id, game_id, score, sort_score, country, submitted_at, status from score_runs where id = $1 for update",
      [runId],
    );
    const r = rows[0];
    if (!r || r.status !== "flagged") throw new ApiError(409, "not_flagged");
    await tx.query("update score_runs set status = 'accepted', reviewed_at = now(), reviewed_by = $2 where id = $1", [runId, adminId]);
    const at = new Date(r.submitted_at);
    await tx.query(
      `insert into personal_bests (player_id, game_id, score, sort_score, run_id, country, achieved_at) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (player_id, game_id) do update set score = excluded.score, sort_score = excluded.sort_score, run_id = excluded.run_id, achieved_at = excluded.achieved_at
       where excluded.sort_score > personal_bests.sort_score`,
      [r.player_id, r.game_id, r.score, r.sort_score, runId, r.country, at],
    );
    for (const [period, key] of [["day", dayKey(at)], ["week", weekKey(at)]]) {
      await tx.query(
        `insert into period_bests (game_id, period, period_key, player_id, score, sort_score, run_id, country, achieved_at) values ($1,$2,$3::date,$4,$5,$6,$7,$8,$9)
         on conflict (game_id, period, period_key, player_id) do update set score = excluded.score, sort_score = excluded.sort_score, run_id = excluded.run_id, achieved_at = excluded.achieved_at
         where excluded.sort_score > period_bests.sort_score`,
        [r.game_id, period, key, r.player_id, r.score, r.sort_score, runId, r.country, at],
      );
    }
  });
  await recountAll(db);
}

/**
 * Remove a run from the leaderboards. If it was someone's personal best, their
 * next-best accepted run takes its place (so honest history survives).
 */
export async function removeRun(db: Db, runId: string, adminId: string | null) {
  await db.tx(async (tx) => {
    const rows = await tx.query<{ player_id: string; game_id: string }>("select player_id, game_id from score_runs where id = $1 for update", [runId]);
    const r = rows[0];
    if (!r) throw new ApiError(404, "run_not_found");
    await tx.query("update score_runs set status = 'removed', reviewed_at = now(), reviewed_by = $2 where id = $1", [runId, adminId]);
    await tx.query("delete from period_bests where run_id = $1", [runId]);
    await tx.query("delete from daily_challenge_scores where best_run_id = $1", [runId]);
    const pb = await tx.query("delete from personal_bests where run_id = $1 returning player_id", [runId]);
    if (pb.length) {
      await tx.query(
        `insert into personal_bests (player_id, game_id, score, sort_score, run_id, country, achieved_at)
         select player_id, game_id, score, sort_score, id, country, submitted_at from score_runs
         where player_id = $1 and game_id = $2 and status = 'accepted' and score is not null
         order by sort_score desc, submitted_at asc limit 1
         on conflict do nothing`,
        [r.player_id, r.game_id],
      );
    }
  });
  await recountAll(db);
}

export async function resetLeaderboard(db: Db, gameId: string, scope: "all" | "day" | "week") {
  if (!getGame(gameId)) throw new ApiError(404, "game_not_found");
  if (scope === "all") {
    await db.query("delete from personal_bests where game_id = $1", [gameId]);
    await db.query("delete from period_bests where game_id = $1", [gameId]);
  } else {
    const key = scope === "day" ? dayKey() : weekKey();
    await db.query("delete from period_bests where game_id = $1 and period = $2 and period_key = $3::date", [gameId, scope, key]);
  }
  await db.query("insert into security_events (kind, severity, detail) values ('leaderboard_reset', 'warn', $1::jsonb)", [JSON.stringify({ gameId, scope })]);
  await recountAll(db);
}

export async function recountAll(db: Db) {
  await db.exec(`
    delete from leaderboard_counts;
    insert into leaderboard_counts (game_id, board, entries) select game_id, 'global', count(*) from personal_bests group by game_id;
    insert into leaderboard_counts (game_id, board, entries) select game_id, period || ':' || period_key::text, count(*) from period_bests group by game_id, period, period_key;
    insert into leaderboard_counts (game_id, board, entries)
      select dc.game_id, 'daily:' || dc.id::text, count(*) from daily_challenge_scores s join daily_challenges dc on dc.id = s.daily_challenge_id group by dc.game_id, dc.id;
  `);
}

/* ════════════════════════════ daily / reports / achievements ════════════════════════════ */

export async function dailySchedule(db: Db) {
  return db.query(
    `select dc.day::text as day, dc.game_id, dc.source, p.username as winner,
            (select count(*) from daily_challenge_scores s where s.daily_challenge_id = dc.id)::int as players
     from daily_challenges dc left join profiles p on p.id = dc.winner_id
     where dc.day >= (now() at time zone 'utc')::date - 14 order by dc.day desc`,
  );
}

export async function scheduleDaily(db: Db, day: string, gameId: string) {
  const def = getGame(gameId);
  if (!def || def.status !== "live") throw new ApiError(400, "invalid_game");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ApiError(400, "invalid_day");
  if (day < dayKey()) throw new ApiError(400, "past_day", "Past challenges can't be changed.");
  if (day === dayKey()) {
    const started = await db.query("select 1 from daily_challenge_scores s join daily_challenges d on d.id = s.daily_challenge_id where d.day = $1::date limit 1", [day]);
    if (started.length) throw new ApiError(409, "daily_in_progress", "Players have already played today's challenge.");
  }
  await setDailyChallenge(db, day, gameId);
}

export async function listReports(db: Db, status: string) {
  return db.query(
    `select r.id, r.kind, r.game_id, r.run_id, r.message, r.status, r.resolution, r.created_at,
            rep.username as reporter, tgt.username as target, tgt.id as target_id
     from reports r left join profiles rep on rep.id = r.reporter_id left join profiles tgt on tgt.id = r.target_player_id
     where r.status = $1 order by r.created_at desc limit 100`,
    [status],
  );
}

export async function resolveReport(db: Db, id: string, status: "resolved" | "dismissed", note: string, adminId: string | null) {
  await db.query("update reports set status = $2, resolution = $3, resolved_at = now(), resolved_by = $4 where id = $1", [id, status, note, adminId]);
}

export async function listAchievements(db: Db) {
  return db.query(
    `select a.id, a.name, a.description, a.icon, a.xp, a.tier, a.enabled, a.rule,
            (select count(*) from player_achievements pa where pa.achievement_id = a.id)::int as unlocked
     from achievements a order by a.sort_order`,
  );
}

export async function updateAchievement(db: Db, id: string, patch: { enabled?: boolean; xp?: number; name?: string; description?: string }) {
  await db.query(
    `update achievements set enabled = coalesce($2, enabled), xp = coalesce($3, xp), name = coalesce($4, name), description = coalesce($5, description), updated_at = now() where id = $1`,
    [id, patch.enabled ?? null, patch.xp ?? null, patch.name ?? null, patch.description ?? null],
  );
}

export function liveGameIds() {
  return allGames.filter((g) => g.status === "live").map((g) => g.id);
}
