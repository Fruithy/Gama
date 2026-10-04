import type { GameDefinition, RunMetadata } from "@/games/core/types";
import { hashString } from "@/games/core/rng";

/**
 * Run plausibility checks — shared by the browser (`validateLocalRun`) and the
 * server submission endpoint. Pure and deterministic so it is unit-testable.
 *
 * Philosophy: a browser game can never be made cheat-proof. These rules bound
 * what a human can physically do; anything outside is FLAGGED for review
 * (kept off leaderboards) rather than silently trusted. Structural problems
 * (bad numbers, absurd durations) are REJECTED outright.
 */

export type Verdict = "accepted" | "flagged" | "rejected";

export interface RunSubmissionData {
  score: number;
  completed: boolean;
  metadata: RunMetadata;
}

export interface ServerRunContext {
  /** ms between server-issued run start and submission arrival. */
  serverElapsedMs?: number;
  /** Client wall clock at submission (ms epoch). */
  clientTimestamp?: number;
  /** Server wall clock (ms epoch). */
  serverNow?: number;
}

export interface RunEvaluation {
  verdict: Verdict;
  flags: string[];
  rejections: string[];
}

/** Grace for network latency / timer granularity between client and server. */
const SERVER_WINDOW_GRACE_MS = 2_500;
/** Accept client clocks up to 10 minutes off before flagging. */
const MAX_CLOCK_SKEW_MS = 10 * 60_000;
/** Slack for per-action score caps (combo bonuses land on the last action). */
const SCORE_PER_ACTION_GRACE = 5;
/** Checkpoints may trail the final duration slightly (end animation). */
const CHECKPOINT_TIME_GRACE_MS = 1_000;

export function evaluateRun(
  def: Pick<GameDefinition, "validation" | "scoreDirection">,
  sub: RunSubmissionData,
  ctx: ServerRunContext = {},
): RunEvaluation {
  const rules = def.validation;
  const flags: string[] = [];
  const rejections: string[] = [];
  const m = sub.metadata;
  const score = sub.score;

  // ── structural sanity → reject ───────────────────────────────────────────
  if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0) rejections.push("invalid_score");
  if (!Number.isFinite(m.durationMs) || m.durationMs < 0) rejections.push("invalid_duration");
  if (m.durationMs > rules.maxDurationMs) rejections.push("duration_out_of_range");
  if (!Number.isFinite(m.actions) || m.actions < 0 || !Number.isFinite(m.peakActionsPerSecond)) rejections.push("invalid_actions");
  if (!Array.isArray(m.checkpoints)) rejections.push("invalid_checkpoints");
  if (def.scoreDirection === "lower" && !sub.completed) rejections.push("incomplete_lower_is_better_run");
  if (rejections.length) return { verdict: "rejected", flags, rejections };

  // ── plausibility → flag ──────────────────────────────────────────────────
  const meaningful = def.scoreDirection === "lower" ? sub.completed : score > 0;

  if (meaningful && m.durationMs < rules.minDurationMs) flags.push("duration_too_short");

  if (rules.fixedDurationMs !== undefined && sub.completed) {
    const tol = rules.fixedDurationToleranceMs ?? 1_500;
    if (Math.abs(m.durationMs - rules.fixedDurationMs) > tol) flags.push("fixed_duration_mismatch");
  }

  if (score > rules.maxScore) flags.push("score_above_max");
  if (rules.minScore !== undefined && score < rules.minScore) flags.push("score_below_human_min");

  if (def.scoreDirection === "higher" && rules.maxScorePerSecond !== undefined) {
    const seconds = Math.max(1, m.durationMs / 1000);
    if (score > rules.maxScorePerSecond * seconds) flags.push("score_rate_too_high");
  }

  if (m.peakActionsPerSecond > rules.maxActionsPerSecond) flags.push("action_rate_too_high");

  if (rules.maxScorePerAction !== undefined && def.scoreDirection === "higher") {
    if (score > m.actions * rules.maxScorePerAction + SCORE_PER_ACTION_GRACE) flags.push("score_exceeds_actions");
  }

  if (rules.monotonicCheckpoints && def.scoreDirection === "higher") {
    const issue = checkProgression(m.checkpoints, score, m.durationMs);
    if (issue) flags.push(issue);
  }

  // ── server-only context ──────────────────────────────────────────────────
  if (ctx.serverElapsedMs !== undefined && m.durationMs > ctx.serverElapsedMs + SERVER_WINDOW_GRACE_MS) {
    // The client claims it played longer than the server-issued run existed.
    flags.push("duration_exceeds_server_window");
  }
  if (ctx.clientTimestamp !== undefined && ctx.serverNow !== undefined) {
    if (Math.abs(ctx.clientTimestamp - ctx.serverNow) > MAX_CLOCK_SKEW_MS) flags.push("clock_skew");
  }

  return { verdict: flags.length ? "flagged" : "accepted", flags, rejections };
}

function checkProgression(checkpoints: Array<[number, number]>, finalScore: number, durationMs: number): string | null {
  if (finalScore > 0 && checkpoints.length === 0) return "missing_progression";
  let lastT = -1;
  let lastS = 0;
  for (const cp of checkpoints) {
    if (!Array.isArray(cp) || cp.length !== 2) return "malformed_progression";
    const [t, s] = cp;
    if (!Number.isFinite(t) || !Number.isFinite(s)) return "malformed_progression";
    if (t < lastT || s < lastS) return "non_monotonic_progression";
    if (t > durationMs + CHECKPOINT_TIME_GRACE_MS) return "progression_after_end";
    lastT = t;
    lastS = s;
  }
  if (checkpoints.length && lastS !== finalScore) return "progression_score_mismatch";
  return null;
}

/**
 * Lightweight tamper signal binding the payload to the server nonce. A
 * determined cheater can recompute this — it exists to stop naive replays and
 * hand-edited requests, not to be cryptographic proof.
 */
export function runChecksum(runId: string, nonce: string, score: number, durationMs: number): string {
  const a = hashString(`${runId}|${score}|${Math.round(durationMs)}|${nonce}`);
  const b = hashString(`${nonce}|${a}|${runId}`);
  return a.toString(36) + b.toString(36);
}
