import { ApiError, route } from "@/lib/api/http";
import { db, getCurrentPlayer } from "@/lib/api/server";
import { exportAccount } from "@/lib/players/account";

export const dynamic = "force-dynamic";

/** GDPR data export (JSON download). */
export const GET = route(async () => {
  const d = await db();
  const player = await getCurrentPlayer(d);
  if (!player) throw new ApiError(401, "no_session");
  const data = await exportAccount(d, player.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="filter-arcade-${player.username}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
