"use client";

import { useEffect, useState } from "react";

function nextUtcMidnight() {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Live countdown to the next UTC day (next Daily Challenge). */
export function Countdown({ className, prefix }: { className?: string; prefix?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(nextUtcMidnight() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={className} suppressHydrationWarning>
      {prefix}
      <span className="tabular">{left === null ? "--:--:--" : fmt(left)}</span>
    </span>
  );
}
