"use client";

import { useEffect, useRef } from "react";
import { cn } from "./cn";

/** Bottom sheet on phones, centred dialog on desktop. Uses native <dialog> for a11y + focus trapping. */
export function Sheet({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-[28px] border border-line-strong bg-surface p-0 text-text backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md sm:rounded-[28px]",
        className,
      )}
    >
      <div className="px-5 pb-[calc(20px+var(--safe-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-black">{title}</h2>
          <button type="button" onClick={onClose} className="press grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
