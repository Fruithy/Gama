import { ApiError, assertSameOrigin, noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { getChallenge, recordChallengeOpen } from "@/lib/challenges/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const d = await db();
  const ch = await getChallenge(d, token);
  if (!ch) throw new ApiError(404, "challenge_not_found");
  return noStore(ch);
});

/** Track an open (called once per page view by the client). */
export const POST = route(async (req: Request, ctx: { params: Promise<{ token: string }> }) => {
  assertSameOrigin(req);
  const { token } = await ctx.params;
  const d = await db();
  const me = await getCurrentPlayer(d);
  await recordChallengeOpen(d, token, me?.id ?? null);
  return noStore({ ok: true });
});
