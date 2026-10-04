import "server-only";
import { randomBytes } from "node:crypto";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api/http";
import type { GameDefinition } from "@/games/core/types";
import { randomSeed } from "@/games/core/rng";
import { toSortScore } from "@/games/core/format";
import { getGame } from "@/games/registry";
import { ensureSynced, getPlayableGame } from "@/lib/games/catalog";
import { evaluateRun, runChecksum } from "@/lib/security/run-validation";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { getDailyChallenge } from "@/lib/daily/service";
import { nextStreak } from "@/lib/daily/select";
import { getChallenge } from "@/lib/challenges/service";
import { recordEvent } from "@/lib/analytics/service";
import { getConfig } from "@/lib/config/service";
import { computeRunXp, levelFromXp, levelProgress } from "@/lib/xp/rules";
import { unlockAchievements } from "@/lib/achievements/service";
import { percentileBetterThan, rankTier } from "@/lib/leaderboards/compose";
import { boardTotal, rankOf, type BoardQuery } from "@/lib/leaderboards/service";
import { dayKey, weekKey } from "@/lib/time";
import type { ProfileRow } from "@/lib/players/service";
import type { RankInfo, StartRunRequest, StartRunResponse, SubmitRunRequest, SubmitRunResponse } from "./types";

/** A run must be submitted within this window after the server issued it. */
const RUN_TTL_MS = 2 * 60 * 60 * 1000;

/* ════════════════════════════════ START ════════════════════════════════ */

export async function startRun(db: Db, player: ProfileRow, req: StartRunRequest): Promise<StartRunResponse> {
  await ensureSynced(db);
  if (player.is_banned) throw new ApiError(403, "banned", "This account can't submit scores.");
  const def = await getPlayableGame(db, req.gameId);
  if (!def) throw new ApiError(404, "game_unavailable", "This game is not available right now.");
  if (req.gameVersion !== def.version) throw new ApiError(409, "version_mismatch", "A new version of this game is available. Refresh to play.");
  await enforce(db, `run:start:${player.id}`, LIMITS.runStart.limit, LIMITS.runStart.windowSec, player.id);

  let seed = randomSeed();
  let dailyId: string | null = null;
  let challengeId: string | null = null;

  if (req.mode === "daily") {
    const daily = await getDailyChallenge(db);
    if (daily.game_id !== def.id) throw new ApiError(409, "daily_mismatch", "The daily challenge has changed. Refresh.");
    seed = daily.seed;
    dailyId = daily.id;
  } else if (req.mode === "challenge") {
    const ch = req.challengeToken ? await getChallenge(db, req.challengeToken) : null;
    if (!ch || ch.gameId !== def.id) throw new ApiError(404, "challenge_not_found");
    seed = ch.seed;
    const ids = await db.query<{ id: string }>("select id from challenges where token = $1", [ch.token]);
    challengeId = ids[0]?.id ?? null;
  }

  const nonce = randomBytes(12).toString("base64url");
  const rows = await db.query<{ id: string; started_at: Date }>(
    `insert into score_runs (game_id, game_version, player_id, mode, daily_challenge_id, challenge_id, seed, nonce, country)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id, started_at`,
    [def.id, def.version, player.id, req.mode, dailyId, challengeId, seed, nonce, player.country],
  );
  await recordEvent(db, { name: "game_started", playerId: player.id, gameId: def.id, props: { mode: req.mode } });
  return { runId: rows[0].id, nonce, seed, mode: req.mode, startedAt: new Date(rows[0].started_at).toISOString() };
}

/* ════════════════════════════════ SUBMIT ═══════════════════════════════ */

interface RunRow {
  id: string;
  game_id: string;
  game_version: number;
  player_id: string;
  mode: "normal" | "daily" | "challenge";
  daily_challenge_id: string | null;
  challenge_id: string | null;
  seed: string;
  nonce: string;
  status: string;
  idempotency_key: string | null;
  result: SubmitRunResponse | null;
  started_at: Date;
}

