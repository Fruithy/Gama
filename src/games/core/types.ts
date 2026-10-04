/**
 * FILTER ARCADE — game contract.
 *
 * Everything the platform knows about a game flows through two types:
 *
 *  - `GameDefinition`  static, serialisable-ish metadata + validation rules.
 *                      Imported by the server (leaderboards, anti-cheat, SEO)
 *                      and the client. Must stay lightweight: no canvas code.
 *  - `GameRuntime`     the playable implementation, lazily loaded through
 *                      `definition.load()` so each game is its own JS chunk.
 *
 * To add a game: create `src/games/<slug>/{meta,game,art}.ts` and add the meta
 * to `src/games/registry.ts`. See README → "How to add a new game".
 */

export type GameCategory =
  | "reaction"
  | "timing"
  | "precision"
  | "arcade"
  | "puzzle"
  | "memory"
  | "sports"
  | "physics"
  | "rhythm"
  | "camera";

export type Difficulty = "easy" | "medium" | "hard" | "impossible";

export type ControlType =
  | "tap"
  | "hold"
  | "swipe"
  | "drag"
  | "keyboard"
  | "head"
  | "face"
  | "voice";

/** higher = bigger number wins, lower = smaller number wins (times, ms). */
export type ScoreDirection = "higher" | "lower";

/** How a score integer is presented. Scores are ALWAYS stored as integers. */
export type ScoreFormat =
  | "points" // 1,234
  | "count" // 47
  | "ms" // 213 ms
  | "centiseconds" // 12.34 s
  | "meters" // 312 m
  | "percent10"; // stored ×10 → 98.7%

export type LeaderboardType = "score" | "time" | "survival";

export type PlayMode = "normal" | "daily" | "challenge";

export type GameStatus = "live" | "planned";

export interface GameTheme {
  /** Two-stop background gradient for cards / stage. */
  bg: [string, string];
  /** Primary accent used for buttons and highlights in this game. */
  accent: string;
  /** Text colour that reads well on `bg`. */
  ink: string;
}

/**
 * Server-side plausibility rules. These never "prove" a run is legit — they
 * bound what a human can do so impossible submissions are flagged.
 */
export interface ValidationRules {
  /** Absolute floor for a completed run's duration. */
  minDurationMs: number;
  /** Runs longer than this are rejected (stale / paused forever). */
  maxDurationMs: number;
  /** Hard ceiling. Anything above is flagged. */
  maxScore: number;
  /** Hard floor (lower-is-better games: fastest humanly plausible). */
  minScore?: number;
  /** Score accrual ceiling over the run's duration (higher-is-better). */
  maxScorePerSecond?: number;
  /** Peak input rate in any 1-second window. Humans top out ~16/s. */
  maxActionsPerSecond: number;
  /** Fixed-length games (e.g. 10 s Tap Rush): expected duration ± tolerance. */
  fixedDurationMs?: number;
  fixedDurationToleranceMs?: number;
  /** Require the reported score progression (checkpoints) to be monotonic. */
  monotonicCheckpoints?: boolean;
  /** Score must not exceed actions × this (e.g. 1 tap = ≤1 point). */
  maxScorePerAction?: number;
}

/** Score thresholds used for copy ("Great!"), achievements and challenges. */
export interface ScoreMilestones {
  good: number;
  great: number;
  /** For impossible games: reaching this counts as an "Impossible Win". */
  legendary: number;
}

export interface GameAccessibility {
  requiresSound?: boolean;
  requiresColorVision?: boolean;
  requiresFastReactions?: boolean;
  note?: string;
}

export interface GameDefinition {
  id: string;
  slug: string;
  name: string;
  /** ≤ 60 chars. Shown on cards. */
  shortDescription: string;
  /** One line a player can read in 2 seconds. */
  instructions: string;
  /** Optional extra bullets shown on the game page. */
  howTo?: string[];
  category: GameCategory;
  /** Secondary categories for discovery. */
  tags?: GameCategory[];
  difficulty: Difficulty;
  controls: ControlType[];
  /** Typical run length in seconds. */
  estimatedDuration: number;
  supportsMobile: boolean;
  supportsDesktop: boolean;
  usesCamera: boolean;
  usesMicrophone: boolean;
  leaderboardType: LeaderboardType;
  scoreDirection: ScoreDirection;
  scoreFormat: ScoreFormat;
  /** Short unit label shown next to scores ("pts", "taps", "ms"). */
  scoreUnit: string;
  featured?: boolean;
  isNew?: boolean;
  trending?: boolean;
  /** Bump when rules/balance change in a way that invalidates comparisons. */
  version: number;
  status: GameStatus;
  theme: GameTheme;
  /** Optional override; defaults to the generated `/art/<slug>.svg`. */
  thumbnail?: string;
  validation: ValidationRules;
  milestones: ScoreMilestones;
  accessibility?: GameAccessibility;
  /** Whether this game is eligible to be picked as a Daily Challenge. */
  dailyEligible?: boolean;
  /** Lazy loader for the playable runtime (code-split per game). */
  load?: () => Promise<{ default: GameFactory }>;
  /** Lazy loader for the SVG illustration (server/OG only). */
  art?: () => Promise<{ default: string }>;
}

