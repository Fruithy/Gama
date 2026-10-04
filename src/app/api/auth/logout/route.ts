import { assertSameOrigin, noStore, route } from "@/lib/api/http";
import { clearSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await clearSession();
  return noStore({ ok: true });
});
