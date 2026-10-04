"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/client/hooks";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { api, RequestError } from "@/lib/client/api";
import { ALL_AVATARS } from "@/lib/players/avatar";
import { validateUsername } from "@/lib/players/username";
import { COUNTRY_CODES, countryName, flagEmoji } from "@/lib/country";
import { getAudio } from "@/games/core/audio";
import { setHapticsEnabled } from "@/games/core/haptics";
import { authConfigured, signInWithEmail, signInWithProvider } from "@/lib/client/supabase";
import { Avatar } from "./Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { levelProgress } from "@/lib/xp/rules";

function readHaptics() {
  try {
    return localStorage.getItem("fa:haptics") !== "0";
  } catch {
    return true;
  }
}

export function Settings() {
  const router = useRouter();
  const { player, setPlayer, refresh } = usePlayer();
  const hydrated = useHydrated();
  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? player?.username ?? "";
  const [check, setCheck] = useState<{ name: string; ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [soundPref, setSound] = useState<boolean | null>(null);
  const [hapticPref, setHaptic] = useState<boolean | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Device preferences (localStorage) are read only after hydration.
  const sound = soundPref ?? (hydrated ? !getAudio().muted : true);
  const haptic = hapticPref ?? (hydrated ? readHaptics() : true);

  // Username feedback: local rules instantly, availability from the server (debounced).
  const local = validateUsername(name);
  const unchanged = !player || name === player.username;
  const nameMsg = check?.name === name && !check.ok && unchanged ? check : unchanged ? null : !local.ok ? { ok: false, text: local.message } : check?.name === name ? check : null;
  useEffect(() => {
    if (!player || name === player.username || !validateUsername(name).ok) return;
    const t = setTimeout(() => {
      api<{ available: boolean; message: string }>(`/api/username?name=${encodeURIComponent(name)}`)
        .then((r) => setCheck({ name, ok: r.available, text: r.message }))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [name, player]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const r = await api<{ player: NonNullable<typeof player> }>("/api/me", { method: "PATCH", json: body });
      setPlayer(r.player);
      setName(null);
      return true;
    } catch (e) {
      setCheck({ name, ok: false, text: (e as RequestError).message });
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (player === undefined) {
    return (
      <div className="px-4 pt-6">
        <Skeleton className="h-24" />
        <Skeleton className="mt-4 h-64" />
      </div>
    );
  }

  const lp = player ? levelProgress(player.xp) : null;

  return (
    <div className="animate-rise px-4 pt-6 sm:px-0">
      <div className="flex items-center gap-4">
        <Avatar id={player?.avatar} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-black">{player?.username ?? "Guest"}</h1>
          {player && lp ? (
            <p className="text-sm text-muted">Level {lp.level} · {player.xp.toLocaleString("en-US")} XP · {player.totalPlays} plays</p>
          ) : (
            <p className="text-sm text-muted">Play any game to get your player card.</p>
          )}
        </div>
      </div>
      {player && (
        <div className="mt-3 flex gap-2">
          <Link href={`/u/${player.username}`} className={buttonClass("secondary", "sm")}>Public profile</Link>
          <Link href="/records" className={buttonClass("secondary", "sm")}>Records</Link>
        </div>
      )}

      {!player && (
        <div className="mt-6 rounded-[22px] border border-line bg-surface p-5 text-center">
          <p className="font-display text-xl font-black">No account needed</p>
          <p className="mt-1 text-sm text-muted">We create your player automatically when you finish your first game.</p>
          <Link href="/" className={buttonClass("primary", "lg", "mt-4")}>Play now</Link>
        </div>
      )}

      {player && (
        <>
          <Section title={player.usernameClaimed ? "Username" : "🔒 Secure your username"} hint={player.usernameClaimed ? "You can change it once a week." : "Pick the name the world sees on leaderboards."}>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Username" className="h-12 flex-1 rounded-2xl border border-line-strong bg-surface-2 px-4 font-bold outline-none focus:border-volt" />
              <Button onClick={() => void patch({ username: name.trim() })} disabled={saving || !nameMsg?.ok}>Save</Button>
            </div>
            {nameMsg && <p className={cn("mt-1.5 text-xs", nameMsg.ok ? "text-mint" : "text-flare")}>{nameMsg.text}</p>}
          </Section>

          <Section title="Avatar">
            <div className="grid grid-cols-8 gap-1.5">
              {ALL_AVATARS.map((a) => (
                <button key={a} type="button" onClick={() => void patch({ avatar: a })} aria-label={`Avatar ${a}`} aria-pressed={player.avatar === a} className={cn("press rounded-xl p-1", player.avatar === a ? "bg-volt/30 ring-2 ring-volt" : "bg-white/5")}>
                  <Avatar id={a} size={34} />
                </button>
              ))}
            </div>
          </Section>

          <Section title="Country" hint="Used only for country leaderboards. We never store your location.">
            <select value={player.country ?? ""} onChange={(e) => void patch({ country: e.target.value || null })} className="h-12 w-full rounded-2xl border border-line-strong bg-surface-2 px-3 font-semibold" aria-label="Country">
              <option value="">🏳️ Not set</option>
              {COUNTRY_CODES.map((c) => (
                <option key={c} value={c}>{flagEmoji(c)} {countryName(c)}</option>
              ))}
            </select>
          </Section>

          <Section title="Account" hint={player.hasAccount ? "Your progress is saved to your account." : "Sign in to keep your scores on every device. Your guest progress comes with you."}>
            {player.hasAccount ? (
              <div className="flex items-center justify-between rounded-2xl bg-mint/10 px-4 py-3 text-sm text-mint">
                ✓ Signed in
                <button type="button" className="font-bold underline" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); setPlayer(null); void refresh(); }}>Sign out</button>
              </div>
            ) : authConfigured() ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email" className="h-12 flex-1 rounded-2xl border border-line-strong bg-surface-2 px-4 outline-none focus:border-volt" />
                  <Button onClick={async () => { try { await signInWithEmail(email); setAuthMsg("Check your inbox for a sign-in link ✉️"); } catch { setAuthMsg("Couldn't send the link."); } }}>Send link</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="light" onClick={() => void signInWithProvider("google")}>Google</Button>
                  <Button variant="light" onClick={() => void signInWithProvider("apple")}> Apple</Button>
                </div>
                {authMsg && <p className="text-xs text-muted">{authMsg}</p>}
              </div>
            ) : (
              <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-muted">Accounts (email, Google, Apple) are not enabled on this server yet. Your progress is saved to this device.</p>
            )}
          </Section>
        </>
      )}

      <Section title="Preferences">
        <Toggle label="🔊 Sound" on={sound} onChange={(v) => { setSound(v); getAudio().setMuted(!v); }} />
        <Toggle label="📳 Haptics (supported phones)" on={haptic} onChange={(v) => { setHaptic(v); setHapticsEnabled(v); }} />
      </Section>

      {player && (
        <Section title="Privacy & data" hint="Camera and microphone games process everything on your device. Nothing is recorded or uploaded.">
          <div className="flex flex-wrap gap-2">
            <a href="/api/me/export" className={buttonClass("secondary", "sm")}>⬇ Export my data</a>
            <Link href="/privacy" className={buttonClass("secondary", "sm")}>Privacy policy</Link>
            {!confirmDelete ? (
              <Button variant="ghost" size="sm" className="text-flare" onClick={() => setConfirmDelete(true)}>Delete account</Button>
            ) : (
              <Button variant="danger" size="sm" onClick={async () => { await api("/api/me", { method: "DELETE" }); setPlayer(null); router.replace("/"); router.refresh(); }}>
                Permanently delete everything
              </Button>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-[22px] border border-line bg-surface p-4">
      <h2 className="font-display text-base font-black uppercase">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2 text-sm font-semibold">
      {label}
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn("relative h-7 w-12 rounded-full transition", on ? "bg-volt" : "bg-white/15")}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6 bg-black" : "left-1")} />
      </button>
    </label>
  );
}
