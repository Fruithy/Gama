import { describe, expect, it } from "vitest";
import { evaluateRun, runChecksum } from "@/lib/security/run-validation";
import type { GameDefinition, RunMetadata } from "@/games/core/types";
import { getGame } from "@/games/registry";

const meta = (over: Partial<RunMetadata> = {}): RunMetadata => ({
  seed: "s",
  gameVersion: 1,
  durationMs: 20_000,
  actions: 30,
  peakActionsPerSecond: 4,
  checkpoints: [[1000, 1], [5000, 5], [19_000, 10]],
  stats: {},
  input: { pointerDowns: 30, keyDowns: 0, rejectedMultiTouch: 0, rejectedFast: 0 },
  ...over,
});

const higher = getGame("stack-up")!;
const lower = getGame("reaction-flash")!;
const fixed = getGame("tap-rush")!;

describe("score validation (higher is better)", () => {
  it("accepts a plausible run", () => {
    expect(evaluateRun(higher, { score: 10, completed: true, metadata: meta() }).verdict).toBe("accepted");
  });
  it("rejects structurally invalid scores", () => {
    expect(evaluateRun(higher, { score: -5, completed: true, metadata: meta() }).verdict).toBe("rejected");
    expect(evaluateRun(higher, { score: 1.5, completed: true, metadata: meta() }).rejections).toContain("invalid_score");
    expect(evaluateRun(higher, { score: 3, completed: true, metadata: meta({ durationMs: 999_999_999 }) }).rejections).toContain("duration_out_of_range");
  });
  it("flags impossible score rates and action rates", () => {
    const r = evaluateRun(higher, { score: 500, completed: true, metadata: meta({ checkpoints: [[19_000, 500]] }) });
    expect(r.verdict).toBe("flagged");
    expect(r.flags).toContain("score_rate_too_high");
    const a = evaluateRun(higher, { score: 10, completed: true, metadata: meta({ peakActionsPerSecond: 60 }) });
    expect(a.flags).toContain("action_rate_too_high");
  });
  it("flags broken score progression", () => {
    const r = evaluateRun(higher, { score: 10, completed: true, metadata: meta({ checkpoints: [[1000, 5], [2000, 3], [3000, 10]] }) });
    expect(r.flags).toContain("non_monotonic_progression");
    const m = evaluateRun(higher, { score: 12, completed: true, metadata: meta() });
    expect(m.flags).toContain("progression_score_mismatch");
  });
  it("flags runs claiming more time than the server window", () => {
    const r = evaluateRun(higher, { score: 10, completed: true, metadata: meta() }, { serverElapsedMs: 5_000 });
    expect(r.flags).toContain("duration_exceeds_server_window");
  });
  it("flags client clock skew", () => {
    const r = evaluateRun(higher, { score: 10, completed: true, metadata: meta() }, { clientTimestamp: 0, serverNow: Date.now() });
    expect(r.flags).toContain("clock_skew");
  });
});

describe("score validation (lower is better)", () => {
  it("rejects incomplete runs (false starts can't rank)", () => {
    expect(evaluateRun(lower, { score: 150, completed: false, metadata: meta({ durationMs: 8000, checkpoints: [] }) }).verdict).toBe("rejected");
  });
  it("flags superhuman reaction averages", () => {
    const r = evaluateRun(lower, { score: 60, completed: true, metadata: meta({ durationMs: 9000, checkpoints: [] }) });
    expect(r.flags).toContain("score_below_human_min");
  });
  it("accepts a normal reaction run", () => {
    expect(evaluateRun(lower, { score: 231, completed: true, metadata: meta({ durationMs: 12_000, checkpoints: [], actions: 5 }) }).verdict).toBe("accepted");
  });
});

describe("fixed-length games", () => {
  it("flags a Tap Rush run that didn't last 10 seconds", () => {
    const cps: Array<[number, number]> = Array.from({ length: 50 }, (_, i) => [i * 100, i + 1]);
    const r = evaluateRun(fixed, { score: 50, completed: true, metadata: meta({ durationMs: 5_000, actions: 50, checkpoints: cps }) });
    expect(r.flags).toContain("fixed_duration_mismatch");
  });
  it("flags more taps than actions", () => {
    const cps: Array<[number, number]> = [[9_000, 150]];
    const r = evaluateRun(fixed, { score: 150, completed: true, metadata: meta({ durationMs: 10_000, actions: 60, checkpoints: cps }) });
    expect(r.flags).toContain("score_exceeds_actions");
  });
});

describe("checksum", () => {
  it("is deterministic and binds run, nonce, score and duration", () => {
    const a = runChecksum("run", "nonce", 10, 2000);
    expect(runChecksum("run", "nonce", 10, 2000)).toBe(a);
    expect(runChecksum("run", "nonce", 11, 2000)).not.toBe(a);
    expect(runChecksum("run", "other", 10, 2000)).not.toBe(a);
  });
});

export type { GameDefinition };
