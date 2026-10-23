import { RIGS, TUNING, UPGRADE_BY_ID } from "./config";
import {
  applyOffline,
  baseIncome,
  blockReward,
  buyRig,
  buyUpgrade,
  earn,
  hardFork,
  isRigUnlocked,
  modifiers,
  tapValue,
  type MineState,
  type Modifiers,
  type OfflineReport,
} from "./economy";

/**
 * A live play session: the saved economy plus everything that only exists
 * while the page is open — market hype, whale comets, bull runs — and an
 * event queue the renderer, audio and UI drain every frame.
 */

export type MineEvent =
  | { type: "tap"; value: number; auto: boolean }
  | { type: "block"; height: number; reward: number }
  | { type: "rig"; index: number; qty: number }
  | { type: "upgrade"; id: string }
  | { type: "unlock"; index: number }
  | { type: "comet-spawn"; id: number }
  | { type: "comet-miss"; id: number }
  | { type: "comet-catch"; id: number; kind: "whale" | "bull"; amount: number; auto: boolean }
  | { type: "bull-end" }
  | { type: "fork"; tokens: number };

export interface Comet {
  id: number;
  age: number;
  life: number;
  /** 0..1 — the renderer derives the flight path from it. */
  seed: number;
}

export const HYPE_HISTORY = 96;
const HYPE_SAMPLE_S = 0.5;

export class MineSession {
  readonly state: MineState;
  mods: Modifiers;
  hype = 1;
  private logHype = 0;
  hypeHistory: number[] = [];
  private hypeClock = 0;
  bullLeft = 0;
  bullTotal = 0;
  comet: Comet | null = null;
  private cometClock: number;
  private cometIds = 0;
  private autoTapClock = 0;
  events: MineEvent[] = [];
  offline: OfflineReport | null = null;

  constructor(
    state: MineState,
    now: number,
    private random: () => number = Math.random,
  ) {
    this.state = state;
    const report = applyOffline(state, now);
    if (report.seconds >= 60 && report.earned > 0) this.offline = report;
    this.mods = modifiers(state);
    this.cometClock = this.nextCometDelay() * 0.6;
    // Pre-roll the market so the chart is alive from the first frame.
    for (let i = 0; i < HYPE_HISTORY; i++) {
      this.stepHype(HYPE_SAMPLE_S);
      this.hypeHistory.push(this.hype);
    }
  }

  private stepHype(dt: number) {
    const { hypeReversion, hypeVolatility, hypeClamp } = TUNING;
    const gauss = (this.random() + this.random() + this.random() - 1.5) * 2;
    this.logHype += -hypeReversion * this.logHype * dt + hypeVolatility * Math.sqrt(dt) * gauss;
    this.logHype = Math.max(-hypeClamp, Math.min(hypeClamp, this.logHype));
    this.hype = Math.exp(this.logHype);
  }

  /** Base income × market hype × bull run. */
  get income() {
    return baseIncome(this.state, this.mods) * this.hype * this.bullMult;
  }

  get bullMult() {
    return this.bullLeft > 0 ? TUNING.bullMultiplier : 1;
  }

  get tapValue() {
    return tapValue(this.mods, this.income) * this.bullMult;
  }

  get blockSeconds() {
    return TUNING.blockSeconds / this.mods.blockSpeed;
  }

  private emit(e: MineEvent) {
    if (this.events.length < 200) this.events.push(e);
  }

  drain(): MineEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private nextCometDelay() {
    const { cometMinS, cometMaxS } = TUNING;
    return (cometMinS + this.random() * (cometMaxS - cometMinS)) / this.mods.cometRate;
  }

  private refresh() {
    const before = RIGS.map((_, i) => isRigUnlocked(this.state, i));
    this.mods = modifiers(this.state);
    return before;
  }

  private announceUnlocks(before: boolean[]) {
    for (let i = 0; i < RIGS.length; i++) if (!before[i] && isRigUnlocked(this.state, i)) this.emit({ type: "unlock", index: i });
  }

  private credit(amount: number) {
    const before = RIGS.map((_, i) => isRigUnlocked(this.state, i));
    earn(this.state, amount);
    this.announceUnlocks(before);
  }

