import { getDb } from "@/lib/db";
import { getGame } from "@/games/registry";
import { formatScore } from "@/games/core/format";
import { rankOf, boardTotal } from "@/lib/leaderboards/service";
import { RANK_TIER_LABEL, rankTier } from "@/lib/leaderboards/compose";
import { renderScoreCard, type CardFormat } from "@/lib/og/render";
import { pickTaunt } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * 9:16 story / square share cards for a verified run. Built from server data
 * (run id → score, rank, username) so cards can't be forged via URL params.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("run") ?? "";
  const format = (url.searchParams.get("format") === "square" ? "square" : "story") as CardFormat;
  if (!/^[0-9a-f-]{36}$/.test(runId)) return new Response("Bad request", { status: 400 });
  const db = await getDb();
  const rows = await db.query<{ game_id: string; score: number; sort_score: number; submitted_at: Date; username: string; status: string }>(
    "select r.game_id, r.score, r.sort_score, r.submitted_at, p.username, r.status from score_runs r join profiles p on p.id = r.player_id where r.id = $1",
    [runId],
  );
  const run = rows[0];
  const def = run && getGame(run.game_id);
  if (!run || !def || run.status !== "accepted") return new Response("Not found", { status: 404 });
  const q = { gameId: def.id, board: "global" as const };
  const [rank, total] = await Promise.all([rankOf(db, q, Number(run.sort_score), run.submitted_at), boardTotal(db, q)]);
  const tier = rankTier(rank, Math.max(total, rank));
  const img = await renderScoreCard({
    def,
    format,
    scoreText: formatScore(Number(run.score), def.scoreFormat),
    unit: def.scoreUnit,
    headline: "I scored",
    username: `@${run.username}`,
    rankLine: tier ? `${RANK_TIER_LABEL[tier]} · #${rank.toLocaleString("en-US")}` : `#${rank.toLocaleString("en-US")} IN THE WORLD`,
    cta: pickTaunt(Number(run.score)),
  });
  const headers = new Headers(img.headers);
  headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  if (url.searchParams.get("download")) headers.set("Content-Disposition", `attachment; filename="${def.slug}-${run.score}-${format}.png"`);
  return new Response(img.body, { status: 200, headers });
}
