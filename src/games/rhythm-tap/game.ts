import { CanvasGame } from "../core/engine";
import { blobCritter, circle, text } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

interface Note {
  t: number; // seconds from song start
  judged: boolean;
  grade?: "perfect" | "great" | "good" | "miss";
  beat: number;
  offbeat: boolean;
}

const SCALE = [392, 440, 523, 587, 659, 784];

/**
 * Timing model: everything is measured on ONE clock. When Web Audio is
 * available we use AudioContext.currentTime (sample-accurate, the same clock
 * the beat is scheduled on) and compensate for output latency; otherwise we
 * fall back to performance.now(). Notes and judgement both use song time.
 */
class RhythmTap extends CanvasGame {
  private notes: Note[] = [];
  private beatTimes: number[] = [];
  private songStart = 0;
  private useAudio = false;
  private latency = 0;
  private scheduledUpTo = 0;
  private combo = 0;
  private misses = 0;
  private lastGrade = "";
  private gradeTimer = 0;
  private ringPulse = 0;
  private counts = { perfect: 0, great: 0, good: 0, miss: 0 };

  private clockNow(): number {
    const ctx = this.ctx.audio.context();
    if (this.useAudio && ctx) return ctx.currentTime - this.latency;
    return performance.now() / 1000;
  }
  private songTime() {
    return this.clockNow() - this.songStart;
  }
  private get hitY() {
    return this.h * 0.74;
  }

  protected setup() {
    // Build the chart from the seed: steady beats, optional off-beats, occasional rests.
    this.notes = [];
    this.beatTimes = [];
    let t = 0;
    let bpm = B.startBpm;
    for (let beat = 0; beat < B.beats; beat++) {
      if (beat > 0 && beat % B.bpmStepEvery === 0) bpm = Math.min(B.maxBpm, bpm + B.bpmStep);
      const spb = 60 / bpm;
      this.beatTimes.push(t);
      const rest = beat > 4 && beat % 4 !== 0 && this.rng.chance(B.restChance);
      if (!rest) this.notes.push({ t, judged: false, beat, offbeat: false });
      if (beat >= B.offbeatFrom && this.rng.chance(B.offbeatChance)) this.notes.push({ t: t + spb / 2, judged: false, beat, offbeat: true });
      t += spb;
    }
    this.combo = 0;
    this.misses = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.scheduledUpTo = 0;
  }

  start() {
    const ctx = this.ctx.audio.context();
    this.useAudio = !!ctx && ctx.state === "running";
    // Output latency: when the speaker actually plays what we schedule now.
    this.latency = this.useAudio && ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0;
    this.songStart = this.clockNow() + B.leadInS;
    super.start();
  }

  /** Lookahead scheduler: queue metronome clicks ~0.25 s ahead on the audio clock. */
  private schedule() {
    const ctx = this.ctx.audio.context();
    if (!this.useAudio || !ctx) return;
    const horizon = this.songTime() + 0.25;
    while (this.scheduledUpTo < this.beatTimes.length && this.beatTimes[this.scheduledUpTo] <= horizon) {
      const bt = this.beatTimes[this.scheduledUpTo];
      const when = this.songStart + bt + this.latency;
      const downbeat = this.scheduledUpTo % 4 === 0;
      this.ctx.audio.toneAt(downbeat ? 70 : 95, when, 110, { type: "sine", volume: 2.2 });
      this.ctx.audio.toneAt(downbeat ? 1600 : 2400, when, 30, { type: "square", volume: 0.25 });
      this.scheduledUpTo++;
    }
  }

  protected onPointerDown() {
    const now = this.songTime();
    let best: Note | null = null;
    let bestD = Infinity;
    for (const n of this.notes) {
      if (n.judged) continue;
      const d = Math.abs(n.t - now);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
      if (n.t - now > B.good) break;
    }
    if (!best || bestD > B.good) {
      this.combo = 0; // stray tap
      return;
    }
    const grade = bestD <= B.perfect ? "perfect" : bestD <= B.great ? "great" : "good";
    best.judged = true;
    best.grade = grade;
    this.counts[grade]++;
    this.combo++;
    const mult = Math.min(B.maxMultiplier, 1 + Math.floor(this.combo / B.comboStep));
    this.addScore(B.points[grade] * mult);
    this.statMax("maxCombo", this.combo);
    if (grade === "perfect") this.stat("perfects");
    this.lastGrade = grade.toUpperCase();
    this.gradeTimer = 0.4;
    this.ringPulse = 1;
    const color = grade === "perfect" ? PALETTE.volt : grade === "great" ? PALETTE.ion : "#fff";
    this.fx.burst(this.w / 2, this.hitY, { color: [color, "#fff"], count: grade === "perfect" ? 16 : 8, speed: 260 });
    this.ctx.audio.tone(SCALE[best.beat % SCALE.length], 120, { type: "triangle", volume: 0.8 });
    this.ctx.haptics.tap();
  }

