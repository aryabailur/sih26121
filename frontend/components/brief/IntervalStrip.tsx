"use client";

import { motion } from "motion/react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import type { LookAheadBrief } from "@/lib/types";
import { clamp, cn, FAMILY_META, fmtDepth, formationColor, SEVERITY_STYLE } from "@/lib/utils";

/** The interval ahead on one ruler: formations, hazard windows (lane-stacked), casing shoes and the bit. */
export function IntervalStrip({ brief }: { brief: LookAheadBrief }) {
  const { start, end } = brief.window;
  const span = Math.max(1, end - start);
  const pos = (d: number) => ((clamp(d, start, end) - start) / span) * 100;
  const step = span <= 200 ? 25 : span <= 400 ? 50 : span <= 800 ? 100 : 200;
  const ticks: number[] = [];
  for (let d = Math.ceil(start / step) * step; d <= end; d += step) ticks.push(d);

  // Greedy lanes so overlapping windows (e.g. kick 3,580 / losses 3,600) stack instead of colliding.
  const laneEnds: number[] = [];
  const placed = brief.hazards.map((h) => {
    let lane = laneEnds.findIndex((e) => e + span * 0.16 < h.window.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(h.window.end);
    } else laneEnds[lane] = h.window.end;
    return { h, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  const LANE = 44;

  return (
    <div className="select-none">
      {/* hazard lanes */}
      <div className="relative" style={{ height: lanes * LANE + 6 }}>
        {placed.map(({ h, lane }, i) => {
          const fam = FAMILY_META[h.risk_type];
          const left = pos(h.window.start);
          const width = Math.max(1.2, pos(h.window.end) - left);
          const sev = SEVERITY_STYLE[h.projected.severity];
          return (
            <motion.div
              key={h.zone_id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 260, damping: 24 }}
              className="absolute"
              style={{ left: `${left}%`, top: lane * LANE, width: `${width}%`, height: LANE - 6 }}
            >
              <div className="absolute bottom-0 left-0 top-[22px] w-full rounded-[2px] border-t-[3px]" style={{ borderColor: fam.color, background: `color-mix(in oklab, ${fam.color} 16%, transparent)` }} />
              <div className={cn("absolute top-0 flex items-center gap-1.5 whitespace-nowrap text-[12px] font-bold text-ink", left > 62 ? "right-0" : "left-0")}>
                <FamilyIcon family={h.risk_type} size={13} />
                {fam.label}
                <span className="font-mono text-[11.5px] font-semibold text-ink-3">{fmtDepth(h.window.start)}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: sev.hex }} title={`Projected ${sev.label}`} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* formations + casing + bit */}
      <div className="relative h-9 overflow-hidden rounded-[3px] bg-surface-3">
        {brief.formations.map((f, i) => {
          const left = pos(f.top_md);
          const width = pos(f.base_md) - left;
          if (width <= 0) return null;
          return (
            <motion.div
              key={f.name}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute inset-y-0 origin-left"
              style={{ left: `${left}%`, width: `${width}%`, background: formationColor(f.name) }}
            >
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 truncate rounded-[2px] bg-black/55 px-1.5 py-px text-[11.5px] font-bold text-white" style={{ maxWidth: "calc(100% - 12px)" }}>
                {f.name}
              </span>
            </motion.div>
          );
        })}
        <div className="absolute inset-y-0 left-0 w-[3px] bg-brand" />
      </div>
      {brief.casing.some((c) => c.in_window) && (
        <div className="relative h-8">
          {brief.casing
            .filter((c) => c.in_window)
            .map((c) => (
              <div key={c.name} className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-center" style={{ left: `${pos(c.shoe_md)}%` }} title={`${c.size} ${c.name} shoe at ${fmtDepth(c.shoe_md)}${c.planned ? " (planned)" : ""}`}>
                <div className="mx-auto h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-ink" />
                <div className="text-[11.5px] font-bold text-ink-2">
                  {c.size} shoe <span className="font-mono font-semibold">{fmtDepth(c.shoe_md)}</span>
                </div>
              </div>
            ))}
        </div>
      )}
      <div className="relative h-7">
        {ticks.map((d) => (
          <div key={d} className="absolute top-0 -translate-x-1/2" style={{ left: `${pos(d)}%` }}>
            <div className="mx-auto h-1.5 w-px bg-line-2" />
            <div className="font-mono text-[11px] text-ink-3">{d.toLocaleString("en-IN")}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[12px] font-semibold text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Bit now · {fmtDepth(start)}
        </span>
        <span>{fmtDepth(end)} · end of look-ahead (m MD)</span>
      </div>
    </div>
  );
}
