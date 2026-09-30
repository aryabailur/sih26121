"use client";

import { BadgeCheck, Database, ExternalLink, FlaskConical, Gauge, Layers3, MapPinned, Quote, RefreshCw, ScanSearch, Table2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { MudWindowScatter } from "@/components/opendata/MudWindowScatter";
import { OffsetDepthChart } from "@/components/opendata/OffsetDepthChart";
import { ShelfMap } from "@/components/opendata";
import { unitLabel } from "@/components/opendata/palette";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { AnimatedNumber } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { ErrorState, Loading } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync, useWidth } from "@/lib/hooks";
import type { OpenEvent, RiskFamily, ShelfScan } from "@/lib/types";
import { cn, FAMILY_META, fmtDate, fmtDepth, highlightSegments } from "@/lib/utils";

const TRIGGER_WORDS: Record<string, string[]> = {
  mud_loss: ["losses", "loss", "lost", "circulation"],
  stuck_pipe: ["stuck", "sticking"],
  kick: ["kick", "influx", "flow"],
  NPT: ["fishing", "twisted off", "twist", "fish", "parted"],
  wellbore_instability: ["tight hole", "tight spots", "instability", "cavings", "pack-off"],
  cementing_failure: ["squeeze", "cement"],
  torque_spike: ["torque", "stick-slip"],
};

/** Sidetracks and re-entries share the parent well's location. */
const kmLabel = (d: number | undefined) => (d === undefined ? "" : d < 0.05 ? "same well" : `${d.toFixed(1)} km`);

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 rounded-[3px] border border-white/10 bg-white/[0.06] px-3 py-2.5">
      <div className="text-[12px] font-semibold text-white/75">{label}</div>
      <div className="mt-0.5 truncate text-[24px] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: tone ?? "#fff" }}>
        {value}
      </div>
      {sub && <div className="truncate text-[12px] text-white/70">{sub}</div>}
    </div>
  );
}

