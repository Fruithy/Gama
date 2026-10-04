import { z } from "zod";
import { ApiError, assertSameOrigin, body, noStore, route } from "@/lib/api/http";
import { db, getCurrentPlayer, isAdmin, requireAdmin } from "@/lib/api/server";
import { checkAdminSecret, clearAdminCookie, writeAdminCookie } from "@/lib/auth/session";
import { clientKey } from "@/lib/players/service";
import { enforce, LIMITS } from "@/lib/security/rate-limit";
import * as admin from "@/lib/admin/service";
import { getConfig, getFlags, setConfig, setFlag } from "@/lib/config/service";
import { FLAG_DEFAULTS, type FlagKey } from "@/lib/config/flags";

export const dynamic = "force-dynamic";

/**
 * Admin API — one dispatcher keyed by resource. Every resource except
 * `session` requires admin (profile role or ADMIN_SECRET session cookie).
 */
type Ctx = { params: Promise<{ resource: string }> };

export const GET = route(async (req: Request, ctx: Ctx) => {
  const { resource } = await ctx.params;
  const d = await db();
  const url = new URL(req.url);
  if (resource === "session") return noStore({ admin: await isAdmin(d) });
  await requireAdmin(d);
  switch (resource) {
    case "overview":
      return noStore(await admin.overview(d));
    case "analytics":
      return noStore(await admin.gameAnalytics(d, url.searchParams.get("game") ?? ""));
    case "games":
      return noStore({ games: await admin.listGames(d) });
    case "players":
      return noStore({ players: await admin.searchPlayers(d, url.searchParams.get("q") ?? "") });
    case "scores":
      return noStore({ flagged: await admin.flaggedRuns(d) });
    case "leaderboards":
      return noStore({ runs: await admin.topRuns(d, url.searchParams.get("game") ?? "") });
    case "daily":
      return noStore({ schedule: await admin.dailySchedule(d), games: admin.liveGameIds() });
    case "reports":
      return noStore({ reports: await admin.listReports(d, url.searchParams.get("status") ?? "open") });
    case "achievements":
      return noStore({ achievements: await admin.listAchievements(d) });
    case "flags": {
      const flags = await getFlags(d);
      return noStore({ flags: Object.entries(FLAG_DEFAULTS).map(([key, v]) => ({ key, description: v.description, enabled: flags[key as FlagKey] })) });
    }
    case "config":
      return noStore(await getConfig(d));
    default:
      throw new ApiError(404, "unknown_resource");
  }
});

const actionSchema = z.object({ action: z.string().max(40) }).passthrough();

export const POST = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { resource } = await ctx.params;
  const d = await db();
  const input = await body(req, actionSchema);
  const a = input as Record<string, unknown> & { action: string };

  if (resource === "session") {
    if (a.action === "logout") {
      await clearAdminCookie();
      return noStore({ ok: true });
    }
    await enforce(d, `admin:login:${await clientKey()}`, LIMITS.adminLogin.limit, LIMITS.adminLogin.windowSec);
    if (typeof a.secret !== "string" || !checkAdminSecret(a.secret)) throw new ApiError(401, "invalid_secret", "Wrong admin secret.");
    await writeAdminCookie();
    return noStore({ ok: true });
  }

  await requireAdmin(d);
  const me = await getCurrentPlayer(d);
  const adminId = me?.role === "admin" ? me.id : null;
  const str = (k: string) => {
    const v = a[k];
    if (typeof v !== "string" || !v) throw new ApiError(400, `missing_${k}`);
    return v;
  };

  switch (`${resource}:${a.action}`) {
    case "games:update":
      await admin.updateGame(d, str("id"), (a.patch ?? {}) as Record<string, unknown>);
      break;
    case "players:ban":
      await admin.setBan(d, str("id"), true, typeof a.reason === "string" ? a.reason : null);
      break;
    case "players:unban":
      await admin.setBan(d, str("id"), false, null);
      break;
    case "players:role":
      await admin.setRole(d, str("id"), a.role === "admin" ? "admin" : "player");
      break;
    case "scores:approve":
      await admin.approveRun(d, str("id"), adminId);
      break;
    case "scores:remove":
      await admin.removeRun(d, str("id"), adminId);
      break;
    case "leaderboards:reset":
      await admin.resetLeaderboard(d, str("game"), (["all", "day", "week"].includes(String(a.scope)) ? a.scope : "day") as "all" | "day" | "week");
      break;
    case "daily:schedule":
      await admin.scheduleDaily(d, str("day"), str("game"));
      break;
    case "reports:resolve":
      await admin.resolveReport(d, str("id"), a.status === "dismissed" ? "dismissed" : "resolved", typeof a.note === "string" ? a.note.slice(0, 500) : "", adminId);
      break;
    case "achievements:update":
      await admin.updateAchievement(d, str("id"), {
        enabled: typeof a.enabled === "boolean" ? a.enabled : undefined,
        xp: typeof a.xp === "number" ? Math.max(0, Math.min(10_000, Math.round(a.xp))) : undefined,
      });
      break;
    case "flags:set":
      if (!(str("key") in FLAG_DEFAULTS)) throw new ApiError(400, "unknown_flag");
      await setFlag(d, a.key as FlagKey, !!a.enabled);
      break;
    case "config:set": {
      const key = str("key");
      if (!["xp", "trending", "ads"].includes(key) || typeof a.value !== "object" || !a.value) throw new ApiError(400, "invalid_config");
      // Only numeric values, only known keys.
      const current = (await getConfig(d))[key as "xp" | "trending" | "ads"] as unknown as Record<string, number>;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(a.value as Record<string, unknown>)) if (k in current && typeof v === "number" && Number.isFinite(v)) next[k] = v;
      await setConfig(d, key as "xp" | "trending" | "ads", { ...current, ...next });
      break;
    }
    default:
      throw new ApiError(400, "unknown_action");
  }
  return noStore({ ok: true });
});
