import { z } from "zod";
import { assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, requirePlayer } from "@/lib/api/server";
import { getGame } from "@/games/registry";
import { recordEvent } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const { gameId, fun } = await body(req, z.object({ gameId: z.string().max(64), fun: z.boolean() }));
  const player = await requirePlayer(d);
  if (!getGame(gameId)) return noStore({ ok: false });
  await d.query(
    "insert into ratings (player_id, game_id, fun) values ($1, $2, $3) on conflict (player_id, game_id) do update set fun = excluded.fun, created_at = now()",
    [player.id, gameId, fun],
  );
  await recordEvent(d, { name: "rating", playerId: player.id, gameId, props: { fun } });
  return noStore({ ok: true });
});
