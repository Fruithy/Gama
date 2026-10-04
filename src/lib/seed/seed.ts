/**
 * DEVELOPMENT SEED DATA — makes a fresh local arcade look alive.
 *
 * Every seeded profile has `is_seed = true`; `unseedDatabase` removes them
 * (and, through cascades, all their runs, bests and achievements). The seed
 * refuses to run against production unless explicitly forced.
 *
 * Writes go straight to SQL in bulk (unnest) rather than through the run
 * submission service — seeded runs are marked `accepted` with a `seed` flag.
 */
import type { Db } from "@/lib/db/types";
import { liveGames } from "@/games/registry";
import type { GameDefinition } from "@/games/core/types";
import { createRng, type Rng } from "@/games/core/rng";
import { toSortScore } from "@/games/core/format";
import { syncRegistry } from "@/lib/games/sync";
import { addDays, dayKey, weekKey } from "@/lib/time";
import { dailySeed, selectDailyGame } from "@/lib/daily/select";
import { generateUsername } from "@/lib/players/username";
import { randomAvatar } from "@/lib/players/avatar";
import { levelFromXp } from "@/lib/xp/rules";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import { challengeToken } from "@/lib/challenges/token";

const COUNTRIES: Array<[string, number]> = [
  ["US", 18], ["GB", 8], ["DE", 7], ["NO", 5], ["SE", 4], ["BR", 7], ["JP", 5], ["KR", 4], ["IN", 6], ["FR", 5],
  ["ES", 4], ["MX", 4], ["CA", 4], ["AU", 3], ["NL", 3], ["PL", 3], ["TR", 3], ["ID", 3], ["PH", 3], ["NG", 2],
  ["IT", 3], ["FI", 2], ["DK", 2], ["AR", 2], ["ZA", 1], ["EG", 1], ["VN", 2], ["TH", 1], ["UA", 1], ["IE", 1],
];

const HANDLES = [
  "Fruithy", "nova_k", "pixelpirate", "Zed", "mikasa_99", "tapgod", "LunaLoop", "speedrunSam", "kawaiiKai", "Brick",
  "noodle_arms", "OliviaR", "Tomasz", "quickdraw", "jun_park", "yuki", "rafa_br", "Ingrid", "deepfocus", "MrPerfect",
  "glitchy", "Saoirse", "kofi", "AnaB", "hex", "theRealDev", "CaptainCombo", "Ola", "fyrn", "stacklord",
];

function weighted<T>(rng: Rng, items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[0][0];
}

