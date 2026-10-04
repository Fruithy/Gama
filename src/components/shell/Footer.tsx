import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="mx-auto mb-[calc(84px+var(--safe-bottom))] max-w-6xl px-4 py-8 text-xs text-faint md:mb-0">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/games" className="hover:text-text">All games</Link>
        <Link href="/privacy" className="hover:text-text">Privacy</Link>
        <Link href="/terms" className="hover:text-text">Terms</Link>
        <Link href="/privacy#cookies" className="hover:text-text">Cookies</Link>
      </div>
      <p className="mt-3">
        © {new Date().getFullYear()} {BRAND.name}. Original games. No downloads. Camera &amp; mic games run on your device.
      </p>
    </footer>
  );
}
