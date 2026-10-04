"use client";

import { useCallback, useEffect, useState } from "react";
import { shouldShowInterstitial, DEFAULT_AD_POLICY } from "@/lib/config/monetization";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { readJson, writeJson } from "@/lib/client/storage";

/**
 * Interstitial slot shown ONLY on the result screen, never during play, and
 * only when the `ads` flag is on and the frequency policy allows it. With ads
 * disabled (the default) this renders nothing. Plug an ad network in here.
 */
const KEY = "fa:ads";

export function useInterstitial() {
  const { flags } = usePlayer();
  const [show, setShow] = useState(false);
  /** Call when a run completes (event time, never during gameplay). */
  const record = useCallback(() => {
    const s = readJson(KEY, { lifetime: 0, since: 0, lastAt: 0 });
    s.lifetime++;
    s.since++;
    const ok = shouldShowInterstitial({
      adsEnabled: flags.ads,
      inGameplay: false,
      lifetimeRuns: s.lifetime,
      runsSinceLastAd: s.since,
      secondsSinceLastAd: (Date.now() - s.lastAt) / 1000,
      premium: false,
    }, DEFAULT_AD_POLICY);
    if (ok) {
      s.since = 0;
      s.lastAt = Date.now();
    }
    writeJson(KEY, s);
    setShow(ok);
  }, [flags.ads]);
  return { show, record, close: () => setShow(false) };
}

export function InterstitialSlot({ onClose }: { onClose: () => void }) {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center" role="dialog" aria-label="Advertisement">
      <div className="grid h-[250px] w-[300px] place-items-center rounded-xl border border-dashed border-white/30 text-sm text-muted">Ad slot (300×250)</div>
      <button type="button" disabled={left > 0} onClick={onClose} className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-bold disabled:opacity-50">
        {left > 0 ? `Close in ${left}` : "Close ✕"}
      </button>
    </div>
  );
}
