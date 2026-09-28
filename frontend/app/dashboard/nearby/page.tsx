"use client";

import { ArrowDownUp, GitCompare, LineChart, MapPinned, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FamilyFilter } from "@/components/shared/FilterBar";
import { SimilarityBadge } from "@/components/shared/SimilarityBadge";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { FieldMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Select } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";
import type { WellListItem } from "@/lib/types";
import { cn, fmtDate, fmtDepth, SEVERITY_RANK } from "@/lib/utils";

const RADIUS_STEPS = [0.5, 1, 1.5, 2, 3, 5, 10, 15, 25, 35, 50];
type SortKey = "distance_km" | "similarity" | "event_count" | "total_depth_md" | "npt_hours" | "history";

/** Screen B — Nearby Wells. */
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
    const val = (w: WellListItem) =>
      sort.key === "history" ? (w.history_severity ? SEVERITY_RANK[w.history_severity] : -1) : ((w[sort.key] as number | null) ?? 0);
    return filtered.sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [wells, events, radiusKm, familyFilter, formation, yearFrom, sort]);

  const outside = wells.filter((w) => w.role === "offset" && w.distance_km > radiusKm).length;
  const formations = useMemo(() => Array.from(new Set(events.map((e) => e.formation))).sort(), [events]);

  const sortHeader = (k: SortKey, children: React.ReactNode, className?: string) => (
    <th key={k} className={cn("px-2 py-2 font-medium", className)}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === "distance_km" ? 1 : -1 }))} className={cn("inline-flex items-center gap-1 hover:text-slate-200", sort.key === k && "text-cyan-200")}>
        {children} <ArrowDownUp size={10} />
      </button>
    </th>
  );

  return (
    <div className="grid h-full grid-cols-1 gap-2 p-2 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Panel title="Search radius & filters" icon={<SlidersHorizontal size={14} />} bodyClassName="space-y-5 overflow-y-auto p-3">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label-caps">Radius from OIL-AX-102</span>
            <span className="font-mono text-lg font-semibold text-cyan-200">{radiusKm} km</span>
          </div>
          <input
            type="range"
            className="nwis-range mt-2 w-full"
            min={0}
            max={RADIUS_STEPS.length - 1}
            step={1}
            value={stepIndex}
            style={{ ["--fill" as string]: `${(stepIndex / (RADIUS_STEPS.length - 1)) * 100}%` }}
            onChange={(e) => setRadius(RADIUS_STEPS[Number(e.target.value)])}
            aria-label="Search radius"
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-cockpit-dim">
            {RADIUS_STEPS.filter((_, i) => i % 2 === 0).map((r) => <span key={r}>{r}</span>)}
          </div>
          <p className="mt-2 text-[11px] text-cockpit-muted">
            {rows.length} offset well{rows.length === 1 ? "" : "s"} shown · {outside} outside the radius. The radius also scopes the risk engine and evidence search.
          </p>
        </div>

        <div>
          <div className="label-caps mb-1.5">Event type</div>
          <FamilyFilter value={familyFilter} onChange={setFamilyFilter} />
        </div>

        <div>
          <div className="label-caps mb-1.5">Formation (event recorded in)</div>
          <Select value={formation} onChange={(e) => setFormation(e.target.value)}>
            <option value="">Any formation</option>
            {formations.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label-caps">Events since</span>
            <span className="font-mono text-sm text-slate-200">{yearFrom}</span>
          </div>
          <input type="range" className="nwis-range mt-1 w-full" min={2016} max={2026} value={yearFrom}
            style={{ ["--fill" as string]: `${((yearFrom - 2016) / 10) * 100}%` }}
            onChange={(e) => setYearFrom(Number(e.target.value))} aria-label="Events since year" />
        </div>

        <div className="rounded-lg border border-cockpit-line bg-black/20 p-3">
          <div className="label-caps mb-1">Compare set ({compareIds.length}/4)</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {compareIds.length === 0 && <span className="text-[11px] text-cockpit-dim">Tick wells in the table to compare them with the active well on one depth axis.</span>}
            {compareIds.map((id) => (
              <button key={id} onClick={() => toggleCompare(id)} className="rounded border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-px font-mono text-[10px] text-cyan-100">
                {wells.find((w) => w.id === id)?.name} ×
              </button>
            ))}
          </div>
          <Link href="/dashboard/compare">
            <Button variant="primary" className="w-full" disabled={compareIds.length === 0}>
              <GitCompare size={13} /> Compare selected
            </Button>
          </Link>
        </div>
      </Panel>

      <div className="grid min-h-0 grid-rows-[minmax(0,1.1fr)_minmax(0,1fr)] gap-2">
        <Panel title="Nearby wells map" icon={<MapPinned size={14} />} subtitle="Hover a row to locate the well · click a marker for its profile" bodyClassName="relative p-1.5">
          <FieldMap />
        </Panel>
        <Panel title="Offset wells" subtitle="Sorted by distance · similarity blends formations, depth coverage, trajectory, parameters and distance" bodyClassName="overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-10 bg-cockpit-surface/95 text-left text-[10.5px] uppercase tracking-wider text-cockpit-dim backdrop-blur">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 font-medium">Well</th>
                {sortHeader("distance_km", "Distance")}
                {sortHeader("total_depth_md", "TD")}
                {sortHeader("similarity", "Similarity")}
                {sortHeader("history", "Worst event")}
                {sortHeader("event_count", "Events")}
                {sortHeader("npt_hours", "NPT")}
                <th className="px-2 py-2 font-medium">Completed</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr
                  key={w.id}
                  onMouseEnter={() => setHover(w.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => openWell(w.id)}
                  className={cn("cursor-pointer border-t border-cockpit-line/70 hover:bg-cyan-400/[0.04]", hoverWellId === w.id && "bg-cyan-400/[0.06]")}
                >
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={compareIds.includes(w.id)} onChange={() => toggleCompare(w.id)} className="accent-cyan-400" aria-label={`Compare ${w.name}`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="font-mono font-semibold text-slate-100">{w.name}</div>
                    <div className="text-[10px] text-cockpit-dim">{w.id} · {w.field.replace(" (Demo Field)", "")}</div>
                  </td>
                  <td className="px-2 py-1.5 font-mono tabular text-slate-300">{w.distance_km.toFixed(2)} km <span className="text-cockpit-dim">{w.direction}</span></td>
                  <td className="px-2 py-1.5 font-mono tabular text-slate-300">{fmtDepth(w.total_depth_md)}</td>
                  <td className="px-2 py-1.5"><SimilarityBadge value={w.similarity} /></td>
                  <td className="px-2 py-1.5">{w.history_severity ? <SeverityBadge severity={w.history_severity} /> : <span className="text-cockpit-dim">—</span>}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 font-mono text-slate-200">{w.event_count}</span>
                      {w.risk_families.slice(0, 3).map((f) => <FamilyChip key={f} family={f} />)}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 font-mono tabular text-slate-300">{w.npt_hours} h</td>
                  <td className="px-2 py-1.5 text-slate-400">{fmtDate(w.completion_date)}</td>
                  <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/dashboard/well/${w.id}`} className="inline-flex items-center gap-1 rounded border border-cockpit-border px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200">
                      <LineChart size={11} /> Intelligence
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-[12px] text-cockpit-muted">No offset wells match — widen the radius or clear filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
