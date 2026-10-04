import "server-only";
import type { Db } from "@/lib/db";
import { getGame } from "@/games/registry";
import { ROLLUP_COLUMN, ROLLUP_ONLY, type EventName } from "./events";

export interface AnalyticsEvent {
  name: EventName;
  playerId?: string | null;
  gameId?: string | null;
  props?: Record<string, unknown>;
  /** Extra duration to add to the daily rollup (completed runs). */
  durationMs?: number;
}

/**
 * Store an event (raw row for drill-down) and bump the per-game daily rollup
 * used by dashboards and the trending algorithm.
 */
export async function recordEvent(db: Db, e: AnalyticsEvent) {
  const gameId = e.gameId && getGame(e.gameId) ? e.gameId : null;
  if (!ROLLUP_ONLY.has(e.name)) {
    await db.query("insert into analytics_events (name, player_id, game_id, props) values ($1, $2, $3, $4::jsonb)", [
      e.name,
      e.playerId ?? null,
      gameId,
      JSON.stringify(e.props ?? {}),
    ]);
  }
  const col = ROLLUP_COLUMN[e.name];
  if (gameId && col) {
    await db.query(
      `insert into game_daily_stats (game_id, day, ${col}, total_duration_ms) values ($1, (now() at time zone 'utc')::date, 1, $2)
       on conflict (game_id, day) do update set ${col} = game_daily_stats.${col} + 1, total_duration_ms = game_daily_stats.total_duration_ms + excluded.total_duration_ms`,
      [gameId, e.durationMs ?? 0],
    );
  }
}

export async function recordEvents(db: Db, events: AnalyticsEvent[]) {
  for (const e of events) await recordEvent(db, e);
}
