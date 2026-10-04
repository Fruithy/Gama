import { z } from "zod";
import { assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, ensurePlayer } from "@/lib/api/server";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { getProfileByUsername } from "@/lib/players/service";
import { getGame } from "@/games/registry";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["bug", "cheating", "username", "other"]),
  gameId: z.string().max(64).optional(),
  runId: z.string().uuid().optional(),
  username: z.string().max(40).optional(),
  message: z.string().max(1000).default(""),
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const input = await body(req, schema);
  const player = await ensurePlayer(d);
  await enforce(d, `reports:${player.id}`, LIMITS.reports.limit, LIMITS.reports.windowSec, player.id);
  const target = input.username ? await getProfileByUsername(d, input.username) : null;
  await d.query(
    "insert into reports (reporter_id, kind, game_id, run_id, target_player_id, message) values ($1, $2, $3, $4, $5, $6)",
    [player.id, input.kind, input.gameId && getGame(input.gameId) ? input.gameId : null, input.runId ?? null, target?.id ?? null, input.message.trim()],
  );
  return noStore({ ok: true });
});
