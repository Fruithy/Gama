import { describe, expect, it } from "vitest";
import { RIGS, TUNING, UPGRADES } from "@/mine/config";
import {
  applyOffline,
  availableUpgrades,
  baseIncome,
  buyRig,
  buyUpgrade,
  earn,
  hardFork,
  maxAffordable,
  modifiers,
  newState,
  parseSave,
  pendingTokens,
  rigCost,
  serialize,
  tokensForEarnings,
} from "@/mine/economy";
import { fmt, fmtDuration, fmtHash } from "@/mine/format";
import { MineSession } from "@/mine/session";
import { createRng } from "@/games/core/rng";

const T0 = 1_800_000_000_000;

describe("Neon Rig config", () => {
  it("has unique ids and strictly growing rig tiers", () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
    for (let i = 1; i < RIGS.length; i++) {
      expect(RIGS[i].cost).toBeGreaterThan(RIGS[i - 1].cost);
      expect(RIGS[i].rate).toBeGreaterThan(RIGS[i - 1].rate);
      // Later rigs are never a better deal per GLINT than the first.
      expect(RIGS[i].rate / RIGS[i].cost).toBeLessThan(RIGS[0].rate / RIGS[0].cost * 2);
    }
  });
});

describe("Neon Rig economy", () => {
  it("prices rigs on a geometric curve and finds the max affordable", () => {
    expect(rigCost(0, 0)).toBe(15);
    expect(rigCost(0, 1)).toBe(Math.ceil(15 * TUNING.costGrowth));
    expect(rigCost(0, 0, 10)).toBeGreaterThan(rigCost(0, 0) * 10);
    for (const bank of [0, 14, 15, 100, 12_345, 9.9e9]) {
      const n = maxAffordable(0, 3, bank);
      if (n > 0) expect(rigCost(0, 3, n)).toBeLessThanOrEqual(bank);
      expect(rigCost(0, 3, n + 1)).toBeGreaterThan(bank);
    }
  });

  it("buys rigs and upgrades only when affordable and visible", () => {
    const s = newState(T0);
    expect(buyRig(s, 0, 1)).toBe(false);
    earn(s, 1_000);
    expect(buyRig(s, 0, 1)).toBe(true);
    expect(s.rigs[0]).toBe(1);
    expect(s.glint).toBe(985);
    expect(baseIncome(s)).toBeCloseTo(0.1);
    // Thermal Paste I needs 1 potato and costs 150.
    expect(availableUpgrades(s).map((u) => u.id)).toContain("potato-t0");
    expect(buyUpgrade(s, "potato-t0")).toBe(true);
    expect(buyUpgrade(s, "potato-t0")).toBe(false);
    expect(baseIncome(s)).toBeCloseTo(0.2);
    // Not yet visible: requires 10 potatoes.
    expect(buyUpgrade(s, "potato-t1")).toBe(false);
  });

  it("stacks global, tap and fork multipliers", () => {
    const s = newState(T0);
    s.rigs[1] = 10;
    s.upgrades = ["pool", "tap1", "tap3"];
    s.tokens = 50;
    const m = modifiers(s);
    expect(m.globalMult).toBe(1.25);
    expect(m.tapMult).toBe(2);
    expect(m.tapIncomeShare).toBe(0.01);
    expect(m.forkMult).toBeCloseTo(1 + 50 * TUNING.forkBonus);
    expect(baseIncome(s, m)).toBeCloseTo(10 * 1 * 1.25 * m.forkMult);
  });

  it("hard forks into tokens and resets the run", () => {
    const s = newState(T0);
    earn(s, 4e8); // sqrt(400) = 20 tokens
    s.rigs[0] = 50;
    s.upgrades = ["pool"];
    expect(tokensForEarnings(s.allTimeEarned)).toBe(20);
    expect(pendingTokens(s)).toBe(20);
    expect(hardFork(s)).toBe(true);
    expect(s).toMatchObject({ tokens: 20, forks: 1, glint: 0, runEarned: 0, upgrades: [] });
    expect(s.rigs.every((r) => r === 0)).toBe(true);
    expect(s.allTimeEarned).toBe(4e8);
    expect(hardFork(s)).toBe(false); // nothing new to claim
  });

  it("credits time away at the offline rate, capped", () => {
    const s = newState(T0);
    s.rigs[1] = 10; // 10 GLINT/s
    const r = applyOffline(s, T0 + 3600e3);
    expect(r.seconds).toBe(3600);
    expect(r.earned).toBeCloseTo(10 * 3600 * TUNING.offlineEfficiency);
    expect(r.blocks).toBe(360);
    const capped = applyOffline(s, T0 + 3600e3 + 48 * 3600e3);
    expect(capped.capped).toBe(true);
    expect(capped.seconds).toBe(TUNING.offlineCapS);
    s.upgrades.push("cold");
    const full = applyOffline(s, s.lastSeen + 1000e3);
    expect(full.earned).toBeCloseTo(10 * 1000);
  });

  it("round-trips saves and survives garbage", () => {
    const s = newState(T0);
    earn(s, 1234);
    s.rigs[2] = 7;
    s.upgrades = ["pool"];
    expect(parseSave(serialize(s), T0)).toEqual(s);
    expect(parseSave("{nope", T0)).toEqual(newState(T0));
    const hostile = parseSave(JSON.stringify({ v: 1, glint: -5, rigs: ["x", 3, Infinity], upgrades: ["pool", "pool", "hack"], lastSeen: T0 * 2 }), T0);
    expect(hostile.glint).toBe(0);
    expect(hostile.rigs.slice(0, 3)).toEqual([0, 3, 0]);
    expect(hostile.upgrades).toEqual(["pool"]);
    expect(hostile.lastSeen).toBe(T0); // a clock from the future can't mint offline time
  });
});

