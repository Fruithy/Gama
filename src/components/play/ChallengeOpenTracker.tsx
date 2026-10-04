"use client";

import { useEffect } from "react";

/** Counts a challenge open once per browser session (not on every re-render / refresh). */
export function ChallengeOpenTracker({ token }: { token: string }) {
  useEffect(() => {
    const key = `fa:opened:${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: still count */
    }
    void fetch(`/api/challenges/${token}`, { method: "POST" }).catch(() => {});
  }, [token]);
  return null;
}
