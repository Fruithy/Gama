import { ok, route } from "@/lib/api/http";
import { db } from "@/lib/api/server";
import { getFlags } from "@/lib/config/service";
import { supabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public runtime config: feature flags + which auth providers are available. */
export const GET = route(async () => {
  const d = await db();
  return ok({ flags: await getFlags(d), auth: { enabled: !!supabaseConfig() } }, { headers: { "Cache-Control": "public, max-age=30" } });
});
