import type { AudioApi, SoundName } from "./types";

/**
 * Tiny procedural sound engine. Every sound is synthesised with Web Audio —
 * there are no audio files to license, download or cache.
 *
 * The AudioContext is created lazily on the first user gesture (browsers block
 * autoplay), so the engine is safe to construct at any time.
 */

interface Voice {
  type: OscillatorType;
  /** Start frequency (Hz). */
  f0: number;
  /** End frequency (Hz) — exponential glide. */
  f1?: number;
  dur: number;
  vol: number;
  /** Optional second note, played after `dur` (two-tone chimes). */
  then?: Omit<Voice, "then">;
  noise?: boolean;
}

const SOUNDS: Record<SoundName, Voice> = {
  tap: { type: "triangle", f0: 660, f1: 520, dur: 0.05, vol: 0.18 },
  hit: { type: "square", f0: 520, f1: 780, dur: 0.07, vol: 0.12 },
  perfect: { type: "triangle", f0: 880, f1: 1320, dur: 0.08, vol: 0.2, then: { type: "sine", f0: 1320, f1: 1760, dur: 0.12, vol: 0.16 } },
  miss: { type: "sawtooth", f0: 220, f1: 110, dur: 0.18, vol: 0.12 },
  fail: { type: "sawtooth", f0: 330, f1: 70, dur: 0.45, vol: 0.16 },
  pop: { type: "sine", f0: 900, f1: 300, dur: 0.06, vol: 0.22 },
  whoosh: { type: "sine", f0: 200, f1: 900, dur: 0.12, vol: 0.08, noise: true },
  tick: { type: "square", f0: 1200, dur: 0.025, vol: 0.06 },
  go: { type: "triangle", f0: 523, dur: 0.09, vol: 0.2, then: { type: "triangle", f0: 1046, dur: 0.18, vol: 0.2 } },
  levelup: { type: "triangle", f0: 660, f1: 990, dur: 0.1, vol: 0.18, then: { type: "triangle", f0: 990, f1: 1480, dur: 0.16, vol: 0.18 } },
  coin: { type: "square", f0: 988, dur: 0.06, vol: 0.1, then: { type: "square", f0: 1319, dur: 0.14, vol: 0.1 } },
  thud: { type: "sine", f0: 140, f1: 50, dur: 0.16, vol: 0.35 },
  cut: { type: "sawtooth", f0: 1800, f1: 400, dur: 0.07, vol: 0.08, noise: true },
  bounce: { type: "sine", f0: 300, f1: 600, dur: 0.08, vol: 0.2 },
  flip: { type: "triangle", f0: 400, f1: 800, dur: 0.07, vol: 0.14 },
};

const MUTE_KEY = "fa:muted";

class AudioEngine implements AudioApi {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private _muted = false;
  private intensity = 0;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this._muted = window.localStorage.getItem(MUTE_KEY) === "1";
      } catch {
        /* storage unavailable (private mode) — default to sound on */
      }
    }
  }

  get muted() {
    return this._muted;
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  /** Must be called from a user gesture handler at least once. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  context() {
    return this.ctx;
  }

  setIntensity(level: number) {
    this.intensity = Math.max(0, Math.min(1, level));
  }

  play(sound: SoundName, opts: { pitch?: number; volume?: number } = {}) {
    if (this._muted) return;
    this.unlock();
    const v = SOUNDS[sound];
    if (!v || !this.ctx) return;
    const pitch = (opts.pitch ?? 1) * (1 + this.intensity * 0.12);
    this.voice(v, pitch, opts.volume ?? 1, 0);
  }

  tone(freq: number, durationMs: number, opts: { type?: OscillatorType; volume?: number; delayMs?: number } = {}) {
    if (this._muted) return;
    this.unlock();
    if (!this.ctx) return;
    this.voice(
      { type: opts.type ?? "triangle", f0: freq, dur: durationMs / 1000, vol: 0.18 },
      1,
      opts.volume ?? 1,
      (opts.delayMs ?? 0) / 1000,
    );
  }

  toneAt(freq: number, when: number, durationMs: number, opts: { type?: OscillatorType; volume?: number } = {}) {
    if (this._muted || !this.ctx) return;
    this.voice({ type: opts.type ?? "triangle", f0: freq, dur: durationMs / 1000, vol: 0.18 }, 1, opts.volume ?? 1, Math.max(0, when - this.ctx.currentTime));
  }

  private voice(v: Voice, pitch: number, volume: number, delay: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(v.vol * volume, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + v.dur);
    gain.connect(this.master!);

    if (v.noise) {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoise();
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(v.f0 * pitch, t0);
      if (v.f1) filter.frequency.exponentialRampToValueAtTime(v.f1 * pitch, t0 + v.dur);
      src.connect(filter).connect(gain);
      src.start(t0);
      src.stop(t0 + v.dur + 0.02);
    } else {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.f0 * pitch, t0);
      if (v.f1) osc.frequency.exponentialRampToValueAtTime(v.f1 * pitch, t0 + v.dur);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t0 + v.dur + 0.02);
    }
    if (v.then) this.voice(v.then, pitch, volume, delay + v.dur * 0.85);
  }

  private getNoise() {
    if (!this.noiseBuffer && this.ctx) {
      const len = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer!;
  }
}

let engine: AudioEngine | null = null;

/** Process-wide audio engine (client only). */
export function getAudio(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}

export type { AudioEngine };
