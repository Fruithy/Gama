"use client";

import { useState } from "react";

/**
 * Single-series bar chart (SVG). One hue (magnitude, not identity) so no
 * legend — the title names the series. Thin bars with 4px rounded data-ends
 * on the baseline, a 2px gap between bars, a recessive grid, a hover tooltip
 * with a large hit target, and a table view for screen readers / exact values.
 */
export function BarChart({
  title,
  data,
  format = (v) => v.toLocaleString("en-US"),
  height = 180,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  format?: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = height;
  const pad = { l: 40, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(36, slot - 2));
  const ticks = [0, 0.5, 1].map((f) => f * nice);
  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{title}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
          {ticks.map((t) => {
            const y = pad.t + plotH - (t / nice) * plotH;
            return (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
                <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9a9aa6">
                  {format(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / nice) * plotH;
            const x = pad.l + i * slot + (slot - barW) / 2;
            const y = pad.t + plotH - h;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* hit target: full slot height */}
                <rect x={pad.l + i * slot} y={pad.t} width={slot} height={plotH} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${pad.t + plotH} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${pad.t + plotH} Z`}
                    fill={hover === i ? "#e6ff7a" : "#d4ff3a"}
                  />
                )}
                <text x={pad.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#9a9aa6">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-line-strong bg-surface-3 px-2 py-1 text-xs shadow-lg"
            style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`, top: 0 }}
          >
            <span className="text-muted">{data[hover].label}</span> <b className="text-text">{format(data[hover].value)}</b>
          </div>
        )}
      </div>
      <details className="mt-1 text-xs text-muted">
        <summary className="cursor-pointer">Table view</summary>
        <table className="mt-1 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td className="text-right tabular">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
