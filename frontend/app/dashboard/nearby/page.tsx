"use client";

import { ArrowDownUp, ArrowRight, GitCompare, Navigation, SlidersHorizontal, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { FamilyFilter } from "@/components/shared/FilterBar";
import { SimilarityBadge } from "@/components/shared/SimilarityBadge";
import { SeverityBadge } from "@/components/shared/StatusBadge";
import { FieldMap } from "@/components/map";
import { AnimatedNumber } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Select } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";
import type { WellListItem } from "@/lib/types";
import { cn, FAMILY_META, fieldName, fmtDate, fmtDepth, SEVERITY_RANK, SEVERITY_STYLE, SERIES_COLORS } from "@/lib/utils";

const RADIUS_STEPS = [0.5, 1, 1.5, 2, 3, 5, 10, 15, 25, 35, 50];
type SortKey = "distance_km" | "similarity" | "event_count" | "total_depth_md" | "npt_hours" | "history";

/** Screen B — Nearby wells. */
export default function NearbyPage() {
  const wells = useNWIS((s) => s.wells);
  const events = useNWIS((s) => s.events);
  const radiusKm = useNWIS((s) => s.radiusKm);
  const setRadius = useNWIS((s) => s.setRadius);
  const familyFilter = useNWIS((s) => s.familyFilter);
  const setFamilyFilter = useNWIS((s) => s.setFamilyFilter);
  const compareIds = useNWIS((s) => s.compareIds);
  const toggleCompare = useNWIS((s) => s.toggleCompare);
  const openWell = useNWIS((s) => s.openWell);
  const setHover = useNWIS((s) => s.setHover);
  const hoverWellId = useNWIS((s) => s.hoverWellId);
  const [formation, setFormation] = useState("");
  const [yearFrom, setYearFrom] = useState(2016);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "distance_km", dir: 1 });

  const stepIndex = Math.max(0, RADIUS_STEPS.findIndex((r) => r >= radiusKm));

  const rows = useMemo(() => {
    const offsets = wells.filter((w) => w.role === "offset" && w.distance_km <= radiusKm);
    const filtered = offsets.filter((w) => {
      const evs = events.filter((e) => e.well_id === w.id && Number(e.date.slice(0, 4)) >= yearFrom);
      if (familyFilter.length && !evs.some((e) => familyFilter.includes(e.risk_family ?? "NPT"))) return false;
      if (formation && !evs.some((e) => e.formation === formation)) return false;
      if (yearFrom > 2016 && evs.length === 0) return false;
      return true;
    });
    const val = (w: WellListItem) => (sort.key === "history" ? (w.history_severity ? SEVERITY_RANK[w.history_severity] : -1) : ((w[sort.key] as number | null) ?? 0));
    return filtered.sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [wells, events, radiusKm, familyFilter, formation, yearFrom, sort]);

  const outside = wells.filter((w) => w.role === "offset" && w.distance_km > radiusKm).length;
  const formations = useMemo(() => Array.from(new Set(events.map((e) => e.formation))).sort(), [events]);
  const totalNpt = rows.reduce((s, w) => s + w.npt_hours, 0);
  const totalEvents = rows.reduce((s, w) => s + w.event_count, 0);

  const sortHeader = (k: SortKey, children: React.ReactNode, className?: string) => (
    <th key={k} className={cn("px-3 py-2.5 font-bold", className)}>
      <button
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === "distance_km" ? 1 : -1 }))}
        className={cn("inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors hover:bg-surface-3 hover:text-ink", sort.key === k && "bg-brand-soft text-brand-ink")}
      >
        {children} <ArrowDownUp size={11} />
      </button>
    </th>
  );

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden">
      <Panel title="Search radius & filters" icon={<SlidersHorizontal size={16} />} bodyClassName="space-y-6 overflow-y-auto px-4 pb-4">
        <div className="rounded-[4px] bg-surface-2 p-4">
          <div className="flex items-baseline justify-between">
            <span className="label">Radius from OIL-AX-102</span>
            <span className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-brand-ink">
              <AnimatedNumber value={radiusKm} format={(v) => (v < 2 ? v.toFixed(1) : Math.round(v).toString())} /> <span className="text-[14px]">km</span>
            </span>
          </div>
          <input
            type="range"
            className="nwis-range mt-3 w-full"
            min={0}
            max={RADIUS_STEPS.length - 1}
            step={1}
            value={stepIndex}
            style={{ ["--fill" as string]: `${(stepIndex / (RADIUS_STEPS.length - 1)) * 100}%` }}
            onChange={(e) => setRadius(RADIUS_STEPS[Number(e.target.value)])}
            aria-label="Search radius"
          />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-4">
            {RADIUS_STEPS.filter((_, i) => i % 2 === 0).map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: "In radius", v: rows.length },
              { l: "Events", v: totalEvents },
              { l: "NPT h", v: totalNpt },
            ].map((x) => (
              <div key={x.l} className="rounded-[3px] bg-surface px-2 py-2 shadow-xs">
                <div className="text-[18px] font-extrabold tabular text-ink">
                  <AnimatedNumber value={x.v} />
                </div>
                <div className="text-[11.5px] font-bold text-ink-3">{x.l}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] leading-snug text-ink-3">
            {outside} well{outside === 1 ? "" : "s"} outside the radius. The radius also scopes the risk engine and evidence search.
          </p>
        </div>

        <div>
          <div className="label mb-2">Event type</div>
          <FamilyFilter value={familyFilter} onChange={setFamilyFilter} compact />
        </div>

        <div>
          <div className="label mb-2">Formation (event recorded in)</div>
          <Select value={formation} onChange={(e) => setFormation(e.target.value)}>
            <option value="">Any formation</option>
            {formations.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Events since</span>
            <span className="text-[14px] font-extrabold tabular text-ink">{yearFrom}</span>
          </div>
          <input
            type="range"
            className="nwis-range mt-2 w-full"
            min={2016}
            max={2026}
            value={yearFrom}
            style={{ ["--fill" as string]: `${((yearFrom - 2016) / 10) * 100}%` }}
            onChange={(e) => setYearFrom(Number(e.target.value))}
            aria-label="Events since year"
          />
        </div>

        <div className="rounded-[4px] border border-dashed border-line-2 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13.5px] font-extrabold text-ink">Compare set</span>
            <span className="text-[12.5px] font-bold text-ink-3">{compareIds.length}/4</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {compareIds.length === 0 && <span className="text-[12.5px] leading-snug text-ink-3">Tick wells in the table to compare them with the active well on one depth axis.</span>}
            {compareIds.map((id, i) => (
              <motion.button
                key={id}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => toggleCompare(id)}
                className="flex items-center gap-1.5 rounded-[2px] bg-surface-3 py-1 pl-2 pr-1.5 font-mono text-[12.5px] font-semibold text-ink hover:bg-line-2"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i + 1] }} />
                {wells.find((w) => w.id === id)?.name}
                <X size={12} className="text-ink-3" />
              </motion.button>
            ))}
          </div>
          <Link href="/dashboard/compare">
            <Button variant="primary" size="md" className="w-full" disabled={compareIds.length === 0}>
              <GitCompare size={15} /> Compare selected
            </Button>
          </Link>
        </div>
      </Panel>

      <div className="grid min-h-0 grid-rows-[minmax(360px,1.15fr)_minmax(0,1fr)] gap-3">
        <div className="relative min-h-0 overflow-hidden rounded-[4px] border border-line shadow-md">
          <FieldMap />
        </div>
        <Panel title="Offset wells" subtitle="Similarity blends formations, depth coverage, trajectory, parameters and distance · hover a row to find the well on the map" bodyClassName="overflow-auto">
          <table className="w-full whitespace-nowrap text-[13.5px]">
            <thead className="sticky top-0 z-10 bg-surface text-left text-[12.5px] text-ink-3 shadow-[0_1px_0_var(--line)]">
              <tr>
                <th className="w-10 px-3 py-2.5" />
                <th className="px-3 py-2.5 font-bold">Well</th>
                {sortHeader("distance_km", "Distance")}
                {sortHeader("total_depth_md", "TD")}
                {sortHeader("similarity", "Similarity")}
                {sortHeader("history", "Worst event")}
                {sortHeader("event_count", "Events")}
                {sortHeader("npt_hours", "NPT")}
                <th className="hidden px-3 py-2.5 font-bold 2xl:table-cell">Completed</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => (
                <motion.tr
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.025 * i }}
                  onMouseEnter={() => setHover(w.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => openWell(w.id)}
                  className={cn("cursor-pointer border-t border-line transition-colors hover:bg-brand-soft/50", hoverWellId === w.id && "bg-brand-soft/60")}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={compareIds.includes(w.id)} onChange={() => toggleCompare(w.id)} className="h-4 w-4 accent-[var(--brand)]" aria-label={`Compare ${w.name}`} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-surface" style={{ background: w.history_severity ? SEVERITY_STYLE[w.history_severity].hex : "#94a3b8", boxShadow: "0 0 0 1px var(--line-2)" }} />
                      <div>
                        <div className="font-mono text-[13.5px] font-semibold text-ink">{w.name}</div>
                        <div className="text-[12px] text-ink-3">
                          {w.id} · {fieldName(w.field)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold tabular text-ink-2">
                      <Navigation size={12} className="text-brand-ink" style={{ transform: `rotate(${w.bearing}deg)` }} />
                      {w.distance_km.toFixed(2)} km <span className="text-ink-4">{w.direction}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold tabular text-ink-2">{fmtDepth(w.total_depth_md)}</td>
                  <td className="px-3 py-2">
                    <SimilarityBadge value={w.similarity} />
                  </td>
                  <td className="px-3 py-2">{w.history_severity ? <SeverityBadge severity={w.history_severity} /> : <span className="text-ink-4">—</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 font-extrabold tabular text-ink">{w.event_count}</span>
                      {w.risk_families.slice(0, 4).map((f) => (
                        <span key={f} title={FAMILY_META[f].label} className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: `color-mix(in oklab, ${FAMILY_META[f].color} 14%, transparent)` }}>
                          <FamilyIcon family={f} size={12} />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-semibold tabular text-ink-2">{w.npt_hours} h</td>
                  <td className="hidden px-3 py-2 text-ink-3 2xl:table-cell">{fmtDate(w.completion_date)}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/dashboard/well/${w.id}`} className="inline-flex items-center gap-1 rounded-[2px] bg-surface-3 px-2.5 py-1 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-brand hover:text-white">
                      Intelligence <ArrowRight size={12} />
                    </Link>
                  </td>
                </motion.tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-[13.5px] text-ink-3">
                    No offset wells match — widen the radius or clear filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
