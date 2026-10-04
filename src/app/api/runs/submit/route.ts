import { assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, requirePlayer } from "@/lib/api/server";
import { submitRun } from "@/lib/runs/service";
import { submitRunSchema } from "@/lib/runs/types";

export const dynamic = "force-dynamic";

/** Step 2: validate and record a finished run. Idempotent per run. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const d = await db();
  const input = await body(req, submitRunSchema);
  const player = await requirePlayer(d);
  return noStore(await submitRun(d, player, input));
});
