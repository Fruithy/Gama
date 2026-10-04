/**
 * Monetization policy (prepared, disabled by default via the `ads` flag).
 * Retention comes first: never during gameplay, never after every run.
 */
export interface AdPolicy {
  /** Completed runs between interstitials. */
  runsBetweenInterstitials: number;
  /** No interstitial in a player's first N runs ever. */
  graceRuns: number;
  /** Minimum seconds between interstitials. */
  minSecondsBetween: number;
}

export const DEFAULT_AD_POLICY: AdPolicy = { runsBetweenInterstitials: 6, graceRuns: 10, minSecondsBetween: 240 };

export function shouldShowInterstitial(
  p: { adsEnabled: boolean; inGameplay: boolean; lifetimeRuns: number; runsSinceLastAd: number; secondsSinceLastAd: number; premium: boolean },
  policy: AdPolicy = DEFAULT_AD_POLICY,
): boolean {
  if (!p.adsEnabled || p.premium || p.inGameplay) return false;
  if (p.lifetimeRuns < policy.graceRuns) return false;
  return p.runsSinceLastAd >= policy.runsBetweenInterstitials && p.secondsSinceLastAd >= policy.minSecondsBetween;
}
