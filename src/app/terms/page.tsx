import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-8 text-[15px] leading-relaxed text-text/90 sm:px-0 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-black [&_p]:mt-3">
      <h1 className="font-display text-4xl font-black uppercase">Terms</h1>
      <h2>Play fair</h2>
      <p>
        Leaderboards only mean something if they&apos;re real. Automated input, modified clients, replayed requests or any other manipulation of scores is not
        allowed. Suspicious runs are held for review and may be removed; repeat offenders may be banned.
      </p>
      <h2>Usernames</h2>
      <p>Pick something you&apos;d be happy to see on a public leaderboard. Offensive, impersonating or reserved names may be changed or removed.</p>
      <h2>Your content</h2>
      <p>Share cards you generate are yours to post anywhere. Game artwork, names and code belong to {BRAND.name}.</p>
      <h2>Availability</h2>
      <p>Games are provided as-is. We may change, rebalance or retire games; leaderboards may be reset when rules change (game versions).</p>
    </article>
  );
}