export async function submitRun(db: Db, player: ProfileRow, req: SubmitRunRequest): Promise<SubmitRunResponse> {
  await enforce(db, `run:submit:${player.id}`, LIMITS.runSubmit.limit, LIMITS.runSubmit.windowSec, player.id);
  const def = getGame(req.gameId);
  if (!def || def.status !== "live") throw new ApiError(404, "game_unavailable");

  const result = await db.tx(async (tx) => {
    const runs = await tx.query<RunRow>(
      `select id, game_id, game_version, player_id, mode, daily_challenge_id, challenge_id, seed, nonce, status, idempotency_key, result, started_at
       from score_runs where id = $1 for update`,
      [req.runId],
    );
    const run = runs[0];
    if (!run) throw new ApiError(404, "run_not_found");
    if (run.player_id !== player.id) throw new ApiError(403, "not_your_run");

    // Idempotency: the same submission retried (flaky network) gets the same answer.
    if (run.status !== "started") {
      if (run.idempotency_key === req.idempotencyKey && run.result) return run.result;
      await logSecurity(tx, player.id, "duplicate_submission", "warn", { runId: run.id });
      throw new ApiError(409, "already_submitted", "This run was already submitted.");
    }

    const now = new Date();
    const serverElapsedMs = now.getTime() - new Date(run.started_at).getTime();
    const reasons: string[] = [];
    if (run.game_id !== def.id) reasons.push("game_mismatch");
    if (run.game_version !== req.gameVersion || def.version !== req.gameVersion) reasons.push("version_mismatch");
    if (serverElapsedMs > RUN_TTL_MS) reasons.push("run_expired");

    const evaluation = evaluateRun(def, { score: req.score, completed: req.completed, metadata: req.metadata }, {
      serverElapsedMs,
      clientTimestamp: req.clientTimestamp,
      serverNow: now.getTime(),
    });
    const flags = [...evaluation.flags];
    if (req.checksum !== runChecksum(run.id, run.nonce, req.score, req.metadata.durationMs)) flags.push("checksum_mismatch");
    if (req.metadata.seed !== run.seed) flags.push("seed_mismatch");
    if (player.is_banned) reasons.push("banned");

    const rejections = [...reasons, ...evaluation.rejections];
    const status: SubmitRunResponse["status"] = rejections.length ? "rejected" : flags.length ? "flagged" : "accepted";
    const score = Math.round(req.score);
    const sortScore = toSortScore(score, def.scoreDirection);

    await tx.query(
      `update score_runs set status = $2, completed = $3, score = $4, sort_score = $5, duration_ms = $6, server_elapsed_ms = $7,
         actions = $8, peak_aps = $9, stats = $10::jsonb, input_summary = $11::jsonb, checkpoints = $12::jsonb, flags = $13::text[],
         client_ts = to_timestamp($14 / 1000.0), idempotency_key = $15, submitted_at = now()
       where id = $1`,
      [
        run.id, status, req.completed, score, sortScore, Math.round(req.metadata.durationMs), serverElapsedMs,
        req.metadata.actions, Math.round(req.metadata.peakActionsPerSecond), JSON.stringify(req.metadata.stats),
        JSON.stringify(req.metadata.input), JSON.stringify(req.metadata.checkpoints), [...rejections, ...flags],
        req.clientTimestamp, req.idempotencyKey,
      ],
    );

    let response: SubmitRunResponse;
    if (status === "rejected") {
      await logSecurity(tx, player.id, "run_rejected", "warn", { runId: run.id, reasons: rejections });
      response = { status, runId: run.id, score, reasons: rejections };
    } else if (status === "flagged") {
      await logSecurity(tx, player.id, "run_flagged", "high", { runId: run.id, game: def.id, score, flags });
      response = { status, runId: run.id, score, reasons: flags };
    } else {
      response = await applyAcceptedRun(tx, def, player, run, { score, sortScore, durationMs: req.metadata.durationMs, stats: req.metadata.stats });
    }
    await tx.query("update score_runs set result = $2::jsonb, xp_awarded = $3 where id = $1", [run.id, JSON.stringify(response), response.xp?.gained ?? 0]);
    return response;
  });

  await recordEvent(db, {
    name: "game_completed",
    playerId: player.id,
    gameId: def.id,
    durationMs: Math.round(req.metadata.durationMs),
    props: { status: result.status, score: result.score, pb: result.personalBest?.isNew ?? false },
  });
  if (result.personalBest?.isNew) await recordEvent(db, { name: "personal_best", playerId: player.id, gameId: def.id, props: { score: result.score } });
  return result;
}

async function logSecurity(db: Db, playerId: string, kind: string, severity: "info" | "warn" | "high", detail: Record<string, unknown>) {
  await db.query("insert into security_events (player_id, kind, severity, detail) values ($1, $2, $3, $4::jsonb)", [playerId, kind, severity, JSON.stringify(detail)]);
}

/* ════════════════════════════ ACCEPTED RUN ═════════════════════════════ */

async function bumpCount(db: Db, gameId: string, board: string) {
  await db.query(
    "insert into leaderboard_counts (game_id, board, entries) values ($1, $2, 1) on conflict (game_id, board) do update set entries = leaderboard_counts.entries + 1",
    [gameId, board],
  );
}

