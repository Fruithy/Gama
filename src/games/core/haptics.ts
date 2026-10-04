import type { HapticsApi } from "./types";

/**
 * Haptic feedback via the Vibration API (Android Chrome & friends). iOS Safari
 * has no web vibration API, so every call degrades to a silent no-op.
 */
const HAPTICS_KEY = "fa:haptics";

function enabled(): boolean {
  try {
    return window.localStorage.getItem(HAPTICS_KEY) !== "0";
  } catch {
    return true;
  }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (!enabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw when called without user activation */
  }
}

export const haptics: HapticsApi = {
  tap: () => vibrate(8),
  success: () => vibrate([12, 40, 18]),
  fail: () => vibrate([40, 30, 60]),
  heavy: () => vibrate(28),
};

export function setHapticsEnabled(on: boolean) {
  try {
    window.localStorage.setItem(HAPTICS_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
