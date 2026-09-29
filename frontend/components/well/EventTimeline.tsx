"use client";

import { motion } from "motion/react";
import { useRef } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import type { DrillingEvent, Formation } from "@/lib/types";
import { clamp, cn, EVENT_LABELS, FAMILY_META, familyOf, fmtDepth, formationColor, SEVERITY_STYLE } from "@/lib/utils";

/**
 * Vertical depth column: formation strata + depth-aligned event tags, with the active-well bit
 * depth as a cursor. Clicking the column moves the bit (vertical scrubber).
 */
export function EventTimeline({
  formations,
  events,
  domain,
  depth,
  onDepth,
  activeFormations,
  selectedEventId,
  onSelectEvent,
  className,
  header = 0,
}: {
  /** Reserve this many px on top for column headings (aligns the depth axis with neighbouring charts). */
  header?: number;
  formations: Formation[];
  events: DrillingEvent[];
  domain: [number, number];
  depth: number;
  onDepth?: (d: number) => void;
  activeFormations?: Formation[];
  selectedEventId?: string | null;
  onSelectEvent?: (e: DrillingEvent) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [lo, hi] = domain;
  const shown = events.filter((e) => e.depth_end >= lo && e.depth_start <= hi);
  const y = (d: number) => `${((clamp(d, lo, hi) - lo) / (hi - lo)) * 100}%`;
  const h = (a: number, b: number) => `${((clamp(b, lo, hi) - clamp(a, lo, hi)) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  const step = hi - lo > 2000 ? 500 : 100;
  for (let d = Math.ceil(lo / step) * step; d <= hi; d += step) ticks.push(d);

  // Greedy lane assignment: a second lane only where labels would collide vertically.
  const minGap = (hi - lo) * 0.04;
  const laneEnd = [-Infinity, -Infinity];
  const lanes = new Map<string, number>();
  for (const e of [...shown].sort((a, b) => a.depth_start - b.depth_start)) {
    const lane = e.depth_start >= laneEnd[0] + minGap ? 0 : e.depth_start >= laneEnd[1] + minGap ? 1 : 0;
    laneEnd[lane] = Math.max(e.depth_start, e.depth_end);
    lanes.set(e.id, lane);
  }

  const setFromY = (clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !onDepth) return;
    onDepth(Math.round((lo + clamp((clientY - r.top) / r.height, 0, 1) * (hi - lo)) / 5) * 5);
  };

  return (
    <div className={cn("relative flex h-full select-none", className)} style={header ? { paddingTop: header } : undefined}>
      {header > 0 && (
        <div className="absolute inset-x-0 top-0 flex items-end gap-0 pb-2 text-[12px] font-bold text-ink-3" style={{ height: header }}>
          <span className="w-11 shrink-0 pr-1.5 text-right">m MD</span>
          <span className="w-[64px] shrink-0 pl-2">Strata</span>
          <span className="flex-1 pl-2">Events</span>
        </div>
      )}
      {/* depth axis */}
      <div className="relative w-11 shrink-0">
        {ticks.map((t) => (
          <span key={t} className="absolute right-1.5 -translate-y-1/2 font-mono text-[11px] font-medium text-ink-4" style={{ top: y(t) }}>
            {t.toLocaleString("en-IN")}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        className={cn("relative flex-1 overflow-hidden rounded-[3px] bg-surface-2 ring-1 ring-inset ring-line", onDepth && "cursor-ns-resize")}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          setFromY(e.clientY);
        }}
        onPointerMove={(e) => e.buttons === 1 && setFromY(e.clientY)}
        title={onDepth ? "Click or drag to move the active well's bit depth" : undefined}
      >
        {/* strata */}
        <div className="absolute inset-y-0 left-0 w-[64px]">
          {formations.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="absolute inset-x-0 overflow-hidden border-b-2 border-surface-2 px-1 pt-1"
              style={{ top: y(f.top_md), height: h(f.top_md, f.base_md), background: `linear-gradient(90deg, ${formationColor(f.name)}, color-mix(in oklab, ${formationColor(f.name)} 78%, white))` }}
            >
              <div className="inline-flex max-w-full flex-col rounded-[2px] bg-[#0c0e14]/55 px-1 py-px leading-tight">
                <span className="truncate text-[11.5px] font-extrabold text-white">{f.name.split(" ")[0]}</span>
                <span className="whitespace-nowrap font-mono text-[11px] font-medium text-white/90">{fmtDepth(f.top_md)}</span>
              </div>
            </motion.div>
          ))}
        </div>
        {/* active well formation tops (correlation overlay) */}
        {activeFormations?.map((f) =>
          f.top_md > lo && f.top_md < hi ? (
            <div key={f.id} className="pointer-events-none absolute left-[64px] right-0 border-t-2 border-dashed border-brand/50" style={{ top: y(f.top_md) }}>
              <span className="absolute -top-4 right-1 font-mono text-[11px] font-semibold text-brand-ink">
                AX-102 {f.name.split(" ")[0]} {Math.round(f.top_md)}
              </span>
            </div>
          ) : null,
        )}
        {/* event tags */}
        <div className="absolute inset-y-0 left-[69px] right-1">
          {shown.map((e) => {
            const fam = familyOf(e.event_type);
            const c = FAMILY_META[fam].color;
            const lane = lanes.get(e.id) ?? 0;
            const sel = selectedEventId === e.id;
            return (
              <button
                key={e.id}
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={() => onSelectEvent?.(e)}
                className={cn("absolute flex items-start gap-1 text-left", sel && "z-10")}
                style={{ top: y(e.depth_start), left: lane ? "50%" : 0, right: lane ? 0 : Array.from(lanes.values()).includes(1) ? "50%" : 0 }}
                title={`${e.title} · ${fmtDepth(e.depth_start)}–${fmtDepth(e.depth_end)}`}
              >
                <span className="mt-0.5 w-1 shrink-0 rounded-[1px]" style={{ height: `max(8px, ${h(e.depth_start, e.depth_end)})`, background: c }} />
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1 rounded-[2px] py-0.5 pl-0.5 pr-1.5 text-[11.5px] font-semibold leading-tight shadow-sm transition-all",
                    sel ? "bg-brand text-white ring-2 ring-brand/30" : "bg-surface text-ink-2 hover:scale-[1.03]",
                  )}
                  style={!sel && (e.severity === "critical" || e.severity === "high") ? { boxShadow: `0 0 0 1.5px ${SEVERITY_STYLE[e.severity].hex}` } : undefined}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white">
                    <FamilyIcon family={fam} size={10} />
                  </span>
                  <span className={cn("hidden truncate 2xl:inline", Array.from(lanes.values()).includes(1) && "2xl:hidden")}>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                  <span className={cn("font-mono", sel ? "text-white" : "text-ink-3")}>{Math.round(e.depth_start)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {/* bit depth cursor */}
        {depth >= lo && depth <= hi && (
          <motion.div className="pointer-events-none absolute inset-x-0 z-20" initial={false} animate={{ top: y(depth) }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
            <div className="h-[3px] rounded-[1px] bg-brand shadow-[0_0_12px_var(--brand)]" />
            <span className="absolute -top-5 left-1.5 rounded-[2px] bg-brand px-2 py-px font-mono text-[11px] font-semibold text-white shadow-brand">bit {fmtDepth(depth)}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
