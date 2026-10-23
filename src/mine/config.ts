/**
 * NEON RIG — idle crypto-mining. Every tuning number lives in this file
 * (shared by the economy, the UI and the tests).
 *
 * GLINT (◆) is a fictional coin; nothing here touches a real chain or wallet.
 */

export const GAME_NAME = "NEON RIG";
export const COIN = "GLINT";
export const COIN_GLYPH = "◆";

export const TUNING = {
  /** Price growth per rig owned (classic idle curve). */
  costGrowth: 1.15,
  /** Base GLINT per tap before upgrades. */
  tapBase: 1,
  /** Seconds a block takes at 100% speed. */
  blockSeconds: 10,
  /** Block progress added per tap (fraction of a block). */
  tapBlockProgress: 0.025,
  /** Block reward = (income × blockIncomeSeconds + tap × blockTapMultiple) × block multiplier. */
  blockIncomeSeconds: 3,
  blockTapMultiple: 5,
  /** Offline earnings: base efficiency and cap (seconds). */
  offlineEfficiency: 0.5,
  offlineCapS: 8 * 3600,
  /** Whale comets: spawn window (s) and how long one stays on screen. */
  cometMinS: 50,
  cometMaxS: 130,
  cometLifeS: 11,
  /** Whale drop = min(bank × share, income × seconds) + floor. */
  whaleBankShare: 0.15,
  whaleIncomeSeconds: 900,
  whaleFloor: 25,
  /** Bull run started by a comet. */
  bullMultiplier: 5,
  bullSeconds: 30,
  /** Chance a comet is a bull run rather than a lump of GLINT. */
  bullChance: 0.42,
  /** Market "hype" — mean-reverting random walk on log price. */
  hypeReversion: 0.12,
  hypeVolatility: 0.11,
  hypeClamp: 0.4,
  /** Hard fork: tokens = floor(sqrt(allTimeEarned / forkScale)); each token adds forkBonus income. */
  forkScale: 1e6,
  forkBonus: 0.02,
  /** Hashrate shown in the UI = income units × this many H/s. */
  hashPerUnit: 1e6,
} as const;

export type RigShape = "square" | "hex" | "diamond" | "tri" | "ring" | "star" | "cross" | "orb";

export interface RigDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  cost: number;
  /** Base GLINT/s per rig. */
  rate: number;
  color: string;
  shape: RigShape;
}

export const RIGS: readonly RigDef[] = [
  { id: "potato", name: "Potato Laptop", icon: "🥔", blurb: "Runs hot. Mines slow. Believes in you.", cost: 15, rate: 0.1, color: "#ffc23d", shape: "square" },
  { id: "gpu", name: "Gamer GPU", icon: "🎮", blurb: "The RGB adds +0% hashrate. Worth it.", cost: 100, rate: 1, color: "#3dffb0", shape: "diamond" },
  { id: "rack", name: "GPU Rack", icon: "🗄️", blurb: "Six cards and one very loud fan.", cost: 1_100, rate: 8, color: "#3dd8ff", shape: "hex" },
  { id: "asic", name: "ASIC Brick", icon: "🧱", blurb: "Does one thing. Does it beautifully.", cost: 12_000, rate: 47, color: "#8b5cff", shape: "square" },
  { id: "tank", name: "Immersion Tank", icon: "🛁", blurb: "Servers taking a relaxing bath.", cost: 130_000, rate: 260, color: "#ff3d7f", shape: "ring" },
  { id: "hydro", name: "Hydro Farm", icon: "💧", blurb: "A waterfall's worth of hashes.", cost: 1.4e6, rate: 1_400, color: "#4f8cff", shape: "tri" },
  { id: "volcano", name: "Volcano Vault", icon: "🌋", blurb: "Geothermal power. Free heat. Free vibes.", cost: 2e7, rate: 7_800, color: "#ff6a3d", shape: "star" },
  { id: "orbital", name: "Orbital Array", icon: "🛰️", blurb: "Solar rigs in low orbit. No cooling bill.", cost: 3.3e8, rate: 44_000, color: "#d4ff3a", shape: "cross" },
  { id: "quantum", name: "Quantum Hasher", icon: "⚛️", blurb: "Finds the block before you ask.", cost: 5.1e9, rate: 260_000, color: "#e85dff", shape: "orb" },
  { id: "dyson", name: "Dyson Swarm", icon: "☀️", blurb: "Wraps a star. Mines the light.", cost: 7.5e10, rate: 1.6e6, color: "#fff27a", shape: "star" },
  { id: "multiverse", name: "Multiverse Node", icon: "🌀", blurb: "Borrows hashrate from other timelines.", cost: 1e12, rate: 1e7, color: "#ffffff", shape: "orb" },
];

