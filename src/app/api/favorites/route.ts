import { z } from "zod";
import { assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, ensurePlayer } from "@/lib/api/server";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { getGame } from "@/games/registry";
import { recordEvent } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({ gameId: z.string().max(64), on: z.boolean() }),
  /** Merge locally-stored (anonymous) favourites after sign-in / first sync. */
  z.object({ merge: z.array(z.string().max(64)).max(100) }),
]);

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const input = await body(req, schema);
  const player = await ensurePlayer(d);
  await enforce(d, `social:${player.id}`, LIMITS.social.limit, LIMITS.social.windowSec, player.id);
  if ("merge" in input) {
    const ids = input.merge.filter((g) => getGame(g));
    if (ids.length) await d.query("insert into favorites (player_id, game_id) select $1, unnest($2::text[]) on conflict do nothing", [player.id, ids]);
  } else if (getGame(input.gameId)) {
    if (input.on) {
      const rows = await d.query("insert into favorites (player_id, game_id) values ($1, $2) on conflict do nothing returning game_id", [player.id, input.gameId]);
      if (rows.length) await recordEvent(d, { name: "favorite", playerId: player.id, gameId: input.gameId });
    } else {
      await d.query("delete from favorites where player_id = $1 and game_id = $2", [player.id, input.gameId]);
    }
  }
  const favs = await d.query<{ game_id: string }>("select game_id from favorites where player_id = $1 order by created_at desc", [player.id]);
  return noStore({ favorites: favs.map((f) => f.game_id) });
});
