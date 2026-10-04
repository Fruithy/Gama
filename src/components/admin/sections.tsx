"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { getGame, liveGames } from "@/games/registry";
import { CATEGORIES, DIFFICULTY_INFO } from "@/games/taxonomy";
import { formatScoreWithUnit } from "@/games/core/format";
import { flagEmoji } from "@/lib/country";
import { Skeleton } from "@/components/ui/Skeleton";
import { BarChart } from "./BarChart";
import { Kpi, num, Panel, pct, secs, SmallButton, Toggle } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin tables render loosely-typed SQL rows */

function useAdmin<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!path) return;
    setError("");
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, reload: load };
}

async function act(resource: string, body: Record<string, unknown>) {
  try {
    await api(`/api/admin/${resource}`, { json: body });
    return true;
  } catch (e) {
    alert((e as Error).message);
    return false;
  }
}

const gameName = (id: string) => getGame(id)?.name ?? id;
const Loading = () => <Skeleton className="h-40 rounded-2xl" />;

/* ────────────────────────────── Overview ────────────────────────────── */

export function Overview() {
  const { data, error } = useAdmin<any>("/api/admin/overview");
  if (error) return <p className="text-flare">{error}</p>;
  if (!data) return <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-black uppercase">Today · {data.today}</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Plays today" value={num(data.playsToday)} />
        <Kpi label="Unique players" value={num(data.uniquePlayers)} />
        <Kpi label="New players" value={num(data.newPlayers)} sub={`${num(data.newAccounts)} accounts linked`} />
        <Kpi label="Games / player" value={num(data.gamesPerPlayer)} />
        <Kpi label="Retry rate" value={pct(data.retryRate)} />
        <Kpi label="Shares" value={num(data.shares)} />
        <Kpi label="Challenge links" value={num(data.challengeLinks)} sub={`${pct(data.challengeConversion)} open→play (7d) · ${num(data.challengeConversions)} chained`} />
        <Kpi label="Daily participation" value={num(data.dailyParticipation)} />
      </div>
      <Panel title="Plays · last 7 days">
        <BarChart title="Plays per day (all games)" data={data.series.map((s: any) => ({ label: s.day.slice(5), value: s.plays }))} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Most played today">
          <ol className="flex flex-col gap-1 text-sm">
            {data.mostPlayed.map((g: any, i: number) => (
              <li key={g.gameId} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                <span>{i + 1}. {gameName(g.gameId)}</span>
                <b className="tabular">{num(g.plays)}</b>
              </li>
            ))}
            {!data.mostPlayed.length && <p className="text-muted">No plays yet today.</p>}
          </ol>
        </Panel>
        <Panel title="Fastest growing (3d vs prior 3d)">
          <ol className="flex flex-col gap-1 text-sm">
            {data.fastestGrowing.map((g: any) => (
              <li key={g.gameId} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                <span>{gameName(g.gameId)}</span>
                <b className={g.growth >= 0 ? "text-mint" : "text-flare"}>{g.growth >= 0 ? "▲" : "▼"} {pct(Math.abs(g.growth))}</b>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}

/* ────────────────────────────── Games ────────────────────────────── */

export function GamesSection() {
  const { data, reload } = useAdmin<{ games: any[] }>("/api/admin/games");
  const update = async (id: string, patch: Record<string, unknown>) => {
    if (await act("games", { action: "update", id, patch })) void reload();
  };
  if (!data) return <Loading />;
  return (
    <Panel title={`Games (${data.games.length})`}>
      <p className="mb-3 text-xs text-muted">Metadata edits apply instantly (no deploy). Gameplay, version and score rules live in code.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="p-2">Game</th><th>Status</th><th>On</th><th>Featured</th><th>Trending</th><th>New</th><th>Category</th><th>Difficulty</th><th>Thumbnail URL</th><th className="text-right">Plays 7d</th><th className="text-right">Ranked</th><th className="text-right">Fun</th>
            </tr>
          </thead>
          <tbody>
            {data.games.map((g) => (
              <tr key={g.id} className="border-t border-line">
                <td className="p-2 font-bold">{g.name}<div className="text-[10px] font-normal text-faint">{g.id} · v{g.current_version}</div></td>
                <td className="text-xs text-muted">{g.status}</td>
                <td><Toggle label="Enabled" on={g.enabled} onChange={(v) => update(g.id, { enabled: v })} /></td>
                <td><Toggle label="Featured" on={g.featured} onChange={(v) => update(g.id, { featured: v })} /></td>
                <td><Toggle label="Trending" on={g.trending_override} onChange={(v) => update(g.id, { trendingOverride: v })} /></td>
                <td><Toggle label="New" on={g.is_new} onChange={(v) => update(g.id, { isNew: v })} /></td>
                <td>
                  <select value={g.category} onChange={(e) => update(g.id, { category: e.target.value })} className="rounded-lg bg-surface-2 px-2 py-1 text-xs">
                    {CATEGORIES.filter((c) => !["impossible", "quick"].includes(c.slug)).map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                  </select>
                </td>
                <td>
                  <select value={g.difficulty} onChange={(e) => update(g.id, { difficulty: e.target.value })} className="rounded-lg bg-surface-2 px-2 py-1 text-xs">
                    {Object.entries(DIFFICULTY_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </td>
                <td>
                  <input defaultValue={g.thumbnail_url ?? ""} placeholder={`/art/${g.id}.svg`} onBlur={(e) => e.target.value !== (g.thumbnail_url ?? "") && update(g.id, { thumbnailUrl: e.target.value })} className="w-40 rounded-lg bg-surface-2 px-2 py-1 text-xs" aria-label="Thumbnail URL" />
                </td>
                <td className="text-right tabular">{num(g.plays7d)}</td>
                <td className="text-right tabular">{num(g.players)}</td>
                <td className="pr-2 text-right">{g.fun_ratio === null ? "—" : `👍 ${pct(g.fun_ratio)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ────────────────────────────── Players ────────────────────────────── */

export function PlayersSection() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, reload } = useAdmin<{ players: any[] }>(`/api/admin/players?q=${encodeURIComponent(query)}`);
  return (
    <Panel
      title="Players"
      actions={
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username" aria-label="Search players" className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm" />
          <SmallButton onClick={() => setQuery(q)}>Search</SmallButton>
        </form>
      }
    >
      {!data ? <Loading /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr><th className="p-2">Player</th><th>Country</th><th>Level</th><th>Plays</th><th>Account</th><th>Role</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.players.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="p-2"><a href={`/u/${p.username}`} className="font-bold hover:underline">{p.username}</a>{p.is_seed && <span className="ml-1 text-[10px] text-faint">seed</span>}</td>
                  <td>{flagEmoji(p.country)} {p.country ?? ""}</td>
                  <td>{p.level}</td>
                  <td className="tabular">{num(p.total_plays)}</td>
                  <td>{p.has_account ? "✓" : "guest"}</td>
                  <td>{p.role}</td>
                  <td>{p.is_banned ? <span className="text-flare">banned{p.ban_reason ? `: ${p.ban_reason}` : ""}</span> : "ok"}</td>
                  <td className="flex gap-1 py-2">
                    {p.is_banned ? (
                      <SmallButton tone="ok" onClick={async () => (await act("players", { action: "unban", id: p.id })) && reload()}>Unban</SmallButton>
                    ) : (
                      <SmallButton tone="danger" onClick={async () => { const reason = prompt("Ban reason?") ?? ""; if (await act("players", { action: "ban", id: p.id, reason })) void reload(); }}>Ban</SmallButton>
                    )}
                    <SmallButton onClick={async () => (await act("players", { action: "role", id: p.id, role: p.role === "admin" ? "player" : "admin" })) && reload()}>{p.role === "admin" ? "Revoke admin" : "Make admin"}</SmallButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ────────────────────────────── Scores & leaderboards ────────────────────────────── */

export function ScoresSection() {
  const flagged = useAdmin<{ flagged: any[] }>("/api/admin/scores");
  const [game, setGame] = useState(liveGames[0]?.id ?? "");
  const board = useAdmin<{ runs: any[] }>(game ? `/api/admin/leaderboards?game=${game}` : null);
  const def = getGame(game);
  return (
    <div className="flex flex-col gap-4">
      <Panel title={`Flagged runs (${flagged.data?.flagged.length ?? "…"})`}>
        <p className="mb-3 text-xs text-muted">Runs that failed plausibility checks. They are NOT on any leaderboard until approved.</p>
        {!flagged.data ? <Loading /> : flagged.data.flagged.length === 0 ? <p className="text-sm text-muted">Queue empty. 🎉</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr><th className="p-2">When</th><th>Player</th><th>Game</th><th>Score</th><th>Duration (client/server)</th><th>Peak taps/s</th><th>Flags</th><th /></tr></thead>
              <tbody>
                {flagged.data.flagged.map((r) => {
                  const g = getGame(r.game_id);
                  return (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="p-2 text-xs">{new Date(r.submitted_at).toLocaleString()}</td>
                      <td>{r.username}</td>
                      <td>{g?.name ?? r.game_id}</td>
                      <td className="font-bold tabular">{g ? formatScoreWithUnit(Number(r.score), g) : r.score}</td>
                      <td className="text-xs tabular">{secs(r.duration_ms)} / {secs(r.server_elapsed_ms)}</td>
                      <td className="tabular">{r.peak_aps}</td>
                      <td className="max-w-[220px]">{(r.flags as string[]).map((f) => <span key={f} className="mb-1 mr-1 inline-block rounded bg-sun/15 px-1.5 py-0.5 text-[10px] text-sun">{f}</span>)}</td>
                      <td className="flex gap-1 py-2">
                        <SmallButton tone="ok" onClick={async () => (await act("scores", { action: "approve", id: r.id })) && flagged.reload()}>Approve</SmallButton>
                        <SmallButton tone="danger" onClick={async () => (await act("scores", { action: "remove", id: r.id })) && flagged.reload()}>Reject</SmallButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel
        title="Leaderboard moderation"
        actions={
          <select value={game} onChange={(e) => setGame(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-sm" aria-label="Game">
            {liveGames.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {(["day", "week", "all"] as const).map((scope) => (
            <SmallButton key={scope} tone="danger" onClick={async () => { if (confirm(`Reset the ${scope === "all" ? "ALL-TIME" : scope} leaderboard for ${def?.name}? This cannot be undone.`) && (await act("leaderboards", { action: "reset", game, scope }))) void board.reload(); }}>
              Reset {scope === "all" ? "all-time" : scope === "day" ? "today" : "this week"}
            </SmallButton>
          ))}
        </div>
        {!board.data ? <Loading /> : (
          <table className="w-full text-sm">
            <tbody>
              {board.data.runs.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-line">
                  <td className="p-2 tabular text-muted">#{i + 1}</td>
                  <td>{r.username}</td>
                  <td className="font-bold tabular">{def ? formatScoreWithUnit(Number(r.score), def) : r.score}</td>
                  <td className="text-xs text-muted">{secs(r.duration_ms)} · peak {r.peak_aps ?? "—"}/s {(r.flags ?? []).includes("seed") ? "· seed" : ""}</td>
                  <td className="text-right">{r.id && <SmallButton tone="danger" onClick={async () => (await act("scores", { action: "remove", id: r.id })) && board.reload()}>Remove</SmallButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

/* ────────────────────────────── Daily ────────────────────────────── */

export function DailySection() {
  const { data, reload } = useAdmin<{ schedule: any[]; games: string[] }>("/api/admin/daily");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [day, setDay] = useState(tomorrow);
  const [game, setGame] = useState(liveGames[0]?.id ?? "");
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Schedule a Daily Challenge">
        <p className="mb-3 text-xs text-muted">Unscheduled days are picked automatically and deterministically (no repeats within 5 days). Today can only be changed before anyone plays it.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-sm" aria-label="Day" />
          <select value={game} onChange={(e) => setGame(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-sm" aria-label="Game">
            {(data?.games ?? []).map((g) => <option key={g} value={g}>{gameName(g)}</option>)}
          </select>
          <SmallButton tone="ok" onClick={async () => (await act("daily", { action: "schedule", day, game })) && reload()}>Schedule</SmallButton>
        </div>
      </Panel>
      <Panel title="Recent & upcoming">
        {!data ? <Loading /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr><th className="p-2">Day</th><th>Game</th><th>Source</th><th>Players</th><th>Winner</th></tr></thead>
            <tbody>
              {data.schedule.map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="p-2 tabular">{d.day}</td><td>{gameName(d.game_id)}</td><td>{d.source}</td><td className="tabular">{num(d.players)}</td><td>{d.winner ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

/* ────────────────────────────── Reports ────────────────────────────── */

export function ReportsSection() {
  const [status, setStatus] = useState("open");
  const { data, reload } = useAdmin<{ reports: any[] }>(`/api/admin/reports?status=${status}`);
  return (
    <Panel
      title="Reports"
      actions={
        <div className="flex gap-1">
          {["open", "resolved", "dismissed"].map((s) => (
            <SmallButton key={s} onClick={() => setStatus(s)}>{s === status ? `● ${s}` : s}</SmallButton>
          ))}
        </div>
      }
    >
      {!data ? <Loading /> : data.reports.length === 0 ? <p className="text-sm text-muted">Nothing here.</p> : (
        <div className="flex flex-col gap-2">
          {data.reports.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/5 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black uppercase">{r.kind}</span>
                {r.game_id && <span className="text-muted">{gameName(r.game_id)}</span>}
                {r.target && <span>→ <a href={`/u/${r.target}`} className="underline">{r.target}</a></span>}
                <span className="ml-auto text-xs text-faint">{r.reporter ?? "anon"} · {new Date(r.created_at).toLocaleString()}</span>
              </div>
              {r.message && <p className="mt-1.5">{r.message}</p>}
              {r.resolution && <p className="mt-1 text-xs text-muted">Resolution: {r.resolution}</p>}
              {status === "open" && (
                <div className="mt-2 flex gap-1">
                  <SmallButton tone="ok" onClick={async () => (await act("reports", { action: "resolve", id: r.id, status: "resolved", note: prompt("Resolution note?") ?? "" })) && reload()}>Resolve</SmallButton>
                  <SmallButton onClick={async () => (await act("reports", { action: "resolve", id: r.id, status: "dismissed", note: "" })) && reload()}>Dismiss</SmallButton>
                  {r.target_id && <SmallButton tone="danger" onClick={async () => (await act("players", { action: "ban", id: r.target_id, reason: `report ${r.kind}` })) && reload()}>Ban {r.target}</SmallButton>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ────────────────────────────── Analytics ────────────────────────────── */

export function AnalyticsSection() {
  const [game, setGame] = useState(liveGames[0]?.id ?? "");
  const { data, error } = useAdmin<any>(game ? `/api/admin/analytics?game=${game}` : null);
  const def = getGame(game);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-black uppercase">Game analytics</h1>
        <select value={game} onChange={(e) => setGame(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-sm" aria-label="Game">
          {liveGames.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <span className="text-xs text-muted">last 7 days</span>
      </div>
      {error && <p className="text-flare">{error}</p>}
      {!data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Plays" value={num(data.plays7d)} />
            <Kpi label="Unique players" value={num(data.uniquePlayers7d)} />
            <Kpi label="Avg session" value={secs(data.avgSessionMs)} sub={`median ${secs(data.medianSessionMs)}`} />
            <Kpi label="Retry rate" value={pct(data.retryRate)} />
            <Kpi label="Completion rate" value={pct(data.completionRate)} />
            <Kpi label="Share rate" value={pct(data.shareRate)} sub={`challenge rate ${pct(data.challengeRate)}`} />
            <Kpi label="D1 return (proxy)" value={pct(data.d1Return)} />
            <Kpi label="Card → open" value={pct(data.openRate)} sub={`${num(data.flagged7d)} flagged runs`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Plays per day">
              <BarChart title={`${def?.name} plays`} data={data.series.map((s: any) => ({ label: s.day.slice(5), value: s.plays }))} />
            </Panel>
            <Panel title="Score distribution (personal bests)">
              {data.histogram.length ? (
                <BarChart title={`Players per score band${def?.scoreDirection === "lower" ? " (lower is better)" : ""}`} data={data.histogram.map((h: any) => ({ label: def ? formatScoreWithUnit(h.from, { ...def, scoreUnit: "" }) : String(h.from), value: h.count }))} />
              ) : <p className="text-sm text-muted">No scores yet.</p>}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────── Achievements / flags / config ────────────────────────────── */

export function AchievementsSection() {
  const { data, reload } = useAdmin<{ achievements: any[] }>("/api/admin/achievements");
  if (!data) return <Loading />;
  return (
    <Panel title="Achievements">
      <p className="mb-3 text-xs text-muted">Rules are data (see lib/achievements/definitions.ts). Toggle or re-price here.</p>
      <table className="w-full text-sm">
        <tbody>
          {data.achievements.map((a) => (
            <tr key={a.id} className="border-t border-line">
              <td className="p-2 text-xl">{a.icon}</td>
              <td><b>{a.name}</b><div className="text-xs text-muted">{a.description} · <code className="text-faint">{JSON.stringify(a.rule)}</code></div></td>
              <td className="text-xs text-muted">{a.tier}</td>
              <td className="tabular text-xs">{num(a.unlocked)} unlocked</td>
              <td><input type="number" defaultValue={a.xp} min={0} max={10000} onBlur={async (e) => Number(e.target.value) !== a.xp && (await act("achievements", { action: "update", id: a.id, xp: Number(e.target.value) })) && reload()} className="w-20 rounded-lg bg-surface-2 px-2 py-1 text-xs" aria-label="XP" /> XP</td>
              <td className="pr-2"><Toggle label="Enabled" on={a.enabled} onChange={async (v) => (await act("achievements", { action: "update", id: a.id, enabled: v })) && reload()} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function FlagsSection() {
  const { data, reload } = useAdmin<{ flags: Array<{ key: string; description: string; enabled: boolean }> }>("/api/admin/flags");
  if (!data) return <Loading />;
  return (
    <Panel title="Feature flags">
      <div className="flex flex-col gap-2">
        {data.flags.map((f) => (
          <div key={f.key} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
            <div>
              <code className="text-sm font-bold">{f.key}</code>
              <p className="text-xs text-muted">{f.description}</p>
            </div>
            <Toggle label={f.key} on={f.enabled} onChange={async (v) => (await act("flags", { action: "set", key: f.key, enabled: v })) && reload()} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ConfigSection() {
  const { data, reload } = useAdmin<Record<string, Record<string, number>>>("/api/admin/config");
  if (!data) return <Loading />;
  const titles: Record<string, string> = { xp: "XP rewards", trending: "Trending weights", ads: "Ad policy (only when the `ads` flag is on)" };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Object.entries(data).map(([key, values]) => (
        <Panel key={key} title={titles[key] ?? key}>
          <form
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const value = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, Number(v)]));
              if (await act("config", { action: "set", key, value })) void reload();
            }}
          >
            {Object.entries(values).map(([k, v]) => (
              <label key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">{k}</span>
                <input name={k} type="number" step="any" defaultValue={v} className="w-28 rounded-lg bg-surface-2 px-2 py-1 text-right text-sm" />
              </label>
            ))}
            <button type="submit" className="press mt-2 rounded-xl bg-volt py-2 text-sm font-black text-black">Save</button>
          </form>
        </Panel>
      ))}
    </div>
  );
}
