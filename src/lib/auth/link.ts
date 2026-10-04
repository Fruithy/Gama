import "server-only";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api/http";
import { supabaseConfig } from "@/lib/env";
import { getProfileById, type ProfileRow } from "@/lib/players/service";

/**
 * Link a Supabase Auth identity (email magic link / Google / Apple) to the
 * player's anonymous profile — "secure your username" without losing progress.
 *
 *  - First sign-in: the current anonymous profile becomes the account.
 *  - Signing in on a second device: the account's profile wins; the device's
 *    anonymous progress (bests, runs, favourites, achievements) merges in.
 */
export async function verifySupabaseToken(accessToken: string): Promise<{ id: string; email?: string }> {
  const cfg = supabaseConfig();
  if (!cfg) throw new ApiError(501, "auth_not_configured", "Accounts are not enabled on this server.");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new ApiError(401, "invalid_token");
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export async function linkIdentity(db: Db, current: ProfileRow | null, authUserId: string): Promise<ProfileRow> {
  const owner = await db.query<{ id: string }>("select id from profiles where auth_user_id = $1", [authUserId]);
  const adminNames = (process.env.ADMIN_USERNAMES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  let profileId: string;
  if (!owner[0]) {
    if (!current) throw new ApiError(400, "no_session");
    await db.query("update profiles set auth_user_id = $2, updated_at = now() where id = $1", [current.id, authUserId]);
    profileId = current.id;
  } else {
    profileId = owner[0].id;
    if (current && current.id !== profileId && !current.auth_user_id) await mergeProfiles(db, current.id, profileId);
  }
  const p = (await getProfileById(db, profileId))!;
  if (adminNames.includes(p.username.toLowerCase()) && p.role !== "admin") {
    await db.query("update profiles set role = 'admin' where id = $1", [p.id]);
    p.role = "admin";
  }
  return p;
}

/** Move an anonymous profile's progress into the account profile, then delete it. */
export async function mergeProfiles(db: Db, fromId: string, intoId: string) {
  await db.tx(async (tx) => {
    await tx.query("update score_runs set player_id = $2 where player_id = $1", [fromId, intoId]);
    // Keep the better personal best per game.
    await tx.query(
      `insert into personal_bests (player_id, game_id, score, sort_score, run_id, country, achieved_at)
       select $2, game_id, score, sort_score, run_id, country, achieved_at from personal_bests where player_id = $1
       on conflict (player_id, game_id) do update set score = excluded.score, sort_score = excluded.sort_score, run_id = excluded.run_id, achieved_at = excluded.achieved_at
       where excluded.sort_score > personal_bests.sort_score`,
      [fromId, intoId],
    );
    await tx.query(
      `insert into period_bests (game_id, period, period_key, player_id, score, sort_score, run_id, country, achieved_at)
       select game_id, period, period_key, $2, score, sort_score, run_id, country, achieved_at from period_bests where player_id = $1
       on conflict (game_id, period, period_key, player_id) do update set score = excluded.score, sort_score = excluded.sort_score, run_id = excluded.run_id, achieved_at = excluded.achieved_at
       where excluded.sort_score > period_bests.sort_score`,
      [fromId, intoId],
    );
    await tx.query("insert into favorites (player_id, game_id, created_at) select $2, game_id, created_at from favorites where player_id = $1 on conflict do nothing", [fromId, intoId]);
    await tx.query("insert into player_achievements (player_id, achievement_id, game_id, run_id, unlocked_at) select $2, achievement_id, game_id, run_id, unlocked_at from player_achievements where player_id = $1 on conflict do nothing", [fromId, intoId]);
    await tx.query(
      `insert into player_game_stats (player_id, game_id, plays, total_duration_ms, best_stats, first_played_at, last_played_at)
       select $2, game_id, plays, total_duration_ms, best_stats, first_played_at, last_played_at from player_game_stats where player_id = $1
       on conflict (player_id, game_id) do update set plays = player_game_stats.plays + excluded.plays, total_duration_ms = player_game_stats.total_duration_ms + excluded.total_duration_ms`,
      [fromId, intoId],
    );
    await tx.query(
      `update profiles t set xp = t.xp + f.xp, total_plays = t.total_plays + f.total_plays,
         games_played = (select count(*) from player_game_stats where player_id = $2)
       from profiles f where f.id = $1 and t.id = $2`,
      [fromId, intoId],
    );
    await tx.query("delete from profiles where id = $1", [fromId]);
  });
  // Board sizes may have shrunk (two rows → one); recount cheaply for affected games.
  await db.query(
    `update leaderboard_counts lc set entries = (select count(*) from personal_bests pb where pb.game_id = lc.game_id)
     where board = 'global' and game_id in (select game_id from personal_bests where player_id = $1)`,
    [intoId],
  );
}
