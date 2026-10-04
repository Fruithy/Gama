"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { usePlayer } from "@/components/providers/PlayerProvider";

export function FollowButton({ username, initial }: { username: string; initial: boolean }) {
  const { flags } = usePlayer();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (!flags.friendSystem) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      await api("/api/follows", { json: { username, on: !on } });
      setOn(!on);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={toggle} disabled={busy} className={`press rounded-full px-4 py-2 text-sm font-black ${on ? "bg-white/10" : "bg-volt text-black"}`}>
      {on ? "Following ✓" : "+ Follow"}
    </button>
  );
}
