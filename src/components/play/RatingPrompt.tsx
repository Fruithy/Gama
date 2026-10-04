"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { markRated } from "@/lib/client/local";

/** Tiny, skippable "Fun?" prompt — only shown after several plays, never mid-game. */
export function RatingPrompt({ gameId }: { gameId: string }) {
  const [done, setDone] = useState(false);
  const rate = (fun: boolean) => {
    setDone(true);
    markRated(gameId);
    void api("/api/ratings", { json: { gameId, fun } }).catch(() => {});
  };
  if (done) return <p className="text-center text-xs text-muted">Thanks — noted. 🙏</p>;
  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <span className="text-muted">Fun?</span>
      <button type="button" className="press rounded-full bg-white/10 px-3 py-1.5 text-lg" onClick={() => rate(true)} aria-label="Yes, fun">
        👍
      </button>
      <button type="button" className="press rounded-full bg-white/10 px-3 py-1.5 text-lg" onClick={() => rate(false)} aria-label="Not fun">
        👎
      </button>
    </div>
  );
}
