"use client";

import { useRef } from "react";
import { SeverityGlyph } from "@/components/shared/StatusBadge";
import type { DrillingEvent, Formation } from "@/lib/types";
import { clamp, cn, EVENT_LABELS, FAMILY_META, familyOf, fmtDepth, formationColor } from "@/lib/utils";

/**
 * Vertical depth column: formation bands + depth-aligned event markers, with the
 * active-well bit depth as a cursor. Clicking the column moves the bit (vertical scrubber).
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
}: {
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
  events = events.filter((e) => e.depth_end >= lo && e.depth_start <= hi);
  const y = (d: number) => `${((clamp(d, lo, hi) - lo) / (hi - lo)) * 100}%`;
  const h = (a: number, b: number) => `${((clamp(b, lo, hi) - clamp(a, lo, hi)) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  const step = hi - lo > 2000 ? 500 : 100;
  for (let d = Math.ceil(lo / step) * step; d <= hi; d += step) ticks.push(d);

  // Greedy lane assignment: a second lane only where labels would collide vertically.
  const minGap = (hi - lo) * 0.035;
  const laneEnd = [-Infinity, -Infinity];
  const lanes = new Map<string, number>();
  for (const e of [...events].sort((a, b) => a.depth_start - b.depth_start)) {
    const lane = e.depth_start >= laneEnd[0] + minGap ? 0 : e.depth_start >= laneEnd[1] + minGap ? 1 : 0;
    laneEnd[lane] = Math.max(e.depth_start, e.depth_end);
    lanes.set(e.id, lane);
  }
  const twoLanes = Array.from(lanes.values()).includes(1);

  const setFromY = (clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !onDepth) return;
    onDepth(Math.round((lo + clamp((clientY - r.top) / r.height, 0, 1) * (hi - lo)) / 5) * 5);
  };

  return (
    <div className={cn("relative flex h-full select-none", className)}>
      {/* depth axis */}
      <div className="relative w-11 shrink-0">
        {ticks.map((t) => (
          <span key={t} className="absolute right-1 -translate-y-1/2 font-mono text-[9px] text-cockpit-dim" style={{ top: y(t) }}>
            {t.toLocaleString("en-IN")}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        className={cn("relative flex-1 rounded border border-cockpit-line bg-black/25", onDepth && "cursor-ns-resize")}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setFromY(e.clientY);
        }}
        onPointerMove={(e) => e.buttons === 1 && setFromY(e.clientY)}
        title={onDepth ? "Click or drag to move the active well's bit depth" : undefined}
      >
        {/* formation bands */}
        <div className="absolute inset-y-0 left-0 w-[76px]">
          {formations.map((f) => (
            <div key={f.id} className="absolute inset-x-0 overflow-hidden border-b border-black/50 px-1.5 pt-0.5" style={{ top: y(f.top_md), height: h(f.top_md, f.base_md), background: formationColor(f.name) }}>
              <div className="truncate text-[9.5px] font-semibold leading-tight text-white/85">{f.name}</div>
              <div className="font-mono text-[9px] text-white/55">{fmtDepth(f.top_md)}</div>
            </div>
          ))}
        </div>
        {/* active well formation tops (correlation overlay) */}
        {activeFormations?.map((f) =>
          f.top_md > lo && f.top_md < hi ? (
            <div key={f.id} className="pointer-events-none absolute left-[76px] right-0 border-t border-dashed border-cyan-400/50" style={{ top: y(f.top_md) }}>
              <span className="absolute right-1 -top-3 font-mono text-[9px] text-cyan-300/80">OIL-AX-102 {f.name.split(" ")[0]} {Math.round(f.top_md)}</span>
            </div>
          ) : null,
        )}
        {/* event bars + markers */}
        <div className="absolute inset-y-0 left-[82px] right-1">
          {events.map((e) => {
            const c = FAMILY_META[familyOf(e.event_type)].color;
            const lane = lanes.get(e.id) ?? 0;
            return (
              <button
                key={e.id}
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={() => onSelectEvent?.(e)}
                className={cn("absolute flex items-start gap-1 text-left", selectedEventId === e.id && "z-10")}
                style={{ top: y(e.depth_start), left: lane ? "50%" : 0, right: lane || !twoLanes ? 0 : "50%" }}
                title={`${e.title} · ${fmtDepth(e.depth_start)}–${fmtDepth(e.depth_end)}`}
              >
                <span className="mt-0.5 w-1 shrink-0 rounded-sm" style={{ height: `max(6px, calc(${h(e.depth_start, e.depth_end)} * 1))`, background: c }} />
                <span className={cn("flex min-w-0 items-center gap-1 rounded px-1 py-px text-[10px] leading-tight", selectedEventId === e.id ? "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/50" : "bg-black/50 text-slate-200 hover:bg-black/70")}>
                  <SeverityGlyph severity={e.severity} color={e.severity === "critical" || e.severity === "high" ? undefined : c} size={8} />
                  <span className="truncate">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                  <span className="font-mono text-cockpit-dim">{Math.round(e.depth_start)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {/* bit depth cursor */}
        {depth >= lo && depth <= hi && (
          <div className="pointer-events-none absolute inset-x-0 z-20 transition-[top] duration-300" style={{ top: y(depth) }}>
            <div className="h-0.5 bg-cyan-300 shadow-[0_0_10px_#22d3ee]" />
            <span className="absolute -top-4 left-1 rounded bg-cockpit-bg/90 px-1 font-mono text-[9.5px] text-cyan-200">bit {fmtDepth(depth)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
