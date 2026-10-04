import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

/** Plain-language privacy notice. Have counsel review before launch. */
export default function PrivacyPage() {
  return (
    <article className="prose-invert mx-auto max-w-2xl px-4 pt-8 text-[15px] leading-relaxed text-text/90 sm:px-0 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-black [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
      <h1 className="font-display text-4xl font-black uppercase">Privacy</h1>
      <p className="text-muted">The short version: we collect the minimum needed to run a competitive arcade.</p>

      <h2>What we store</h2>
      <ul>
        <li>A random player ID in a first-party cookie so your scores stay yours. No tracking cookies.</li>
        <li>Your username, chosen avatar, optional country (for country leaderboards), XP, scores and game stats.</li>
        <li>For fraud prevention: run timing, input counts and score progression for each game you play.</li>
        <li>If you create an account: your email is held by our authentication provider (Supabase) and is never shown publicly or stored in your profile.</li>
        <li>Basic, pseudonymous product analytics (which games are opened, played, shared) to improve the arcade.</li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>We never store IP addresses or precise location. Country is detected once from your connection region (or chosen by you) and stored as a 2-letter code only.</li>
        <li>We never record, store or upload camera video or microphone audio. Camera and voice games process everything live on your device, and only after you explicitly allow it.</li>
        <li>We never sell personal data.</li>
      </ul>

      <h2 id="cookies">Cookies</h2>
      <p>
        We use one essential cookie (<code>fa_sid</code>) to keep you signed in as your player, and local storage on your device for preferences (sound,
        haptics), favourites, recent games and scores waiting to sync. If we ever introduce non-essential cookies (e.g. ads), we&apos;ll ask first via a
        cookie settings panel.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Export everything we hold about you: Profile → Privacy &amp; data → Export my data.</li>
        <li>Delete your account and all associated scores permanently: Profile → Privacy &amp; data → Delete account.</li>
        <li>Correct your data at any time in your profile settings.</li>
      </ul>

      <h2>Retention</h2>
      <p>Scores and stats are kept while your account exists. Rate-limit counters are deleted within 48 hours. Deleted accounts are removed immediately; analytics events are anonymised.</p>

      <h2>Contact</h2>
      <p>Questions about {BRAND.name} and your data: privacy@your-domain.example</p>
    </article>
  );
}
