"use client";

import { GitCompare, Layers, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SeverityGlyph } from "@/components/shared/StatusBadge";
import { ParameterChart, type DepthSeries } from "@/components/well/ParameterChart";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Empty, ErrorState, Loading, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, FormationCorrelation, Parameters } from "@/lib/types";
import { clamp, FAMILY_META, familyOf, fmtDepth, formationColor, SERIES_COLORS } from "@/lib/utils";

const DEFAULT_SET = ["W002", "W003", "W005"];
const PARAMS: { key: keyof Parameters; label: string; unit: string; digits: number }[] = [
  { key: "torque", label: "Torque", unit: "kN·m", digits: 1 },
  { key: "ecd", label: "ECD", unit: "sg", digits: 3 },
  { key: "rop", label: "ROP", unit: "m/hr", digits: 1 },
  { key: "standpipe_pressure", label: "SPP", unit: "psi", digits: 0 },
  { key: "mud_weight", label: "Mud weight", unit: "sg", digits: 3 },
];

function CorrelationPanel({ ids, names, corr, events, domain, depth }: {
  ids: string[];
  names: Record<string, string>;
  corr: FormationCorrelation[];
  events: DrillingEvent[];
  domain: [number, number];
  depth: number;
}) {
  const [lo, hi] = domain;
  const n = ids.length;
  const y = (d: number) => ((clamp(d, lo, hi) - lo) / (hi - lo)) * 100;
  const colL = (i: number) => (i * 100) / n + 100 / n * 0.22;
  const colR = (i: number) => ((i + 1) * 100) / n - 100 / n * 0.22;
  const ticks: number[] = [];
  for (let d = Math.ceil(lo / 250) * 250; d <= hi; d += 250) ticks.push(d);

  return (
    <div className="flex h-full">
      <div className="relative w-10 shrink-0">
        {ticks.map((t) => (
          <span key={t} className="absolute right-1 -translate-y-1/2 font-mono text-[9px] text-cockpit-dim" style={{ top: `${y(t)}%` }}>{t}</span>
        ))}
      </div>
      <div className="relative flex-1">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Formation correlation">
          {/* formation bands */}
          {corr.map((c) =>
            c.wells.map((w) => {
              const i = ids.indexOf(w.well_id);
              if (i < 0) return null;
              return (
                <rect key={`${c.formation}-${w.well_id}`} x={colL(i)} width={colR(i) - colL(i)} y={y(w.top_md)} height={Math.max(0, y(w.base_md) - y(w.top_md))}
                  fill={formationColor(c.formation)} opacity={w.prognosed ? 0.55 : 0.95} />
              );
            }),
          )}
          {/* correlation lines between neighbouring wells */}
          {corr.map((c) =>
            ids.slice(0, -1).map((id, i) => {
              const a = c.wells.find((w) => w.well_id === id);
              const b = c.wells.find((w) => w.well_id === ids[i + 1]);
              if (!a || !b) return null;
              return (
                <line key={`${c.formation}-${i}`} x1={colR(i)} x2={colL(i + 1)} y1={y(a.top_md)} y2={y(b.top_md)}
                  stroke={formationColor(c.formation)} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
              );
            }),
          )}
          {/* bit depth */}
          <line x1={0} x2={100} y1={y(depth)} y2={y(depth)} stroke="#22d3ee" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* well headers */}
        {ids.map((id, i) => (
          <div key={id} className="absolute top-0 -translate-y-full pb-1 text-center" style={{ left: `${(i * 100) / n}%`, width: `${100 / n}%` }}>
            <div className="flex items-center justify-center gap-1 font-mono text-[11px] font-semibold text-slate-100">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              {names[id]}
            </div>
          </div>
        ))}
        {/* event markers (HTML for crisp glyphs) */}
        {events.filter((e) => ids.includes(e.well_id) && e.depth_end >= lo && e.depth_start <= hi).map((e) => {
          const i = ids.indexOf(e.well_id);
          return (
            <div key={e.id} className="absolute flex -translate-y-1/2 items-center gap-0.5" style={{ top: `${y((e.depth_start + e.depth_end) / 2)}%`, left: `${colR(i)}%` }}
              title={`${names[e.well_id]}: ${e.title} ${Math.round(e.depth_start)}–${Math.round(e.depth_end)} m`}>
              <span className="h-px w-2" style={{ background: FAMILY_META[familyOf(e.event_type)].color }} />
              <SeverityGlyph severity={e.severity} color={e.severity === "critical" || e.severity === "high" ? undefined : FAMILY_META[familyOf(e.event_type)].color} size={9} />
            </div>
          );
        })}
        {/* formation names on the first column */}
        {corr.map((c) => {
          const w = c.wells.find((x) => x.well_id === ids[0]);
          if (!w || w.base_md < lo) return null;
          return (
            <span key={c.formation} className="absolute truncate px-1 text-[9.5px] font-semibold text-white/85" style={{ top: `calc(${y(Math.max(w.top_md, lo))}% + 2px)`, left: `${colL(0)}%`, width: `${colR(0) - colL(0)}%` }}>
              {c.formation}
            </span>
          );
        })}
        <span className="absolute right-0 -translate-y-full rounded bg-cockpit-bg/80 px-1 font-mono text-[9.5px] text-cyan-200" style={{ top: `${y(depth)}%` }}>bit {fmtDepth(depth)}</span>
      </div>
    </div>
  );
}