  tick(dt: number) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 1); // long frames (tab switches) are covered by offline earnings
    const s = this.state;
    s.playSeconds += dt;

    // Market hype: mean-reverting walk on log price.
    this.stepHype(dt);
    this.hypeClock += dt;
    if (this.hypeClock >= HYPE_SAMPLE_S) {
      this.hypeClock -= HYPE_SAMPLE_S;
      this.hypeHistory.push(this.hype * this.bullMult);
      if (this.hypeHistory.length > HYPE_HISTORY) this.hypeHistory.shift();
    }

    if (this.bullLeft > 0) {
      this.bullLeft = Math.max(0, this.bullLeft - dt);
      if (this.bullLeft === 0) this.emit({ type: "bull-end" });
    }

    const income = this.income;
    this.credit(income * dt);

    // Drones.
    if (this.mods.autoTapsPerSecond > 0) {
      this.autoTapClock += dt * this.mods.autoTapsPerSecond;
      let n = 0;
      while (this.autoTapClock >= 1 && n < 8) {
        this.autoTapClock -= 1;
        this.tap(true);
        n++;
      }
      this.autoTapClock = Math.min(this.autoTapClock, 1);
    }

    // Blocks.
    s.blockProgress += dt / this.blockSeconds;
    this.settleBlocks();

    // Whale comets.
    if (this.comet) {
      this.comet.age += dt;
      if (this.mods.autoComet && this.comet.age >= 2.5) this.catchComet(true);
      else if (this.comet.age >= this.comet.life) {
        this.emit({ type: "comet-miss", id: this.comet.id });
        this.comet = null;
        this.cometClock = this.nextCometDelay();
      }
    } else {
      this.cometClock -= dt;
      if (this.cometClock <= 0) this.spawnComet();
    }
  }

  private settleBlocks() {
    const s = this.state;
    let guard = 0;
    while (s.blockProgress >= 1 && guard++ < 4) {
      s.blockProgress -= 1;
      s.blocks += 1;
      s.height += 1;
      const reward = blockReward(this.mods, this.income);
      this.credit(reward);
      this.emit({ type: "block", height: s.height, reward });
    }
    if (s.blockProgress >= 1) s.blockProgress = 0.99;
  }

  tap(auto = false): number {
    const value = this.tapValue;
    this.state.taps += 1;
    this.credit(value);
    this.state.blockProgress += TUNING.tapBlockProgress;
    this.emit({ type: "tap", value, auto });
    if (!auto) this.settleBlocks();
    return value;
  }

  buyRig(index: number, qty: number): boolean {
    if (!buyRig(this.state, index, qty)) return false;
    const before = this.refresh();
    this.announceUnlocks(before);
    this.emit({ type: "rig", index, qty });
    return true;
  }

  buyUpgrade(id: string): boolean {
    if (!buyUpgrade(this.state, id)) return false;
    this.refresh();
    this.emit({ type: "upgrade", id });
    return true;
  }

  spawnComet() {
    this.comet = { id: ++this.cometIds, age: 0, life: TUNING.cometLifeS, seed: this.random() };
    this.emit({ type: "comet-spawn", id: this.comet.id });
  }

  catchComet(auto = false): boolean {
    const c = this.comet;
    if (!c) return false;
    this.comet = null;
    this.cometClock = this.nextCometDelay();
    this.state.cometsCaught += 1;
    if (this.random() < TUNING.bullChance) {
      const length = TUNING.bullSeconds * this.mods.bullLength;
      this.bullLeft = Math.max(this.bullLeft, length);
      this.bullTotal = this.bullLeft;
      this.emit({ type: "comet-catch", id: c.id, kind: "bull", amount: TUNING.bullMultiplier, auto });
    } else {
      const base = baseIncome(this.state, this.mods) * this.hype;
      const amount = Math.min(this.state.glint * TUNING.whaleBankShare, base * TUNING.whaleIncomeSeconds) + Math.max(TUNING.whaleFloor, base * 30);
      this.credit(amount);
      this.emit({ type: "comet-catch", id: c.id, kind: "whale", amount, auto });
    }
    return true;
  }

  fork(): boolean {
    const before = this.state.tokens;
    if (!hardFork(this.state)) return false;
    this.refresh();
    this.bullLeft = 0;
    this.comet = null;
    this.emit({ type: "fork", tokens: this.state.tokens - before });
    return true;
  }

  touch(now: number) {
    this.state.lastSeen = now;
  }

  /** Back from a hidden tab: credit the gap like time away. */
  resume(now: number) {
    const report = applyOffline(this.state, now);
    if (report.seconds >= 60 && report.earned > 0) this.offline = report;
  }

  /** After the saved state was replaced wholesale (wipe). */
  resetLive() {
    this.mods = modifiers(this.state);
    this.bullLeft = 0;
    this.bullTotal = 0;
    this.comet = null;
    this.offline = null;
    this.events = [];
    this.cometClock = this.nextCometDelay() * 0.6;
  }

  static upgradeName(id: string) {
    return UPGRADE_BY_ID.get(id)?.name ?? id;
  }
}
