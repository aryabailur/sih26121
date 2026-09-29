"use client";

import { GitCompare, Layers, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { SeverityGlyph } from "@/components/shared/StatusBadge";
import { ParameterChart, type DepthSeries } from "@/components/well/ParameterChart";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Empty, ErrorState, Loading, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import type { CasingString, DrillingEvent, FormationCorrelation, Parameters } from "@/lib/types";
import { clamp, cn, FAMILY_META, familyOf, fmtDepth, formationColor, FORMATION_ORDER, SEVERITY_STYLE, SERIES_COLORS } from "@/lib/utils";

const DEFAULT_SET = ["W002", "W003", "W005"];
const PARAMS: { key: keyof Parameters; label: string; unit: string; digits: number }[] = [
  { key: "torque", label: "Torque", unit: "kN·m", digits: 1 },
  { key: "ecd", label: "ECD", unit: "sg", digits: 3 },
  { key: "rop", label: "ROP", unit: "m/hr", digits: 1 },
  { key: "standpipe_pressure", label: "SPP", unit: "psi", digits: 0 },
  { key: "mud_weight", label: "Mud weight", unit: "sg", digits: 3 },
];

/** Smooth path through points (monotone-ish cubic between neighbours). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

/** Geological cross-section: strata flow between well bores; events sit on the bore at depth. */
/** Half-width of each casing string around the bore, in cross-section % units (outer strings wider). */
const CASING_DX: Record<string, number> = { '20"': 1.8, '13-3/8"': 1.4, '9-5/8"': 1.05, '7"': 0.72 };

function CrossSection({
  ids,
  names,
  corr,
  casing,
  events,
  domain,
  depth,
}: {
  ids: string[];
  names: Record<string, string>;
  corr: FormationCorrelation[];
  casing: Record<string, CasingString[]>;
  events: DrillingEvent[];
  domain: [number, number];
  depth: number;
}) {
  const [lo, hi] = domain;
  const n = ids.length;
  const xs = ids.map((_, i) => (n === 1 ? 50 : 9 + (i * 82) / (n - 1)));
  const y = (d: number) => ((clamp(d, lo, hi) - lo) / (hi - lo)) * 100;
  const ticks: number[] = [];
  for (let d = Math.ceil(lo / 250) * 250; d <= hi; d += 250) ticks.push(d);

  // Formation tops per well (fall back to a neighbour when a well has no record).
  const ordered = [...corr].sort((a, b) => FORMATION_ORDER.indexOf(a.formation) - FORMATION_ORDER.indexOf(b.formation));
  const topAt = (c: FormationCorrelation, id: string) => c.wells.find((w) => w.well_id === id)?.top_md;
  const baseAt = (c: FormationCorrelation, id: string) => c.wells.find((w) => w.well_id === id)?.base_md;
  const series = (c: FormationCorrelation, pick: (c: FormationCorrelation, id: string) => number | undefined) => {
    const vals = ids.map((id) => pick(c, id));
    return vals.map((v, i) => v ?? vals.slice(0, i).reverse().find((x) => x !== undefined) ?? vals.slice(i).find((x) => x !== undefined) ?? hi);
  };

  return (
    <div className="flex h-full">
      <div className="relative w-11 shrink-0">
        {ticks.map((t) => (
          <span key={t} className="absolute right-1.5 -translate-y-1/2 font-mono text-[11px] font-medium text-ink-4" style={{ top: `${y(t)}%` }}>
            {t.toLocaleString("en-IN")}
          </span>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden rounded-[4px] ring-1 ring-inset ring-line">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Geological cross-section">
          <defs>
            <pattern id="grain" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
              <circle cx="0.4" cy="0.4" r="0.18" fill="white" opacity="0.35" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="var(--surface-2)" />
          {ordered.map((c, i) => {
            const tops = series(c, topAt).map((t, k) => [xs[k], y(t)] as [number, number]);
            const bases = series(c, baseAt).map((b, k) => [xs[k], y(b)] as [number, number]);
            const top = [[0, tops[0][1]] as [number, number], ...tops, [100, tops[tops.length - 1][1]] as [number, number]];
            const base = [[0, bases[0][1]] as [number, number], ...bases, [100, bases[bases.length - 1][1]] as [number, number]];
            const back = [...base].reverse();
            const d = `${smooth(top)} L${back[0][0]},${back[0][1]} ${smooth(back).slice(1)} Z`;
            return (
              <motion.g key={c.formation} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 * i, duration: 0.5 }}>
                <path d={d} fill={formationColor(c.formation)} opacity={0.92} />
                <path d={d} fill="url(#grain)" />
                <motion.path d={smooth(top)} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={1.4} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2 + 0.08 * i, duration: 0.9 }} />
              </motion.g>
            );
          })}
          {/* well bores */}
          {ids.map((id, i) => (
            <g key={id}>
              <line x1={xs[i]} x2={xs[i]} y1={0} y2={100} stroke="#101218" strokeOpacity={0.85} strokeWidth={id === "W001" ? 6 : 4.5} vectorEffect="non-scaling-stroke" />
              <line x1={xs[i]} x2={xs[i]} y1={0} y2={100} stroke={SERIES_COLORS[i]} strokeWidth={id === "W001" ? 3 : 2} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {/* casing strings: walls either side of the bore (outer strings sit wider); planned strings dashed */}
          {ids.map((id, i) =>
            (casing[id] ?? []).map((c) => {
              if (c.shoe_md < lo || c.top_md > hi) return null;
              const dx = CASING_DX[c.size_in] ?? 0.9;
              const y1 = y(Math.max(c.top_md, lo));
              const y2 = y(Math.min(c.shoe_md, hi));
              return [-dx, dx].map((o) => (
                <line
                  key={`${id}-${c.id}-${o}`}
                  x1={xs[i] + o}
                  x2={xs[i] + o}
                  y1={y1}
                  y2={y2}
                  stroke="white"
                  strokeOpacity={0.9}
                  strokeWidth={1.6}
                  strokeDasharray={c.planned ? "4 3" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ));
            }),
          )}
          {/* bit depth */}
          <line x1={0} x2={100} y1={y(depth)} y2={y(depth)} stroke="var(--brand)" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* casing shoes */}
        {ids.map((id, i) =>
          (casing[id] ?? [])
            .filter((c) => c.shoe_md >= lo && c.shoe_md <= hi)
            .map((c) => (
              <div
                key={`${id}-${c.id}-shoe`}
                className="pointer-events-auto absolute z-[5] flex -translate-y-full items-end"
                style={{ top: `${y(c.shoe_md)}%`, left: `calc(${xs[i] + (CASING_DX[c.size_in] ?? 0.9)}% - 1px)` }}
                title={`${names[id]}: ${c.size_in} ${c.name} shoe at ${fmtDepth(c.shoe_md)}${c.planned ? " (planned)" : ""}`}
              >
                <span className="h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-white drop-shadow" />
                <span className="ml-0.5 whitespace-nowrap rounded-[2px] bg-[#101218]/80 px-1 py-px font-mono text-[11px] font-semibold text-white">
                  {c.size_in}
                  {c.planned ? " plan" : ""}
                </span>
              </div>
            )),
        )}
        {/* formation labels (left gutter) */}
        {ordered.map((c) => {
          const t = series(c, topAt)[0];
          const b = series(c, baseAt)[0];
          if (b < lo || t > hi) return null;
          return (
            <span key={c.formation} className="absolute -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-[#0c0e14]/55 px-1 py-px text-[11px] font-extrabold uppercase tracking-wide text-white" style={{ top: `calc(${y(Math.max(t, lo))}% + 4px)`, left: `${n > 1 ? (xs[0] + xs[1]) / 2 : 25}%` }}>
              {c.formation.split(" ")[0]}
            </span>
          );
        })}
        {/* well headers */}
        {ids.map((id, i) => (
          <div key={id} className="absolute top-2 -translate-x-1/2" style={{ left: `${xs[i]}%` }}>
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-[2px] bg-surface/95 px-2.5 py-1 font-mono text-[12.5px] font-semibold text-ink shadow-md">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              {names[id]}
            </span>
          </div>
        ))}
        {/* events on the bores */}
        {events
          .filter((e) => ids.includes(e.well_id) && e.depth_end >= lo && e.depth_start <= hi)
          .map((e) => {
            const i = ids.indexOf(e.well_id);
            const fam = familyOf(e.event_type);
            return (
              <div
                key={e.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ top: `${y((e.depth_start + e.depth_end) / 2)}%`, left: `${xs[i]}%` }}
                title={`${names[e.well_id]}: ${e.title} ${Math.round(e.depth_start)}–${Math.round(e.depth_end)} m`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md" style={{ boxShadow: `0 0 0 2px ${e.severity === "critical" || e.severity === "high" ? SEVERITY_STYLE[e.severity].hex : FAMILY_META[fam].color}, 0 4px 10px rgb(0 0 0/0.3)` }}>
                  <FamilyIcon family={fam} size={12} />
                </span>
              </div>
            );
          })}
        <span className="absolute right-2 -translate-y-[calc(100%+3px)] rounded-[2px] bg-brand px-2 py-0.5 font-mono text-[11.5px] font-semibold text-white shadow-brand" style={{ top: `${y(depth)}%` }}>
          bit {fmtDepth(depth)}
        </span>
      </div>
    </div>
  );
}

/** Correlate & compare — active well vs selected offsets on one depth axis (P3 / S4). */
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
  // Mud-weight programme per well / formation, flagged where it differs from the active well's plan.
  const mw = (id: string, formation: string) => corr.data?.mud_program?.[id]?.[formation];
  const mwDiffers = (id: string, formation: string) => {
    const a = mw("W001", formation);
    const b = mw(id, formation);
    return id !== "W001" && a !== undefined && b !== undefined && Math.abs(a - b) >= 0.005;
  };
  const shoeSpread = (size: string) => {
    const shoes = ids.flatMap((id) => (corr.data?.casing?.[id] ?? []).filter((c) => c.size_in === size).map((c) => c.shoe_md));
    return shoes.length ? Math.round(Math.max(...shoes) - Math.min(...shoes)) : 0;
  };

  const suggestions = wells
    .filter((w) => w.role === "offset" && !compareIds.includes(w.id) && w.distance_km < 5)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 xl:overflow-hidden">
      <div className="card flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-1 flex items-center gap-2 text-[14px] font-extrabold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-brand-soft text-brand-ink">
            <GitCompare size={16} />
          </span>
          Compare set
        </span>
        {ids.map((id, i) => (
          <motion.span key={id} layout initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 rounded-[2px] bg-surface-3 py-1 pl-2.5 pr-2 font-mono text-[12.5px] font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
            {names[id]}{" "}
            {id === "W001" ? (
              <span className="font-sans text-[12px] font-bold text-brand-ink">active</span>
            ) : (
              <button onClick={() => toggleCompare(id)} className="rounded-[3px] p-0.5 text-ink-3 hover:bg-line-2 hover:text-ink" aria-label={`Remove ${names[id]}`}>
                <X size={12} />
              </button>
            )}
          </motion.span>
        ))}
        {compareIds.length < 4 &&
          suggestions.map((w) => (
            <button key={w.id} onClick={() => toggleCompare(w.id)} className="flex items-center gap-1.5 rounded-[2px] border border-dashed border-line-2 px-2.5 py-1 font-mono text-[12.5px] font-medium text-ink-3 transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-ink">
              <Plus size={12} /> {w.name} <span className="font-sans text-[12px] font-bold">{Math.round((w.similarity ?? 0) * 100)}%</span>
            </button>
          ))}
        <Button variant={full ? "secondary" : "soft"} className="ml-auto" onClick={() => setFull(!full)}>
          <Layers size={14} /> {full ? "Full well" : "Reservoir section"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Geological cross-section" subtitle="Formation tops correlated across wells · white walls = casing, ▸ = shoe · icons = recorded events · dashed = bit" bodyClassName="px-3 pb-3" className="min-h-[520px] xl:min-h-0">
          {corr.loading && !corr.data ? <Loading /> : corr.error ? <ErrorState message={corr.error} onRetry={corr.reload} /> : corr.data && <CrossSection ids={ids} names={names} corr={corr.data.correlation} casing={corr.data.casing ?? {}} events={events} domain={domain} depth={depth} />}
        </Panel>
        <Panel
          title={`${p.label} vs depth`}
          subtitle="Same depth axis · active well dashed, recorded up to the bit"
          actions={<Tabs size="xs" value={param} onChange={setParam} tabs={PARAMS.map((x) => ({ value: x.key, label: x.label }))} />}
          bodyClassName="px-3 pb-3"
          className="min-h-[520px] xl:min-h-0"
        >
          {samples.loading && !samples.data ? <Loading /> : merged.length ? <ParameterChart title={p.label} unit={p.unit} digits={p.digits} data={merged} series={series} domain={domain} depth={depth} /> : <Empty title="No parameter records" />}
        </Panel>
      </div>

      <Panel title="Correlation table" subtitle="Formation tops (MD), reservoir properties, mud-weight programme and casing per well — amber = programme differs from the active well" className="max-h-[32%] min-h-[180px] shrink-0" bodyClassName="overflow-auto">
        {corr.data && (
          <table className="w-full whitespace-nowrap text-[13px]">
            <thead className="sticky top-0 bg-surface text-left text-[12.5px] text-ink-3 shadow-[0_1px_0_var(--line)]">
              <tr>
                <th className="px-4 py-2 font-bold">Formation</th>
                {ids.map((id, i) => (
                  <th key={id} className="px-3 py-2 font-mono font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                      {names[id]}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 font-bold">Top spread</th>
                <th className="px-3 py-2 font-bold">Risk tags</th>
              </tr>
            </thead>
            <tbody>
              {corr.data.correlation.map((c) => (
                <tr key={c.formation} className="border-t border-line">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 font-bold text-ink">
                      <span className="h-3 w-3 rounded-[2px]" style={{ background: formationColor(c.formation) }} />
                      {c.formation}
                    </span>
                  </td>
                  {ids.map((id) => {
                    const w = c.wells.find((x) => x.well_id === id);
                    return (
                      <td key={id} className="px-3 py-2 font-mono text-ink-2">
                        {w ? (
                          <>
                            <span className="flex flex-wrap items-center gap-1 font-semibold text-ink">
                              {Math.round(w.top_md)}
                              {w.prognosed && <span className="font-sans text-[11px] font-bold text-ink-4">prog.</span>}
                              {w.events.map((e) => (
                                <span key={e.id} title={`${e.label} ${Math.round(e.depth_start)}–${Math.round(e.depth_end)} m`}>
                                  <SeverityGlyph severity={e.severity} color={e.severity === "critical" || e.severity === "high" ? undefined : FAMILY_META[familyOf(e.event_type)].color} size={9} />
                                </span>
                              ))}
                            </span>
                            {w.pore_pressure_sg != null && (
                              <span className="block text-[11.5px] text-ink-3" title="Porosity · pore pressure · fracture gradient (sg EMW)">
                                φ {w.porosity_pct}% · PP {w.pore_pressure_sg?.toFixed(2)} · FG {w.frac_gradient_sg?.toFixed(2)}
                              </span>
                            )}
                            {mw(id, c.formation) !== undefined && (
                              <span
                                className={cn("mt-0.5 inline-block rounded-[2px] px-1 text-[11.5px] font-semibold", mwDiffers(id, c.formation) ? "bg-med-soft text-med-ink" : "text-ink-3")}
                                title={mwDiffers(id, c.formation) ? "Mud-weight programme differs from the active well in this formation" : "Mud-weight programme (sg)"}
                              >
                                MW {mw(id, c.formation)!.toFixed(2)} sg
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="font-sans text-ink-4">not penetrated</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 font-mono font-semibold text-ink-2">{c.top_spread_m} m</td>
                  <td className="min-w-[180px] whitespace-normal px-3 py-2 text-ink-3">{c.risk_tags.join(", ").replaceAll("_", " ") || "—"}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line-2 bg-surface-2">
                <td className="px-4 py-2 align-top">
                  <span className="flex items-center gap-2 font-bold text-ink">
                    <span className="h-3 w-3 rounded-[2px] border-2 border-ink-3" />
                    Casing programme
                  </span>
                </td>
                {ids.map((id) => (
                  <td key={id} className="px-3 py-2 align-top font-mono text-[12.5px] text-ink-2">
                    {(corr.data!.casing?.[id] ?? []).map((c) => (
                      <span key={c.id} className="block whitespace-nowrap" title={`${c.name}${c.planned ? " (planned)" : ""}`}>
                        <b className="text-ink">{c.size_in}</b> shoe {Math.round(c.shoe_md).toLocaleString("en-IN")}
                        {c.planned ? <span className="ml-1 font-sans text-[11px] font-bold text-brand-ink">plan</span> : null}
                      </span>
                    ))}
                  </td>
                ))}
                <td className="px-3 py-2 align-top font-mono font-semibold text-ink-2">{shoeSpread('9-5/8"')} m</td>
                <td className="min-w-[180px] whitespace-normal px-3 py-2 align-top text-ink-3">9-5/8&quot; intermediate shoe spread; the active well&apos;s 7&quot; liner is still planned</td>
              </tr>
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
