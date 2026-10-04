"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameSummary } from "@/games/registry";
import { CATEGORIES, DIFFICULTY_INFO } from "@/games/taxonomy";
import type { ControlType, Difficulty } from "@/games/core/types";
import { GameCard } from "@/components/game/GameCard";
import { toCard } from "@/components/game/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";

type Sort = "trending" | "newest" | "played" | "rated" | "quickest" | "hardest";
const SORTS: Array<{ id: Sort; label: string }> = [
  { id: "trending", label: "🔥 Trending" },
  { id: "newest", label: "✨ Newest" },
  { id: "played", label: "👑 Most played" },
  { id: "rated", label: "👍 Highest rated" },
  { id: "quickest", label: "⚡ Quickest" },
  { id: "hardest", label: "💀 Hardest" },
];
const CONTROLS: Array<{ id: ControlType; label: string }> = [
  { id: "tap", label: "Tap" },
  { id: "hold", label: "Hold" },
  { id: "swipe", label: "Swipe" },
  { id: "drag", label: "Drag" },
  { id: "head", label: "Head" },
  { id: "voice", label: "Voice" },
];

/** Search, filter & sort the whole library client-side (the catalogue is small and already on the page). */
export function Discover({ games, playCounts, trending, ratings }: { games: GameSummary[]; playCounts: Record<string, number>; trending: Record<string, number>; ratings: Record<string, number> }) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState<string | null>(params.get("category"));
  const [diff, setDiff] = useState<Difficulty | null>((params.get("difficulty") as Difficulty) ?? null);
  const [control, setControl] = useState<ControlType | null>((params.get("control") as ControlType) ?? null);
  const [camera, setCamera] = useState(params.get("camera") === "1");
  const [mic, setMic] = useState(params.get("mic") === "1");
  const [noDevices, setNoDevices] = useState(params.get("touch") === "1");
  const [sort, setSort] = useState<Sort>((params.get("sort") as Sort) ?? "trending");

  const order = useMemo(() => new Map(games.map((g, i) => [g.id, i])), [games]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const category = cat ? CATEGORIES.find((c) => c.slug === cat) : null;
    const filtered = games.filter(
      (g) =>
        (!needle || `${g.name} ${g.shortDescription} ${g.category} ${(g.tags ?? []).join(" ")}`.toLowerCase().includes(needle)) &&
        (!category || category.match(g)) &&
        (!diff || g.difficulty === diff) &&
        (!control || g.controls.includes(control)) &&
        (!camera || g.usesCamera) &&
        (!mic || g.usesMicrophone) &&
        (!noDevices || (!g.usesCamera && !g.usesMicrophone)),
    );
    const by: Record<Sort, (a: GameSummary, b: GameSummary) => number> = {
      trending: (a, b) => (trending[b.id] ?? 0) - (trending[a.id] ?? 0) || Number(!!b.trending) - Number(!!a.trending),
      newest: (a, b) => Number(!!b.isNew) - Number(!!a.isNew) || order.get(b.id)! - order.get(a.id)!,
      played: (a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0),
      rated: (a, b) => (ratings[b.id] ?? 0.5) - (ratings[a.id] ?? 0.5),
      quickest: (a, b) => a.estimatedDuration - b.estimatedDuration,
      hardest: (a, b) => DIFFICULTY_INFO[b.difficulty].rank - DIFFICULTY_INFO[a.difficulty].rank,
    };
    return filtered.sort(by[sort]);
  }, [games, q, cat, diff, control, camera, mic, noDevices, sort, trending, playCounts, ratings, order]);

  const sync = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`/games${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const chip = (active: boolean) => cn("press shrink-0 rounded-full px-3 py-1.5 text-xs font-bold", active ? "bg-white text-black" : "bg-white/8 text-muted hover:text-text");

  return (
    <div className="animate-rise px-4 pt-5 sm:px-0">
      <h1 className="font-display text-4xl font-black uppercase leading-none">Discover</h1>
      <p className="mt-1 text-sm text-muted">{games.length} games. Every one with a global leaderboard.</p>
      <label className="mt-4 flex items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-volt">
        <span aria-hidden="true">🔍</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); sync({ q: e.target.value || null }); }}
          placeholder="Search games"
          aria-label="Search games"
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-faint"
          type="search"
        />
      </label>

      <div className="rail mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Categories">
        <button type="button" className={chip(!cat)} onClick={() => { setCat(null); sync({ category: null }); }}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.slug} type="button" className={chip(cat === c.slug)} onClick={() => { const v = cat === c.slug ? null : c.slug; setCat(v); sync({ category: v }); }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <div className="rail mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Filters">
        {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
          <button key={d} type="button" className={chip(diff === d)} onClick={() => { const v = diff === d ? null : d; setDiff(v); sync({ difficulty: v }); }}>
            {DIFFICULTY_INFO[d].label}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {CONTROLS.map((c) => (
          <button key={c.id} type="button" className={chip(control === c.id)} onClick={() => { const v = control === c.id ? null : c.id; setControl(v); sync({ control: v }); }}>
            {c.label}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        <button type="button" className={chip(camera)} onClick={() => { setCamera(!camera); sync({ camera: !camera ? "1" : null }); }}>📸 Camera</button>
        <button type="button" className={chip(mic)} onClick={() => { setMic(!mic); sync({ mic: !mic ? "1" : null }); }}>🎤 Mic</button>
        <button type="button" className={chip(noDevices)} onClick={() => { setNoDevices(!noDevices); sync({ touch: !noDevices ? "1" : null }); }}>👆 Touch only</button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{list.length} result{list.length === 1 ? "" : "s"}</span>
        <label className="flex items-center gap-2 text-xs text-muted">
          Sort
          <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); sync({ sort: e.target.value }); }} className="rounded-xl border border-line-strong bg-surface px-2 py-1.5 text-sm font-bold text-text">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <EmptyState className="mt-6" icon="🙈" title="No games match">Try fewer filters.</EmptyState>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((g, i) => (
            <GameCard key={g.slug} game={toCard(g)} plays={playCounts[g.id]} size="lg" priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
