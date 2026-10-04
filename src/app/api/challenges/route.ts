import { z } from "zod";
import { assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, requirePlayer } from "@/lib/api/server";
import { createChallenge } from "@/lib/challenges/service";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const { runId } = await body(req, z.object({ runId: z.string().uuid() }));
  const player = await requirePlayer(d);
  const { token } = await createChallenge(d, player.id, runId);
  return noStore({ token, url: `${siteUrl()}/challenge/${token}` });
});