/* ──────────────────────────── runtime contract ──────────────────────────── */

export interface HudState {
  score?: number;
  /** Seconds remaining, for timed games. */
  timeLeft?: number;
  lives?: number;
  maxLives?: number;
  combo?: number;
  level?: number;
  /** Short contextual label ("CUT 37%", "ROUND 3/10"). */
  label?: string;
  /** Override for how `score` is shown in the HUD. */
  scoreText?: string;
}

export interface RunMetadata {
  seed: string;
  gameVersion: number;
  /** Active gameplay time (pauses excluded). */
  durationMs: number;
  /** Total counted player actions (taps, swipes, key presses). */
  actions: number;
  /** Peak actions within any rolling 1 s window. */
  peakActionsPerSecond: number;
  /** [elapsedMs, scoreAfterEvent] — capped list for progression validation. */
  checkpoints: Array<[number, number]>;
  /** Game-specific numeric stats (perfects, maxCombo, accuracy…). */
  stats: Record<string, number>;
  input: {
    pointerDowns: number;
    keyDowns: number;
    /** Extra simultaneous touches we ignored (multi-touch exploit guard). */
    rejectedMultiTouch: number;
    /** Inputs dropped by min-interval debounce. */
    rejectedFast: number;
  };
}

export interface GameResult {
  score: number;
  /** false = run ended in a way that should not be ranked (e.g. false start). */
  completed: boolean;
  /** Short reason shown on the result screen ("TOO EARLY", "OUT OF TIME"). */
  reason?: string;
  /**
   * false = practice run that must never reach a leaderboard (e.g. a camera
   * game played with the touch fallback, which is easier than the real input).
   */
  ranked?: boolean;
  metadata: RunMetadata;
}

export interface LocalValidation {
  ok: boolean;
  issues: string[];
}

export interface AudioApi {
  readonly muted: boolean;
  /** Generic synth note. `pitch` multiplies frequency for variation. */
  play(sound: SoundName, opts?: { pitch?: number; volume?: number }): void;
  tone(freq: number, durationMs: number, opts?: { type?: OscillatorType; volume?: number; delayMs?: number }): void;
  /** Schedule a tone at an absolute AudioContext time (rhythm games). */
  toneAt(freq: number, when: number, durationMs: number, opts?: { type?: OscillatorType; volume?: number }): void;
  /** Underlying context (rhythm games schedule against its clock). */
  context(): AudioContext | null;
  /** Rough 0..1 tension level for progressive audio intensity. */
  setIntensity(level: number): void;
}

export type SoundName =
  | "tap"
  | "hit"
  | "perfect"
  | "miss"
  | "fail"
  | "pop"
  | "whoosh"
  | "tick"
  | "go"
  | "levelup"
  | "coin"
  | "thud"
  | "cut"
  | "bounce"
  | "flip";

export interface HapticsApi {
  tap(): void;
  success(): void;
  fail(): void;
  heavy(): void;
}

export interface FaceInput {
  /** Normalised head x (-1 left … 1 right), mirrored for selfie view. */
  x: number;
  /** Normalised head y (-1 up … 1 down). */
  y: number;
  /** 0..1 jaw open amount. */
  mouthOpen: number;
  /** 0..1 eye closure (max of both eyes). */
  blink: number;
  /** Whether a face is currently detected. */
  present: boolean;
}

export interface CameraApi {
  /** Latest face sample (polled each frame by the game). */
  readFace(): FaceInput;
  readonly active: boolean;
}

export interface MicApi {
  /** 0..1 smoothed loudness. */
  readLevel(): number;
  /** Detected fundamental frequency in Hz, or null. */
  readPitch(): number | null;
  readonly active: boolean;
}

export interface GameContext {
  container: HTMLElement;
  seed: string;
  mode: PlayMode;
  definition: GameDefinition;
  audio: AudioApi;
  haptics: HapticsApi;
  reducedMotion: boolean;
  onHud: (hud: HudState) => void;
  /** Present only when the game declared `usesCamera` and permission was granted. */
  camera?: CameraApi;
  /** Present only when the game declared `usesMicrophone` and permission was granted. */
  mic?: MicApi;
}

export interface GameRuntime {
  initialize(ctx: GameContext): Promise<void> | void;
  start(): void;
  pause(): void;
  resume(): void;
  /** Prepare a fresh run. A new seed may be provided (retry / challenge). */
  reset(seed?: string): void;
  destroy(): void;
  getScore(): number;
  getRunMetadata(): RunMetadata;
  validateLocalRun(): LocalValidation;
  onGameOver(cb: (result: GameResult) => void): void;
}

export type GameFactory = (definition: GameDefinition) => GameRuntime;
