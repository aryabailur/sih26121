"use client";

import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Crosshair, Gem, Layers3, Shield } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { SeverityBadge } from "@/components/shared/StatusBadge";
import { focusSubsurfaceEvent, Subsurface3D } from "@/components/subsurface";
import { AnimatedNumber } from "@/components/ui/animated";
import { Panel } from "@/components/ui/card";
import { Empty } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";
import type { Trajectory } from "@/lib/types";
import { cn, EVENT_LABELS, FAMILY_META, familyOf, fmtDepth, fmtNum, fmtRange, formationColor, SEVERITY_STYLE } from "@/lib/utils";

function tvdAt(traj: Trajectory[] | undefined, md: number) {
  if (!traj?.length) return md;
  for (let i = 1; i < traj.length; i++) {
    if (traj[i].md >= md) {
      const a = traj[i - 1];
      const b = traj[i];
      const t = (md - a.md) / (b.md - a.md || 1);
      return (a.tvd ?? a.md) + ((b.tvd ?? b.md) - (a.tvd ?? a.md)) * t;
    }
  }
  const last = traj[traj.length - 1];
  return last.tvd ?? last.md;
}

/** Screen — Subsurface 3D: the field as a cut-away block, the bit's depth plane and what offsets saw there. */
export default function SubsurfacePage() {
  const depth = useNWIS((s) => s.depth);
  const setDepth = useNWIS((s) => s.setDepth);
  const well = useNWIS((s) => s.activeWell);
  const trajectories = useNWIS((s) => s.trajectories);
  const evaluation = useNWIS((s) => s.evaluation);
  const zones = useNWIS((s) => s.zones);
  const events = useNWIS((s) => s.events);
  const formations = useNWIS((s) => s.formations);
  const td = well?.total_depth_md ?? 3800;
  const tvd = tvdAt(trajectories[well?.id ?? "W001"], depth);
  const overall = evaluation?.overall_risk_level ?? "low";
  const near = evaluation?.context.nearby_events ?? [];
  const current = evaluation?.current_formation;

  const hazards = useMemo(
    () =>
      zones
        .map((z) => {
          const ev = events.find((e) => familyOf(e.event_type) === z.risk_type && e.depth_end >= z.depth_start - 30 && e.depth_start <= z.depth_end + 30 && e.well_id !== well?.id);
          const state = depth > z.depth_end ? "passed" : depth >= z.depth_start ? "inside" : "ahead";
          return { z, ev, state, gap: z.depth_start - depth };
        })
        .sort((a, b) => a.z.depth_start - b.z.depth_start),
    [zones, events, depth, well],
  );

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[minmax(0,1fr)_356px] xl:overflow-hidden">
      <div className="relative min-h-[620px] overflow-hidden rounded-[4px] border border-line shadow-md xl:min-h-0">
        <Subsurface3D />
      </div>

      <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto">
        {/* At the bit */}
        <section className="card shrink-0 p-4">
          <div className="flex items-center gap-2 text-[12.5px] font-bold text-ink-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffb020]" /> Bit on {well?.name ?? "OIL-AX-102"}
            <SeverityBadge severity={overall} className="ml-auto" />
          </div>
          <div className="mt-2 flex items-end gap-5">
            <div>
              <div className="label">Measured depth</div>
              <div className="text-[30px] font-extrabold leading-none tracking-[-0.02em] text-ink">
                <AnimatedNumber value={depth} />
                <span className="ml-1 text-[15px] font-bold text-ink-3">m</span>
              </div>
            </div>
            <div>
              <div className="label">True vertical</div>
              <div className="text-[20px] font-extrabold leading-none text-ink-2">
                <AnimatedNumber value={tvd} />
                <span className="ml-1 text-[13px] font-bold text-ink-3">m</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <span className="h-3 w-3 rounded-[2px]" style={{ background: formationColor(current) }} />
            {current ?? "—"}
            {evaluation?.next_risk_zone && (
              <span className="ml-auto text-[12.5px] font-semibold text-ink-3">
                Next: {FAMILY_META[evaluation.next_risk_zone.type].label.toLowerCase()} in {fmtDepth(evaluation.next_risk_zone.distance)}
              </span>
            )}
          </div>
          <input
            type="range"
            min={2400}
            max={td}
            step={10}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="nwis-range mt-3 w-full"
            style={{ ["--fill" as string]: `${((depth - 2400) / (td - 2400)) * 100}%` }}
            aria-label="Move the bit"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[12px] text-ink-3">Drag to move the bit · 2,400–{fmtDepth(td)}</span>
            <div className="flex gap-1">
              {[
                { d: -50, icon: ChevronsUp, t: "Up 50 m" },
                { d: -10, icon: ChevronUp, t: "Up 10 m" },
                { d: 10, icon: ChevronDown, t: "Down 10 m" },
                { d: 50, icon: ChevronsDown, t: "Down 50 m" },
              ].map(({ d, icon: Icon, t }) => (
                <button key={d} onClick={() => setDepth(depth + d)} title={t} aria-label={t} className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line-2 text-ink-2 transition-colors hover:border-brand/60 hover:text-brand-ink">
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Offsets at this depth */}
        <Panel title="Seen near this depth" subtitle="Offset events within 75 m of the bit — click to fly there" icon={<Gem size={16} />} className="shrink-0">
          {near.length ? (
            <ul className="space-y-1.5 px-3 pb-3">
              {near.map((e, i) => {
                const fam = familyOf(e.event_type);
                return (
                  <motion.li key={e.event_id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <button
                      onClick={() => focusSubsurfaceEvent(e.event_id)}
                      className="group flex w-full items-start gap-2.5 rounded-[3px] border border-line bg-surface-2 p-2.5 text-left transition-colors hover:border-brand/50 hover:bg-brand-soft"
                    >
                      <FamilyIcon family={fam} tile size={14} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                          {EVENT_LABELS[e.event_type] ?? e.event_type}
                          <span className="font-mono text-[12px] font-semibold text-ink-3">{e.well_name}</span>
                        </span>
                        <span className="block text-[12.5px] text-ink-2">
                          {fmtRange(e.depth_start, e.depth_end)} · {e.formation}
                          {e.npt_hours ? ` · ${e.npt_hours} h NPT` : ""}
                        </span>
                      </span>
                      <Crosshair size={14} className="mt-0.5 shrink-0 text-ink-3 transition-colors group-hover:text-brand-ink" />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          ) : (
            <Empty title="Nothing recorded near this depth" hint="No offset well logged an event within 75 m of the bit." className="py-5" />
          )}
        </Panel>

        {/* Hazards along the plan */}
        <Panel title="Hazard windows on the plan" subtitle="Glowing sleeves around the active well" icon={<Shield size={16} />} className="shrink-0">
          <ul className="space-y-1 px-3 pb-3">
            {hazards.map(({ z, ev, state, gap }) => (
              <li key={z.id}>
                <button
                  onClick={() => ev && focusSubsurfaceEvent(ev.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left transition-colors hover:bg-surface-3",
                    state === "inside" && "bg-crit-soft",
                    state === "passed" && "opacity-60",
                  )}
                >
                  <FamilyIcon family={z.risk_type} size={14} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{FAMILY_META[z.risk_type].label}</span>
                    <span className="block text-[12px] text-ink-3">
                      {fmtRange(z.depth_start, z.depth_end)} · {z.formation}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-right text-[12px] font-bold tabular", state === "inside" ? "text-crit-ink" : "text-ink-2")}>
                    {state === "inside" ? "Bit inside" : state === "passed" ? "Passed" : `in ${fmtDepth(gap)}`}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_STYLE[z.severity].hex }} title={`${SEVERITY_STYLE[z.severity].label} history`} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Strata at the active well */}
        <Panel title="Strata at the active well" subtitle="Prognosed tops, porosity, pore pressure & frac gradient" icon={<Layers3 size={16} />} className="shrink-0">
          <ul className="px-3 pb-3">
            {formations.map((f) => {
              const here = current === f.name;
              return (
                <li key={f.id} className={cn("flex items-center gap-2.5 rounded-[3px] px-2 py-1.5", here && "bg-brand-soft")}>
                  <span className="h-8 w-1.5 shrink-0 rounded-[1px]" style={{ background: formationColor(f.name) }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      {f.name}
                      {here && <span className="rounded-[2px] bg-brand px-1.5 text-[11px] font-bold text-white">bit</span>}
                    </span>
                    <span className="block text-[12px] text-ink-3">
                      {fmtRange(f.top_md, f.base_md)} · {f.lithology}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[11.5px] leading-tight text-ink-2">
                    {f.porosity_pct != null && <span className="block">φ {fmtNum(f.porosity_pct, 1)}%</span>}
                    {f.pore_pressure_sg != null && (
                      <span className="block">
                        {fmtNum(f.pore_pressure_sg, 2)}–{fmtNum(f.frac_gradient_sg, 2)} sg
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
