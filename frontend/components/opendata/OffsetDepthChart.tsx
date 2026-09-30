"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import type { OpenEvent, OpenWellCard } from "@/lib/types";
import { FAMILY_META, fmtDepth } from "@/lib/utils";
import { groupColor, unitLabel } from "./palette";

const H = 440;
const TOP = 46;
const AXIS = 54;

/** Real offsets side by side on one depth axis: their lithostratigraphic groups and the problems their histories report. */
export function OffsetDepthChart({
  focus,
  focusGroups,
  offsets,
  events,
  selected,
  onSelect,
  width,
}: {
  focus: OpenWellCard;
  focusGroups: { name: string; top_md: number; base_md: number | null }[];
  offsets: OpenWellCard[];
  events: OpenEvent[];
  selected: string | null;
  onSelect: (key: string) => void;
  width: number;
}) {
  const cols = useMemo(() => {
    const withEvents = offsets.filter((o) => events.some((e) => e.well === o.name));
    return [{ card: focus, groups: focusGroups, isFocus: true }, ...withEvents.slice(0, 13).map((o) => ({ card: o, groups: o.groups ?? [], isFocus: false }))];
  }, [focus, focusGroups, offsets, events]);
  const maxDepth = Math.max(
    1000,
    ...cols.map((c) => c.card.total_depth_md ?? 0),
    ...events.map((e) => e.depth_end ?? e.depth_start ?? 0),
  );
  const dmax = Math.ceil((maxDepth + 100) / 500) * 500;
  const y = (d: number) => TOP + (d / dmax) * (H - TOP - 14);
  const colW = Math.max(46, (width - AXIS) / cols.length);
  const x = (i: number) => AXIS + i * colW + colW / 2;
  const ticks = Array.from({ length: dmax / 500 + 1 }, (_, i) => i * 500);
  const legend = Array.from(new Set(cols.flatMap((c) => c.groups.map((g) => g.name)))).filter((g) => g !== "NO GROUP DEFINED" && g !== "UNDEFINED GP");

  return (
    <div>
      <svg width={width} height={H} className="block select-none">
        {ticks.map((d) => (
          <g key={d}>
            <line x1={AXIS - 4} x2={width} y1={y(d)} y2={y(d)} stroke="var(--chart-grid)" />
            <text x={AXIS - 8} y={y(d) + 4} textAnchor="end" className="fill-[var(--chart-tick)] font-mono text-[11px]">
              {d.toLocaleString("en-IN")}
            </text>
          </g>
        ))}
        <text x={8} y={TOP - 18} className="fill-[var(--chart-tick)] text-[11px] font-semibold">
          m MD
        </text>
        {cols.map((c, i) => {
          const cx = x(i);
          const bw = Math.min(26, colW * 0.42);
          const td = c.card.total_depth_md ?? dmax;
          return (
            <g key={c.card.name}>
              <text x={cx} y={16} textAnchor="middle" className={c.isFocus ? "fill-[var(--brand-ink)] font-mono text-[11px] font-bold" : "fill-[var(--ink)] font-mono text-[11px] font-semibold"}>
                {c.card.name}
              </text>
              <text x={cx} y={30} textAnchor="middle" className="fill-[var(--ink-3)] text-[11px]">
                {c.isFocus ? "focus" : (c.card.distance_km ?? 0) < 0.05 ? "same well" : `${c.card.distance_km?.toFixed(1)} km`}
              </text>
              <rect x={cx - bw / 2} y={y(0)} width={bw} height={y(td) - y(0)} fill="var(--surface-3)" rx={1} />
              {c.groups.map((g, gi) => (
                <motion.rect
                  key={`${g.name}-${g.top_md}`}
                  x={cx - bw / 2}
                  width={bw}
                  y={y(g.top_md)}
                  height={Math.max(1, y(g.base_md ?? td) - y(g.top_md))}
                  fill={groupColor(g.name)}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 0.9, scaleY: 1 }}
                  style={{ transformOrigin: `${cx}px ${y(0)}px` }}
                  transition={{ delay: i * 0.05 + gi * 0.03, duration: 0.5 }}
                >
                  <title>{`${unitLabel(g.name)} ${fmtDepth(g.top_md)}–${fmtDepth(g.base_md)}`}</title>
                </motion.rect>
              ))}
              {c.isFocus && <rect x={cx - bw / 2 - 3} y={y(0) - 3} width={bw + 6} height={y(td) - y(0) + 6} fill="none" stroke="var(--brand)" strokeWidth={2} rx={2} />}
              {events
                .filter((e) => e.well === c.card.name && e.depth_start !== null)
                .map((e, k) => {
                  const col = FAMILY_META[e.family]?.color ?? "#8b93a7";
                  const on = selected === e.key;
                  const cy = y(e.depth_start ?? 0);
                  const s = on ? 9 : 7;
                  return (
                    <motion.g
                      key={e.key}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.05 + k * 0.05, type: "spring", stiffness: 420, damping: 16 }}
                      style={{ transformOrigin: `${cx}px ${cy}px`, cursor: "pointer" }}
                      onClick={() => onSelect(e.key)}
                    >
                      {on && <circle cx={cx} cy={cy} r={15} fill="none" stroke={col} strokeWidth={2} className="animate-pulse" />}
                      <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} transform={`rotate(45 ${cx} ${cy})`} fill={col} stroke="#fff" strokeWidth={2} rx={1.5} />
                      <title>{`${e.label} · ${fmtDepth(e.depth_start)} · ${e.formation ?? ""}\n${e.sentence}`}</title>
                    </motion.g>
                  );
                })}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-2">
        {legend.map((g) => (
          <span key={g} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px]" style={{ background: groupColor(g) }} />
            {unitLabel(g)}
          </span>
        ))}
      </div>
    </div>
  );
}
