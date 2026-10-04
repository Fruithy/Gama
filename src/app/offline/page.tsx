import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-6xl">📡</div>
      <h1 className="font-display text-3xl font-black uppercase">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-muted">Games you&apos;ve opened before still work. Scores are saved on your device and sync when you&apos;re back.</p>
      <Link href="/" className={buttonClass("primary", "lg", "mt-6")}>Try again</Link>
    </div>
  );
}
