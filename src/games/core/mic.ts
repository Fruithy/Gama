import type { MicApi } from "./types";

/**
 * Microphone analysis for voice games: loudness + pitch, computed live from
 * an AnalyserNode. Audio is never recorded, buffered beyond one analysis
 * window, or uploaded.
 */
const MIN_RMS_FOR_PITCH = 0.012;
const MIN_HZ = 70;
const MAX_HZ = 1100;

export class MicService implements MicApi {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private stream: MediaStream;
  private buf: Float32Array<ArrayBuffer>;
  private level = 0;
  private stopped = false;

  private constructor(stream: MediaStream) {
    this.stream = stream;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    this.buf = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
  }

  static async request(): Promise<MicService> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone not supported on this browser");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const svc = new MicService(stream);
    if (svc.ctx.state === "suspended") await svc.ctx.resume().catch(() => {});
    return svc;
  }

  get active() {
    return !this.stopped;
  }

  private rms(): number {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    return Math.sqrt(sum / this.buf.length);
  }

  readLevel(): number {
    if (this.stopped) return 0;
    const target = Math.min(1, this.rms() * 6);
    // Fast attack, slower release feels responsive but not jittery.
    this.level += (target - this.level) * (target > this.level ? 0.6 : 0.15);
    return this.level;
  }

  /**
   * Autocorrelation pitch detection (time-domain). Good enough for humming /
   * singing a held note; returns null for silence or noisy frames.
   */
  readPitch(): number | null {
    if (this.stopped) return null;
    const rms = this.rms();
    if (rms < MIN_RMS_FOR_PITCH) return null;
    const buf = this.buf;
    const sr = this.ctx.sampleRate;
    const minLag = Math.floor(sr / MAX_HZ);
    // Analyse a 1024-sample window to keep this cheap enough for 30 Hz on phones.
    const n = Math.min(buf.length, 1024);
    const maxLag = Math.min(n - 1, Math.floor(sr / MIN_HZ));
    let bestLag = -1;
    let best = 0;
    let prev = 1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      let norm = 0;
      for (let i = 0; i + lag < n; i++) {
        sum += buf[i] * buf[i + lag];
        norm += buf[i] * buf[i] + buf[i + lag] * buf[i + lag];
      }
      const corr = norm ? (2 * sum) / norm : 0;
      if (corr > best && corr > 0.85 && corr >= prev) {
        best = corr;
        bestLag = lag;
      }
      prev = corr;
    }
    return bestLag > 0 ? sr / bestLag : null;
  }

  stop() {
    this.stopped = true;
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close().catch(() => {});
  }
}
