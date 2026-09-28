"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Crosshair, Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { SeverityGlyph } from "@/components/shared/StatusBadge";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, Severity } from "@/lib/types";
import { clamp, cn, FAMILY_META, familyOf, fmtDepth, formationColor, SEVERITY_RANK, SEVERITY_STYLE } from "@/lib/utils";

const SECTION: [number, number] = [2400, 3800];

/**
 * THE signature interaction: drag the bit depth and every panel (KPIs, map highlights,
 * risk watch, timeline, alerts) re-evaluates against nearby-well history.
 */
export function DepthScrubber({ compact = false, className }: { compact?: boolean; className?: string }) {
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
  const offsetEvents = useMemo(
    () => events.filter((e) => inRadius.has(e.well_id) && e.depth_end >= lo && e.depth_start <= hi),
    [events, inRadius, lo, hi],
  );
  // Ribbon shows only medium-or-worse predicted risk so the eye lands on real windows.
  const profileSegs = useMemo(() => profile.filter((p) => p.depth >= lo && p.depth <= hi && p.score >= 0.35), [profile, lo, hi]);
  const zoneSegs = useMemo(() => zones.filter((z) => z.depth_end >= lo && z.depth_start <= hi), [zones, lo, hi]);

  const depthFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return depth;
    const r = el.getBoundingClientRect();
    return lo + clamp((clientX - r.left) / r.width, 0, 1) * (hi - lo);
  };
  const snap = (d: number) => Math.round(d / 5) * 5;

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setIsDrag(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDepth(snap(depthFromEvent(e.clientX)));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = depthFromEvent(e.clientX);
    setHover(d);
    if (dragging.current) setDepth(snap(d));
  };
  const onPointerUp = () => {
    dragging.current = false;
    setIsDrag(false);
  };
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
  const hoverEvents: DrillingEvent[] = hover !== null
    ? offsetEvents.filter((e) => Math.abs((e.depth_start + e.depth_end) / 2 - hover) < (hi - lo) / 60 + (e.depth_end - e.depth_start) / 2)
    : [];

  return (
    <div className={cn("select-none", className)}>
      {!compact && (
        <div className="mb-1.5 flex items-center gap-3">
          <span className="label-caps text-cyan-300/80">Depth scrubber</span>
          <span className="font-mono text-lg font-semibold tabular text-cyan-200">{fmtDepth(depth)}</span>
          <span className="text-[11px] text-cockpit-muted">MD</span>
          {currentFm && (
            <span className="flex items-center gap-1.5 rounded border border-cockpit-border px-1.5 py-px text-[11px] text-slate-200">
              <span className="h-2 w-2 rounded-sm" style={{ background: formationColor(currentFm) }} />
              {currentFm}
            </span>
          )}
          {depth > drilled && (
            <span className="rounded border border-slate-600/50 bg-slate-500/10 px-1.5 py-px text-[10px] uppercase tracking-wider text-slate-400">
              look-ahead · simulated feed
            </span>
          )}
          {nxt && (
            <span className="hidden text-[11px] text-cockpit-muted xl:inline">
              Next window: <span style={{ color: FAMILY_META[nxt.type].color }}>{nxt.label}</span> at {fmtDepth(nxt.depth)} ·{" "}
              <span className="font-mono text-slate-200">{Math.round(nxt.distance)} m</span> ahead
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {[
              { icon: <ChevronsLeft size={13} />, d: -50, t: "−50 m" },
              { icon: <ChevronLeft size={13} />, d: -10, t: "−10 m" },
              { icon: <ChevronRight size={13} />, d: 10, t: "+10 m" },
              { icon: <ChevronsRight size={13} />, d: 50, t: "+50 m" },
            ].map((b) => (
              <button
                key={b.t}
                title={b.t}
                onClick={() => setDepth(depth + b.d)}
                className="rounded border border-cockpit-border p-1 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200"
              >
                {b.icon}
              </button>
            ))}
            <button
              title="Return to drilled depth"
              onClick={() => setDepth(drilled)}
              className="rounded border border-cockpit-border p-1 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200"
            >
              <Crosshair size={13} />
            </button>
            <button
              title={full ? "Zoom to reservoir section" : "Show full well"}
              onClick={() => setFull(!full)}
              className="flex items-center gap-1 rounded border border-cockpit-border px-1.5 py-1 text-[10px] uppercase tracking-wider text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200"
            >
              {full ? <Minimize2 size={12} /> : <Maximize2 size={12} />} {full ? "Section" : "Full well"}
            </button>
          </div>
        </div>
      )}

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Bit depth"
        aria-valuemin={lo}
        aria-valuemax={hi}
        aria-valuenow={depth}
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        className="relative cursor-ew-resize rounded-md border border-cockpit-line bg-black/30 outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60"
        style={{ height: compact ? 44 : 78 }}
      >
        {/* offset event markers */}
        <div className="absolute inset-x-0 top-1 h-3.5">
          {offsetEvents.map((e) => (
            <span
              key={e.id}
              className="absolute -translate-x-1/2"
              style={{ left: x((e.depth_start + e.depth_end) / 2), zIndex: SEVERITY_RANK[e.severity] }}
            >
              <SeverityGlyph severity={e.severity} color={e.severity === "critical" || e.severity === "high" ? undefined : FAMILY_META[familyOf(e.event_type)].color} size={e.severity === "critical" ? 11 : 9} />
            </span>
          ))}
        </div>

        {/* risk ribbon from the risk profile */}
        <div className="absolute inset-x-0" style={{ top: compact ? 17 : 20, height: compact ? 5 : 7 }}>
          {profileSegs.map((p) => (
            <span
              key={p.depth}
              className="absolute top-0 h-full"
              style={{
                left: x(p.depth - 5),
                width: w(p.depth - 5, p.depth + 5),
                background: SEVERITY_STYLE[p.severity as Severity].hex,
                opacity: 0.25 + p.score * 0.75,
              }}
            />
          ))}
        </div>

        {/* formation bands */}
        <div className="absolute inset-x-0" style={{ top: compact ? 24 : 30, height: compact ? 14 : 26 }}>
          {formations.map((f) => (
            <div
              key={f.id}
              className="absolute top-0 flex h-full items-center overflow-hidden border-r border-black/40 px-1.5"
              style={{ left: x(f.top_md), width: w(f.top_md, f.base_md), background: formationColor(f.name) }}
              title={`${f.name} ${fmtDepth(f.top_md)}–${fmtDepth(f.base_md)}${f.is_prognosed ? " (prognosed)" : ""}`}
            >
              {!compact && <span className="truncate text-[10px] font-semibold text-white/80">{f.name}</span>}
            </div>
          ))}
          {/* look-ahead hatch beyond drilled depth */}
          {drilled < hi && (
            <div className="hatched pointer-events-none absolute top-0 h-full bg-black/25" style={{ left: x(Math.max(drilled, lo)), width: w(Math.max(drilled, lo), hi) }} />
          )}
        </div>

        {/* risk zone brackets */}
        {!compact && (
          <div className="absolute inset-x-0" style={{ top: 58, height: 5 }}>
            {zoneSegs.map((z) => (
              <span
                key={z.id}
                title={`${z.id} ${z.risk_label} · ${z.formation} ${fmtDepth(z.depth_start)}–${fmtDepth(z.depth_end)}`}
                className="absolute top-0 h-full rounded-sm"
                style={{ left: x(z.depth_start), width: w(z.depth_start, z.depth_end), background: `${FAMILY_META[z.risk_type].color}aa` }}
              />
            ))}
          </div>
        )}

        {/* ticks */}
        {!compact && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3">
            {ticks.map((t) => (
              <span key={t} className="absolute -translate-x-1/2 font-mono text-[9px] text-cockpit-dim" style={{ left: x(t) }}>
                {t.toLocaleString("en-IN")}
              </span>
            ))}
          </div>
        )}

        {/* hover readout */}
        {hover !== null && !isDrag && (
          <div className="pointer-events-none absolute inset-y-0 w-px bg-white/25" style={{ left: x(hover) }}>
            <div className="glass-strong absolute bottom-full left-1/2 mb-1.5 w-max max-w-[280px] -translate-x-1/2 rounded px-2 py-1 text-[10px] text-slate-200">
              <div className="font-mono text-cyan-200">{fmtDepth(hover)}</div>
              {hoverEvents.slice(0, 3).map((e) => (
                <div key={e.id} className="truncate text-cockpit-muted">
                  {e.well_name}: {e.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* cursor */}
        <div className="pointer-events-none absolute inset-y-0 transition-[left] duration-300 ease-out" style={{ left: x(depth) }}>
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
          <div className="absolute -bottom-1 -ml-[7px] h-3.5 w-3.5 rounded-full border-2 border-cyan-300 bg-cockpit-bg" />
        </div>
      </div>

      {!compact && (
        <div className="mt-1 flex items-center gap-4 text-[10px] text-cockpit-dim">
          <span className="flex items-center gap-1"><SeverityGlyph severity="critical" /> critical event</span>
          <span className="flex items-center gap-1"><SeverityGlyph severity="high" /> high event</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded-sm bg-gradient-to-r from-amber-500/60 to-red-500" /> predicted risk ribbon</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded-sm bg-sky-400/70" /> risk-zone register</span>
          <span className="flex items-center gap-1"><span className="hatched h-2 w-4 rounded-sm border border-slate-600/60" /> not yet drilled</span>
          <span className="ml-auto">Drag, click, or use ← → (Shift ×5)</span>
        </div>
      )}
    </div>
  );
}