/** Per-rig ×2 upgrades: unlocked at an owned count, priced at rig cost × factor. */
export const RIG_TIERS = [
  { name: "Thermal Paste", at: 1, factor: 10 },
  { name: "Overclock", at: 10, factor: 50 },
  { name: "Custom Firmware", at: 25, factor: 500 },
  { name: "Liquid Cooling", at: 50, factor: 5_000 },
  { name: "Silicon Lottery", at: 100, factor: 50_000 },
  { name: "Exotic Alloys", at: 150, factor: 500_000 },
  { name: "Cryo Chamber", at: 200, factor: 5e6 },
  { name: "Singularity Tuning", at: 250, factor: 5e7 },
] as const;

export type UpgradeEffect =
  | { kind: "rig"; rig: number; mult: number }
  | { kind: "global"; mult: number }
  | { kind: "tapMult"; mult: number }
  | { kind: "tapIncome"; share: number }
  | { kind: "autoTap"; perSecond: number }
  | { kind: "blockReward"; mult: number }
  | { kind: "blockSpeed"; mult: number }
  | { kind: "cometRate"; mult: number }
  | { kind: "bullLength"; mult: number }
  | { kind: "autoComet" }
  | { kind: "offlineEfficiency"; value: number }
  | { kind: "offlineCap"; seconds: number };

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  effect: UpgradeEffect;
  /** Rig index + count required before the upgrade appears. */
  requires?: { rig: number; count: number };
  color: string;
}

const TIER_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const rigUpgrades: UpgradeDef[] = RIGS.flatMap((rig, i) =>
  RIG_TIERS.map((t, k) => ({
    id: `${rig.id}-t${k}`,
    name: `${t.name} ${TIER_NUMERALS[k]}`,
    icon: rig.icon,
    desc: `${rig.name}s mine ×2 faster.`,
    cost: rig.cost * t.factor,
    effect: { kind: "rig", rig: i, mult: 2 } as const,
    requires: { rig: i, count: t.at },
    color: rig.color,
  })),
);

