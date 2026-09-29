"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/** Axis-less trend line for stat tiles: gradient area, ringed end dot, hover readout. */
export function Sparkline({
  values,
  depths,
  color = "var(--brand)",
  width = 120,
  height = 28,
  format = (v: number) => v.toFixed(1),
  className,
  fluid = false,
}: {
  values: number[];
  depths?: number[];
  color?: string;
  width?: number;
  height?: number;
  format?: (v: number) => string;
  className?: string;
  /** Fill the container width (measured) instead of the fixed `width`. */
  fluid?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    if (!fluid || !box.current) return;
    const ro = new ResizeObserver(([e]) => setMeasured(Math.round(e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [fluid]);
  const w = fluid && measured ? measured : width;
  const geo = useMemo(() => {
    if (values.length < 2) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || Math.abs(hi) * 0.05 || 1;
    const pad = 4;
    const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - pad * 2), pad + (1 - (v - lo) / span) * (height - pad * 2)]);
    // Smooth path (Catmull-Rom → cubic Bézier) for a calmer line.
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    const area = `${d} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
    return { pts, d, area };
  }, [values, w, height]);

  if (!geo) return <div ref={box} className={className} style={{ width: fluid ? "100%" : width, height }} />;
  const last = geo.pts[geo.pts.length - 1];
  const hp = hover !== null ? geo.pts[hover] : null;

  return (
    <div ref={box} className={className} style={{ position: "relative", width: fluid ? "100%" : width, height }}>
      <svg
        width={w}
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
        <defs>
          <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#sg-${id})`} />
        <path d={geo.d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r={5.5} fill={color} opacity={0.25} className="animate-breathe" />
        <circle cx={last[0]} cy={last[1]} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
        {hp && (
          <>
            <line x1={hp[0]} x2={hp[0]} y1={0} y2={height} stroke="var(--chart-cursor)" strokeWidth={1} />
            <circle cx={hp[0]} cy={hp[1]} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-ink px-2 py-1 font-mono text-[11.5px] font-medium text-surface shadow-md">
          {format(values[hover])}
          {depths?.[hover] !== undefined && <span className="opacity-60"> @ {Math.round(depths[hover])} m</span>}
        </div>
      )}
    </div>
  );
}
