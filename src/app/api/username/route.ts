import { noStore, route } from "@/lib/api/http";
import { db } from "@/lib/api/server";
import { validateUsername } from "@/lib/players/username";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import { clientKey } from "@/lib/players/service";

export const dynamic = "force-dynamic";

/** Live availability check for the username form. */
export const GET = route(async (req: Request) => {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const v = validateUsername(name);
  if (!v.ok) return noStore({ available: false, message: v.message });
  const d = await db();
  await enforce(d, `username:${await clientKey()}`, LIMITS.usernameCheck.limit, LIMITS.usernameCheck.windowSec);
  const rows = await d.query("select 1 from profiles where lower(username) = lower($1)", [v.username]);
  return noStore({ available: rows.length === 0, message: rows.length ? "That name is taken." : "Available" });
});
