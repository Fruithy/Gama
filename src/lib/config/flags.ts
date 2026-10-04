/** Feature flags: defaults live in code, overrides in the `feature_flags` table. */
export const FLAG_DEFAULTS = {
  cameraGames: { enabled: true, description: "Camera / face-tracking games" },
  micGames: { enabled: true, description: "Microphone / voice games" },
  friendSystem: { enabled: true, description: "Follow players & friends leaderboards" },
  achievements: { enabled: true, description: "Achievements & trophy cabinet" },
  videoRecording: { enabled: false, description: "Record gameplay clips with MediaRecorder (experimental)" },
  ratings: { enabled: true, description: "Ask players 'Fun? 👍/👎' after several plays" },
  ads: { enabled: false, description: "Display / interstitial ads between runs (never during play)" },
  multiplayer: { enabled: false, description: "Realtime head-to-head (future)" },
  dailyChallenge: { enabled: true, description: "Daily Challenge" },
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;
export type Flags = Record<FlagKey, boolean>;

export function defaultFlags(): Flags {
  return Object.fromEntries(Object.entries(FLAG_DEFAULTS).map(([k, v]) => [k, v.enabled])) as Flags;
}
