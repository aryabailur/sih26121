"use client";

import { useMemo, useState } from "react";
import { CHART } from "@/lib/utils";

/** Axis-less trend line for stat tiles: 2px line, ringed end dot, hover readout. */
export function Sparkline({
  values,
  depths,
  color = "#38bdf8",
  width = 120,
  height = 28,
  format = (v: number) => v.toFixed(1),
}: {
  values: number[];
  depths?: number[];
  color?: string;
  width?: number;
  height?: number;
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    if (values.length < 2) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || Math.abs(hi) * 0.05 || 1;
    const pad = 4;
    const pts = values.map((v, i) => [
      pad + (i / (values.length - 1)) * (width - pad * 2),
      pad + (1 - (v - lo) / span) * (height - pad * 2),
    ]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `${d} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
    return { pts, d, area };
  }, [values, width, height]);

  if (!geo) return <div style={{ width, height }} />;
  const last = geo.pts[geo.pts.length - 1];
  const hp = hover !== null ? geo.pts[hover] : null;

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (values.length - 1));
          setHover(Math.max(0, Math.min(values.length - 1, i)));
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Trend of last ${values.length} readings, latest ${format(values[values.length - 1])}`}
      >
        <path d={geo.area} fill={color} opacity={0.1} />
        <path d={geo.d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} stroke={CHART.surface} strokeWidth={2} />
        {hp && (
          <>
            <line x1={hp[0]} x2={hp[0]} y1={0} y2={height} stroke={CHART.axis} strokeWidth={1} />
            <circle cx={hp[0]} cy={hp[1]} r={3.5} fill={color} stroke={CHART.surface} strokeWidth={2} />
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="glass-strong pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
          {format(values[hover])}
          {depths?.[hover] !== undefined && <span className="text-cockpit-dim"> @ {Math.round(depths[hover])} m</span>}
        </div>
      )}
    </div>
  );
}
