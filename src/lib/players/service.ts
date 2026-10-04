import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api/http";
import { readSession, writeSession } from "@/lib/auth/session";
import { countryFromHeaders, normalizeCountry } from "@/lib/country";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { generateUsername, USERNAME_CHANGE_COOLDOWN_DAYS, validateUsername } from "./username";
import { isValidAvatar, randomAvatar } from "./avatar";
import { levelProgress } from "@/lib/xp/rules";

export interface ProfileRow {
  id: string;
  auth_user_id: string | null;
  username: string;
  username_claimed: boolean;
  username_changed_at: Date | null;
  avatar: string;
  country: string | null;
  xp: number;
  level: number;
  total_plays: number;
  games_played: number;
  daily_streak: number;
  longest_streak: number;
  last_daily_day: string | null;
  last_play_day: string | null;
  challenge_wins: number;
  daily_wins: number;
  role: "player" | "admin";
  is_banned: boolean;
  session_version: number;
  created_at: Date;
}

const PROFILE_COLUMNS = `id, auth_user_id, username, username_claimed, username_changed_at, avatar, country, xp, level,
  total_plays, games_played, daily_streak, longest_streak, last_daily_day::text, last_play_day::text,
  challenge_wins, daily_wins, role, is_banned, session_version, created_at`;

export async function getProfileById(db: Db, id: string): Promise<ProfileRow | null> {
  const rows = await db.query<ProfileRow>(`select ${PROFILE_COLUMNS} from profiles where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getProfileByUsername(db: Db, username: string): Promise<ProfileRow | null> {
  const rows = await db.query<ProfileRow>(`select ${PROFILE_COLUMNS} from profiles where lower(username) = lower($1)`, [username]);
  return rows[0] ?? null;
}

/** The player behind the current request's session cookie, if valid. */
export async function getCurrentPlayer(db: Db): Promise<ProfileRow | null> {
  const claims = await readSession();
  if (!claims) return null;
  const p = await getProfileById(db, claims.playerId);
  if (!p || p.session_version !== claims.version) return null;
  return p;
}

/** Hashed client fingerprint for rate-limit keys only (never stored on profiles). */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return createHash("sha256").update(`${ip}|${process.env.SESSION_SECRET ?? "dev"}`).digest("base64url").slice(0, 22);
}

/** Current player, or a freshly created anonymous one (sets the cookie). */
export async function ensurePlayer(db: Db): Promise<ProfileRow> {
  const existing = await getCurrentPlayer(db);
  if (existing) {
    // Throttled "last seen" touch.
    void db.query("update profiles set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '10 minutes'", [existing.id]);
    return existing;
  }
  await enforce(db, `player:create:${await clientKey()}`, LIMITS.createPlayer.limit, LIMITS.createPlayer.windowSec);
  const country = countryFromHeaders(await headers());
  const profile = await createAnonymousProfile(db, { country });
  await writeSession({ playerId: profile.id, version: profile.session_version });
  return profile;
}

export async function createAnonymousProfile(db: Db, opts: { country?: string | null; isSeed?: boolean; username?: string; random?: () => number } = {}): Promise<ProfileRow> {
  const random = opts.random ?? Math.random;
  for (let attempt = 0; attempt < 8; attempt++) {
    const username = opts.username ?? generateUsername(random);
    const rows = await db.query<ProfileRow>(
      `insert into profiles (username, avatar, country, country_source, is_seed)
       values ($1, $2, $3, $4, $5)
       on conflict ((lower(username))) do nothing
       returning ${PROFILE_COLUMNS}`,
      [username, randomAvatar(random), opts.country ?? null, opts.country ? "geo" : "unknown", opts.isSeed ?? false],
    );
    if (rows[0]) return rows[0];
    if (opts.username) throw new ApiError(409, "username_taken");
  }
  throw new ApiError(500, "username_generation_failed");
}

export interface ProfileUpdate {
  username?: string;
  avatar?: string;
  country?: string | null;
}

export async function updateProfile(db: Db, player: ProfileRow, update: ProfileUpdate): Promise<ProfileRow> {
  await enforce(db, `profile:update:${player.id}`, LIMITS.profileUpdate.limit, LIMITS.profileUpdate.windowSec, player.id);
  const sets: string[] = [];
  const params: unknown[] = [player.id];

  if (update.username !== undefined && update.username !== player.username) {
    const v = validateUsername(update.username);
    if (!v.ok) throw new ApiError(400, `username_${v.error}`, v.message);
    if (player.username_claimed && player.username_changed_at) {
      const days = (Date.now() - new Date(player.username_changed_at).getTime()) / 86_400_000;
      if (days < USERNAME_CHANGE_COOLDOWN_DAYS && v.username.toLowerCase() !== player.username.toLowerCase()) {
        throw new ApiError(429, "username_cooldown", `You can change your name again in ${Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - days)} days.`);
      }
    }
    const taken = await db.query("select 1 from profiles where lower(username) = lower($1) and id <> $2", [v.username, player.id]);
    if (taken.length) throw new ApiError(409, "username_taken", "That name is taken.");
    params.push(v.username);
    sets.push(`username = $${params.length}`, "username_claimed = true", "username_changed_at = now()");
  }
  if (update.avatar !== undefined) {
    if (!isValidAvatar(update.avatar)) throw new ApiError(400, "invalid_avatar");
    params.push(update.avatar);
    sets.push(`avatar = $${params.length}`);
  }
  if (update.country !== undefined) {
    const c = update.country === null ? null : normalizeCountry(update.country);
    if (update.country !== null && !c) throw new ApiError(400, "invalid_country");
    params.push(c);
    sets.push(`country = $${params.length}`, "country_source = 'user'");
  }
  if (!sets.length) return player;
  try {
    await db.query(`update profiles set ${sets.join(", ")}, updated_at = now() where id = $1`, params);
  } catch (e) {
    if (String((e as Error).message).includes("profiles_username_lower_idx")) throw new ApiError(409, "username_taken", "That name is taken.");
    throw e;
  }
  if (update.country !== undefined) {
    // Keep leaderboard rows' country in sync so country boards stay correct.
    const c = params[params.length - 1];
    await db.query("update personal_bests set country = $2 where player_id = $1", [player.id, c]);
  }
  const fresh = await getProfileById(db, player.id);
  return fresh!;
}

/** Private view returned to the owner (/api/me). Never includes auth/email. */
export function toPrivateProfile(p: ProfileRow) {
  const progress = levelProgress(p.xp);
  return {
    id: p.id,
    username: p.username,
    usernameClaimed: p.username_claimed,
    avatar: p.avatar,
    country: p.country,
    xp: p.xp,
    level: progress.level,
    levelProgress: progress,
    totalPlays: p.total_plays,
    gamesPlayed: p.games_played,
    dailyStreak: p.daily_streak,
    longestStreak: p.longest_streak,
    lastDailyDay: p.last_daily_day,
    challengeWins: p.challenge_wins,
    dailyWins: p.daily_wins,
    isAdmin: p.role === "admin",
    hasAccount: !!p.auth_user_id,
    joinedAt: new Date(p.created_at).toISOString(),
  };
}

export type PrivateProfile = ReturnType<typeof toPrivateProfile>;
