import { ApiError, noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { getGame } from "@/games/registry";
import { getOverrides } from "@/lib/games/catalog";
import { boardTotal, topEntries } from "@/lib/leaderboards/service";
import { getCatalogStats } from "@/lib/home/service";

export const dynamic = "force-dynamic";

/** Everything the pre-game screen needs, in one round trip. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ gameId: string }> }) => {
  const { gameId } = await ctx.params;
  const def = getGame(gameId);
  if (!def) throw new ApiError(404, "game_not_found");
  const d = await db();
  const [me, overrides, stats] = await Promise.all([getCurrentPlayer(d), getOverrides(d), getCatalogStats(d)]);
  const enabled = def.status === "live" && overrides.get(def.id)?.enabled !== false;
  const [top, today, total, pb, plays] = await Promise.all([
    topEntries(d, { gameId: def.id, board: "global" }, 5),
    topEntries(d, { gameId: def.id, board: "today" }, 1),
    boardTotal(d, { gameId: def.id, board: "global" }),
    me ? d.query<{ score: number }>("select score from personal_bests where player_id = $1 and game_id = $2", [me.id, def.id]) : Promise.resolve([]),
    me ? d.query<{ plays: number }>("select plays from player_game_stats where player_id = $1 and game_id = $2", [me.id, def.id]) : Promise.resolve([]),
  ]);
  return noStore({
    enabled,
    record: top[0] ?? null,
    todayTop: today[0] ?? null,
    preview: top,
    totalPlayers: total,
    playCount: stats.playCounts[def.id] ?? 0,
    personalBest: pb[0] ? Number(pb[0].score) : null,
    myPlays: plays[0]?.plays ?? 0,
  });
});
