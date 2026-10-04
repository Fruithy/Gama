import { z } from "zod";
import { ApiError, assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, ensurePlayer } from "@/lib/api/server";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { getProfileByUsername } from "@/lib/players/service";
import { getFlags } from "@/lib/config/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  if (!(await getFlags(d)).friendSystem) throw new ApiError(404, "disabled");
  const { username, on } = await body(req, z.object({ username: z.string().max(40), on: z.boolean() }));
  const player = await ensurePlayer(d);
  await enforce(d, `social:${player.id}`, LIMITS.social.limit, LIMITS.social.windowSec, player.id);
  const target = await getProfileByUsername(d, username);
  if (!target || target.is_banned) throw new ApiError(404, "player_not_found");
  if (target.id === player.id) throw new ApiError(400, "cannot_follow_self");
  if (on) await d.query("insert into follows (follower_id, followee_id) values ($1, $2) on conflict do nothing", [player.id, target.id]);
  else await d.query("delete from follows where follower_id = $1 and followee_id = $2", [player.id, target.id]);
  return noStore({ following: on });
});
