"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, buttonClass } from "@/components/ui/Button";
import { track } from "@/lib/client/analytics";

/**
 * Share UI: Web Share API (with the score card image when the platform allows
 * files), with Copy Link + Download Card fallbacks everywhere else.
 * Recording gameplay clips (MediaRecorder) can plug in here later behind the
 * `videoRecording` flag — the card is just one "attachment" type.
 */
export function ShareSheet({
  open,
  onClose,
  url,
  text,
  gameId,
  runId,
  title = "Share",
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  text: string;
  gameId: string;
  runId?: string | null;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = (format: "story" | "square") => (runId ? `/api/share/card?run=${runId}&format=${format}` : `/games/${gameId}/opengraph-image`);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const nativeShare = async () => {
    setBusy(true);
    try {
      let files: File[] | undefined;
      if (runId && typeof navigator.canShare === "function") {
        const blob = await fetch(card("story")).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
        const file = blob ? new File([blob], "filter-arcade-score.png", { type: "image/png" }) : null;
        if (file && navigator.canShare({ files: [file] })) files = [file];
      }
      await navigator.share({ title: "FILTER ARCADE", text, url, ...(files ? { files } : {}) });
      track("share", gameId, { method: files ? "native_card" : "native" });
    } catch {
      /* user cancelled */
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      track("share", gameId, { method: "copy" });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {runId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card("square")} alt="Your score card" className="mx-auto mb-4 aspect-square w-full max-w-[260px] rounded-2xl border border-line bg-surface-2" />
      )}
      <p className="mb-4 rounded-2xl bg-white/5 p-3 text-sm">
        {text} <span className="break-all text-ion">{url}</span>
      </p>
      <div className="flex flex-col gap-2">
        {canNativeShare && (
          <Button size="lg" onClick={nativeShare} disabled={busy}>
            {busy ? "Preparing…" : "Share"}
          </Button>
        )}
        <Button size="lg" variant={canNativeShare ? "secondary" : "primary"} onClick={copy}>
          {copied ? "Copied ✓" : "Copy link"}
        </Button>
        {runId && (
          <div className="grid grid-cols-2 gap-2">
            <a href={`${card("story")}&download=1`} download className={buttonClass("secondary", "md")} onClick={() => track("share", gameId, { method: "download_story" })}>
              ⬇ Story 9:16
            </a>
            <a href={`${card("square")}&download=1`} download className={buttonClass("secondary", "md")} onClick={() => track("share", gameId, { method: "download_square" })}>
              ⬇ Square
            </a>
          </div>
        )}
      </div>
    </Sheet>
  );
}
