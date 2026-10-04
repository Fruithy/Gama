import { assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, ensurePlayer } from "@/lib/api/server";
import { startRun } from "@/lib/runs/service";
import { startRunSchema } from "@/lib/runs/types";

export const dynamic = "force-dynamic";

/** Step 1 of the server-authoritative flow: issue a run id, nonce and seed. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const input = await body(req, startRunSchema);
  const player = await ensurePlayer(d);
  return noStore(await startRun(d, player, input));
});
