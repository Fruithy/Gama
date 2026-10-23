/** Number formatting for idle-sized numbers (1.23K … 4.56Dc, then 7.8e36). */

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
const SI = ["", "k", "M", "G", "T", "P", "E", "Z", "Y", "R", "Q"];

function sig(n: number, digits: number) {
  // n is in [1, 1000): keep `digits` significant digits, never round up to "1000".
  const decimals = Math.max(0, digits - (n >= 100 ? 3 : n >= 10 ? 2 : 1));
  const f = Math.pow(10, decimals);
  return (Math.floor(n * f) / f).toFixed(decimals);
}

export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "∞";
  if (n < 0) return `-${fmt(-n, digits)}`;
  if (n < 1000) {
    if (n === 0) return "0";
    if (n < 10) return (Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return Math.floor(n).toString();
  }
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) {
    const exp = Math.floor(Math.log10(n));
    return `${sig(n / Math.pow(10, exp), digits)}e${exp}`;
  }
  return `${sig(n / Math.pow(1000, tier), digits)}${SUFFIXES[tier]}`;
}

/** H/s with SI prefixes: 120 kH/s, 4.2 TH/s. */
export function fmtHash(hps: number): string {
  if (!(hps > 0)) return "0 H/s";
  const tier = Math.min(SI.length - 1, Math.max(0, Math.floor(Math.log10(hps) / 3)));
  const v = hps / Math.pow(1000, tier);
  if (v >= 1000) return `${fmt(hps)} H/s`;
  return `${sig(v, 3)} ${SI[tier]}H/s`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Deterministic fake block hash for display: 0x3f9a…c21e. */
export function blockHash(height: number): string {
  let x = (height * 2654435761) >>> 0;
  let out = "";
  for (let i = 0; i < 8; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out += (x & 0xffff).toString(16).padStart(4, "0");
  }
  return `0x0000${out.slice(0, 4)}…${out.slice(-4)}`;
}
