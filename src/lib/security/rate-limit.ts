import "server-only";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api/http";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across
 * serverless instances. One upsert per check.
 */
export async function hit(db: Db, key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; count: number }> {
  const rows = await db.query<{ count: number }>(
    `insert into rate_limits(key, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowSec],
  );
  // Opportunistic cleanup (~1% of calls) keeps the table tiny.
  if (Math.random() < 0.01) await db.query("delete from rate_limits where window_start < now() - interval '2 days'");
  const count = rows[0]?.count ?? 1;
  return { allowed: count <= limit, count };
}

export async function enforce(db: Db, key: string, limit: number, windowSec: number, playerId?: string) {
  const r = await hit(db, key, limit, windowSec);
  if (!r.allowed) {
    if (r.count === limit + 1) {
      await db.query("insert into security_events(player_id, kind, severity, detail) values ($1, 'rate_limited', 'warn', $2::jsonb)", [
        playerId ?? null,
        JSON.stringify({ key, limit, windowSec }),
      ]);
    }
    throw new ApiError(429, "rate_limited", "Slow down a little.");
  }
}

export const LIMITS = {
  runStart: { limit: 40, windowSec: 60 },
  runSubmit: { limit: 40, windowSec: 60 },
  createPlayer: { limit: 10, windowSec: 3600 },
  usernameCheck: { limit: 30, windowSec: 60 },
  profileUpdate: { limit: 20, windowSec: 3600 },
  challengeCreate: { limit: 30, windowSec: 3600 },
  events: { limit: 120, windowSec: 60 },
  reports: { limit: 10, windowSec: 3600 },
  social: { limit: 60, windowSec: 60 },
  adminLogin: { limit: 10, windowSec: 900 },
} as const;
