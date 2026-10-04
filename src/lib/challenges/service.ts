import "server-only";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api/http";
import { getGame } from "@/games/registry";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { challengeToken, isChallengeToken } from "./token";
import { recordEvent } from "@/lib/analytics/service";

export interface ChallengeInfo {
  token: string;
  gameId: string;
  gameVersion: number;
  score: number;
  seed: string;
  creator: { id: string; username: string; avatar: string; country: string | null };
  createdAt: string;
  stats: { opens: number; attempts: number; wins: number };
}

/** Create (or reuse) a challenge link for one of the player's accepted runs. */
export async function createChallenge(db: Db, playerId: string, runId: string): Promise<{ token: string }> {
  await enforce(db, `challenge:create:${playerId}`, LIMITS.challengeCreate.limit, LIMITS.challengeCreate.windowSec, playerId);
  const runs = await db.query<{ id: string; game_id: string; game_version: number; score: number; sort_score: number; seed: string; status: string; player_id: string; challenge_id: string | null }>(
    "select id, game_id, game_version, score, sort_score, seed, status, player_id, challenge_id from score_runs where id = $1",
    [runId],
  );
  const run = runs[0];
  if (!run || run.player_id !== playerId) throw new ApiError(404, "run_not_found");
  if (run.status !== "accepted") throw new ApiError(409, "run_not_eligible", "Only verified scores can be used for challenges.");

  const existing = await db.query<{ token: string }>("select token from challenges where run_id = $1", [runId]);
  if (existing[0]) return { token: existing[0].token };

  // Conversion: the player was challenged and is now challenging someone else.
  if (run.challenge_id) await db.query("update challenges set conversions = conversions + 1 where id = $1", [run.challenge_id]);

  for (let i = 0; i < 5; i++) {
    const token = challengeToken();
    const rows = await db.query<{ token: string }>(
      `insert into challenges (token, game_id, game_version, creator_id, run_id, score, sort_score, seed)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (token) do nothing returning token`,
      [token, run.game_id, run.game_version, playerId, run.id, run.score, run.sort_score, run.seed],
    );
    if (rows[0]) {
      await recordEvent(db, { name: "challenge_created", playerId, gameId: run.game_id, props: { runId } });
      return { token };
    }
  }
  throw new ApiError(500, "token_generation_failed");
}

export async function getChallenge(db: Db, token: string): Promise<ChallengeInfo | null> {
  if (!isChallengeToken(token)) return null;
  const rows = await db.query<{
    token: string; game_id: string; game_version: number; score: number; seed: string; created_at: Date;
    opens: number; attempts: number; wins: number; creator_id: string; username: string; avatar: string; country: string | null;
  }>(
    `select c.token, c.game_id, c.game_version, c.score, c.seed, c.created_at, c.opens, c.attempts, c.wins,
            c.creator_id, p.username, p.avatar, p.country
     from challenges c join profiles p on p.id = c.creator_id where c.token = $1 and p.is_banned = false`,
    [token],
  );
  const r = rows[0];
  if (!r || !getGame(r.game_id)) return null;
  return {
    token: r.token,
    gameId: r.game_id,
    gameVersion: r.game_version,
    score: Number(r.score),
    seed: r.seed,
    creator: { id: r.creator_id, username: r.username, avatar: r.avatar, country: r.country },
    createdAt: new Date(r.created_at).toISOString(),
    stats: { opens: r.opens, attempts: r.attempts, wins: r.wins },
  };
}

export async function recordChallengeOpen(db: Db, token: string, playerId: string | null) {
  const rows = await db.query<{ game_id: string }>("update challenges set opens = opens + 1 where token = $1 returning game_id", [token]);
  if (rows[0]) await recordEvent(db, { name: "challenge_opened", playerId, gameId: rows[0].game_id, props: { token } });
}
