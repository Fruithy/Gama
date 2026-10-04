import "server-only";
import type { Db } from "@/lib/db";
import { DEFAULT_XP, type XpConfig } from "@/lib/xp/rules";
import { DEFAULT_TRENDING_WEIGHTS, type TrendingWeights } from "@/lib/analytics/trending";
import { DEFAULT_AD_POLICY, type AdPolicy } from "./monetization";
import { defaultFlags, FLAG_DEFAULTS, type Flags } from "./flags";

export interface AppConfig {
  xp: XpConfig;
  trending: TrendingWeights;
  ads: AdPolicy;
}

const DEFAULTS: AppConfig = { xp: DEFAULT_XP, trending: DEFAULT_TRENDING_WEIGHTS, ads: DEFAULT_AD_POLICY };

let cache: { at: number; config: AppConfig; flags: Flags } | null = null;
const TTL_MS = 30_000;

export function invalidateConfigCache() {
  cache = null;
}

async function load(db: Db) {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const [cfgRows, flagRows] = await Promise.all([
    db.query<{ key: string; value: unknown }>("select key, value from app_config"),
    db.query<{ key: string; enabled: boolean }>("select key, enabled from feature_flags"),
  ]);
  const config = structuredClone(DEFAULTS) as AppConfig;
  for (const r of cfgRows) {
    if (r.key in config && r.value && typeof r.value === "object") {
      Object.assign(config[r.key as keyof AppConfig], r.value);
    }
  }
  const flags = defaultFlags();
  for (const r of flagRows) if (r.key in FLAG_DEFAULTS) flags[r.key as keyof Flags] = r.enabled;
  cache = { at: Date.now(), config, flags };
  return cache;
}

export async function getConfig(db: Db): Promise<AppConfig> {
  return (await load(db)).config;
}

export async function getFlags(db: Db): Promise<Flags> {
  return (await load(db)).flags;
}

export async function setConfig(db: Db, key: keyof AppConfig, value: Record<string, unknown>) {
  await db.query(
    "insert into app_config(key, value, updated_at) values ($1, $2::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
    [key, JSON.stringify(value)],
  );
  invalidateConfigCache();
}

export async function setFlag(db: Db, key: keyof Flags, enabled: boolean) {
  await db.query(
    "insert into feature_flags(key, enabled, description, updated_at) values ($1, $2, $3, now()) on conflict (key) do update set enabled = excluded.enabled, updated_at = now()",
    [key, enabled, FLAG_DEFAULTS[key].description],
  );
  invalidateConfigCache();
}
