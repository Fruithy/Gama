"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

const KINDS = [
  { id: "bug", label: "🐞 Bug" },
  { id: "cheating", label: "🚩 Cheating score" },
  { id: "username", label: "🤬 Offensive username" },
  { id: "other", label: "💬 Other" },
] as const;

export function ReportButton({ gameId, username, runId, compact = true }: { gameId?: string; username?: string; runId?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>(username ? "username" : "bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async () => {
    setSent("sending");
    try {
      await api("/api/reports", { json: { kind, gameId, username, runId, message } });
      setSent("sent");
    } catch {
      setSent("error");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setSent("idle"); }}
        className={compact ? "press grid h-9 w-9 place-items-center rounded-full bg-white/5 text-sm" : "text-xs font-bold text-muted underline"}
        aria-label="Report a problem"
      >
        {compact ? "⚑" : "Report"}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Report a problem">
        {sent === "sent" ? (
          <p className="py-6 text-center">Thanks — our team will take a look. 🙏</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button key={k.id} type="button" onClick={() => setKind(k.id)} className={`press rounded-xl border px-3 py-2.5 text-sm font-bold ${kind === k.id ? "border-volt bg-volt/10" : "border-line-strong"}`}>
                  {k.label}
                </button>
              ))}
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} placeholder="What happened?" className="rounded-xl border border-line-strong bg-surface-2 p-3 text-sm outline-none focus:border-volt" />
            {sent === "error" && <p className="text-sm text-flare">Couldn&apos;t send. Try again in a moment.</p>}
            <Button size="lg" onClick={send} disabled={sent === "sending"}>{sent === "sending" ? "Sending…" : "Send report"}</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
