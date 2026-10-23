import { RIGS, TUNING, UPGRADES, UPGRADE_BY_ID, type UpgradeDef } from "./config";

/**
 * Pure economy for NEON RIG. Everything here is deterministic and free of
 * browser APIs so it can be unit-tested and reused for offline earnings.
 */

export interface MineState {
  v: 1;
  glint: number;
  /** Earned since the last hard fork. */
  runEarned: number;
  /** Earned across every fork — drives fork tokens. */
  allTimeEarned: number;
  tokens: number;
  forks: number;
  rigs: number[];
  upgrades: string[];
  taps: number;
  blocks: number;
  height: number;
  blockProgress: number;
  cometsCaught: number;
  startedAt: number;
  lastSeen: number;
  playSeconds: number;
}

export function newState(now: number): MineState {
  return {
    v: 1,
    glint: 0,
    runEarned: 0,
    allTimeEarned: 0,
    tokens: 0,
    forks: 0,
    rigs: RIGS.map(() => 0),
    upgrades: [],
    taps: 0,
    blocks: 0,
    height: 0,
    blockProgress: 0,
    cometsCaught: 0,
    startedAt: now,
    lastSeen: now,
    playSeconds: 0,
  };
}

/* ───────────────────────── modifiers ───────────────────────── */

export interface Modifiers {
  rigMult: number[];
  globalMult: number;
  tapMult: number;
  tapIncomeShare: number;
  autoTapsPerSecond: number;
  blockRewardMult: number;
  blockSpeed: number;
  cometRate: number;
  bullLength: number;
  autoComet: boolean;
  offlineEfficiency: number;
  offlineCapS: number;
  forkMult: number;
}

/** Fold every owned upgrade into one flat set of multipliers. */
export function modifiers(s: MineState): Modifiers {
  const m: Modifiers = {
    rigMult: RIGS.map(() => 1),
    globalMult: 1,
    tapMult: 1,
    tapIncomeShare: 0,
    autoTapsPerSecond: 0,
    blockRewardMult: 1,
    blockSpeed: 1,
    cometRate: 1,
    bullLength: 1,
    autoComet: false,
    offlineEfficiency: TUNING.offlineEfficiency,
    offlineCapS: TUNING.offlineCapS,
    forkMult: 1 + s.tokens * TUNING.forkBonus,
  };
  for (const id of s.upgrades) {
    const u = UPGRADE_BY_ID.get(id);
    if (!u) continue;
    const e = u.effect;
    switch (e.kind) {
      case "rig":
        m.rigMult[e.rig] *= e.mult;
        break;
      case "global":
        m.globalMult *= e.mult;
        break;
      case "tapMult":
        m.tapMult *= e.mult;
        break;
      case "tapIncome":
        m.tapIncomeShare += e.share;
        break;
      case "autoTap":
        m.autoTapsPerSecond += e.perSecond;
        break;
      case "blockReward":
        m.blockRewardMult *= e.mult;
        break;
      case "blockSpeed":
        m.blockSpeed *= e.mult;
        break;
      case "cometRate":
        m.cometRate *= e.mult;
        break;
      case "bullLength":
        m.bullLength *= e.mult;
        break;
      case "autoComet":
        m.autoComet = true;
        break;
      case "offlineEfficiency":
        m.offlineEfficiency = Math.max(m.offlineEfficiency, e.value);
        break;
      case "offlineCap":
        m.offlineCapS = Math.max(m.offlineCapS, e.seconds);
        break;
    }
  }
  return m;
}

/** GLINT/s produced by one rig type (all of them), before market + bull. */
export function rigOutput(s: MineState, m: Modifiers, i: number): number {
  return s.rigs[i] * RIGS[i].rate * m.rigMult[i] * m.globalMult * m.forkMult;
}

/** Base GLINT/s (no market hype, no bull run). */
export function baseIncome(s: MineState, m: Modifiers = modifiers(s)): number {
  let total = 0;
  for (let i = 0; i < RIGS.length; i++) total += rigOutput(s, m, i);
  return total;
}

/** Hashrate shown to the player (H/s). Cosmetic — proportional to base income. */
export function hashrate(s: MineState, m: Modifiers = modifiers(s)): number {
  return baseIncome(s, m) * TUNING.hashPerUnit;
}

export function tapValue(m: Modifiers, income: number): number {
  return TUNING.tapBase * m.tapMult + income * m.tapIncomeShare;
}

export function blockReward(m: Modifiers, income: number): number {
  return (income * TUNING.blockIncomeSeconds + tapValue(m, income) * TUNING.blockTapMultiple) * m.blockRewardMult;
}

/* ───────────────────────── buying ───────────────────────── */

/** Cost of buying `qty` more of rig `i` when `owned` are already owned. */
export function rigCost(i: number, owned: number, qty = 1): number {
  const r = TUNING.costGrowth;
  return Math.ceil((RIGS[i].cost * Math.pow(r, owned) * (Math.pow(r, qty) - 1)) / (r - 1));
}

