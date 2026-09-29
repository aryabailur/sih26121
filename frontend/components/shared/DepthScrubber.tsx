"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LocateFixed, Maximize2, Minimize2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { AnimatedNumber } from "@/components/ui/animated";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, Severity } from "@/lib/types";
import { clamp, cn, FAMILY_META, familyOf, fmtDepth, formationColor, SEVERITY_RANK, SEVERITY_STYLE } from "@/lib/utils";

const SECTION: [number, number] = [2400, 3800];

/** Horizontal depth ruler (Risk explorer): formations, offset events, predicted-risk ribbon, zone register. */
export function DepthScrubber({ className }: { className?: string }) {
  const depth = useNWIS((s) => s.depth);
  const setDepth = useNWIS((s) => s.setDepth);
  const well = useNWIS((s) => s.activeWell);
  const formations = useNWIS((s) => s.formations);
  const profile = useNWIS((s) => s.profile);
  const zones = useNWIS((s) => s.zones);
  const events = useNWIS((s) => s.events);
  const wells = useNWIS((s) => s.wells);
  const radiusKm = useNWIS((s) => s.radiusKm);
  const evaluation = useNWIS((s) => s.evaluation);
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [isDrag, setIsDrag] = useState(false);

  const td = well?.total_depth_md ?? 3800;
  const drilled = well?.current_depth_md ?? 3100;
  const [lo, hi] = full ? [0, td] : SECTION;
  const x = useCallback((d: number) => `${((clamp(d, lo, hi) - lo) / (hi - lo)) * 100}%`, [lo, hi]);
  const w = useCallback((a: number, b: number) => `${((clamp(b, lo, hi) - clamp(a, lo, hi)) / (hi - lo)) * 100}%`, [lo, hi]);

  const inRadius = useMemo(() => new Set(wells.filter((x) => x.distance_km <= radiusKm && x.role === "offset").map((x) => x.id)), [wells, radiusKm]);
  const offsetEvents = useMemo(() => events.filter((e) => inRadius.has(e.well_id) && e.depth_end >= lo && e.depth_start <= hi), [events, inRadius, lo, hi]);
  const profileSegs = useMemo(() => profile.filter((p) => p.depth >= lo && p.depth <= hi && p.score >= 0.35), [profile, lo, hi]);
  const zoneSegs = useMemo(() => zones.filter((z) => z.depth_end >= lo && z.depth_start <= hi), [zones, lo, hi]);

  const depthFromEvent = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return depth;
    return lo + clamp((clientX - r.left) / r.width, 0, 1) * (hi - lo);
  };
  const snap = (d: number) => Math.round(d / 5) * 5;
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 10;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") setDepth(depth + step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setDepth(depth - step);
    else return;
    e.preventDefault();
  };

  const ticks = useMemo(() => {
    const step = full ? 500 : 100;
    const out: number[] = [];
    for (let d = Math.ceil(lo / step) * step; d <= hi; d += step) out.push(d);
    return out;
  }, [lo, hi, full]);

  const nxt = evaluation?.next_risk_zone;
  const currentFm = evaluation?.current_formation ?? formations.find((f) => f.top_md <= depth && depth < f.base_md)?.name;
  const hoverEvents: DrillingEvent[] =
    hover !== null ? offsetEvents.filter((e) => Math.abs((e.depth_start + e.depth_end) / 2 - hover) < (hi - lo) / 60 + (e.depth_end - e.depth_start) / 2) : [];

  const btn = "flex h-8 w-8 items-center justify-center rounded-[3px] bg-surface-3 text-ink-2 transition-all hover:bg-line-2 hover:text-ink active:scale-95";

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] font-bold text-ink-3">Bit depth</span>
        <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-ink">
          <AnimatedNumber value={depth} /> <span className="text-[13.5px] text-ink-3">m MD</span>
        </span>
        {currentFm && (
          <span className="flex items-center gap-1.5 rounded-[2px] px-2.5 py-0.5 text-[12.5px] font-bold text-ink" style={{ background: `color-mix(in oklab, ${formationColor(currentFm)} 16%, transparent)` }}>
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: formationColor(currentFm) }} />
            {currentFm}
          </span>
        )}
        {depth > drilled && <span className="rounded-[2px] bg-surface-3 px-2.5 py-0.5 text-[12px] font-bold text-ink-3">Look-ahead · simulated feed</span>}
        {nxt && (
          <span className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-ink-3 xl:flex">
            <FamilyIcon family={nxt.type} size={13} /> Next: <b className="text-ink">{FAMILY_META[nxt.type].label}</b> at {fmtDepth(nxt.depth)} ·{" "}
            <b className="text-ink">{Math.round(nxt.distance)} m</b> ahead
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {[
            { icon: <ChevronsLeft size={15} />, d: -50, t: "Up 50 m" },
            { icon: <ChevronLeft size={15} />, d: -10, t: "Up 10 m" },
            { icon: <ChevronRight size={15} />, d: 10, t: "Down 10 m" },
            { icon: <ChevronsRight size={15} />, d: 50, t: "Down 50 m" },
          ].map((b) => (
            <button key={b.t} title={b.t} aria-label={b.t} onClick={() => setDepth(depth + b.d)} className={btn}>
              {b.icon}
            </button>
          ))}
          <button title="Back to the drilled depth" aria-label="Back to the drilled depth" onClick={() => setDepth(drilled)} className={cn(btn, "bg-brand-soft text-brand-ink hover:bg-brand hover:text-white")}>
            <LocateFixed size={15} />
          </button>
          <button onClick={() => setFull(!full)} className="ml-1 flex h-8 items-center gap-1.5 rounded-[3px] bg-surface-3 px-2.5 text-[12.5px] font-bold text-ink-2 hover:bg-line-2">
            {full ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {full ? "Section" : "Full well"}
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Bit depth"
        aria-valuemin={lo}
        aria-valuemax={hi}
        aria-valuenow={depth}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true;
          setIsDrag(true);
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          setDepth(snap(depthFromEvent(e.clientX)));
        }}
        onPointerMove={(e) => {
          const d = depthFromEvent(e.clientX);
          setHover(d);
          if (dragging.current) setDepth(snap(d));
        }}
        onPointerUp={() => {
          dragging.current = false;
          setIsDrag(false);
        }}
        onPointerLeave={() => setHover(null)}
        className="relative h-[92px] cursor-ew-resize rounded-[3px] bg-surface-2 outline-none ring-1 ring-inset ring-line focus-visible:ring-4 focus-visible:ring-brand/20"
      >
        {/* offset event markers */}
        <div className="absolute inset-x-0 top-1.5 h-5">
          {offsetEvents.map((e) => (
            <span key={e.id} className="absolute -translate-x-1/2" style={{ left: x((e.depth_start + e.depth_end) / 2), zIndex: SEVERITY_RANK[e.severity] }}>
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface shadow-sm" style={{ boxShadow: `0 0 0 1.5px ${e.severity === "critical" || e.severity === "high" ? SEVERITY_STYLE[e.severity].hex : FAMILY_META[familyOf(e.event_type)].color}` }}>
                <FamilyIcon family={familyOf(e.event_type)} size={10} />
              </span>
            </span>
          ))}
        </div>

        {/* predicted risk ribbon */}
        <div className="absolute inset-x-0 top-[28px] h-[6px]">
          {profileSegs.map((p) => (
            <span key={p.depth} className="absolute top-0 h-full" style={{ left: x(p.depth - 5), width: w(p.depth - 5, p.depth + 5), background: SEVERITY_STYLE[p.severity as Severity].hex, opacity: 0.3 + p.score * 0.7 }} />
          ))}
        </div>

        {/* formation bands */}
        <div className="absolute inset-x-0 top-[38px] h-[26px] overflow-hidden">
          {formations.map((f) => (
            <div
              key={f.id}
              className="absolute top-0 flex h-full items-center overflow-hidden border-r-2 border-surface-2 px-2"
              style={{ left: x(f.top_md), width: w(f.top_md, f.base_md), background: formationColor(f.name) }}
              title={`${f.name} ${fmtDepth(f.top_md)}–${fmtDepth(f.base_md)}${f.is_prognosed ? " (prognosed)" : ""}`}
            >
              <span className="truncate rounded-[2px] bg-[#0c0e14]/55 px-1 py-px text-[12px] font-bold text-white">{f.name}</span>
            </div>
          ))}
          {drilled < hi && <div className="hatched pointer-events-none absolute top-0 h-full bg-black/10" style={{ left: x(Math.max(drilled, lo)), width: w(Math.max(drilled, lo), hi) }} />}
        </div>

        {/* zone register */}
        <div className="absolute inset-x-0 top-[68px] h-[5px]">
          {zoneSegs.map((z) => (
            <span
              key={z.id}
              title={`${z.id} ${z.risk_label} · ${z.formation} ${fmtDepth(z.depth_start)}–${fmtDepth(z.depth_end)}`}
              className="absolute top-0 h-full rounded-[1px]"
              style={{ left: x(z.depth_start), width: w(z.depth_start, z.depth_end), background: FAMILY_META[z.risk_type].color }}
            />
          ))}
        </div>

        {/* ticks */}
        <div className="pointer-events-none absolute inset-x-0 bottom-1 h-3">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 font-mono text-[11px] font-medium text-ink-4" style={{ left: x(t) }}>
              {t.toLocaleString("en-IN")}
            </span>
          ))}
        </div>

        {/* hover readout */}
        {hover !== null && !isDrag && (
          <div className="pointer-events-none absolute inset-y-0 w-px bg-ink/25" style={{ left: x(hover) }}>
            <div className="absolute bottom-full left-1/2 mb-2 w-max max-w-[280px] -translate-x-1/2 rounded-[3px] bg-ink px-2.5 py-1.5 text-[12px] text-surface shadow-lg">
              <div className="font-mono font-semibold">{fmtDepth(hover)}</div>
              {hoverEvents.slice(0, 3).map((e) => (
                <div key={e.id} className="truncate opacity-80">
                  {e.well_name}: {e.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* cursor */}
        <motion.div className="pointer-events-none absolute inset-y-0" initial={false} animate={{ left: x(depth) }} transition={{ type: "spring", stiffness: 280, damping: 30 }}>
          <div className="absolute inset-y-0 -ml-[1.5px] w-[3px] rounded-[1px] bg-brand shadow-[0_0_14px_var(--brand)]" />
          <div className="absolute -bottom-2 -ml-[9px] h-[18px] w-[18px] rounded-full border-[3px] border-surface bg-brand shadow-md" />
        </motion.div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-[1px]" style={{ background: "linear-gradient(90deg,#f2a60c,#f76b15,#e5383b)" }} /> Predicted risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-[1px] bg-[#0ea5e9]" /> Risk-zone register
        </span>
        <span className="flex items-center gap-1.5">
          <span className="hatched h-2.5 w-5 rounded-[2px] ring-1 ring-line-2" /> Not yet drilled
        </span>
        <span className="ml-auto">Drag, click, or use ← → (Shift ×5)</span>
      </div>
    </div>
  );
}
