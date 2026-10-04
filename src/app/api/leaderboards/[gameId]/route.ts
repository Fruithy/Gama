import { ApiError, noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { getGame } from "@/games/registry";
import { getBoard, type BoardKind } from "@/lib/leaderboards/service";
import { getDailyChallenge } from "@/lib/daily/service";
import { normalizeCountry } from "@/lib/country";

export const dynamic = "force-dynamic";

const BOARDS: BoardKind[] = ["global", "today", "week", "friends", "daily"];

export const GET = route(async (req: Request, ctx: { params: Promise<{ gameId: string }> }) => {
  const { gameId } = await ctx.params;
  const def = getGame(gameId);
  if (!def) throw new ApiError(404, "game_not_found");
  const url = new URL(req.url);
  const board = (url.searchParams.get("board") ?? "global") as BoardKind;
  if (!BOARDS.includes(board)) throw new ApiError(400, "invalid_board");
  const country = normalizeCountry(url.searchParams.get("country"));
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const d = await db();
  const me = await getCurrentPlayer(d);
  let dailyChallengeId: string | null = null;
  if (board === "daily") {
    const daily = await getDailyChallenge(d);
    if (daily.game_id !== def.id) return noStore({ board, country, rows: [], total: 0, me: null });
    dailyChallengeId = daily.id;
  }
  const result = await getBoard(d, { gameId: def.id, board, country, playerId: me?.id ?? null, limit, dailyChallengeId });
  return noStore({ ...result, direction: def.scoreDirection });
});
