/** Analytics event catalogue (shared client/server). */
export const EVENT_NAMES = [
  "game_impression",
  "game_opened",
  "game_started",
  "game_completed",
  "game_failed",
  "retry",
  "personal_best",
  "share",
  "challenge_created",
  "challenge_opened",
  "challenge_attempt",
  "favorite",
  "unfavorite",
  "signup_after_play",
  "rating",
  "daily_opened",
  "camera_denied",
  "mic_denied",
  "score_submit_failed",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Events the browser may send. Started/completed/challenges are recorded server-side (can't be spoofed into stats). */
export const CLIENT_EVENTS: ReadonlySet<EventName> = new Set<EventName>([
  "game_impression",
  "game_opened",
  "game_failed",
  "retry",
  "share",
  "favorite",
  "unfavorite",
  "signup_after_play",
  "rating",
  "daily_opened",
  "camera_denied",
  "mic_denied",
  "score_submit_failed",
]);

/** High-volume events only bump rollups; no raw row is stored. */
export const ROLLUP_ONLY: ReadonlySet<EventName> = new Set<EventName>(["game_impression"]);

export const ROLLUP_COLUMN: Partial<Record<EventName, string>> = {
  game_impression: "impressions",
  game_opened: "opens",
  game_started: "starts",
  game_completed: "completions",
  game_failed: "fails",
  retry: "retries",
  share: "shares",
  challenge_created: "challenges_created",
  challenge_opened: "challenge_opens",
  favorite: "favorites",
};
