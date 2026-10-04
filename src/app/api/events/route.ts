import { z } from "zod";
import { noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { CLIENT_EVENTS, EVENT_NAMES, type EventName } from "@/lib/analytics/events";
import { recordEvents } from "@/lib/analytics/service";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { clientKey } from "@/lib/players/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(EVENT_NAMES),
        gameId: z.string().max(64).optional(),
        props: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
      }),
    )
    .max(50),
});

/** Batched client analytics (sent with sendBeacon). Server-owned events are dropped. */
export const POST = route(async (req: Request) => {
  const text = await req.text();
  const parsed = schema.safeParse(JSON.parse(text || "{}"));
  if (!parsed.success) return noStore({ ok: false });
  const d = await db();
  const me = await getCurrentPlayer(d);
  await enforce(d, `events:${me?.id ?? (await clientKey())}`, LIMITS.events.limit, LIMITS.events.windowSec, me?.id);
  const events = parsed.data.events
    .filter((e) => CLIENT_EVENTS.has(e.name as EventName))
    .map((e) => ({ name: e.name as EventName, gameId: e.gameId ?? null, playerId: me?.id ?? null, props: e.props }));
  await recordEvents(d, events);
  return noStore({ ok: true, accepted: events.length });
});
