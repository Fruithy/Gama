import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { ensureSynced } from "@/lib/games/catalog";
import { dailyHistory, getDailyChallenge } from "@/lib/daily/service";
import { getBoard } from "@/lib/leaderboards/service";
import { getCurrentPlayer } from "@/lib/players/service";
import { getGame } from "@/games/registry";
import { formatScoreWithUnit } from "@/games/core/format";
import { buttonClass } from "@/components/ui/Button";
import { Countdown } from "@/components/home/Countdown";
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";
import { EmptyState } from "@/components/ui/EmptyState";
import { thumbnailUrl, toCard } from "@/components/game/types";
import { DifficultyMeter } from "@/components/game/DifficultyMeter";
import { flagEmoji } from "@/lib/country";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Daily Challenge",
  description: "One game. One level. Everyone on Earth plays the same seed today. Climb the daily leaderboard and keep your streak alive.",
  alternates: { canonical: "/daily" },
};

async function load() {
  try {
    const db = await getDb();
    await ensureSynced(db);
    const [daily, me] = await Promise.all([getDailyChallenge(db), getCurrentPlayer(db)]);
    const q = { gameId: daily.game_id, board: "daily" as const, dailyChallengeId: daily.id, playerId: me?.id ?? null };
    const [board, countryBoard, history, mine] = await Promise.all([
      getBoard(db, { ...q, limit: 10 }),
      me?.country ? getBoard(db, { ...q, country: me.country, limit: 1 }) : Promise.resolve(null),
      dailyHistory(db, me?.id ?? null, 28),
      me ? db.query<{ attempts: number; best_score: number }>("select attempts, best_score from daily_challenge_scores where daily_challenge_id = $1 and player_id = $2", [daily.id, me.id]) : Promise.resolve([]),
    ]);
    return { daily, me, board, countryBoard, history, mine: mine[0] ?? null };
  } catch (e) {
    console.error("[daily]", e);
    return null;
  }
}

export default async function DailyPage() {
  const data = await load();
  if (!data) {
    return (
      <div className="px-4 pt-10">
        <EmptyState icon="📡" title="Daily Challenge is warming up">Try again in a moment.</EmptyState>
      </div>
    );
  }
  const { daily, me, board, countryBoard, history, mine } = data;
  const game = getGame(daily.game_id)!;
  const card = toCard(game);
  const streakAlive = !!me?.last_daily_day && history.slice(-2).some((h) => h.played);
  const streak = streakAlive ? me!.daily_streak : 0;

  return (
    <div className="animate-rise px-4 pt-5 sm:px-0">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-volt">Daily Challenge</p>
          <h1 className="font-display text-4xl font-black uppercase leading-none">{new Date(`${daily.day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Next challenge in</p>
          <Countdown className="font-display text-xl font-black" />
        </div>
      </div>

      <div className="noise relative mt-4 overflow-hidden rounded-[28px] border border-white/10 p-4" style={{ background: `linear-gradient(135deg, ${game.theme.bg[0]}, ${game.theme.bg[1]})` }}>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl(card)} alt="" width={400} height={400} className="w-28 rounded-2xl shadow-xl" />
          <div className="min-w-0">
            <p className="font-display text-3xl font-black uppercase leading-none text-white">{game.name}</p>
            <p className="mt-1 text-sm text-white/80">{game.instructions}</p>
            <div className="mt-2 text-white/80"><DifficultyMeter difficulty={game.difficulty} /></div>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-xs text-white/85">🌍 Same level for everyone on Earth today. Unlimited attempts — only your best counts.</p>
        <Link href={`/games/${game.slug}?mode=daily`} className={buttonClass("primary", "xl", "mt-4 w-full")}>
          ▶ {mine ? "Improve your score" : "Play today's challenge"}
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Your best" value={mine ? formatScoreWithUnit(Number(mine.best_score), game) : "—"} />
        <Tile label="Attempts" value={String(mine?.attempts ?? 0)} />
        <Tile label="World rank" value={board.me ? `#${board.me.rank.toLocaleString("en-US")}` : "—"} sub={`of ${board.total.toLocaleString("en-US")}`} />
        <Tile label={me?.country ? `${flagEmoji(me.country)} Country rank` : "Country rank"} value={countryBoard?.me ? `#${countryBoard.me.rank}` : "—"} sub={me?.country ? undefined : "set country in profile"} />
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[19px] font-black uppercase">🔥 Streak</h2>
          <span className="font-display text-2xl font-black text-sun">{streak} day{streak === 1 ? "" : "s"}</span>
        </div>
        <p className="text-xs text-muted">Play the Daily Challenge on consecutive days to grow your streak. Longest: {me?.longest_streak ?? 0}.</p>
        <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Last 28 days">
          {history.map((h) => {
            const g = getGame(h.gameId);
            const isToday = h.day === daily.day;
            return (
              <div
                key={h.day}
                title={`${h.day} · ${g?.name ?? h.gameId}${h.played ? ` · best ${formatScoreWithUnit(h.best, g!)}` : ""}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl text-[10px] font-bold",
                  h.played ? "bg-volt text-black" : "bg-white/5 text-faint",
                  isToday && "ring-2 ring-white",
                )}
              >
                <span>{Number(h.day.slice(8))}</span>
                <span aria-hidden="true">{h.played ? "✓" : "·"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-[19px] font-black uppercase">🏆 Today&apos;s top players</h2>
        {board.rows.length ? (
          <LeaderboardList rows={board.rows} format={game.scoreFormat} unit={game.scoreUnit} />
        ) : (
          <EmptyState icon="👑" title="Nobody yet">First score of the day takes #1.</EmptyState>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display text-xl font-black tabular">{value}</p>
      {sub && <p className="text-[10px] text-faint">{sub}</p>}
    </div>
  );
}
