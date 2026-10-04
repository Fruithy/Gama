import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { ensureSynced } from "@/lib/games/catalog";
import { getCurrentPlayer, getProfileByUsername } from "@/lib/players/service";
import { playerRecords } from "@/lib/players/records";
import { getGame } from "@/games/registry";
import { formatScoreWithUnit } from "@/games/core/format";
import { RANK_TIER_LABEL } from "@/lib/leaderboards/compose";
import { levelProgress } from "@/lib/xp/rules";
import { countryName } from "@/lib/country";
import { Avatar } from "@/components/player/Avatar";
import { Flag } from "@/components/player/Flag";
import { FollowButton } from "@/components/player/FollowButton";
import { TrophyCabinet } from "@/components/player/TrophyCabinet";
import { ReportButton } from "@/components/play/ReportButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { thumbnailUrl, toCard } from "@/components/game/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `${decodeURIComponent(username)} — player profile`, robots: { index: false } };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = await getDb();
  await ensureSynced(db);
  const profile = await getProfileByUsername(db, decodeURIComponent(username));
  if (!profile || profile.is_banned) notFound();
  const [records, me, followers] = await Promise.all([
    playerRecords(db, profile.id),
    getCurrentPlayer(db),
    db.query<{ n: number }>("select count(*)::int as n from follows where followee_id = $1", [profile.id]),
  ]);
  const following = me ? (await db.query("select 1 from follows where follower_id = $1 and followee_id = $2", [me.id, profile.id])).length > 0 : false;
  const isMe = me?.id === profile.id;
  const lp = levelProgress(profile.xp);

  return (
    <div className="animate-rise px-4 pt-6 sm:px-0">
      <div className="flex items-center gap-4">
        <Avatar id={profile.avatar} size={84} className="drop-shadow-xl" label={`${profile.username}'s avatar`} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-black">{profile.username}</h1>
          <p className="text-sm text-muted">
            <Flag code={profile.country} /> {profile.country ? countryName(profile.country) : "Earth"} · joined {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-volt px-2.5 py-0.5 text-xs font-black text-black">LV {lp.level}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-volt to-ion" style={{ width: `${Math.round(lp.ratio * 100)}%` }} /></div>
            <span className="text-[11px] text-muted">{profile.xp.toLocaleString("en-US")} XP</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {isMe ? (
          <Link href="/me" className="press rounded-full bg-white/10 px-4 py-2 text-sm font-bold">Edit profile</Link>
        ) : (
          <FollowButton username={profile.username} initial={following} />
        )}
        <span className="rounded-full bg-white/5 px-3 py-2 text-xs text-muted">{followers[0]?.n ?? 0} followers</span>
        {!isMe && <div className="ml-auto"><ReportButton username={profile.username} /></div>}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        {[
          ["Plays", profile.total_plays],
          ["Games", profile.games_played],
          ["Streak", profile.daily_streak],
          ["Wins", profile.challenge_wins + profile.daily_wins],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white/[0.05] py-3">
            <p className="font-display text-xl font-black tabular">{Number(v).toLocaleString("en-US")}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{k}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-[19px] font-black uppercase">🏆 Trophy cabinet</h2>
        <TrophyCabinet achievements={records.achievements} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-[19px] font-black uppercase">💪 Strongest scores</h2>
        {records.bests.length === 0 ? (
          <EmptyState title="No ranked scores yet" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {records.bests.slice(0, 12).map((b) => {
              const g = getGame(b.gameId)!;
              return (
                <Link key={b.gameId} href={`/games/${g.slug}`} className="press flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5 hover:bg-white/[0.07]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailUrl(toCard(g))} alt="" width={56} height={56} className="h-14 w-14 rounded-xl" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{g.name}</p>
                    <p className="text-xs text-muted">#{b.rank.toLocaleString("en-US")} of {b.total.toLocaleString("en-US")}{b.tier ? ` · ${RANK_TIER_LABEL[b.tier]}` : ""}</p>
                  </div>
                  <p className="font-display text-lg font-black tabular">{formatScoreWithUnit(b.score, g)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
