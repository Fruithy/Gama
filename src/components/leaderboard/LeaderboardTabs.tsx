"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScoreFormat } from "@/games/core/types";
import type { BoardRow, BoardEntry } from "@/lib/leaderboards/compose";
import { api } from "@/lib/client/api";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { flagEmoji } from "@/lib/country";
import { LeaderboardList } from "./LeaderboardList";

type Tab = "global" | "today" | "week" | "country" | "friends";

interface BoardResponse {
  rows: BoardRow[];
  total: number;
  me: BoardEntry | null;
}

const LABELS: Record<Tab, string> = { global: "Global", today: "Today", week: "This week", country: "Country", friends: "Friends" };

export function LeaderboardTabs({
  gameId,
  format,
  unit,
  limit = 10,
  initialTab = "global",
  refreshKey = 0,
  compact = false,
}: {
  gameId: string;
  format: ScoreFormat;
  unit: string;
  limit?: number;
  initialTab?: Tab;
  refreshKey?: number;
  compact?: boolean;
}) {
  const { player, flags } = usePlayer();
  const [tab, setTab] = useState<Tab>(initialTab);
  const country = player?.country ?? null;
  const reqKey = `${gameId}|${tab}|${limit}|${country}|${refreshKey}`;
  const [state, setState] = useState<{ key: string; data: BoardResponse | null; error: boolean }>({ key: "", data: null, error: false });
  const [retries, setRetries] = useState(0);
  const current = state.key === `${reqKey}|${retries}` ? state : null;
  const data = current?.data ?? null;
  const error = current?.error ?? false;
  const tabs: Tab[] = ["global", "today", "week", ...(country ? (["country"] as Tab[]) : []), ...(flags.friendSystem && player ? (["friends"] as Tab[]) : [])];

  const load = useCallback(() => {
    const key = `${reqKey}|${retries}`;
    const board = tab === "country" ? "global" : tab;
    const qs = new URLSearchParams({ board, limit: String(limit) });
    if (tab === "country" && country) qs.set("country", country);
    api<BoardResponse>(`/api/leaderboards/${gameId}?${qs}`)
      .then((d) => setState({ key, data: d, error: false }))
      .catch(() => setState({ key, data: null, error: true }));
  }, [reqKey, retries, tab, gameId, limit, country]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="rail mb-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Leaderboard period">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("press shrink-0 rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wide", tab === t ? "bg-white text-black" : "bg-white/8 text-muted hover:text-text")}
          >
            {t === "country" && country ? `${flagEmoji(country)} ` : ""}
            {LABELS[t]}
          </button>
        ))}
      </div>
      {error ? (
        <EmptyState icon="📡" title="Leaderboard unavailable">
          <button type="button" onClick={() => setRetries((r) => r + 1)} className="mt-2 font-bold text-volt underline">
            Retry
          </button>
        </EmptyState>
      ) : !data ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: Math.min(limit, 6) }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-2xl" />
          ))}
        </div>
      ) : data.rows.length === 0 ? (
        <EmptyState icon={tab === "friends" ? "🫂" : "👑"} title={tab === "friends" ? "No friends here yet" : "Nobody yet"}>
          {tab === "friends" ? "Follow players from their profile to compare scores." : "The #1 spot is wide open. Take it."}
        </EmptyState>
      ) : (
        <>
          <LeaderboardList rows={data.rows} format={format} unit={unit} compact={compact} />
          <p className="mt-2 text-right text-[11px] text-faint">{data.total.toLocaleString("en-US")} players</p>
        </>
      )}
    </div>
  );
}