async function applyAcceptedRun(
  db: Db,
  def: GameDefinition,
  player: ProfileRow,
  run: RunRow,
  r: { score: number; sortScore: number; durationMs: number; stats: Record<string, number> },
): Promise<SubmitRunResponse> {
  const today = dayKey();
  const week = weekKey();
  const country = player.country;
  // Higher-is-better zero scores don't go on boards (noise), but still count as plays.
  const rankable = def.scoreDirection === "lower" || r.score > 0;

  // ── personal best ────────────────────────────────────────────────────────
  const prev = await db.query<{ score: number; sort_score: number }>("select score, sort_score from personal_bests where player_id = $1 and game_id = $2", [player.id, def.id]);
  const previous = prev[0] ? Number(prev[0].score) : null;
  const isNewPb = rankable && (!prev[0] || r.sortScore > Number(prev[0].sort_score));
  if (rankable) {
    const ins = await db.query<{ inserted: boolean }>(
      `insert into personal_bests (player_id, game_id, score, sort_score, run_id, country, achieved_at) values ($1, $2, $3, $4, $5, $6, now())
       on conflict (player_id, game_id) do update set score = excluded.score, sort_score = excluded.sort_score, run_id = excluded.run_id,
         country = excluded.country, achieved_at = excluded.achieved_at
       where excluded.sort_score > personal_bests.sort_score
       returning (xmax = 0) as inserted`,
      [player.id, def.id, r.score, r.sortScore, run.id, country],
    );
    if (ins[0]?.inserted) await bumpCount(db, def.id, "global");

    // ── period bests (today / this week) ──────────────────────────────────
    for (const [period, key] of [["day", today], ["week", week]] as const) {
      const pi = await db.query<{ inserted: boolean }>(
        `insert into period_bests (game_id, period, period_key, player_id, score, sort_score, run_id, country, achieved_at)
         values ($1, $2, $3::date, $4, $5, $6, $7, $8, now())
         on conflict (game_id, period, period_key, player_id) do update set score = excluded.score, sort_score = excluded.sort_score,
           run_id = excluded.run_id, country = excluded.country, achieved_at = excluded.achieved_at
         where excluded.sort_score > period_bests.sort_score
         returning (xmax = 0) as inserted`,
        [def.id, period, key, player.id, r.score, r.sortScore, run.id, country],
      );
      if (pi[0]?.inserted) await bumpCount(db, def.id, `${period}:${key}`);
    }
  }

  // ── daily challenge ──────────────────────────────────────────────────────
  let daily: SubmitRunResponse["daily"] = null;
  let firstDailyRunToday = false;
  let streak = player.daily_streak;
  if (run.mode === "daily" && run.daily_challenge_id) {
    const dc = await db.query<{ day: string }>("select day::text as day from daily_challenges where id = $1", [run.daily_challenge_id]);
    const isToday = dc[0]?.day === today;
    const up = await db.query<{ inserted: boolean; attempts: number; best_score: number }>(
      `insert into daily_challenge_scores (daily_challenge_id, player_id, best_score, sort_score, best_run_id, country, achieved_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (daily_challenge_id, player_id) do update set
         attempts = daily_challenge_scores.attempts + 1,
         best_run_id = case when excluded.sort_score > daily_challenge_scores.sort_score then excluded.best_run_id else daily_challenge_scores.best_run_id end,
         achieved_at = case when excluded.sort_score > daily_challenge_scores.sort_score then excluded.achieved_at else daily_challenge_scores.achieved_at end,
         best_score = case when excluded.sort_score > daily_challenge_scores.sort_score then excluded.best_score else daily_challenge_scores.best_score end,
         sort_score = greatest(excluded.sort_score, daily_challenge_scores.sort_score)
       returning (xmax = 0) as inserted, attempts, best_score`,
      [run.daily_challenge_id, player.id, r.score, r.sortScore, run.id, country],
    );
    if (up[0]?.inserted) await bumpCount(db, def.id, `daily:${run.daily_challenge_id}`);
    if (isToday && player.last_daily_day !== today) {
      firstDailyRunToday = true;
      streak = nextStreak(player.last_daily_day, player.daily_streak, today);
      await db.query(
        "update profiles set daily_streak = $2, longest_streak = greatest(longest_streak, $2), last_daily_day = $3::date where id = $1",
        [player.id, streak, today],
      );
    }
    const mine = await db.query<{ sort_score: number; achieved_at: Date }>(
      "select sort_score, achieved_at from daily_challenge_scores where daily_challenge_id = $1 and player_id = $2",
      [run.daily_challenge_id, player.id],
    );
    const dq: BoardQuery = { gameId: def.id, board: "daily", dailyChallengeId: run.daily_challenge_id };
    const [dRank, dTotal, dCountryRank] = await Promise.all([
      rankOf(db, dq, Number(mine[0].sort_score), mine[0].achieved_at, player.id),
      boardTotal(db, dq),
      country ? rankOf(db, { ...dq, country }, Number(mine[0].sort_score), mine[0].achieved_at, player.id) : Promise.resolve(null),
    ]);
    daily = { rank: dRank, total: dTotal, attempts: up[0]?.attempts ?? 1, best: Number(up[0]?.best_score ?? r.score), streak, countryRank: dCountryRank };
  }

  // ── friend challenge ─────────────────────────────────────────────────────
  let challenge: SubmitRunResponse["challenge"] = null;
  let challengeWon = false;
  if (run.mode === "challenge" && run.challenge_id) {
    const chRows = await db.query<{ id: string; sort_score: number; score: number; creator_id: string; username: string }>(
      "select c.id, c.sort_score, c.score, c.creator_id, p.username from challenges c join profiles p on p.id = c.creator_id where c.id = $1",
      [run.challenge_id],
    );
    const ch = chRows[0];
    if (ch) {
      const won = r.sortScore > Number(ch.sort_score);
      const tie = r.sortScore === Number(ch.sort_score);
      const margin = Math.abs(r.score - Number(ch.score));
      const already = await db.query("select 1 from challenge_attempts where challenge_id = $1 and player_id = $2 and won", [ch.id, player.id]);
      await db.query("insert into challenge_attempts (challenge_id, player_id, run_id, score, won, margin) values ($1, $2, $3, $4, $5, $6)", [ch.id, player.id, run.id, r.score, won, margin]);
      await db.query("update challenges set attempts = attempts + 1, wins = wins + $2 where id = $1", [ch.id, won ? 1 : 0]);
      // Only the first win per challenge counts (no farming your own link), and never vs yourself.
      if (won && !already.length && ch.creator_id !== player.id) {
        challengeWon = true;
        await db.query("update profiles set challenge_wins = challenge_wins + 1 where id = $1", [player.id]);
      }
      challenge = { won, tie, margin, opponent: { username: ch.username, score: Number(ch.score) } };
    }
  }

  // ── per-game stats (plays, XP cap) ───────────────────────────────────────
  const statsRows = await db.query<{ plays: number; xp_day: string | null; xp_plays_today: number }>(
    "select plays, xp_day::text as xp_day, xp_plays_today from player_game_stats where player_id = $1 and game_id = $2",
    [player.id, def.id],
  );
  const firstTimeGame = !statsRows[0];
  const paidRunsToday = statsRows[0] && statsRows[0].xp_day === today ? statsRows[0].xp_plays_today : 0;
  const firstPlayOfDay = player.last_play_day !== today;

  const cfg = await getConfig(db);
  const xp = computeRunXp(
    { durationMs: r.durationMs, paidRunsToday, firstPlayOfDay, isPersonalBest: isNewPb && previous !== null, firstTimeGame, firstDailyRunToday, challengeWon, accepted: true },
    cfg.xp,
  );

  await db.query(
    `insert into player_game_stats (player_id, game_id, plays, total_duration_ms, xp_day, xp_plays_today, best_stats)
     values ($1, $2, 1, $3, $4::date, $5, $6::jsonb)
     on conflict (player_id, game_id) do update set
       plays = player_game_stats.plays + 1,
       total_duration_ms = player_game_stats.total_duration_ms + excluded.total_duration_ms,
       xp_plays_today = case when player_game_stats.xp_day = excluded.xp_day then player_game_stats.xp_plays_today + excluded.xp_plays_today else excluded.xp_plays_today end,
       xp_day = excluded.xp_day,
       best_stats = (select coalesce(jsonb_object_agg(k, greatest(coalesce((player_game_stats.best_stats->>k)::numeric, 0), v::numeric)), '{}'::jsonb)
                     from jsonb_each_text(player_game_stats.best_stats || excluded.best_stats) as e(k, v)),
       last_played_at = now()`,
    [player.id, def.id, Math.round(r.durationMs), today, xp.paidCompletion ? 1 : 0, JSON.stringify(r.stats)],
  );

  // ── ranks for this score ─────────────────────────────────────────────────
  const now = new Date();
  const gq: BoardQuery = { gameId: def.id, board: "global" };
  const tq: BoardQuery = { gameId: def.id, board: "today", day: today };
  const [gRank, gTotal, tRank, tTotal, cRank, cTotal, bestRow] = await Promise.all([
    rankOf(db, gq, r.sortScore, now, player.id),
    boardTotal(db, gq),
    rankOf(db, tq, r.sortScore, now, player.id),
    boardTotal(db, tq),
    country ? rankOf(db, { ...gq, country }, r.sortScore, now, player.id) : Promise.resolve(null),
    country ? boardTotal(db, { ...gq, country }) : Promise.resolve(0),
    db.query<{ sort_score: number; achieved_at: Date; score: number }>("select sort_score, achieved_at, score from personal_bests where player_id = $1 and game_id = $2", [player.id, def.id]),
  ]);
  // A non-PB run's hypothetical rank counts an extra entry (the player's own best) — keep totals honest.
  const info = (rank: number, total: number): RankInfo => {
    const t = Math.max(total, rank);
    return { rank, total: t, tier: rankTier(rank, t), percentile: percentileBetterThan(rank, t) };
  };
  const bestGlobal = bestRow[0] ? await rankOf(db, gq, Number(bestRow[0].sort_score), bestRow[0].achieved_at) : null;

  const above = gRank > 1
    ? await db.query<{ username: string; score: number }>(
        `select p.username, pb.score from personal_bests pb join profiles p on p.id = pb.player_id
         where pb.game_id = $1 and pb.sort_score > $2 and pb.player_id <> $3 order by pb.sort_score asc, pb.achieved_at desc limit 1`,
        [def.id, r.sortScore, player.id],
      )
    : [];

  // ── profile counters + XP ────────────────────────────────────────────────
  const pbIncrement = isNewPb ? 1 : 0;
  const prof = await db.query<{ total_plays: number; games_played: number; xp: number; daily_streak: number; challenge_wins: number; daily_wins: number; personal_best_count: number }>(
    `update profiles set total_plays = total_plays + 1, games_played = games_played + $2, last_play_day = $3::date,
       personal_best_count = personal_best_count + $4, xp = xp + $5, updated_at = now()
     where id = $1
     returning total_plays, games_played, xp, daily_streak, challenge_wins, daily_wins, personal_best_count`,
    [player.id, firstTimeGame ? 1 : 0, today, pbIncrement, xp.total],
  );
  const p = prof[0];
  const categories = await db.query<{ n: number }>(
    "select count(distinct g.category)::int as n from player_game_stats s join games g on g.id = s.game_id where s.player_id = $1",
    [player.id],
  );

  // ── achievements ─────────────────────────────────────────────────────────
  const unlocked = await unlockAchievements(
    db,
    player.id,
    {
      player: {
        total_plays: p.total_plays,
        games_played: p.games_played,
        daily_streak: p.daily_streak,
        challenge_wins: p.challenge_wins,
        daily_wins: p.daily_wins,
        categories_played: categories[0]?.n ?? 0,
        level: levelFromXp(p.xp),
      },
      personalBestCount: p.personal_best_count,
      run: {
        score: r.score,
        scoreFormat: def.scoreFormat,
        scoreDirection: def.scoreDirection,
        difficulty: def.difficulty,
        legendary: def.milestones.legendary,
        stats: r.stats,
        globalRank: rankable ? gRank : null,
        dailyRank: daily?.rank ?? null,
      },
    },
    { gameId: def.id, runId: run.id },
  );
  const achievementXp = unlocked.reduce((s, a) => s + a.xp, 0);
  let totalXp = p.xp;
  if (achievementXp) {
    const rows = await db.query<{ xp: number }>("update profiles set xp = xp + $2 where id = $1 returning xp", [player.id, achievementXp]);
    totalXp = rows[0].xp;
  }
  const newLevel = levelFromXp(totalXp);
  await db.query("update profiles set level = $2 where id = $1 and level <> $2", [player.id, newLevel]);

  return {
    status: "accepted",
    runId: run.id,
    score: r.score,
    personalBest: { isNew: isNewPb, previous, best: bestRow[0] ? Number(bestRow[0].score) : r.score },
    ranks: rankable
      ? {
          global: info(gRank, gTotal),
          country: country && cRank ? { ...info(cRank, cTotal), code: country } : null,
          today: info(tRank, tTotal),
          bestGlobal,
        }
      : undefined,
    nextTarget: above[0] ? { username: above[0].username, score: Number(above[0].score), rank: gRank - 1 } : null,
    daily,
    challenge,
    xp: {
      gained: xp.total + achievementXp,
      breakdown: [...xp.breakdown, ...unlocked.map((a) => ({ reason: a.name, xp: a.xp }))],
      total: totalXp,
      level: newLevel,
      levelUp: newLevel > levelFromXp(player.xp),
      progress: levelProgress(totalXp).ratio,
    },
    achievements: unlocked,
  };
}
