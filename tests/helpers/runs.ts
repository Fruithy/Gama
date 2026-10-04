import type { Db } from "@/lib/db/types";
import { startRun, submitRun } from "@/lib/runs/service";
import { runChecksum } from "@/lib/security/run-validation";
import { getGame } from "@/games/registry";
import type { ProfileRow } from "@/lib/players/service";
import type { PlayMode } from "@/games/core/types";

/** Start + submit a plausible run through the real service (start time backdated to cover the duration). */
export async function play(db: Db, player: ProfileRow, gameId: string, score: number, opts: { durationMs?: number; mode?: PlayMode; challengeToken?: string; seedOverride?: string } = {}) {
  const def = getGame(gameId)!;
  const durationMs = opts.durationMs ?? 20_000;
  const run = await startRun(db, player, { gameId, gameVersion: def.version, mode: opts.mode ?? "normal", challengeToken: opts.challengeToken });
  await db.query("update score_runs set started_at = now() - ($2 || ' milliseconds')::interval where id = $1", [run.runId, String(durationMs + 3000)]);
  const checkpoints: Array<[number, number]> = def.scoreDirection === "higher" ? Array.from({ length: Math.min(score, 200) }, (_, i) => [Math.round(((i + 1) / Math.min(score, 200)) * (durationMs - 100)), i === Math.min(score, 200) - 1 ? score : Math.round(((i + 1) * score) / Math.min(score, 200))]) : [];
  const res = await submitRun(db, player, {
    runId: run.runId,
    gameId,
    gameVersion: def.version,
    score,
    completed: true,
    clientTimestamp: Date.now(),
    checksum: runChecksum(run.runId, run.nonce, score, durationMs),
    idempotencyKey: `k-${run.runId}`,
    metadata: {
      seed: opts.seedOverride ?? run.seed,
      gameVersion: def.version,
      durationMs,
      actions: Math.max(5, score),
      peakActionsPerSecond: 4,
      checkpoints,
      stats: {},
      input: { pointerDowns: score, keyDowns: 0, rejectedMultiTouch: 0, rejectedFast: 0 },
    },
  });
  return { run, res };
}
