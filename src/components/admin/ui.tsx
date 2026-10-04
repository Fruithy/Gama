"use client";

import { cn } from "@/components/ui/cn";

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-black tabular">{value}</p>
      {sub && <p className="text-xs text-faint">{sub}</p>}
    </div>
  );
}

export function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-black uppercase">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-volt" : "bg-white/15")}>
      <span className={cn("absolute top-1 h-4 w-4 rounded-full transition-all", on ? "left-5 bg-black" : "left-1 bg-white")} />
    </button>
  );
}

export function SmallButton({ children, onClick, tone = "default", disabled }: { children: React.ReactNode; onClick: () => void; tone?: "default" | "danger" | "ok"; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-40",
        tone === "danger" ? "bg-flare/20 text-flare" : tone === "ok" ? "bg-mint/20 text-mint" : "bg-white/10 text-text",
      )}
    >
      {children}
    </button>
  );
}

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);
export const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: 1 }));
export const secs = (ms: number | null | undefined) => (ms === null || ms === undefined ? "—" : `${(ms / 1000).toFixed(1)}s`);