/** Correlate & Compare — active well vs selected offsets on one depth axis (P3 / S4). */
export default function ComparePage() {
  const compareIds = useNWIS((s) => s.compareIds);
  const toggleCompare = useNWIS((s) => s.toggleCompare);
  const wells = useNWIS((s) => s.wells);
  const events = useNWIS((s) => s.events);
  const depth = useNWIS((s) => s.depth);
  const [param, setParam] = useState<keyof Parameters>("torque");
  const [full, setFull] = useState(false);

  useEffect(() => {
    // Idempotent (StrictMode runs effects twice): seed the demo set only when nothing is selected.
    if (useNWIS.getState().compareIds.length === 0) useNWIS.setState({ compareIds: DEFAULT_SET });
  }, []);

  const ids = useMemo(() => ["W001", ...compareIds.filter((x) => x !== "W001")], [compareIds]);
  const names = useMemo(() => Object.fromEntries(wells.map((w) => [w.id, w.name])), [wells]);
  const corr = useAsync(() => api.correlate(ids), [ids.join(",")]);
  const samples = useAsync(() => Promise.all(ids.map((id) => api.wellParameters(id, 10))), [ids.join(",")]);
  const domain: [number, number] = full ? [0, 3950] : [2300, 3950];
  const p = PARAMS.find((x) => x.key === param)!;

  const merged = useMemo(() => {
    const map = new Map<number, Record<string, number> & { md: number }>();
    samples.data?.forEach((res, i) => {
      const id = ids[i];
      for (const s of res.samples) {
        if (id === "W001" && s.md > Math.max(3100, depth)) continue; // active well: recorded to the bit only
        const md = Math.round(s.md);
        const row = map.get(md) ?? { md };
        row[id] = s[param] as number;
        map.set(md, row);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.md - b.md);
  }, [samples.data, ids, param, depth]);

  const series: DepthSeries[] = ids.map((id, i) => ({ key: id, label: names[id] ?? id, color: SERIES_COLORS[i], dashed: id === "W001" }));
  const suggestions = wells.filter((w) => w.role === "offset" && !compareIds.includes(w.id) && w.distance_km < 5).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, 4);

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="glass flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
        <GitCompare size={14} className="text-cyan-300" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-200">Compare set</span>
        {ids.map((id, i) => (
          <span key={id} className="flex items-center gap-1 rounded border border-cockpit-border bg-black/20 px-2 py-0.5 font-mono text-[11px] text-slate-100">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
            {names[id]} {id === "W001" ? <span className="text-cockpit-dim">(active)</span> : (
              <button onClick={() => toggleCompare(id)} className="text-slate-500 hover:text-slate-200" aria-label={`Remove ${names[id]}`}><X size={11} /></button>
            )}
          </span>
        ))}
        {compareIds.length < 4 && suggestions.map((w) => (
          <button key={w.id} onClick={() => toggleCompare(w.id)} className="flex items-center gap-1 rounded border border-dashed border-cockpit-border px-2 py-0.5 font-mono text-[11px] text-slate-400 hover:border-cyan-400/50 hover:text-cyan-200">
            <Plus size={11} /> {w.name} <span className="text-cockpit-dim">{Math.round((w.similarity ?? 0) * 100)}%</span>
          </button>
        ))}
        <Button size="xs" variant={full ? "outline" : "primary"} className="ml-auto" onClick={() => setFull(!full)}>
          <Layers size={12} /> {full ? "Full well" : "Reservoir section"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel title="Formation correlation" subtitle="Tops connected across wells · markers = recorded events · cyan = active bit depth" bodyClassName="p-3 pt-9">
          {corr.loading && !corr.data ? <Loading /> : corr.error ? <ErrorState message={corr.error} onRetry={corr.reload} /> : corr.data && (
            <CorrelationPanel ids={ids} names={names} corr={corr.data.correlation} events={events} domain={domain} depth={depth} />
          )}
        </Panel>
        <Panel
          title={`${p.label} vs depth — all wells`}
          subtitle="Same depth axis · active well dashed, recorded up to the bit"
          actions={<Tabs value={param} onChange={setParam} tabs={PARAMS.map((x) => ({ value: x.key, label: x.label }))} />}
          bodyClassName="p-2"
        >
          {samples.loading && !samples.data ? <Loading /> : merged.length ? (
            <ParameterChart title={p.label} unit={p.unit} digits={p.digits} data={merged} series={series} domain={domain} depth={depth} />
          ) : <Empty title="No parameter records" />}
        </Panel>
      </div>

      <Panel title="Correlation table" subtitle="Formation tops (MD) and events per well — spread shows lateral variation" className="max-h-[34%] shrink-0" bodyClassName="overflow-auto">
        {corr.data && (
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 bg-cockpit-surface/95 text-left text-[10px] uppercase tracking-wider text-cockpit-dim">
              <tr>
                <th className="px-3 py-1.5">Formation</th>
                {ids.map((id) => <th key={id} className="px-2 py-1.5 font-mono normal-case">{names[id]}</th>)}
                <th className="px-2 py-1.5">Top spread</th>
                <th className="px-2 py-1.5">Risk tags</th>
              </tr>
            </thead>
            <tbody>
              {corr.data.correlation.map((c) => (
                <tr key={c.formation} className="border-t border-cockpit-line/70">
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-1.5 text-slate-100"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: formationColor(c.formation) }} />{c.formation}</span>
                  </td>
                  {ids.map((id) => {
                    const w = c.wells.find((x) => x.well_id === id);
                    return (
                      <td key={id} className="px-2 py-1.5 font-mono text-slate-300">
                        {w ? (
                          <>
                            <span className="flex flex-wrap items-center gap-1">
                              {Math.round(w.top_md)}{w.prognosed && <span className="text-[9px] text-cockpit-dim">prog.</span>}
                              {w.events.map((e) => (
                                <span key={e.id} title={`${e.label} ${Math.round(e.depth_start)}–${Math.round(e.depth_end)} m`}>
                                  <SeverityGlyph severity={e.severity} color={e.severity === "critical" || e.severity === "high" ? undefined : FAMILY_META[familyOf(e.event_type)].color} size={8} />
                                </span>
                              ))}
                            </span>
                            {w.pore_pressure_sg != null && (
                              <span className="block text-[9.5px] text-cockpit-dim" title="Porosity · pore pressure · fracture gradient (sg EMW)">
                                φ {w.porosity_pct}% · PP {w.pore_pressure_sg?.toFixed(2)} · FG {w.frac_gradient_sg?.toFixed(2)}
                              </span>
                            )}
                          </>
                        ) : <span className="text-cockpit-dim">not penetrated</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 font-mono text-slate-300">{c.top_spread_m} m</td>
                  <td className="px-2 py-1.5 text-cockpit-muted">{c.risk_tags.join(", ").replaceAll("_", " ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
