import { getDb } from "@/lib/db";
import { getChallenge } from "@/lib/challenges/service";
import { getGame, liveGames } from "@/games/registry";
import { formatScore } from "@/games/core/format";
import { renderScoreCard } from "@/lib/og/render";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Friend challenge";

/** Link-preview image: "{user} scored 47 in Stack Up. Can you beat it?" */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const ch = await getChallenge(db, token).catch(() => null);
  const def = (ch && getGame(ch.gameId)) || liveGames[0];
  return renderScoreCard({
    def,
    format: "og",
    scoreText: ch ? formatScore(ch.score, def.scoreFormat) : "?",
    unit: def.scoreUnit,
    headline: ch ? `${ch.creator.username} scored` : "Challenge",
    rankLine: "CAN YOU BEAT IT?",
  });
}
