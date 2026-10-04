import { z } from "zod";
import type { RankTier } from "@/lib/leaderboards/compose";

/** Wire types for the run lifecycle (shared by client + server). */

export const startRunSchema = z.object({
  gameId: z.string().min(1).max(64),
  gameVersion: z.number().int().min(1),
  mode: z.enum(["normal", "daily", "challenge"]).default("normal"),
  challengeToken: z.string().max(32).optional(),
});
export type StartRunRequest = z.infer<typeof startRunSchema>;

export interface StartRunResponse {
  runId: string;
  nonce: string;
  seed: string;
  mode: "normal" | "daily" | "challenge";
  startedAt: string;
}

export const submitRunSchema = z.object({
  runId: z.string().uuid(),
  gameId: z.string().min(1).max(64),
  gameVersion: z.number().int().min(1),
  score: z.number().finite(),
  completed: z.boolean(),
  clientTimestamp: z.number().finite(),
  checksum: z.string().max(64),
  idempotencyKey: z.string().min(8).max(64),
  metadata: z.object({
    seed: z.string().max(128),
    gameVersion: z.number().int(),
    durationMs: z.number().finite().min(0),
    actions: z.number().int().min(0).max(1_000_000),
    peakActionsPerSecond: z.number().finite().min(0).max(10_000),
    checkpoints: z.array(z.tuple([z.number().finite(), z.number().finite()])).max(2000),
    stats: z.record(z.string().max(40), z.number().finite()).refine((o) => Object.keys(o).length <= 40, "too many stats"),
    input: z.object({
      pointerDowns: z.number().int().min(0),
      keyDowns: z.number().int().min(0),
      rejectedMultiTouch: z.number().int().min(0),
      rejectedFast: z.number().int().min(0),
    }),
  }),
});
export type SubmitRunRequest = z.infer<typeof submitRunSchema>;

export interface RankInfo {
  rank: number;
  total: number;
  tier: RankTier;
  percentile: number;
}

export interface SubmitRunResponse {
  status: "accepted" | "flagged" | "rejected";
  runId: string;
  score: number;
  reasons?: string[];
  personalBest?: { isNew: boolean; previous: number | null; best: number };
  /** Where THIS score places on each board. */
  ranks?: {
    global: RankInfo;
    country: (RankInfo & { code: string }) | null;
    today: RankInfo;
    /** Rank of the player's all-time best. */
    bestGlobal: number | null;
  };
  nextTarget?: { username: string; score: number; rank: number } | null;
  daily?: { rank: number; total: number; attempts: number; best: number; streak: number; countryRank: number | null } | null;
  challenge?: { won: boolean; tie: boolean; margin: number; opponent: { username: string; score: number } } | null;
  xp?: { gained: number; breakdown: Array<{ reason: string; xp: number }>; total: number; level: number; levelUp: boolean; progress: number };
  achievements?: Array<{ id: string; name: string; description: string; icon: string; xp: number; tier: string }>;
}