const specialUpgrades: UpgradeDef[] = [
  { id: "tap1", name: "Clicky Keyboard", icon: "⌨️", desc: "Taps mine ×2.", cost: 100, effect: { kind: "tapMult", mult: 2 }, color: "#d4ff3a" },
  { id: "tap2", name: "Gaming Mouse", icon: "🖱️", desc: "Taps mine ×2.", cost: 600, effect: { kind: "tapMult", mult: 2 }, color: "#d4ff3a" },
  { id: "auto1", name: "Tap Drone", icon: "🛸", desc: "A tiny drone taps the core for you, 1×/s.", cost: 3_000, effect: { kind: "autoTap", perSecond: 1 }, color: "#3dd8ff" },
  { id: "tap3", name: "Macro Script", icon: "📜", desc: "Every tap also mines 1% of your income.", cost: 10_000, effect: { kind: "tapIncome", share: 0.01 }, color: "#d4ff3a" },
  { id: "block1", name: "Lucky Nonce", icon: "🍀", desc: "Block rewards ×2.", cost: 20_000, effect: { kind: "blockReward", mult: 2 }, color: "#3dffb0" },
  { id: "pool", name: "Mining Pool", icon: "🏊", desc: "All rigs mine ×1.25.", cost: 50_000, effect: { kind: "global", mult: 1.25 }, color: "#ff3d7f" },
  { id: "radar", name: "Whale Radar", icon: "📡", desc: "Whale comets appear 35% more often.", cost: 100_000, effect: { kind: "cometRate", mult: 1.35 }, color: "#ffc23d" },
  { id: "cold", name: "Cold Wallet", icon: "🧊", desc: "Earn 100% while away (was 50%).", cost: 1e6, effect: { kind: "offlineEfficiency", value: 1 }, color: "#3dd8ff" },
  { id: "tap4", name: "Neural Link", icon: "🧠", desc: "Every tap also mines 2% of your income.", cost: 1e6, effect: { kind: "tapIncome", share: 0.02 }, color: "#d4ff3a" },
  { id: "block2", name: "Merkle Magic", icon: "🌳", desc: "Blocks are found 25% faster.", cost: 2e6, effect: { kind: "blockSpeed", mult: 1 / 0.75 }, color: "#3dffb0" },
  { id: "power", name: "Cheap Night Power", icon: "🌙", desc: "All rigs mine ×1.5.", cost: 5e6, effect: { kind: "global", mult: 1.5 }, color: "#ff3d7f" },
  { id: "auto2", name: "Drone Swarm", icon: "🛸", desc: "+2 drone taps per second.", cost: 1e7, effect: { kind: "autoTap", perSecond: 2 }, color: "#3dd8ff" },
  { id: "diamond", name: "Diamond Hands", icon: "💎", desc: "Bull runs last 50% longer.", cost: 1e7, effect: { kind: "bullLength", mult: 1.5 }, color: "#ffc23d" },
  { id: "tap5", name: "Telekinesis", icon: "🔮", desc: "Every tap also mines 3% of your income.", cost: 1e8, effect: { kind: "tapIncome", share: 0.03 }, color: "#d4ff3a" },
  { id: "block3", name: "Uncle Blocks", icon: "👴", desc: "Block rewards ×3.", cost: 2e8, effect: { kind: "blockReward", mult: 3 }, color: "#3dffb0" },
  { id: "solar", name: "Solar Roof", icon: "🔆", desc: "All rigs mine ×1.5.", cost: 5e8, effect: { kind: "global", mult: 1.5 }, color: "#ff3d7f" },
  { id: "net", name: "Whale Net", icon: "🕸️", desc: "Whale comets are caught automatically.", cost: 1e9, effect: { kind: "autoComet" }, color: "#ffc23d" },
  { id: "freeze", name: "Deep Freeze", icon: "❄️", desc: "Earn while away for up to 24 h (was 8 h).", cost: 1e9, effect: { kind: "offlineCap", seconds: 24 * 3600 }, color: "#3dd8ff" },
  { id: "tap6", name: "Hand of the Whale", icon: "🐋", desc: "Every tap also mines 4% of your income.", cost: 1e10, effect: { kind: "tapIncome", share: 0.04 }, color: "#d4ff3a" },
  { id: "fusion", name: "Fusion Contract", icon: "☢️", desc: "All rigs mine ×2.", cost: 5e10, effect: { kind: "global", mult: 2 }, color: "#ff3d7f" },
  { id: "auto3", name: "Drone Armada", icon: "🛸", desc: "+4 drone taps per second.", cost: 1e11, effect: { kind: "autoTap", perSecond: 4 }, color: "#3dd8ff" },
  { id: "zero", name: "Zero-Point Energy", icon: "✴️", desc: "All rigs mine ×2.", cost: 5e12, effect: { kind: "global", mult: 2 }, color: "#ff3d7f" },
  { id: "hedge", name: "Heat-Death Hedge", icon: "🌌", desc: "All rigs mine ×3.", cost: 5e14, effect: { kind: "global", mult: 3 }, color: "#ff3d7f" },
];

export const UPGRADES: readonly UpgradeDef[] = [...specialUpgrades, ...rigUpgrades].sort((a, b) => a.cost - b.cost);
export const UPGRADE_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(UPGRADES.map((u) => [u.id, u]));

/** Hue (deg) of each fork era — the whole scene re-tints after a hard fork. */
export const ERA_HUES = [265, 190, 320, 150, 25, 210, 290, 55] as const;
export const ERA_NAMES = ["Genesis", "Ion Fork", "Magenta Fork", "Verdant Fork", "Ember Fork", "Abyss Fork", "Ultra Fork", "Gold Fork"] as const;