/** How many of rig `i` the bank can afford right now (0 if none). */
export function maxAffordable(i: number, owned: number, bank: number): number {
  const r = TUNING.costGrowth;
  const first = RIGS[i].cost * Math.pow(r, owned);
  if (bank < first) return 0;
  let n = Math.floor(Math.log((bank * (r - 1)) / first + 1) / Math.log(r));
  // Guard against floating point at the edges.
  while (n > 0 && rigCost(i, owned, n) > bank) n--;
  while (rigCost(i, owned, n + 1) <= bank) n++;
  return n;
}

export function earn(s: MineState, amount: number) {
  if (!(amount > 0)) return;
  s.glint += amount;
  s.runEarned += amount;
  s.allTimeEarned += amount;
}

export function buyRig(s: MineState, i: number, qty: number): boolean {
  if (qty <= 0 || i < 0 || i >= RIGS.length) return false;
  const cost = rigCost(i, s.rigs[i], qty);
  if (cost > s.glint) return false;
  s.glint -= cost;
  s.rigs[i] += qty;
  return true;
}

export function isRigUnlocked(s: MineState, i: number): boolean {
  return i === 0 || s.rigs[i] > 0 || s.rigs[i - 1] > 0 || s.runEarned >= RIGS[i].cost * 0.5;
}

export function upgradeVisible(s: MineState, u: UpgradeDef): boolean {
  if (s.upgrades.includes(u.id)) return false;
  if (u.requires && s.rigs[u.requires.rig] < u.requires.count) return false;
  return s.runEarned >= u.cost * 0.1;
}

export function availableUpgrades(s: MineState): UpgradeDef[] {
  return UPGRADES.filter((u) => upgradeVisible(s, u));
}

export function buyUpgrade(s: MineState, id: string): boolean {
  const u = UPGRADE_BY_ID.get(id);
  if (!u || !upgradeVisible(s, u) || s.glint < u.cost) return false;
  s.glint -= u.cost;
  s.upgrades.push(id);
  return true;
}

/* ───────────────────────── hard fork (prestige) ───────────────────────── */

export function tokensForEarnings(allTimeEarned: number): number {
  return Math.floor(Math.sqrt(Math.max(0, allTimeEarned) / TUNING.forkScale));
}

export function pendingTokens(s: MineState): number {
  return Math.max(0, tokensForEarnings(s.allTimeEarned) - s.tokens);
}

/** Total GLINT that must have been earned (all-time) to own `tokens` tokens. */
export function earningsForTokens(tokens: number): number {
  return tokens * tokens * TUNING.forkScale;
}

export function hardFork(s: MineState): boolean {
  const gain = pendingTokens(s);
  if (gain < 1) return false;
  s.tokens += gain;
  s.forks += 1;
  s.glint = 0;
  s.runEarned = 0;
  s.rigs = RIGS.map(() => 0);
  s.upgrades = [];
  s.blockProgress = 0;
  return true;
}

/* ───────────────────────── time ───────────────────────── */

export interface OfflineReport {
  seconds: number;
  earned: number;
  blocks: number;
  capped: boolean;
}

/** Credit earnings for time away (no hype, no bull runs, no taps). */
export function applyOffline(s: MineState, now: number): OfflineReport {
  const away = Math.max(0, (now - s.lastSeen) / 1000);
  const m = modifiers(s);
  const seconds = Math.min(away, m.offlineCapS);
  const earned = baseIncome(s, m) * seconds * m.offlineEfficiency;
  const blockS = TUNING.blockSeconds / m.blockSpeed;
  const total = s.blockProgress + seconds / blockS;
  const blocks = baseIncome(s, m) > 0 ? Math.floor(total) : 0;
  if (blocks > 0) {
    s.blocks += blocks;
    s.height += blocks;
    s.blockProgress = total - blocks;
  }
  earn(s, earned);
  s.lastSeen = now;
  return { seconds, earned, blocks, capped: away > m.offlineCapS };
}

/* ───────────────────────── persistence ───────────────────────── */

const finite = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);

/** Parse a saved game defensively — a corrupt save never crashes the page. */
export function parseSave(raw: string | null, now: number): MineState {
  const base = newState(now);
  if (!raw) return base;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!data || typeof data !== "object" || data.v !== 1) return base;
  const rigs = Array.isArray(data.rigs) ? data.rigs : [];
  return {
    v: 1,
    glint: finite(data.glint),
    runEarned: finite(data.runEarned),
    allTimeEarned: finite(data.allTimeEarned),
    tokens: Math.floor(finite(data.tokens)),
    forks: Math.floor(finite(data.forks)),
    rigs: RIGS.map((_, i) => Math.floor(finite(rigs[i]))),
    upgrades: Array.isArray(data.upgrades) ? [...new Set(data.upgrades.filter((u): u is string => typeof u === "string" && UPGRADE_BY_ID.has(u)))] : [],
    taps: Math.floor(finite(data.taps)),
    blocks: Math.floor(finite(data.blocks)),
    height: Math.floor(finite(data.height)),
    blockProgress: Math.min(0.999, finite(data.blockProgress)),
    cometsCaught: Math.floor(finite(data.cometsCaught)),
    startedAt: finite(data.startedAt, now),
    lastSeen: Math.min(now, finite(data.lastSeen, now)),
    playSeconds: finite(data.playSeconds),
  };
}

export function serialize(s: MineState): string {
  return JSON.stringify(s);
}
