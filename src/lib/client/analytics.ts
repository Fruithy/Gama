import type { EventName } from "@/lib/analytics/events";

/**
 * Batched, fire-and-forget client analytics. Flushed every few seconds and
 * on page hide via sendBeacon so it never blocks gameplay.
 */
interface QueuedEvent {
  name: EventName;
  gameId?: string;
  props?: Record<string, string | number | boolean | null>;
}

const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let bound = false;
const seenImpressions = new Set<string>();

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, 50);
  const body = JSON.stringify({ events: batch });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through */
  }
  void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

export function track(name: EventName, gameId?: string, props?: QueuedEvent["props"]) {
  if (typeof window === "undefined") return;
  if (!bound) {
    bound = true;
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
    window.addEventListener("pagehide", flush);
  }
  queue.push({ name, gameId, props });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}

/** Once per page load per game. */
export function trackImpression(gameId: string) {
  if (seenImpressions.has(gameId)) return;
  seenImpressions.add(gameId);
  track("game_impression", gameId);
}
