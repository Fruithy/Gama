"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { getLocalFavorites, getPending, removePending, setLocalFavorites } from "@/lib/client/local";
import type { PrivateProfile } from "@/lib/players/service";
import type { Flags } from "@/lib/config/flags";
import { defaultFlags } from "@/lib/config/flags";
import { track } from "@/lib/client/analytics";

interface PlayerContextValue {
  /** undefined while loading, null when this device has never played. */
  player: PrivateProfile | null | undefined;
  favorites: string[];
  flags: Flags;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
  setPlayer: (p: PrivateProfile | null) => void;
  refresh: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

interface MeResponse {
  player: PrivateProfile | null;
  favorites: string[];
  flags: Flags;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<PrivateProfile | null | undefined>(undefined);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [flags, setFlags] = useState<Flags>(defaultFlags());
  const merged = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>("/api/me");
      setPlayer(me.player);
      setFlags(me.flags);
      const local = getLocalFavorites();
      if (me.player) {
        const missing = local.filter((s) => !me.favorites.includes(s));
        if (missing.length && !merged.current) {
          merged.current = true;
          const r = await api<{ favorites: string[] }>("/api/favorites", { json: { merge: missing } });
          setFavorites(r.favorites);
          setLocalFavorites(r.favorites);
          return;
        }
        setFavorites(me.favorites);
        setLocalFavorites(me.favorites);
      } else {
        setFavorites(local);
      }
    } catch {
      setPlayer((p) => (p === undefined ? null : p));
      setFavorites(getLocalFavorites());
    }
  }, []);

  useEffect(() => {
    setFavorites(getLocalFavorites());
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window ? (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(cb) : setTimeout(cb, 200);
    idle(() => void refresh());
    // Retry any scores that failed to submit while offline.
    const retryPending = async () => {
      for (const p of getPending()) {
        try {
          await api("/api/runs/submit", { json: p.payload });
          removePending(p.payload.runId);
        } catch (e) {
          const status = (e as { status?: number }).status ?? 0;
          if (status >= 400 && status < 500) removePending(p.payload.runId);
          else break;
        }
      }
    };
    idle(() => void retryPending());
    window.addEventListener("online", retryPending);
    return () => window.removeEventListener("online", retryPending);
  }, [refresh]);

  const toggleFavorite = useCallback(
    (slug: string) => {
      setFavorites((prev) => {
        const on = !prev.includes(slug);
        const next = on ? [slug, ...prev] : prev.filter((s) => s !== slug);
        setLocalFavorites(next);
        track(on ? "favorite" : "unfavorite", slug);
        if (player) void api("/api/favorites", { json: { gameId: slug, on } }).catch(() => {});
        return next;
      });
    },
    [player],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({ player, favorites, flags, isFavorite: (s) => favorites.includes(s), toggleFavorite, setPlayer, refresh }),
    [player, favorites, flags, toggleFavorite, refresh],
  );
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
