"use client";

import { COIN_GLYPH, ERA_NAMES, RIGS, TUNING, type UpgradeDef } from "@/mine/config";
import { earningsForTokens, isRigUnlocked, maxAffordable, rigCost, rigOutput, type MineState, type Modifiers } from "@/mine/economy";
import { fmt, fmtDuration, fmtHash } from "@/mine/format";
import { cn } from "@/components/ui/cn";

export type BuyQty = 1 | 10 | 100 | "max";

export interface PanelSnap {
  state: MineState;
  mods: Modifiers;
  income: number;
  baseIncome: number;
  upgrades: UpgradeDef[];
  pending: number;
}

function Glint({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      <span className="mr-0.5 text-[0.85em] text-[#ffd24d]">{COIN_GLYPH}</span>
      {fmt(value)}
    </span>
  );
}

function Tile({ icon, color, dim }: { icon: string; color: string; dim?: boolean }) {
  return (
    <span
      className={cn("relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl", dim && "grayscale")}
      style={{
        background: `radial-gradient(circle at 30% 25%, ${color}55, ${color}14 70%)`,
        boxShadow: dim ? undefined : `inset 0 0 0 1px ${color}55, 0 0 18px -6px ${color}`,
      }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

function AffordBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <span className="absolute inset-x-3 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/5" aria-hidden="true">
      <span className="block h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
    </span>
  );
}

export function RigList({ snap, qty, onBuy }: { snap: PanelSnap; qty: BuyQty; onBuy: (i: number, n: number) => void }) {
  const s = snap.state;
  const visible = RIGS.map((_, i) => i).filter((i) => isRigUnlocked(s, i));
  const teaser = RIGS.findIndex((_, i) => !isRigUnlocked(s, i));
  return (
    <ul className="space-y-2">
      {visible.map((i) => {
        const rig = RIGS[i];
        const owned = s.rigs[i];
        const n = qty === "max" ? Math.max(1, maxAffordable(i, owned, s.glint)) : qty;
        const cost = rigCost(i, owned, n);
        const can = cost <= s.glint;
        const each = RIGS[i].rate * snap.mods.rigMult[i] * snap.mods.globalMult * snap.mods.forkMult;
        const share = snap.baseIncome > 0 ? rigOutput(s, snap.mods, i) / snap.baseIncome : 0;
        return (
          <li key={rig.id}>
            <button
              type="button"
              onClick={() => onBuy(i, n)}
              disabled={!can}
              aria-label={`Buy ${n} ${rig.name} for ${fmt(cost)} ${COIN_GLYPH}`}
              className={cn(
                "press relative flex w-full items-center gap-3 rounded-[20px] border bg-white/[0.035] p-2.5 pb-3 text-left",
                can ? "border-white/15 hover:bg-white/[0.07]" : "border-white/[0.06] opacity-70",
              )}
              style={can ? { boxShadow: `0 0 24px -12px ${rig.color}` } : undefined}
            >
              <Tile icon={rig.icon} color={rig.color} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-display text-[13px] font-black uppercase tracking-tight">{rig.name}</span>
                  {owned > 0 && <span className="tabular rounded-full bg-white/10 px-1.5 text-[11px] font-bold text-white/80">{owned}</span>}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-white/55">
                  {owned > 0 ? (
                    <>
                      {fmtHash(each * TUNING.hashPerUnit)} each · {share > 0 && share < 0.01 ? "<1" : Math.round(share * 100)}% of output
                    </>
                  ) : (
                    rig.blurb
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <Glint value={cost} className={cn("font-display text-[13px] font-black", can ? "text-white" : "text-white/60")} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">×{n}</span>
              </span>
              <AffordBar ratio={s.glint / cost} color={rig.color} />
            </button>
          </li>
        );
      })}
      {teaser >= 0 && (
        <li className="relative flex items-center gap-3 rounded-[20px] border border-dashed border-white/10 p-2.5 text-left opacity-60">
          <Tile icon="❔" color="#8888aa" dim />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[13px] font-black uppercase tracking-tight">Undiscovered rig</span>
            <span className="block text-[11px] text-white/55">
              Earn <Glint value={RIGS[teaser].cost * 0.5} /> this chain to reveal it.
            </span>
          </span>
        </li>
      )}
    </ul>
  );
}

export function UpgradeList({ snap, onBuy, onBuyAll }: { snap: PanelSnap; onBuy: (id: string) => void; onBuyAll: () => void }) {
  const s = snap.state;
  const ups = snap.upgrades;
  const affordable = ups.filter((u) => u.cost <= s.glint).length;
  if (ups.length === 0)
    return (
      <div className="grid place-items-center gap-2 py-10 text-center text-sm text-white/55">
        <span className="text-4xl" aria-hidden="true">🔧</span>
        <p>No upgrades in sight.<br />Keep mining — new ones appear as you grow.</p>
      </div>
    );
  return (
    <div>
      {affordable >= 2 && (
        <button type="button" onClick={onBuyAll} className="press mb-2 h-10 w-full rounded-2xl border border-[#d4ff3a]/40 bg-[#d4ff3a]/10 font-display text-[12px] font-black uppercase tracking-tight text-[#d4ff3a]">
          Buy all affordable ({affordable})
        </button>
      )}
      <ul className="space-y-2">
        {ups.map((u) => {
          const can = u.cost <= s.glint;
          return (
            <li key={u.id}>
              <button
                type="button"
                disabled={!can}
                onClick={() => onBuy(u.id)}
                aria-label={`Buy ${u.name} for ${fmt(u.cost)} ${COIN_GLYPH}`}
                className={cn(
                  "press relative flex w-full items-center gap-3 rounded-[20px] border bg-white/[0.035] p-2.5 pb-3 text-left",
                  can ? "border-white/15 hover:bg-white/[0.07]" : "border-white/[0.06] opacity-70",
                )}
                style={can ? { boxShadow: `0 0 24px -12px ${u.color}` } : undefined}
              >
                <Tile icon={u.icon} color={u.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[13px] font-black uppercase tracking-tight">{u.name}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/60">{u.desc}</span>
                </span>
                <Glint value={u.cost} className={cn("shrink-0 font-display text-[13px] font-black", can ? "text-white" : "text-white/60")} />
                <AffordBar ratio={s.glint / u.cost} color={u.color} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</dt>
      <dd className="tabular mt-0.5 font-display text-[15px] font-black">{value}</dd>
    </div>
  );
}

export function ForkPanel({
  snap,
  onFork,
  onReset,
  muted,
  onToggleMute,
}: {
  snap: PanelSnap;
  onFork: () => void;
  onReset: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const s = snap.state;
  const next = earningsForTokens(s.tokens + snap.pending + 1);
  const prev = earningsForTokens(s.tokens + snap.pending);
  const progress = (s.allTimeEarned - prev) / Math.max(1, next - prev);
  const now = 1 + s.tokens * TUNING.forkBonus;
  const after = 1 + (s.tokens + snap.pending) * TUNING.forkBonus;
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[24px] border border-white/10 p-4" style={{ background: "linear-gradient(135deg, #2a1067 0%, #0f2a5c 55%, #0b3b3a 100%)" }}>
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#e85dff]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-6 h-32 w-32 rounded-full bg-[#3dd8ff]/25 blur-3xl" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Prestige</p>
        <h3 className="font-display text-2xl font-black uppercase leading-none">Hard Fork</h3>
        <p className="mt-2 text-[13px] leading-snug text-white/75">
          Split the chain: rigs, upgrades and GLINT reset — but every <b>Fork Token</b> boosts all mining by +{Math.round(TUNING.forkBonus * 100)}%, forever. Each fork also paints a new era.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Tokens owned" value={`🔷 ${fmt(s.tokens)}`} />
          <Stat label="Fork now for" value={<span className={snap.pending > 0 ? "text-[#3dffb0]" : "text-white/50"}>+{fmt(snap.pending)}</span>} />
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] font-bold text-white/60">
            <span>Next token</span>
            <span className="tabular">
              {COIN_GLYPH} {fmt(Math.max(0, next - s.allTimeEarned))} to go
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-gradient-to-r from-[#3dd8ff] to-[#e85dff]" style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={onFork}
          disabled={snap.pending < 1}
          className="press mt-4 h-12 w-full rounded-2xl bg-white font-display text-[14px] font-black uppercase tracking-tight text-[#1a0b3d] shadow-[0_6px_0_0_#8b7bd6] active:translate-y-[4px] active:shadow-[0_2px_0_0_#8b7bd6] disabled:opacity-40"
        >
          {snap.pending < 1 ? "Mine more to fork" : `Fork: ×${now.toFixed(2)} → ×${after.toFixed(2)}`}
        </button>
      </section>

      <section>
        <h3 className="mb-2 font-display text-[13px] font-black uppercase tracking-tight text-white/80">Ledger</h3>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Era" value={ERA_NAMES[s.forks % ERA_NAMES.length]} />
          <Stat label="Chain height" value={`#${s.height.toLocaleString("en-US")}`} />
          <Stat label="Earned this chain" value={<Glint value={s.runEarned} />} />
          <Stat label="Earned all-time" value={<Glint value={s.allTimeEarned} />} />
          <Stat label="Taps" value={fmt(s.taps)} />
          <Stat label="Whales caught" value={fmt(s.cometsCaught)} />
          <Stat label="Rigs online" value={fmt(s.rigs.reduce((a, b) => a + b, 0))} />
          <Stat label="Time mining" value={fmtDuration(s.playSeconds)} />
        </dl>
      </section>

      <section className="flex gap-2">
        <button type="button" onClick={onToggleMute} className="press h-11 flex-1 rounded-2xl border border-white/10 bg-white/[0.05] text-[13px] font-bold">
          {muted ? "🔇 Sound off" : "🔊 Sound on"}
        </button>
        <button type="button" onClick={onReset} className="press h-11 flex-1 rounded-2xl border border-[#ff3d7f]/30 bg-[#ff3d7f]/10 text-[13px] font-bold text-[#ff8fb3]">
          Wipe save
        </button>
      </section>
      <p className="pb-2 text-center text-[11px] text-white/35">GLINT is a pretend coin. No wallets, no chains, no real money — just pretty lights.</p>
    </div>
  );
}
