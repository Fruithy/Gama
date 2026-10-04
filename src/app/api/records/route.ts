import { noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { playerRecords } from "@/lib/players/records";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const d = await db();
  const me = await getCurrentPlayer(d);
  if (!me) return noStore({ player: null, records: null });
  return noStore({ player: { username: me.username }, records: await playerRecords(d, me.id) });
});
