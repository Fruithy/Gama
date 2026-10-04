/**
 * Gameplay clip recording (architecture, behind the `videoRecording` flag).
 *
 * The stage canvas can be captured with `canvas.captureStream()` and encoded
 * by MediaRecorder entirely on-device. A ring of recent chunks keeps the
 * last N seconds so "Share clip" can export the moment that just happened.
 * Nothing is uploaded unless the player explicitly shares the file.
 */
export interface ClipRecorder {
  start(): void;
  stop(): Promise<Blob | null>;
  readonly supported: boolean;
}

export function createClipRecorder(canvas: HTMLCanvasElement, opts: { fps?: number; maxSeconds?: number } = {}): ClipRecorder {
  const supported = typeof MediaRecorder !== "undefined" && typeof canvas.captureStream === "function";
  let rec: MediaRecorder | null = null;
  let chunks: Array<{ at: number; blob: Blob }> = [];
  const maxMs = (opts.maxSeconds ?? 15) * 1000;
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) => supported && MediaRecorder.isTypeSupported(m));
  return {
    supported: supported && !!mime,
    start() {
      if (!supported || !mime) return;
      chunks = [];
      rec = new MediaRecorder(canvas.captureStream(opts.fps ?? 30), { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      rec.ondataavailable = (e) => {
        if (!e.data.size) return;
        chunks.push({ at: performance.now(), blob: e.data });
        // Keep only the last `maxSeconds` (first chunk holds the container header, keep it).
        while (chunks.length > 2 && performance.now() - chunks[1].at > maxMs) chunks.splice(1, 1);
      };
      rec.start(1000);
    },
    stop() {
      return new Promise((resolve) => {
        if (!rec || rec.state === "inactive") return resolve(null);
        rec.onstop = () => resolve(chunks.length ? new Blob(chunks.map((c) => c.blob), { type: mime }) : null);
        rec.stop();
      });
    },
  };
}
