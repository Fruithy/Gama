import "server-only";
import type { Db } from "@/lib/db";
import type { AchievementDef, AchievementRule } from "./definitions";
import { evaluateAchievements, type AchievementContext } from "./evaluate";

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  tier: string;
}

export async function loadAchievementDefs(db: Db): Promise<AchievementDef[]> {
  const rows = await db.query<{ id: string; name: string; description: string; icon: string; xp: number; tier: AchievementDef["tier"]; rule: AchievementRule }>(
    "select id, name, description, icon, xp, tier, rule from achievements where enabled order by sort_order",
  );
  return rows;
}

/** Evaluate + persist newly unlocked achievements. Returns them (for the result screen). */
export async function unlockAchievements(
  db: Db,
  playerId: string,
  ctx: AchievementContext,
  meta: { gameId?: string; runId?: string } = {},
): Promise<UnlockedAchievement[]> {
  const defs = await loadAchievementDefs(db);
  const owned = new Set(
    (await db.query<{ achievement_id: string }>("select achievement_id from player_achievements where player_id = $1", [playerId])).map((r) => r.achievement_id),
  );
  const fresh = evaluateAchievements(defs, ctx, owned);
  const unlocked: UnlockedAchievement[] = [];
  for (const a of fresh) {
    const rows = await db.query(
      "insert into player_achievements (player_id, achievement_id, game_id, run_id) values ($1, $2, $3, $4) on conflict do nothing returning achievement_id",
      [playerId, a.id, meta.gameId ?? null, meta.runId ?? null],
    );
    if (rows.length) unlocked.push({ id: a.id, name: a.name, description: a.description, icon: a.icon, xp: a.xp, tier: a.tier });
  }
  return unlocked;
}

export async function playerAchievements(db: Db, playerId: string) {
  return db.query<{ id: string; name: string; description: string; icon: string; tier: string; xp: number; unlocked_at: Date | null; game_id: string | null }>(
    `select a.id, a.name, a.description, a.icon, a.tier, a.xp, pa.unlocked_at, pa.game_id
     from achievements a left join player_achievements pa on pa.achievement_id = a.id and pa.player_id = $1
     where a.enabled order by (pa.unlocked_at is null), a.sort_order`,
    [playerId],
  );
}
