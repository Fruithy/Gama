import { z } from "zod";
import { assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { linkIdentity, verifySupabaseToken } from "@/lib/auth/link";
import { writeSession } from "@/lib/auth/session";
import { createAnonymousProfile, toPrivateProfile } from "@/lib/players/service";
import { recordEvent } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";

/** Exchange a Supabase access token for a linked FILTER ARCADE session. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const { accessToken } = await body(req, z.object({ accessToken: z.string().min(10).max(4096) }));
  const d = await db();
  const user = await verifySupabaseToken(accessToken);
  const current = (await getCurrentPlayer(d)) ?? (await createAnonymousProfile(d));
  const hadPlayed = current.total_plays > 0;
  const profile = await linkIdentity(d, current, user.id);
  await writeSession({ playerId: profile.id, version: profile.session_version });
  if (hadPlayed) await recordEvent(d, { name: "signup_after_play", playerId: profile.id });
  return noStore({ player: toPrivateProfile(profile) });
});
