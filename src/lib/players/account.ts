import "server-only";
import type { Db } from "@/lib/db";
import type { ProfileRow } from "./service";

/**
 * GDPR helpers: full export and hard deletion.
 * Deleting a profile cascades to runs, bests, favourites, achievements,
 * follows and ratings (see FK `on delete cascade` in the schema). Analytics
 * rows are anonymised (player_id nulled) rather than kept linked.
 */
export async function deleteAccount(db: Db, player: ProfileRow) {
  await db.tx(async (tx) => {
    await tx.query("update analytics_events set player_id = null where player_id = $1", [player.id]);
    await tx.query("update security_events set player_id = null where player_id = $1", [player.id]);
    await tx.query("delete from profiles where id = $1", [player.id]);
  });
  // Remove the Supabase auth user too (needs the server-only service role key).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (player.auth_user_id && url && key) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await admin.auth.admin.deleteUser(player.auth_user_id).catch((e) => console.error("[account] auth delete failed", e));
  }
}

export async function exportAccount(db: Db, playerId: string) {
  const [profile, runs, bests, achievements, favorites, follows, ratings, daily, challenges] = await Promise.all([
    db.query(`select id, username, username_claimed, avatar, country, xp, level, total_plays, games_played, daily_streak, longest_streak,
                     challenge_wins, daily_wins, created_at, (auth_user_id is not null) as has_account from profiles where id = $1`, [playerId]),
    db.query("select id, game_id, game_version, mode, status, score, duration_ms, stats, started_at, submitted_at from score_runs where player_id = $1 order by started_at desc", [playerId]),
    db.query("select game_id, score, achieved_at from personal_bests where player_id = $1", [playerId]),
    db.query("select achievement_id, unlocked_at from player_achievements where player_id = $1", [playerId]),
    db.query("select game_id, created_at from favorites where player_id = $1", [playerId]),
    db.query("select p.username as following, f.created_at from follows f join profiles p on p.id = f.followee_id where f.follower_id = $1", [playerId]),
    db.query("select game_id, fun, created_at from ratings where player_id = $1", [playerId]),
    db.query("select dc.day::text as day, dc.game_id, s.best_score, s.attempts from daily_challenge_scores s join daily_challenges dc on dc.id = s.daily_challenge_id where s.player_id = $1", [playerId]),
    db.query("select token, game_id, score, created_at, opens, attempts, wins from challenges where creator_id = $1", [playerId]),
  ]);
  return { exportedAt: new Date().toISOString(), profile: profile[0], personalBests: bests, runs, achievements, favorites, follows, ratings, daily, challenges };
}
