import { api, RequestError } from "@/lib/client/api";
import { queuePending } from "@/lib/client/local";
import { runChecksum } from "@/lib/security/run-validation";
import type { GameResult, PlayMode } from "@/games/core/types";
import type { StartRunResponse, SubmitRunRequest, SubmitRunResponse } from "@/lib/runs/types";

export type SubmitOutcome =
  | { kind: "ok"; response: SubmitRunResponse }
  | { kind: "queued"; message: string }
  | { kind: "error"; message: string }
  | { kind: "unranked"; message: string };

/**
 * Browser side of the server-authoritative run flow:
 *   start() → server issues {runId, nonce, seed}
 *   submit() → server validates & ranks
 * Network failures never block play: the run is queued locally and the UI
 * says so honestly ("Score saved locally — leaderboard unavailable").
 */
export async function startServerRun(gameId: string, gameVersion: number, mode: PlayMode, challengeToken?: string): Promise<StartRunResponse | { error: string; message: string }> {
  try {
    return await api<StartRunResponse>("/api/runs/start", { json: { gameId, gameVersion, mode, challengeToken }, timeoutMs: 5000 });
  } catch (e) {
    const err = e as RequestError;
    return { error: err.code, message: err.message };
  }
}

export function buildSubmission(session: StartRunResponse, gameId: string, gameVersion: number, result: GameResult): SubmitRunRequest {
  return {
    runId: session.runId,
    gameId,
    gameVersion,
    score: result.score,
    completed: result.completed,
    clientTimestamp: Date.now(),
    checksum: runChecksum(session.runId, session.nonce, result.score, result.metadata.durationMs),
    idempotencyKey: `${session.runId}:${session.nonce.slice(0, 8)}`,
    metadata: result.metadata,
  };
}

export async function submitServerRun(payload: SubmitRunRequest): Promise<SubmitOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await api<SubmitRunResponse>("/api/runs/submit", { json: payload, timeoutMs: 8000 });
      return { kind: "ok", response };
    } catch (e) {
      const err = e as RequestError;
      if (err.status >= 400 && err.status < 500) return { kind: "error", message: err.message };
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
    }
  }
  queuePending(payload);
  return { kind: "queued", message: "Score saved locally — leaderboard unavailable." };
}