  protected update(dt: number) {
    this.gradeTimer = Math.max(0, this.gradeTimer - dt);
    this.ringPulse = Math.max(0, this.ringPulse - dt * 5);
    if (!this.running) return;
    this.schedule();
    const now = this.songTime();
    for (const n of this.notes) {
      if (n.judged) continue;
      if (now - n.t > B.good) {
        n.judged = true;
        n.grade = "miss";
        this.counts.miss++;
        this.misses++;
        this.combo = 0;
        this.lastGrade = "MISS";
        this.gradeTimer = 0.4;
        this.sound("miss", 1, 0.4);
      } else break;
    }
    const acc = this.notes.length ? (this.counts.perfect + this.counts.great * 0.7 + this.counts.good * 0.4) / Math.max(1, this.notes.filter((n) => n.judged).length) : 0;
    this.statMax("accuracy", Math.round(acc * 100));
    if (this.misses >= B.maxMisses) {
      this.juiceFail();
      this.finish({ reason: "OUT OF SYNC" });
      return;
    }
    const last = this.notes[this.notes.length - 1];
    if (last && now > last.t + 0.6) {
      this.fx.confetti(this.w / 2, this.h * 0.4, 40);
      this.finish({ reason: this.counts.miss === 0 ? "FULL COMBO!" : "SONG COMPLETE", slowMo: false });
    }
  }

  protected render(g: CanvasRenderingContext2D) {
    const cx = this.w / 2;
    const now = this.running || this.state === "ending" ? this.songTime() : -B.leadInS;
    // Lane
    g.fillStyle = "rgba(255,255,255,0.06)";
    g.fillRect(cx - 50, 0, 100, this.h);
    // Beat lines
    for (const bt of this.beatTimes) {
      const y = this.hitY - (bt - now) * B.noteSpeed;
      if (y < -20 || y > this.h + 20) continue;
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.fillRect(cx - 50, y - 1, 100, 2);
    }
    // Hit ring
    g.strokeStyle = "#fff";
    g.lineWidth = 6 + this.ringPulse * 4;
    g.beginPath();
    g.arc(cx, this.hitY, 34 + this.ringPulse * 6, 0, Math.PI * 2);
    g.stroke();
    // Notes
    for (const n of this.notes) {
      const y = this.hitY - (n.t - now) * B.noteSpeed;
      if (y < -40 || y > this.h + 40) continue;
      if (n.judged && n.grade !== "miss") continue;
      circle(g, cx, y, n.offbeat ? 18 : 24, n.grade === "miss" ? "rgba(255,61,127,0.4)" : n.offbeat ? PALETTE.flare : PALETTE.ion);
      g.strokeStyle = "#0b0b0f";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, y, n.offbeat ? 18 : 24, 0, Math.PI * 2);
      g.stroke();
    }
    blobCritter(g, cx, this.hitY, 22, PALETTE.volt, { mouth: this.ringPulse > 0.3 ? "o" : "smile", squash: 1 + this.ringPulse * 0.25 });
    if (this.gradeTimer > 0) {
      const color = this.lastGrade === "PERFECT" ? PALETTE.volt : this.lastGrade === "MISS" ? PALETTE.flare : "#fff";
      text(g, this.lastGrade, cx, this.hitY + 80, { font: this.font, size: 26, color });
    }
    if (now < 0 && this.running) text(g, `${Math.ceil(-now)}`, cx, this.h * 0.4, { font: this.font, size: 60, color: "#fff" });
  }

  protected renderOverlay(g: CanvasRenderingContext2D) {
    if (this.state === "idle") text(g, "🔊 SOUND ON", this.w / 2, this.h * 0.35, { font: this.font, size: 20, color: "#fff" });
  }

  protected hud(): HudState {
    const mult = Math.min(B.maxMultiplier, 1 + Math.floor(this.combo / B.comboStep));
    return { score: this.score, combo: this.combo, label: `×${mult} · ${B.maxMisses - this.misses} ♪` };
  }
}

const factory: GameFactory = (def) => new RhythmTap(def);
export default factory;