function Sentence({ e }: { e: OpenEvent }) {
  return (
    <>
      {highlightSegments(e.sentence, TRIGGER_WORDS[e.family] ?? []).map((s, i) =>
        s.hl ? (
          <mark key={i} className="hl">
            {s.t}
          </mark>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
    </>
  );
}

/** Screen — Real-data proof: the NWIS pipeline run on public Norwegian operator records (Sodir FactPages). */
export default function OpenDataPage() {
  const summary = useAsync(() => api.openSummary(), []);
  const shelf = useAsync(() => api.openShelf(), []);
  const wells = useAsync(() => api.openWells(), []);
  const spot = useAsync(() => api.openSpotcheck(), []);
  const [focusName, setFocusName] = useState<string | null>(null);
  const [radiusDraft, setRadiusDraft] = useState(25);
  const [radius, setRadius] = useState(25);
  const focus = focusName ?? summary.data?.area.default_focus ?? "15/9-19 SR";
  const off = useAsync(() => api.openOffsets(focus, radius), [focus, radius]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rescan, setRescan] = useState<ShelfScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [chartRef, chartW] = useWidth<HTMLDivElement>();
  const [mudRef, mudW] = useWidth<HTMLDivElement>();

  useEffect(() => {
    const t = setTimeout(() => setRadius(radiusDraft), 280);
    return () => clearTimeout(t);
  }, [radiusDraft]);

  const s = rescan ?? summary.data?.shelf ?? null;
  const area = summary.data?.area;
  const sc = area?.spotcheck;
  const data = off.data;
  const offsetNames = useMemo(() => (data ? data.offsets.map((o) => o.name) : []), [data]);
  const sel = data?.events.find((e) => e.key === selected) ?? data?.events[0] ?? null;
  const famTotal = s ? Object.values(s.by_family).reduce((a, b) => a + b, 0) : 0;

  const runScan = async () => {
    setScanning(true);
    const t0 = performance.now();
    const r = await api.openShelf(true).catch(() => null);
    // Keep the progress visible for at least a beat so the re-read is perceivable.
    await new Promise((res) => setTimeout(res, Math.max(0, 900 - (performance.now() - t0))));
    if (r) setRescan(r);
    setScanning(false);
  };

  if (summary.error) return <ErrorState message={summary.error} onRetry={summary.reload} className="m-6 card" />;
  if (!s || !area) return <Loading label="Loading public well records…" className="h-full" />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1520px] space-y-3 p-3">
        {/* hero */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[4px] bg-[#0f1220] p-5 text-white shadow-md">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="relative flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[12.5px] font-bold text-[#ffc24d]">
                <BadgeCheck size={15} /> Real-data proof · same pipeline, real operator records
              </div>
              <h2 className="mt-1.5 max-w-[860px] text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em]">
                NWIS read every public well history on the Norwegian shelf — and found the drilling problems in them.
              </h2>
              <p className="mt-2 max-w-[860px] text-[14px] leading-relaxed text-white/80">
                {s.histories.toLocaleString("en-IN")} exploration wellbores ({s.years[0]}–{s.years[1]}) published by the Norwegian Offshore Directorate. The same extractor
                that reads uploaded DDRs pulled out every loss, kick, stuck pipe and fishing job with its depth and sentence, then NWIS ran its offset analysis on
                real formation tops, mud weights and leak-off tests. Rules were tuned on one area and checked by hand on wells outside it.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button variant="primary" size="md" onClick={runScan} disabled={scanning} title="Re-run the extractor over every history, timed">
                <RefreshCw size={15} className={cn(scanning && "animate-spin")} /> {scanning ? "Reading histories…" : "Run the scan again"}
              </Button>
              <a href={s.source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] font-semibold text-white/75 hover:text-white">
                Source: Sodir FactPages <ExternalLink size={12} />
              </a>
            </div>
          </div>
          <div className="relative mt-3 h-1 overflow-hidden rounded-[1px] bg-white/10">
            <AnimatePresence>
              {scanning && <motion.div key="scan" className="h-full bg-[#ffc24d]" initial={{ width: "0%" }} animate={{ width: "92%" }} exit={{ width: "100%", opacity: 0 }} transition={{ duration: 2.4, ease: "easeOut" }} />}
            </AnimatePresence>
          </div>
          <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            <Stat label="Well histories read" value={<AnimatedNumber value={s.histories} from={0} />} sub={`${s.paragraphs.toLocaleString("en-IN")} paragraphs`} />
            <Stat label="Words read" value={<AnimatedNumber value={s.words / 1000} from={0} format={(v) => `${Math.round(v)}k`} />} sub="operator English" />
            <Stat label="Problems found" value={<AnimatedNumber value={s.events} from={0} />} tone="#ffc24d" sub={`in ${s.wells_with_events} wellbores`} />
            <motion.div key={s.seconds} initial={{ scale: rescan ? 1.06 : 1 }} animate={{ scale: 1 }}>
              <Stat label="Scan time" value={`${s.seconds.toFixed(2)} s`} sub={rescan ? "just re-run live" : "one full pass"} />
            </motion.div>
            <Stat
              label="Held-out precision"
              value={sc?.precision != null ? `${Math.round(sc.precision * 100)}%` : "—"}
              tone="#4fdcaa"
              sub={sc ? `${sc.type_correct}/${sc.n} hand-checked` : ""}
            />
            <Stat label="Depth right" value={sc?.depth_accuracy != null ? `${Math.round(sc.depth_accuracy * 100)}%` : "—"} tone="#4fdcaa" sub={sc ? `${sc.depth_correct}/${sc.depth_checked} with a depth` : ""} />
            <Stat label="Wells with mud logs" value={<AnimatedNumber value={area.with_mud} from={0} />} sub={`${area.with_lot} with leak-off tests`} />
          </div>
          <div className="relative mt-3 flex h-3 overflow-hidden rounded-[1px]" title="Problems found on the shelf, by type">
            {Object.entries(s.by_family).map(([f, n]) => (
              <motion.div key={f} initial={{ width: 0 }} animate={{ width: `${(n / famTotal) * 100}%` }} transition={{ duration: 0.9 }} style={{ background: FAMILY_META[f as RiskFamily]?.color ?? "#8b93a7" }} title={`${FAMILY_META[f as RiskFamily]?.label ?? f}: ${n}`} />
            ))}
          </div>
          <div className="relative mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/80">
            {Object.entries(s.by_family).map(([f, n]) => (
              <span key={f} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: FAMILY_META[f as RiskFamily]?.color ?? "#8b93a7" }} />
                {FAMILY_META[f as RiskFamily]?.label ?? f} <b className="tabular text-white">{n}</b>
              </span>
            ))}
            <span className="ml-auto text-white/60">
              {s.source.attribution} Retrieved {fmtDate(s.source.retrieved)}.
            </span>
          </div>
        </motion.section>

        {/* map + focus */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="relative h-[470px] overflow-hidden rounded-[4px] border border-line shadow-md">
            <ShelfMap shelf={shelf.data?.wells} area={wells.data?.wells ?? []} focus={data?.focus ?? null} offsets={offsetNames} radiusKm={radius} onSelect={(n) => { setFocusName(n); setSelected(null); }} />
          </div>
          <Panel title="Offset analysis on real wells" subtitle={area.area} icon={<MapPinned size={16} />} bodyClassName="px-4 pb-4">
            {data ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[20px] font-bold text-ink">{data.focus.name}</div>
                    <div className="text-[13px] text-ink-2">
                      {[data.focus.field && `${data.focus.field} field`, data.focus.purpose?.toLowerCase(), data.focus.content?.toLowerCase(), data.focus.entry_year].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-[12.5px] text-ink-3">
                      {data.focus.operator} · TD {fmtDepth(data.focus.total_depth_md)} MD · water depth {fmtDepth(data.focus.water_depth)}
                    </div>
                  </div>
                  {data.focus.fact_page_url && (
                    <a href={data.focus.fact_page_url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 rounded-[3px] border border-line-2 px-2 py-1 text-[12.5px] font-semibold text-ink-2 hover:border-brand/60 hover:text-brand-ink">
                      FactPage <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink-3">
                    Offset radius <span className="font-mono text-ink">{radiusDraft} km</span>
                  </div>
                  <input type="range" min={5} max={60} step={1} value={radiusDraft} onChange={(e) => setRadiusDraft(Number(e.target.value))} className="nwis-range w-full" style={{ ["--fill" as string]: `${((radiusDraft - 5) / 55) * 100}%` }} aria-label="Offset radius" />
                </div>
                <p className="rounded-[3px] bg-brand-soft px-3 py-2.5 text-[14px] font-semibold leading-snug text-ink">{data.headline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.by_family).map(([f, n]) => (
                    <span key={f} className="flex items-center gap-1.5 rounded-[2px] border border-line bg-surface-2 px-2 py-1 text-[12.5px] font-semibold text-ink-2">
                      <FamilyIcon family={f as RiskFamily} size={13} /> {FAMILY_META[f as RiskFamily]?.label ?? f} <b className="text-ink">{n}</b>
                    </span>
                  ))}
                </div>
                <div className="text-[12.5px] font-bold text-ink-3">Nearest offsets that reported problems — click a map point to change the focus</div>
                <ul className="max-h-[168px] space-y-1 overflow-y-auto pr-1">
                  {data.offsets
                    .filter((o) => o.events)
                    .map((o) => (
                      <li key={o.name} className="flex items-center gap-2 rounded-[3px] px-2 py-1 text-[12.5px] hover:bg-surface-2">
                        <span className="w-[86px] shrink-0 font-mono font-semibold text-ink">{o.name}</span>
                        <span className="w-16 shrink-0 tabular text-ink-3">{kmLabel(o.distance_km)}</span>
                        <span className="flex flex-1 gap-1">
                          {o.families.map((f) => (
                            <FamilyIcon key={f} family={f} size={13} />
                          ))}
                        </span>
                        <span className="text-ink-3">{o.field ?? o.entry_year}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : off.error ? (
              <ErrorState message={off.error} onRetry={off.reload} />
            ) : (
              <Loading />
            )}
          </Panel>
        </div>

        {/* depth correlation */}
        {data && (
          <Panel title="What the offsets reported, on one depth axis" subtitle="Real lithostratigraphic groups per well · diamonds = problems extracted from each well's history — click one" icon={<Layers3 size={16} />} bodyClassName="px-4 pb-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div ref={chartRef} className="min-w-0">
                {chartW > 0 && <OffsetDepthChart focus={data.focus} focusGroups={data.focus_groups} offsets={data.offsets} events={data.events} selected={sel?.key ?? null} onSelect={setSelected} width={chartW} />}
              </div>
              {sel && (
                  <motion.div key={sel.key} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="self-start rounded-[4px] border border-line bg-surface-2 p-4">
                    <div className="flex items-center gap-2">
                      <FamilyIcon family={sel.family} tile size={16} />
                      <div>
                        <div className="text-[15px] font-extrabold text-ink">{sel.label}</div>
                        <div className="text-[12.5px] text-ink-3">
                          <span className="font-mono font-semibold text-ink-2">{sel.well}</span> · {kmLabel(sel.distance_km)} · {fmtDepth(sel.depth_start)}
                          {sel.formation ? ` · ${unitLabel(sel.formation)}` : ""}
                        </div>
                      </div>
                    </div>
                    <blockquote className="mt-3 border-l-2 border-brand pl-3 text-[13.5px] leading-relaxed text-ink">
                      <Quote size={13} className="mb-1 text-ink-3" />
                      <Sentence e={sel} />
                    </blockquote>
                    {sel.evidence !== sel.sentence && <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{sel.evidence.slice(sel.sentence.length).trim()}</p>}
                    <div className="mt-3 flex items-center justify-between text-[12px] text-ink-3">
                      <span>
                        Wellbore history · {sel.section} · ¶{sel.paragraph} · confidence {Math.round(sel.confidence * 100)}%
                      </span>
                      {data.offsets.find((o) => o.name === sel.well)?.fact_page_url && (
                        <a href={data.offsets.find((o) => o.name === sel.well)!.fact_page_url!} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-brand-ink hover:underline">
                          Source <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </motion.div>
              )}
            </div>
          </Panel>
        )}

        <div className="grid gap-3 xl:grid-cols-2">
          {/* real mud window */}
          {data && (
            <Panel title="The mud-weight window the offsets actually drilled" subtitle={`${data.offset_mud.length} mud-weight readings · ${data.offset_lot.length} leak-off tests within ${radius} km`} icon={<Gauge size={16} />} bodyClassName="px-4 pb-4">
              <div ref={mudRef}>{mudW > 0 && <MudWindowScatter data={data} width={mudW} />}</div>
            </Panel>
          )}

          {/* spot-check */}
          <Panel title="How accurate is the extraction?" subtitle="Hand-checked on wells the rules were never tuned on" icon={<FlaskConical size={16} />} bodyClassName="px-4 pb-4">
            {spot.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[3px] bg-low-soft p-3">
                    <div className="text-[12.5px] font-bold text-low-ink">Precision</div>
                    <div className="text-[26px] font-extrabold text-ink">{Math.round((spot.data.summary.precision ?? 0) * 100)}%</div>
                    <div className="text-[12px] text-ink-3">
                      {spot.data.summary.type_correct}/{spot.data.summary.n} real incidents
                    </div>
                  </div>
                  <div className="rounded-[3px] bg-low-soft p-3">
                    <div className="text-[12.5px] font-bold text-low-ink">Depth right</div>
                    <div className="text-[26px] font-extrabold text-ink">{Math.round((spot.data.summary.depth_accuracy ?? 0) * 100)}%</div>
                    <div className="text-[12px] text-ink-3">
                      {spot.data.summary.depth_correct}/{spot.data.summary.depth_checked} with a depth
                    </div>
                  </div>
                  <div className="rounded-[3px] bg-surface-3 p-3">
                    <div className="text-[12.5px] font-bold text-ink-3">Recall</div>
                    <div className="text-[26px] font-extrabold text-ink-3">n/a</div>
                    <div className="text-[12px] text-ink-3">not measured</div>
                  </div>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-2">{spot.data.method}</p>
                <div className="text-[12.5px] font-bold text-ink">Where it went wrong — and why an engineer approves every fact</div>
                <ul className="space-y-1.5">
                  {spot.data.rows
                    .filter((r) => r.verdict !== "correct")
                    .map((r) => (
                      <li key={r.key} className="rounded-[3px] border border-line bg-surface-2 p-2.5 text-[12.5px]">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-[2px] px-1.5 py-px text-[11.5px] font-bold", r.verdict === "depth_off" ? "bg-med-soft text-med-ink" : "bg-crit-soft text-crit-ink")}>
                            {r.verdict === "depth_off" ? "Depth off" : "Not an incident"}
                          </span>
                          <span className="font-mono font-semibold text-ink">{r.well}</span>
                          <span className="text-ink-3">{r.label}</span>
                        </div>
                        <div className="mt-1 italic text-ink-2">“{r.sentence}”</div>
                        {r.note && <div className="mt-1 text-ink-3">{r.note}</div>}
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <Loading />
            )}
          </Panel>
        </div>

        {/* events table */}
        {data && (
          <Panel title="Every problem the offsets reported" subtitle="Extracted sentence · depth · the well's own formation at that depth" icon={<Table2 size={16} />} bodyClassName="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="text-[12px] text-ink-3">
                <tr className="border-y border-line">
                  <th className="px-4 py-2 font-semibold">Problem</th>
                  <th className="px-2 py-2 font-semibold">Well</th>
                  <th className="px-2 py-2 font-semibold">Depth</th>
                  <th className="px-2 py-2 font-semibold">Formation</th>
                  <th className="px-2 py-2 font-semibold">From the history</th>
                  <th className="px-4 py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.key} onClick={() => setSelected(e.key)} className={cn("cursor-pointer border-b border-line align-top transition-colors hover:bg-surface-2", sel?.key === e.key && "bg-brand-soft")}>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        <FamilyIcon family={e.family} size={13} /> {e.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[12.5px] text-ink">
                      {e.well} <span className="font-sans text-ink-3">· {kmLabel(e.distance_km)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[12.5px] text-ink">{fmtDepth(e.depth_start)}</td>
                    <td className="px-2 py-2 text-ink-2">{e.formation ? unitLabel(e.formation) : "—"}</td>
                    <td className="px-2 py-2 leading-snug text-ink-2">
                      <Sentence e={e} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {data.offsets.find((o) => o.name === e.well)?.fact_page_url && (
                        <a href={data.offsets.find((o) => o.name === e.well)!.fact_page_url!} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-1 text-[12.5px] font-semibold text-brand-ink hover:underline">
                          FactPage <ExternalLink size={11} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        <div className="flex items-center gap-2 px-1 pb-2 text-[12px] text-ink-3">
          <Database size={13} /> {area.source.attribution} Bundle built by <span className="font-mono">python -m opendata.sodir</span> · licence{" "}
          <a href={area.source.licence_url} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink hover:underline">
            NLOD 2.0
          </a>
          <ScanSearch size={13} className="ml-2" /> The Assam demo field in the rest of the app is illustrative; this page is real public data.
        </div>
      </div>
    </div>
  );
}