describe("Neon Rig session", () => {
  const rng = () => {
    const r = createRng("mine-test");
    return () => r.next();
  };

  it("mines continuously, seals blocks and runs drones", () => {
    const s = newState(T0);
    s.rigs[1] = 5;
    s.upgrades = ["auto1"];
    const session = new MineSession(s, T0, rng());
    for (let i = 0; i < 600; i++) session.tick(1 / 60); // 10 s
    const events = session.drain();
    expect(events.filter((e) => e.type === "block").length).toBeGreaterThanOrEqual(1);
    expect(events.filter((e) => e.type === "tap" && e.auto).length).toBe(10);
    expect(s.glint).toBeGreaterThan(5 * 10 * Math.exp(-TUNING.hypeClamp));
  });

  it("spawns whale comets that pay out or start a bull run", () => {
    const s = newState(T0);
    s.rigs[1] = 100;
    const session = new MineSession(s, T0, rng());
    let spawned = 0;
    for (let i = 0; i < 20 && spawned < 6; i++) {
      for (let k = 0; k < 400 && !session.comet; k++) session.tick(0.5);
      expect(session.comet).not.toBeNull();
      spawned++;
      const before = s.glint;
      expect(session.catchComet()).toBe(true);
      const caught = session.drain().find((e) => e.type === "comet-catch");
      expect(caught).toBeDefined();
      if (caught?.type === "comet-catch" && caught.kind === "whale") expect(s.glint).toBeGreaterThan(before);
      if (caught?.type === "comet-catch" && caught.kind === "bull") expect(session.bullMult).toBe(TUNING.bullMultiplier);
    }
    expect(s.cometsCaught).toBe(6);
  });

  it("announces newly discovered rigs", () => {
    const session = new MineSession(newState(T0), T0, rng());
    for (let i = 0; i < 60; i++) session.tap();
    expect(session.drain().some((e) => e.type === "unlock" && e.index === 1)).toBe(true);
  });

  it("reports offline earnings on load", () => {
    const s = newState(T0);
    s.rigs[0] = 10;
    const session = new MineSession(s, T0 + 600e3, rng());
    expect(session.offline?.seconds).toBe(600);
    expect(session.offline?.earned).toBeCloseTo(600 * TUNING.offlineEfficiency);
  });
});

describe("Neon Rig formatting", () => {
  it("abbreviates idle-sized numbers", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(7.25)).toBe("7.2");
    expect(fmt(999)).toBe("999");
    expect(fmt(1234)).toBe("1.23K");
    expect(fmt(999_999)).toBe("999K");
    expect(fmt(4.2e8, 4)).toBe("420.0M");
    expect(fmt(1e40)).toBe("1.00e40");
    expect(fmtHash(1.2e5)).toBe("120 kH/s");
    expect(fmtHash(4.5e12)).toBe("4.50 TH/s");
    expect(fmtDuration(3 * 3600 + 120)).toBe("3h 2m");
  });
});
