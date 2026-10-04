import "server-only";
import { getDb, type Db } from "@/lib/db";
import { ensureSynced } from "@/lib/games/catalog";
import { ApiError } from "./http";
import { getCurrentPlayer, ensurePlayer, type ProfileRow } from "@/lib/players/service";
import { hasAdminCookie } from "@/lib/auth/session";

/** DB handle with the registry mirrored (games FK targets exist). */
export async function db(): Promise<Db> {
  const d = await getDb();
  await ensureSynced(d);
  return d;
}

export async function requirePlayer(d: Db): Promise<ProfileRow> {
  const p = await getCurrentPlayer(d);
  if (!p) throw new ApiError(401, "no_session", "Play a game first.");
  return p;
}

export { ensurePlayer, getCurrentPlayer };

/** Admin = profile with role 'admin' OR a valid ADMIN_SECRET session cookie. */
export async function isAdmin(d: Db): Promise<boolean> {
  if (await hasAdminCookie()) return true;
  const p = await getCurrentPlayer(d);
  return p?.role === "admin";
}

export async function requireAdmin(d: Db) {
  if (!(await isAdmin(d))) throw new ApiError(403, "forbidden");
}
