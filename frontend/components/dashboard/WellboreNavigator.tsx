"use client";

import { ChevronsDown, ChevronsUp, ChevronDown, ChevronUp, LocateFixed, Maximize2, Minimize2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { AnimatedNumber } from "@/components/ui/animated";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, Severity } from "@/lib/types";
import { clamp, cn, FAMILY_META, familyOf, fmtDepth, formationColor, SEVERITY_STYLE } from "@/lib/utils";

const SECTION: [number, number] = [2400, 3800];

/**
 * THE signature interaction, vertical like a real well: drag the bit and every panel
 * (KPIs, map, risk radar, alerts) re-evaluates against nearby-well history at that depth.
 */
export function WellboreNavigator({ className }: { className?: string }) {
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
  const openWell = useNWIS((s) => s.openWell);
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [hoverEvent, setHoverEvent] = useState<DrillingEvent | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const td = well?.total_depth_md ?? 3800;
  const drilled = well?.current_depth_md ?? 3100;
  const [lo, hi] = full ? [0, td] : SECTION;
  const y = useCallback((d: number) => ((clamp(d, lo, hi) - lo) / (hi - lo)) * 100, [lo, hi]);
  const h = useCallback((a: number, b: number) => ((clamp(b, lo, hi) - clamp(a, lo, hi)) / (hi - lo)) * 100, [lo, hi]);

  const inRadius = useMemo(() => new Set(wells.filter((x) => x.distance_km <= radiusKm && x.role === "offset").map((x) => x.id)), [wells, radiusKm]);
  const names = useMemo(() => Object.fromEntries(wells.map((w) => [w.id, w.name])), [wells]);
  const offsetEvents = useMemo(() => events.filter((e) => inRadius.has(e.well_id) && e.depth_end >= lo && e.depth_start <= hi), [events, inRadius, lo, hi]);
  const heat = useMemo(() => profile.filter((p) => p.depth >= lo && p.depth <= hi && p.score >= 0.35), [profile, lo, hi]);
  const zoneSegs = useMemo(() => zones.filter((z) => z.depth_end >= lo && z.depth_start <= hi), [zones, lo, hi]);

  // Greedy lanes so event pins at similar depths sit side by side instead of overlapping.
  const lanes = useMemo(() => {
    const gap = (hi - lo) * 0.032;
    const ends: number[] = [];
    const m = new Map<string, number>();
    for (const e of [...offsetEvents].sort((a, b) => a.depth_start - b.depth_start)) {
      const mid = (e.depth_start + e.depth_end) / 2;
      let lane = ends.findIndex((end) => mid >= end + gap);
      if (lane < 0) lane = ends.length < 3 ? ends.length : ends.indexOf(Math.min(...ends));
      ends[lane] = mid;
      m.set(e.id, lane);
    }
    return m;
  }, [offsetEvents, lo, hi]);

  const depthFromY = (clientY: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return depth;
    return lo + clamp((clientY - r.top) / r.height, 0, 1) * (hi - lo);
  };
  const snap = (d: number) => Math.round(d / 5) * 5;
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 10;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") setDepth(depth + step);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") setDepth(depth - step);
    else return;
    e.preventDefault();
  };

  const ticks = useMemo(() => {
    const step = full ? 500 : 100;
    const out: number[] = [];
    for (let d = Math.ceil(lo / step) * step; d <= hi; d += step) out.push(d);
    return out;
  }, [lo, hi, full]);

  const currentFm = evaluation?.current_formation ?? formations.find((f) => f.top_md <= depth && depth < f.base_md)?.name;
  const inside = evaluation?.assessments.filter((a) => a.position === "inside").map((a) => a.zone_id) ?? [];
  const bitSev: Severity = evaluation?.overall_risk_level ?? "low";

  return (
    <section className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      {/* readout */}
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-ink-3">Bit depth · MD</span>
          <button
            onClick={() => setFull(!full)}
            className="flex items-center gap-1 rounded-[2px] bg-surface-3 px-2 py-0.5 text-[12px] font-bold text-ink-2 transition-colors hover:bg-brand-soft hover:text-brand-ink"
            title={full ? "Zoom to the reservoir section" : "Show the full well"}
          >
            {full ? <Minimize2 size={11} /> : <Maximize2 size={11} />} {full ? "Section" : "Full well"}
          </button>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <AnimatedNumber value={depth} className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink" />
          <span className="text-[15px] font-bold text-ink-3">m</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="flex min-w-0 items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-[12.5px] font-bold" style={{ background: `color-mix(in oklab, ${formationColor(currentFm)} 16%, transparent)`, color: "var(--ink)" }}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: formationColor(currentFm) }} />
            <span className="truncate">{currentFm ?? "—"}</span>
          </span>
          {depth > drilled && <span className="shrink-0 rounded-[2px] bg-surface-3 px-2 py-0.5 text-[11.5px] font-bold text-ink-3">look-ahead</span>}
        </div>
      </div>

      {/* track */}
      <div className="relative min-h-0 flex-1 px-3 pb-2">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Bit depth"
          aria-orientation="vertical"
          aria-valuemin={lo}
          aria-valuemax={hi}
          aria-valuenow={depth}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            setDepth(snap(depthFromY(e.clientY)));
          }}
          onPointerMove={(e) => {
            const d = depthFromY(e.clientY);
            setHover(d);
            if (dragging.current) setDepth(snap(d));
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => setHover(null)}
          className="relative h-full cursor-ns-resize rounded-[3px] outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
        >
          {/* depth ticks */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[34px]">
            {ticks.map((t) => (
              <span key={t} className="absolute right-1 -translate-y-1/2 font-mono text-[11px] font-medium tabular text-ink-4" style={{ top: `${y(t)}%` }}>
                {t.toLocaleString("en-IN")}
              </span>
            ))}
          </div>

          {/* predicted-risk heat ribbon */}
          <div className="pointer-events-none absolute inset-y-0 left-[38px] w-[5px] overflow-hidden rounded-[1px] bg-surface-3">
            {heat.map((p) => (
              <span
                key={p.depth}
                className="absolute inset-x-0"
                style={{ top: `${y(p.depth - 5)}%`, height: `${h(p.depth - 5, p.depth + 5)}%`, background: SEVERITY_STYLE[p.severity as Severity].hex, opacity: 0.35 + p.score * 0.65 }}
              />
            ))}
          </div>

          {/* strata column + wellbore */}
          <div className="absolute inset-y-0 left-[48px] w-[60px] overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]">
            {formations.map((f) => (
              <div
                key={f.id}
                className="absolute inset-x-0 overflow-hidden"
                style={{
                  top: `${y(f.top_md)}%`,
                  height: `${h(f.top_md, f.base_md)}%`,
                  background: `linear-gradient(90deg, color-mix(in oklab, ${formationColor(f.name)} 78%, black) 0%, ${formationColor(f.name)} 30%, color-mix(in oklab, ${formationColor(f.name)} 80%, white) 55%, ${formationColor(f.name)} 80%, color-mix(in oklab, ${formationColor(f.name)} 75%, black) 100%)`,
                }}
                title={`${f.name} ${fmtDepth(f.top_md)}–${fmtDepth(f.base_md)}${f.is_prognosed ? " (prognosed)" : ""}`}
              >
                <span className="absolute left-[3px] top-1.5 rounded-[2px] bg-[#0c0e14]/55 px-px py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white [writing-mode:vertical-rl]">{f.name.split(" ")[0]}</span>
                <span className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(rgb(255_255_255/0.5)_1px,transparent_1.2px)] [background-size:7px_7px]" />
              </div>
            ))}
            {/* not yet drilled */}
            {drilled < hi && <div className="hatched pointer-events-none absolute inset-x-0 bottom-0 bg-black/10" style={{ top: `${y(Math.max(drilled, lo))}%` }} />}
            {/* drill string: mud flows down to the bit */}
            <div className="absolute left-[60%] top-0 w-[8px] -translate-x-1/2 overflow-hidden rounded-b-[2px] bg-[#1b1d26] shadow-[0_0_0_2px_rgb(255_255_255/0.55)]" style={{ height: `${y(depth)}%` }}>
              <div className="animate-flow h-full w-full opacity-70 [background-image:repeating-linear-gradient(180deg,transparent_0_8px,#8fdcff_8px_10px,transparent_10px_16px)] [background-size:100%_16px]" />
            </div>
            <div className="absolute left-[60%] w-0 -translate-x-1/2 border-l-2 border-dashed border-white/70" style={{ top: `${y(depth)}%`, bottom: 0 }} />
          </div>

          {/* events lane */}
          <div className="absolute inset-y-0 left-[114px] right-0">
            {zoneSegs.map((z) => {
              const on = inside.includes(z.id);
              const c = FAMILY_META[z.risk_type].color;
              return (
                <span
                  key={z.id}
                  className={cn("absolute left-0 w-[5px] rounded-[1px]", on && "animate-breathe")}
                  style={{ top: `${y(z.depth_start)}%`, height: `max(6px, ${h(z.depth_start, z.depth_end)}%)`, background: c, boxShadow: on ? `0 0 12px ${c}` : undefined }}
                  title={`${z.id} ${z.risk_label} · ${z.formation} ${fmtDepth(z.depth_start)}–${fmtDepth(z.depth_end)}`}
                />
              );
            })}
            {offsetEvents.map((e) => {
              const fam = familyOf(e.event_type);
              const lane = lanes.get(e.id) ?? 0;
              const near = Math.abs((e.depth_start + e.depth_end) / 2 - depth) <= 75;
              return (
                <button
                  key={e.id}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={() => openWell(e.well_id)}
                  onMouseEnter={() => setHoverEvent(e)}
                  onMouseLeave={() => setHoverEvent(null)}
                  className="absolute z-10 -translate-y-1/2"
                  style={{ top: `${y((e.depth_start + e.depth_end) / 2)}%`, left: 10 + lane * 25 }}
                  aria-label={`${names[e.well_id]}: ${e.title}`}
                >
                  <motion.span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-surface shadow-sm"
                    animate={near ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={near ? { duration: 1.4, repeat: Infinity } : undefined}
                    style={{ boxShadow: `0 0 0 2px ${e.severity === "critical" || e.severity === "high" ? SEVERITY_STYLE[e.severity].hex : FAMILY_META[fam].color}${near ? `, 0 0 14px ${FAMILY_META[fam].color}` : ""}` }}
                  >
                    <FamilyIcon family={fam} size={11} />
                  </motion.span>
                </button>
              );
            })}
          </div>

          {/* hover hairline */}
          {hover !== null && !hoverEvent && (
            <div className="pointer-events-none absolute left-[36px] right-0 z-20 border-t border-dashed border-ink-3/60" style={{ top: `${y(hover)}%` }}>
              <span className="absolute -top-2.5 right-0 rounded-[3px] bg-ink px-1.5 py-0.5 font-mono text-[11px] font-semibold text-surface">{fmtDepth(snap(hover))}</span>
            </div>
          )}

          {/* event tooltip */}
          {hoverEvent && (
            <div className="pointer-events-none absolute left-2 right-0 z-30 -translate-y-[calc(100%+14px)] rounded-[3px] bg-ink p-2.5 text-[12.5px] text-surface shadow-lg" style={{ top: `${y((hoverEvent.depth_start + hoverEvent.depth_end) / 2)}%` }}>
              <div className="flex items-center gap-1.5 font-bold">
                <FamilyIcon family={familyOf(hoverEvent.event_type)} size={12} />
                {names[hoverEvent.well_id]} · {fmtDepth(hoverEvent.depth_start)}
              </div>
              <div className="mt-0.5 leading-snug opacity-80">{hoverEvent.title}</div>
              <div className="mt-1 text-[11.5px] opacity-60">{SEVERITY_STYLE[hoverEvent.severity].label} · click for the well profile</div>
            </div>
          )}

          {/* the bit */}
          <motion.div
            className="pointer-events-none absolute left-[30px] right-0 z-20"
            initial={false}
            animate={{ top: `${y(depth)}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="absolute left-[8px] right-0 h-[2px] -translate-y-1/2 rounded-[1px]" style={{ background: `linear-gradient(90deg, var(--brand), color-mix(in oklab, var(--brand) 10%, transparent))` }} />
            <div className="absolute left-[54px] -translate-x-1/2 -translate-y-1/2">
              <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-pulse-ring rounded-full" style={{ border: `2px solid ${SEVERITY_STYLE[bitSev].hex}` }} />
              <motion.svg width="24" height="24" viewBox="0 0 24 24" animate={{ rotate: depth * 6 }} transition={{ type: "spring", stiffness: 80, damping: 18 }} className="relative drop-shadow-md">
                <circle cx="12" cy="12" r="11" fill="var(--brand)" stroke="white" strokeWidth="2" />
                <path d="M12 4.5 L14.2 10.3 L19.5 12 L14.2 13.7 L12 19.5 L9.8 13.7 L4.5 12 L9.8 10.3 Z" fill="white" />
              </motion.svg>
            </div>
          </motion.div>
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center justify-between gap-1 border-t border-line px-3 py-2.5">
        {[
          { icon: <ChevronsUp size={15} />, d: -50, t: "Up 50 m" },
          { icon: <ChevronUp size={15} />, d: -10, t: "Up 10 m" },
        ].map((b) => (
          <StepButton key={b.t} title={b.t} onClick={() => setDepth(depth + b.d)}>
            {b.icon}
          </StepButton>
        ))}
        <StepButton title="Back to the drilled depth" onClick={() => setDepth(drilled)} accent>
          <LocateFixed size={15} />
        </StepButton>
        {[
          { icon: <ChevronDown size={15} />, d: 10, t: "Down 10 m" },
          { icon: <ChevronsDown size={15} />, d: 50, t: "Down 50 m" },
        ].map((b) => (
          <StepButton key={b.t} title={b.t} onClick={() => setDepth(depth + b.d)}>
            {b.icon}
          </StepButton>
        ))}
      </div>
    </section>
  );
}

function StepButton({ children, title, onClick, accent = false }: { children: React.ReactNode; title: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex h-8 flex-1 items-center justify-center rounded-[3px] transition-all active:scale-95",
        accent ? "bg-brand-soft text-brand-ink hover:bg-brand hover:text-white" : "bg-surface-3 text-ink-2 hover:bg-line-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
