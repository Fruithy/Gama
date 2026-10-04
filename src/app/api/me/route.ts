import { z } from "zod";
import { body, assertSameOrigin, ApiError, noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer, ensurePlayer } from "@/lib/api/server";
import { toPrivateProfile, updateProfile } from "@/lib/players/service";
import { getFlags } from "@/lib/config/service";
import { clearSession } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/players/account";

export const dynamic = "force-dynamic";

/** Current player (null when this browser has never played). Never creates a profile. */
export const GET = route(async () => {
  const d = await db();
  const [player, flags] = await Promise.all([getCurrentPlayer(d), getFlags(d)]);
  if (!player) return noStore({ player: null, favorites: [], flags });
  const favs = await d.query<{ game_id: string }>("select game_id from favorites where player_id = $1 order by created_at desc", [player.id]);
  return noStore({ player: toPrivateProfile(player), favorites: favs.map((f) => f.game_id), flags });
});

const patchSchema = z.object({
  username: z.string().max(40).optional(),
  avatar: z.string().max(16).optional(),
  country: z.string().length(2).nullable().optional(),
});

export const PATCH = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const input = await body(req, patchSchema);
  const player = await ensurePlayer(d);
  const updated = await updateProfile(d, player, input);
  return noStore({ player: toPrivateProfile(updated) });
});

/** GDPR: permanently delete the profile and everything attached to it. */
export const DELETE = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const player = await getCurrentPlayer(d);
  if (!player) throw new ApiError(401, "no_session");
  await deleteAccount(d, player);
  await clearSession();
  return noStore({ deleted: true });
});
