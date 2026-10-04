"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl">😵‍💫</p>
      <p className="mt-3 font-display text-2xl font-black uppercase">Something glitched</p>
      <p className="mt-1 text-muted">Not your fault. Try again — your scores are safe.</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonClass("secondary", "md")}>Home</Link>
      </div>
    </div>
  );
}
