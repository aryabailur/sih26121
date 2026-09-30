"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import type { OpenOffsets } from "@/lib/types";
import { fmtDepth, fmtNum } from "@/lib/utils";

const H = 420;
const L = 50;
const T = 16;
const B = 34;
const BIN = 500;

/**
 * The mud-weight window the offsets actually drilled: every mud weight they ran (dots), every leak-off test at a
 * casing shoe (triangles), and per 500 m the corridor between the heaviest mud an offset needed and the weakest
 * leak-off an offset measured — the real-data counterpart of the Assam offset-calibrated window.
 */
export function MudWindowScatter({ data, width }: { data: OpenOffsets; width: number }) {
  const { mud, lot, bands, dmax } = useMemo(() => {
    const mud = data.offset_mud;
    const lot = data.offset_lot;
    const hiMw = new Map<number, number>();
    for (const m of mud) {
      const b = Math.floor(m.md / BIN) * BIN;
      hiMw.set(b, Math.max(hiMw.get(b) ?? 0, m.mud_weight));
    }
    const loLot = new Map<number, number>();
    for (const l of lot) {
      const b = Math.floor(l.md / BIN) * BIN;
      loLot.set(b, Math.min(loLot.get(b) ?? 9, l.lot));
    }
    const bands = [...hiMw.keys()]
      .filter((b) => loLot.has(b))
      .sort((a, b) => a - b)
      .map((b) => ({ d: b, mw: hiMw.get(b)!, lot: loLot.get(b)! }));
    const deepest = Math.max(1000, ...mud.map((m) => m.md), ...lot.map((l) => l.md), ...data.focus_mud.map((m) => m.md));
    return { mud, lot, bands, dmax: Math.ceil(deepest / 500) * 500 };
  }, [data]);
  const lo = 0.95;
  const hi = 2.25;
  const x = (v: number) => L + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (width - L - 12);
  const y = (d: number) => T + (d / dmax) * (H - T - B);
  const xt = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2];
  const yt = Array.from({ length: dmax / 500 + 1 }, (_, i) => i * 500);
  const tight = bands.filter((b) => b.lot > b.mw).sort((a, b) => a.lot - a.mw - (b.lot - b.mw))[0];

  return (
    <div>
      <svg width={width} height={H} className="block select-none">
        {yt.map((d) => (
          <g key={d}>
            <line x1={L} x2={width - 12} y1={y(d)} y2={y(d)} stroke="var(--chart-grid)" />
            <text x={L - 6} y={y(d) + 4} textAnchor="end" className="fill-[var(--chart-tick)] font-mono text-[11px]">
              {d.toLocaleString("en-IN")}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={T} y2={H - B} stroke="var(--chart-grid)" />
            <text x={x(v)} y={H - B + 16} textAnchor="middle" className="fill-[var(--chart-tick)] font-mono text-[11px]">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={width - 12} y={H - 4} textAnchor="end" className="fill-[var(--chart-tick)] text-[11px] font-semibold">
          sg (equivalent density)
        </text>
        {/* per 500 m: the common window (green) — or red where one offset needed heavier mud than another's leak-off */}
        {bands.map((b, i) => {
          const ok = b.lot > b.mw;
          const a = Math.min(b.mw, b.lot);
          const z = Math.max(b.mw, b.lot);
          return (
            <motion.rect
              key={b.d}
              x={x(a)}
              y={y(b.d) + 1}
              width={Math.max(3, x(z) - x(a))}
              height={y(b.d + BIN) - y(b.d) - 2}
              fill={ok ? "var(--low)" : "var(--crit)"}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: ok ? (tight?.d === b.d ? 0.42 : 0.22) : 0.16, scaleX: 1 }}
              style={{ transformOrigin: `${x(a)}px ${y(b.d)}px` }}
              transition={{ delay: 0.2 + i * 0.07, duration: 0.5 }}
            >
              <title>{`${fmtDepth(b.d)}–${fmtDepth(b.d + BIN)}: heaviest offset mud ${fmtNum(b.mw, 2)} sg · weakest leak-off ${fmtNum(b.lot, 2)} sg${ok ? "" : " — offsets overlap"}`}</title>
            </motion.rect>
          );
        })}
        {mud.map((m, i) => (
          <circle key={i} cx={x(m.mud_weight)} cy={y(m.md)} r={2.2} fill="var(--ink-4)" opacity={0.4}>
            <title>{`${m.well}: ${fmtNum(m.mud_weight, 2)} sg at ${fmtDepth(m.md)}`}</title>
          </circle>
        ))}
        {lot.map((l, i) => (
          <path key={i} d={`M${x(l.lot)},${y(l.md) - 5} l5,9 l-10,0 z`} fill="var(--high)" opacity={0.85} stroke="var(--surface)" strokeWidth={1}>
            <title>{`${l.well}: leak-off ${fmtNum(l.lot, 2)} sg at the ${l.casing ?? ""}" shoe, ${fmtDepth(l.md)}`}</title>
          </path>
        ))}
        {data.focus_mud.length > 1 && <polyline points={data.focus_mud.map((m) => `${x(m.mud_weight)},${y(m.md)}`).join(" ")} fill="none" stroke="var(--brand)" strokeWidth={2.5} />}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ink-4" /> Mud weight run ({mud.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-high" /> Leak-off test ({lot.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[1px] bg-low/40" /> Common window: heaviest mud → weakest leak-off
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[1px] bg-crit/25" /> Offsets overlap
        </span>
        {data.focus_mud.length > 1 && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-brand" /> {data.focus.name}
          </span>
        )}
      </div>
      {tight && (
        <p className="mt-2 text-[12.5px] leading-snug text-ink-2">
          Tightest band: <b className="text-ink">{fmtDepth(tight.d)}–{fmtDepth(tight.d + BIN)}</b> — offsets needed up to <b className="text-ink">{fmtNum(tight.mw, 2)} sg</b> while the weakest
          leak-off there was <b className="text-ink">{fmtNum(tight.lot, 2)} sg</b>. That is the interval to plan casing and ECD around.
        </p>
      )}
    </div>
  );
}
