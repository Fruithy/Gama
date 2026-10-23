import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

/** Homepage card for NEON RIG, the idle mining game (/mine). Pure CSS art — no game code on the homepage. */
export function IdlePromo() {
  return (
    <section className="mt-8 px-4 sm:px-0" aria-label="Idle game">
      <Link
        href="/mine"
        className="press noise group relative block overflow-hidden rounded-[28px] border border-white/10 p-5 sm:p-7"
        style={{ background: "radial-gradient(90% 120% at 82% 40%, #3b1d8f 0%, #170b45 45%, #07051a 100%)" }}
      >
        <div className="pointer-events-none absolute right-[-30px] top-1/2 h-[220px] w-[220px] -translate-y-1/2 sm:right-10" aria-hidden="true">
          <div className="absolute inset-0 rounded-full bg-[#8b5cff]/40 blur-3xl" />
          <div className="absolute inset-[22%] animate-[spin_14s_linear_infinite] rounded-full border border-dashed border-[#3dd8ff]/50" />
          <div className="absolute inset-[6%] animate-[spin_22s_linear_infinite_reverse] rounded-full border border-[#e85dff]/30 [transform:rotateX(70deg)]" />
          <div className="absolute inset-[38%] rotate-45 rounded-[22%] bg-gradient-to-br from-white via-[#c9b6ff] to-[#6a3dff] shadow-[0_0_60px_10px_rgba(160,120,255,0.7)] transition-transform duration-500 group-hover:scale-110" />
          <span className="absolute left-[8%] top-[20%] h-2 w-2 rounded-full bg-[#ffc23d] shadow-[0_0_12px_#ffc23d]" />
          <span className="absolute bottom-[18%] right-[12%] h-2.5 w-2.5 rounded-sm bg-[#3dffb0] shadow-[0_0_12px_#3dffb0]" />
          <span className="absolute right-[4%] top-[42%] h-1.5 w-1.5 rounded-full bg-[#ff3d7f] shadow-[0_0_10px_#ff3d7f]" />
        </div>
        <div className="relative max-w-[62%] sm:max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#3dd8ff] backdrop-blur">
            ✦ New · Idle
          </span>
          <h2 className="mt-2 font-display text-[34px] font-black uppercase leading-[0.9] sm:text-5xl">Neon Rig</h2>
          <p className="mt-2 text-sm text-white/75">Idle crypto mining made of pure eye candy. Build rigs, seal blocks, catch whale comets — it keeps hashing while you&apos;re away.</p>
          <span className={buttonClass("light", "md", "mt-4")}>⛏️ Start mining</span>
        </div>
      </Link>
    </section>
  );
}