function gaussian(rng: Rng) {
  // Box–Muller
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Plausible score: log-normal around the game's "good" milestone, capped near legendary. */
export function sampleScore(def: GameDefinition, rng: Rng, skill: number): number {
  const { good, great, legendary } = def.milestones;
  if (def.scoreDirection === "higher") {
    const sigma = Math.log(Math.max(1.2, great / Math.max(1, good)));
    const median = good * 0.7 * Math.exp(skill * 0.8);
    const s = median * Math.exp(gaussian(rng) * sigma * 0.7);
    return Math.max(1, Math.min(Math.round(legendary * 1.08), Math.round(s), def.validation.maxScore));
  }
  // lower is better (times): good > great > legendary
  const spread = Math.max(1, good - great);
  const s = good - skill * spread + gaussian(rng) * spread * 0.6;
  return Math.max(Math.round(legendary * 0.97), Math.max(def.validation.minScore ?? 1, Math.round(s)));
}

function durationFor(def: GameDefinition, rng: Rng) {
  const v = def.validation;
  if (v.fixedDurationMs) return v.fixedDurationMs + rng.int(-200, 200);
  return Math.round(Math.max(v.minDurationMs + 500, def.estimatedDuration * 1000 * rng.range(0.4, 1.6)));
}

export async function seedDatabase(db: Db, opts: { players?: number; log?: (m: string) => void; force?: boolean } = {}) {
  const log = opts.log ?? (() => {});
  if (process.env.NODE_ENV === "production" && !opts.force) throw new Error("Refusing to seed a production database (pass --force).");
  const rng = createRng("filter-arcade-seed-v1");
  const nPlayers = opts.players ?? 360;
  await syncRegistry(db);

  // ── players ──────────────────────────────────────────────────────────────
  const usernames = new Set<string>();
  const players: Array<{ username: string; country: string; avatar: string; skill: number; createdDaysAgo: number }> = [];
  for (let i = 0; i < nPlayers; i++) {
    let name = i < HANDLES.length ? HANDLES[i] : generateUsername(() => rng.next());
    while (usernames.has(name.toLowerCase())) name = generateUsername(() => rng.next());
    usernames.add(name.toLowerCase());
    players.push({
      username: name,
      country: weighted(rng, COUNTRIES),
      avatar: randomAvatar(() => rng.next()),
      skill: gaussian(rng) * 0.9,
      createdDaysAgo: rng.int(0, 60),
    });
  }
  const created = await db.query<{ id: string; username: string }>(
    `insert into profiles (username, username_claimed, avatar, country, country_source, is_seed, created_at)
     select u, c, a, co, 'user', true, now() - (d || ' days')::interval
     from unnest($1::text[], $2::bool[], $3::text[], $4::text[], $5::int[]) as t(u, c, a, co, d)
     on conflict ((lower(username))) do nothing
     returning id, username`,
    [players.map((p) => p.username), players.map((_, i) => i < 200), players.map((p) => p.avatar), players.map((p) => p.country), players.map((p) => p.createdDaysAgo)],
  );
  const idByName = new Map(created.map((r) => [r.username, r.id]));
  log(`players: ${created.length}`);

  // ── runs + bests ─────────────────────────────────────────────────────────
  const today = dayKey();
  const week = weekKey();
  const runs: Array<{ id?: string; game: string; ver: number; player: string; score: number; sort: number; dur: number; country: string; at: Date }> = [];
  const now = Date.now();
  for (const def of liveGames) {
    const popularity = 0.25 + rng.next() * 0.6;
    for (const p of players) {
      const pid = idByName.get(p.username);
      if (!pid || !rng.chance(popularity)) continue;
      const tries = 1 + Math.floor(rng.next() * rng.next() * 8);
      for (let t = 0; t < tries; t++) {
        const score = sampleScore(def, rng, p.skill + t * 0.05);
        const ageMs = Math.floor(Math.pow(rng.next(), 1.6) * 14 * 86_400_000);
        runs.push({ game: def.id, ver: def.version, player: pid, score, sort: toSortScore(score, def.scoreDirection), dur: durationFor(def, rng), country: p.country, at: new Date(now - ageMs) });
      }
    }
  }
  const CHUNK = 2000;
  const runIds: string[] = [];
  for (let i = 0; i < runs.length; i += CHUNK) {
    const part = runs.slice(i, i + CHUNK);
    const ids = await db.query<{ id: string }>(
      `insert into score_runs (game_id, game_version, player_id, mode, seed, nonce, status, completed, score, sort_score, duration_ms, server_elapsed_ms,
         actions, peak_aps, stats, flags, country, started_at, submitted_at)
       select g, v, p, 'normal', 'seed', 'seed', 'accepted', true, s, ss, d, d + 1500, greatest(1, s), 4, '{}'::jsonb, '{seed}', c, at - (d || ' milliseconds')::interval, at
       from unnest($1::text[], $2::int[], $3::uuid[], $4::bigint[], $5::bigint[], $6::int[], $7::text[], $8::timestamptz[]) as t(g, v, p, s, ss, d, c, at)
       returning id`,
      [part.map((r) => r.game), part.map((r) => r.ver), part.map((r) => r.player), part.map((r) => r.score), part.map((r) => r.sort), part.map((r) => r.dur), part.map((r) => r.country), part.map((r) => r.at)],
    );
    runIds.push(...ids.map((x) => x.id));
  }
  runs.forEach((r, i) => (r.id = runIds[i]));
  log(`runs: ${runs.length}`);

  // Personal bests and period bests derived in SQL from the seeded runs.
  await db.exec(`
    insert into personal_bests (player_id, game_id, score, sort_score, run_id, country, achieved_at)
    select distinct on (player_id, game_id) player_id, game_id, score, sort_score, id, country, submitted_at
    from score_runs where status = 'accepted' and 'seed' = any(flags)
    order by player_id, game_id, sort_score desc, submitted_at asc
    on conflict (player_id, game_id) do nothing;

    insert into period_bests (game_id, period, period_key, player_id, score, sort_score, run_id, country, achieved_at)
    select distinct on (game_id, player_id) game_id, 'day', (submitted_at at time zone 'utc')::date, player_id, score, sort_score, id, country, submitted_at
    from score_runs where status = 'accepted' and 'seed' = any(flags) and (submitted_at at time zone 'utc')::date = '${today}'::date
    order by game_id, player_id, sort_score desc, submitted_at asc
    on conflict do nothing;

    insert into period_bests (game_id, period, period_key, player_id, score, sort_score, run_id, country, achieved_at)
    select distinct on (game_id, player_id) game_id, 'week', '${week}'::date, player_id, score, sort_score, id, country, submitted_at
    from score_runs where status = 'accepted' and 'seed' = any(flags) and submitted_at >= '${week}'::date
    order by game_id, player_id, sort_score desc, submitted_at asc
    on conflict do nothing;

    insert into player_game_stats (player_id, game_id, plays, total_duration_ms, first_played_at, last_played_at)
    select player_id, game_id, count(*), sum(duration_ms), min(submitted_at), max(submitted_at)
    from score_runs where 'seed' = any(flags) group by player_id, game_id
    on conflict do nothing;
  `);

  // ── today's daily challenge (+ recent history) ──────────────────────────
  const eligible = liveGames.filter((g) => g.dailyEligible !== false).map((g) => g.slug);
  const recent: string[] = [];
  for (let back = 14; back >= 0; back--) {
    const d = addDays(today, -back);
    const slug = selectDailyGame(d, eligible, recent);
    recent.push(slug);
    await db.query("insert into daily_challenges (day, game_id, seed, source, finalized_at) values ($1::date, $2, $3, 'auto', $4) on conflict (day) do nothing", [
      d, slug, dailySeed(d, slug), back > 0 ? new Date() : null,
    ]);
  }
  const dailies = await db.query<{ id: string; day: string; game_id: string }>("select id, day::text as day, game_id from daily_challenges order by day");
  for (const dc of dailies) {
    const def = liveGames.find((g) => g.id === dc.game_id)!;
    const participants = players.filter(() => rng.chance(dc.day === today ? 0.35 : 0.25));
    const rows = participants
      .map((p) => ({ p, id: idByName.get(p.username) }))
      .filter((x): x is { p: (typeof players)[number]; id: string } => !!x.id)
      .map(({ p, id }) => {
        const score = sampleScore(def, rng, p.skill);
        return { id, score, sort: toSortScore(score, def.scoreDirection), attempts: rng.int(1, 6), country: p.country };
      });
    if (!rows.length) continue;
    await db.query(
      `insert into daily_challenge_scores (daily_challenge_id, player_id, best_score, sort_score, attempts, country, achieved_at)
       select $1, p, s, ss, a, c, $7::date + (random() * interval '20 hours')
       from unnest($2::uuid[], $3::bigint[], $4::bigint[], $5::int[], $6::text[]) as t(p, s, ss, a, c)
       on conflict do nothing`,
      [dc.id, rows.map((r) => r.id), rows.map((r) => r.score), rows.map((r) => r.sort), rows.map((r) => r.attempts), rows.map((r) => r.country), dc.day],
    );
  }
  // Crown past winners.
  await db.exec(`
    update daily_challenges dc set winner_id = w.player_id
    from (select distinct on (daily_challenge_id) daily_challenge_id, player_id from daily_challenge_scores order by daily_challenge_id, sort_score desc, achieved_at asc) w
    where w.daily_challenge_id = dc.id and dc.finalized_at is not null;
    update profiles p set daily_wins = x.n from (select winner_id, count(*)::int n from daily_challenges where winner_id is not null group by winner_id) x where x.winner_id = p.id;
  `);
  log(`daily challenges: ${dailies.length}`);

  // ── counters, XP, levels ─────────────────────────────────────────────────
  await recountLeaderboards(db);
  await db.exec(`
    update profiles p set total_plays = s.plays, games_played = s.games, xp = s.plays * 10 + s.games * 20 + coalesce(p.daily_wins, 0) * 40,
      last_play_day = s.last::date, personal_best_count = s.games
    from (select player_id, sum(plays)::int plays, count(*)::int games, max(last_played_at) last from player_game_stats group by player_id) s
    where s.player_id = p.id and p.is_seed;
    update profiles p set daily_streak = least(12, (abs(hashtext(p.username)) % 9)), longest_streak = 3 + (abs(hashtext(p.username)) % 14),
      last_daily_day = (now() at time zone 'utc')::date where p.is_seed and (abs(hashtext(p.username)) % 3) = 0;
  `);
  const xpRows = await db.query<{ id: string; xp: number }>("select id, xp from profiles where is_seed");
  await db.query("update profiles p set level = t.l from unnest($1::uuid[], $2::int[]) as t(id, l) where t.id = p.id", [xpRows.map((r) => r.id), xpRows.map((r) => levelFromXp(Number(r.xp)))]);

  // ── achievements, follows, challenges, analytics rollups ────────────────
  await db.exec(`
    insert into player_achievements (player_id, achievement_id, unlocked_at)
    select id, 'first-game', created_at + interval '5 minutes' from profiles where is_seed and total_plays >= 1 on conflict do nothing;
    insert into player_achievements (player_id, achievement_id, unlocked_at)
    select id, 'plays-10', now() - interval '3 days' from profiles where is_seed and total_plays >= 10 on conflict do nothing;
    insert into player_achievements (player_id, achievement_id, unlocked_at)
    select id, 'explorer-5', now() - interval '2 days' from profiles where is_seed and games_played >= 5 on conflict do nothing;
    insert into player_achievements (player_id, achievement_id, unlocked_at)
    select distinct pb.player_id, 'global-top-10', now() - interval '1 day' from personal_bests pb
    where (select count(*) from personal_bests o where o.game_id = pb.game_id and (o.sort_score > pb.sort_score or (o.sort_score = pb.sort_score and o.achieved_at < pb.achieved_at))) < 10
    on conflict do nothing;
  `);
  const ids = [...idByName.values()];
  const follows: Array<[string, string]> = [];
  for (let i = 0; i < Math.min(600, ids.length * 2); i++) {
    const a = rng.pick(ids);
    const b = rng.pick(ids);
    if (a !== b) follows.push([a, b]);
  }
  await db.query("insert into follows (follower_id, followee_id) select * from unnest($1::uuid[], $2::uuid[]) on conflict do nothing", [follows.map((f) => f[0]), follows.map((f) => f[1])]);

  const sampleRuns = rng.shuffle(runs.slice()).slice(0, 40);
  for (const r of sampleRuns) {
    await db.query(
      `insert into challenges (token, game_id, game_version, creator_id, run_id, score, sort_score, seed, opens, attempts, wins, conversions)
       values ($1, $2, $3, $4, $5, $6, $7, 'seed', $8, $9, $10, $11) on conflict do nothing`,
      [challengeToken(), r.game, r.ver, r.player, r.id, r.score, r.sort, rng.int(1, 40), rng.int(0, 20), rng.int(0, 8), rng.int(0, 4)],
    );
  }

  const statRows: Array<[string, string, number[]]> = [];
  for (const def of liveGames) {
    const base = rng.int(40, 400);
    const growth = rng.range(-0.08, 0.25);
    for (let back = 13; back >= 0; back--) {
      const plays = Math.max(5, Math.round(base * Math.pow(1 + growth, 13 - back) * rng.range(0.8, 1.2)));
      const opens = Math.round(plays * rng.range(0.4, 0.7));
      statRows.push([def.id, addDays(today, -back), [
        Math.round(opens * rng.range(4, 9)), opens, plays, Math.round(plays * rng.range(0.85, 0.98)), Math.round(plays * rng.range(0.02, 0.1)),
        Math.round(plays * rng.range(0.45, 0.8)), Math.round(plays * rng.range(0.01, 0.05)), Math.round(plays * rng.range(0.01, 0.04)),
        Math.round(plays * rng.range(0.005, 0.03)), Math.round(plays * rng.range(0.003, 0.02)), Math.round(plays * def.estimatedDuration * 1000 * rng.range(0.5, 1.1)),
      ]]);
    }
  }
  await db.query(
    `insert into game_daily_stats (game_id, day, impressions, opens, starts, completions, fails, retries, shares, challenges_created, challenge_opens, favorites, total_duration_ms)
     select g, d::date, i, o, s, c, f, r, sh, cc, co, fa, td from unnest($1::text[], $2::text[], $3::int[], $4::int[], $5::int[], $6::int[], $7::int[], $8::int[], $9::int[], $10::int[], $11::int[], $12::int[], $13::bigint[])
       as t(g, d, i, o, s, c, f, r, sh, cc, co, fa, td)
     on conflict do nothing`,
    [statRows.map((r) => r[0]), statRows.map((r) => r[1]), ...Array.from({ length: 11 }, (_, k) => statRows.map((r) => r[2][k]))],
  );

  // A couple of flagged runs + an open report so the admin queue has something to review.
  const cheater = ids[ids.length - 1];
  const target = liveGames[0];
  await db.query(
    `insert into score_runs (game_id, game_version, player_id, mode, seed, nonce, status, completed, score, sort_score, duration_ms, server_elapsed_ms, actions, peak_aps, flags, started_at, submitted_at)
     values ($1, $2, $3, 'normal', 'seed', 'seed', 'flagged', true, $4, $5, 1200, 1500, 3, 40, '{score_rate_too_high,action_rate_too_high}', now() - interval '2 minutes', now() - interval '1 minute')`,
    [target.id, target.version, cheater, target.validation.maxScore, toSortScore(target.validation.maxScore, target.scoreDirection)],
  );
  await db.query("insert into reports (reporter_id, kind, game_id, target_player_id, message) values ($1, 'cheating', $2, $3, 'This score looks impossible.')", [ids[0], target.id, cheater]);
  await db.query("insert into reports (reporter_id, kind, game_id, message) values ($1, 'bug', $2, 'Sound kept playing after I exited.')", [ids[1], liveGames[1]?.id ?? target.id]);

  log(`achievement catalogue: ${ACHIEVEMENTS.length}`);
  log("done");
}

/** Rebuild cached board sizes from the best tables. */
export async function recountLeaderboards(db: Db) {
  await db.exec(`
    delete from leaderboard_counts;
    insert into leaderboard_counts (game_id, board, entries)
      select game_id, 'global', count(*) from personal_bests group by game_id;
    insert into leaderboard_counts (game_id, board, entries)
      select game_id, period || ':' || period_key::text, count(*) from period_bests group by game_id, period, period_key;
    insert into leaderboard_counts (game_id, board, entries)
      select dc.game_id, 'daily:' || dc.id::text, count(*) from daily_challenge_scores s join daily_challenges dc on dc.id = s.daily_challenge_id group by dc.game_id, dc.id;
  `);
}

/** Remove every seeded profile (cascades to their data) and seeded aggregates. */
export async function unseedDatabase(db: Db) {
  await db.exec(`
    delete from challenges where seed = 'seed';
    delete from profiles where is_seed;
    delete from daily_challenges dc where not exists (select 1 from score_runs r where r.daily_challenge_id = dc.id);
  `);
  await recountLeaderboards(db);
}

export const _seedInternals = { sampleScore, gaussian, weighted, generate: () => challengeToken() };
export type { Rng };
