"use client";

import { AlertTriangle, BrainCircuit, CornerDownLeft, Crosshair, FileSearch, Filter, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { EvidenceCard } from "@/components/search/EvidenceCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Empty, ErrorState, Loading, Select } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useNWIS } from "@/lib/store";
import type { SearchFilters, SearchResponse } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth } from "@/lib/utils";

const DEFAULT_SUGGESTIONS = [
  "What caused mud loss in the Barail Group near 3150m?",
  "Show stuck pipe events in Kopili Shale across all offset wells.",
  "What mitigations were used for overpressure in nearby wells?",
  "Compare drilling parameters between OIL-AX-102 and OIL-AX-99 at 3200m.",
  "What cementing issues were encountered in the Barail Group?",
  "Show evidence for the current stuck pipe risk alert.",
];

function SearchScreen() {
  const params = useSearchParams();
  const depth = useNWIS((s) => s.depth);
  const radiusKm = useNWIS((s) => s.radiusKm);
  const formation = useNWIS((s) => s.evaluation?.current_formation ?? null);
  const wells = useNWIS((s) => s.wells);
  const openWell = useNWIS((s) => s.openWell);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [useContext, setUseContext] = useState(true);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const ran = useRef(false);

  const run = async (q = query) => {
    if (q.trim().length < 2) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setActiveCite(null);
    try {
      const ctx = useContext ? { well_id: "W001", depth, formation, radius_km: radiusKm } : { well_id: "W001" };
      setResult(await api.search(q, filters, ctx, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q && !ran.current) {
      ran.current = true;
      void run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const cite = (n: number) => {
    setActiveCite(n);
    cardRefs.current[n]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const setF = (k: keyof SearchFilters, v: string) =>
    setFilters((f) => ({ ...f, [k]: v === "" ? undefined : k === "depth_min" || k === "depth_max" ? Number(v) : v }));
  const suggestions = result?.suggested_queries ?? [
    `What happened in the ${formation ?? "Barail Group"} near ${Math.round(depth)} m in nearby wells?`,
    ...DEFAULT_SUGGESTIONS,
  ];
  const nFilters = Object.values(filters).filter((v) => v !== undefined).length;

  return (
    <div className="grid h-full grid-cols-1 gap-2 p-2 xl:grid-cols-[230px_minmax(0,1fr)_minmax(0,0.9fr)]">
      {/* ---------------------------------------------------------------- filters */}
      <Panel title="Filters" icon={<Filter size={14} />} subtitle="Metadata filters narrow retrieval" bodyClassName="space-y-3 overflow-y-auto p-3">
        <label className="block">
          <span className="label-caps">Well</span>
          <Select value={filters.well_id ?? ""} onChange={(e) => setF("well_id", e.target.value)}>
            <option value="">All wells</option>
            {wells.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="label-caps">Formation</span>
          <Select value={filters.formation ?? ""} onChange={(e) => setF("formation", e.target.value)}>
            <option value="">Any</option>
            {["Girujan Shale", "Tipam Sandstone", "Namsang Formation", "Barail Group", "Kopili Shale", "Sylhet Limestone"].map((f) => <option key={f}>{f}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="label-caps">Event type</span>
          <Select value={filters.event_type ?? ""} onChange={(e) => setF("event_type", e.target.value)}>
            <option value="">Any</option>
            {Object.entries(FAMILY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </Select>
        </label>
        <div>
          <span className="label-caps">Depth range (m MD)</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <input type="number" placeholder="min" value={filters.depth_min ?? ""} onChange={(e) => setF("depth_min", e.target.value)} className="h-8 rounded-md border border-cockpit-border bg-cockpit-bg/80 px-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-400/60" />
            <input type="number" placeholder="max" value={filters.depth_max ?? ""} onChange={(e) => setF("depth_max", e.target.value)} className="h-8 rounded-md border border-cockpit-border bg-cockpit-bg/80 px-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-400/60" />
          </div>
        </div>
        <label className="block">
          <span className="label-caps">Document type</span>
          <Select value={filters.doc_type ?? ""} onChange={(e) => setF("doc_type", e.target.value)}>
            <option value="">Any</option>
            <option value="DDR">DDR</option>
            <option value="WCR">WCR</option>
            <option value="mud_log">Mud log</option>
            <option value="cementing_report">Cementing report</option>
            <option value="NPT_report">NPT report</option>
            <option value="casing_report">Casing / programme</option>
          </Select>
        </label>
        <div>
          <span className="label-caps">Event date</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <input type="date" value={filters.date_from ?? ""} onChange={(e) => setF("date_from", e.target.value)} className="h-8 rounded-md border border-cockpit-border bg-cockpit-bg/80 px-1.5 text-[11px] text-slate-200 outline-none" />
            <input type="date" value={filters.date_to ?? ""} onChange={(e) => setF("date_to", e.target.value)} className="h-8 rounded-md border border-cockpit-border bg-cockpit-bg/80 px-1.5 text-[11px] text-slate-200 outline-none" />
          </div>
        </div>
        <button onClick={() => setUseContext(!useContext)} className={cn("w-full rounded-md border p-2 text-left text-[11px]", useContext ? "border-cyan-400/50 bg-cyan-400/5 text-cyan-100" : "border-cockpit-border text-slate-400")}>
          <div className="flex items-center gap-1.5 font-semibold"><Crosshair size={12} /> Active-well context {useContext ? "ON" : "OFF"}</div>
          <div className="mt-0.5 text-cockpit-muted">OIL-AX-102 @ {fmtDepth(depth)} · {formation ?? "—"} · offsets within {radiusKm} km. Resolves “here”, “this formation”, “current risk”.</div>
        </button>
        {nFilters > 0 && <Button size="xs" variant="ghost" onClick={() => setFilters({})}>Clear {nFilters} filter{nFilters > 1 ? "s" : ""}</Button>}
      </Panel>

      {/* ---------------------------------------------------------------- query + answer */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="glass rounded-lg p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
            className="flex items-center gap-2 rounded-md border border-cockpit-border bg-black/30 px-3 focus-within:border-cyan-400/60"
          >
            <FileSearch size={16} className="text-cyan-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask the offset-well knowledge base — e.g. “Which nearby wells experienced stuck pipe here?”"
              className="h-11 flex-1 bg-transparent text-[13.5px] text-slate-100 outline-none placeholder:text-slate-500"
              aria-label="Evidence query"
            />
            <Button type="submit" variant="primary" disabled={loading || query.trim().length < 2}>
              Search <CornerDownLeft size={12} />
            </Button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 7).map((s) => (
              <button key={s} onClick={() => void run(s)} className="rounded-full border border-cockpit-border px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-400/50 hover:text-cyan-100">
                {s}
              </button>
            ))}
          </div>
        </div>

        <Panel
          title="Answer"
          icon={<BrainCircuit size={14} />}
          subtitle={result ? (result.insufficient ? "No grounded answer" : `Based on ${result.evidence.length} evidence source${result.evidence.length === 1 ? "" : "s"} — every sentence is cited`) : "Evidence-first: no answer is shown without source cards"}
          className="min-h-0 flex-1"
          bodyClassName="overflow-y-auto p-4"
        >
          {loading && <Loading label="Retrieving evidence (keyword + semantic + metadata)…" />}
          {error && <ErrorState message={error} onRetry={() => void run()} />}
          {!loading && !error && !result && (
            <Empty icon={<Sparkles size={22} />} title="Ask about any depth, formation, event or well" hint="Answers are composed only from retrieved report pages and structured events, with document · page · well · depth citations." />
          )}
          {!loading && result && (
            <div className="space-y-4 animate-fade-in">
              <div className={cn("rounded-lg border p-3", result.insufficient ? "border-amber-500/40 bg-amber-500/5" : "border-cockpit-line bg-black/20")}>
                {result.insufficient && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                    <AlertTriangle size={13} /> Insufficient evidence
                  </div>
                )}
                <div className="space-y-2 text-[13.5px] leading-relaxed text-slate-100">
                  {result.answer_sentences.map((s, i) => (
                    <p key={i}>
                      {s.text}
                      {s.citations.map((c) => (
                        <button key={c} onClick={() => cite(c)} className={cn("ml-0.5 align-super rounded px-1 font-mono text-[10px] font-bold", activeCite === c ? "bg-cyan-300 text-cockpit-bg" : "bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/30")} aria-label={`Evidence ${c}`}>
                          {c}
                        </button>
                      ))}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <div className="label-caps">Confidence</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${result.confidence * 100}%` }} />
                    </div>
                    <span className="font-mono text-[12px] text-slate-100">{Math.round(result.confidence * 100)}%</span>
                  </div>
                </div>
                {result.related_wells.length > 0 && (
                  <div>
                    <div className="label-caps">Related wells</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.related_wells.map((n) => {
                        const w = wells.find((x) => x.name === n);
                        return (
                          <button key={n} onClick={() => w && openWell(w.id)} className="rounded border border-cockpit-border px-1.5 py-px font-mono text-[11px] text-slate-200 hover:border-cyan-400/60">
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="label-caps mb-1">Query understanding</div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="cyan">intent: {result.understanding.intent.replace("_", " ")}</Badge>
                  {result.understanding.families.map((f) => <Badge key={f} tone="violet">{FAMILY_META[f]?.label ?? f}</Badge>)}
                  {result.understanding.formations.map((f) => <Badge key={f} tone="green">{f}</Badge>)}
                  {result.understanding.depth_ranges.map(([a, b], i) => <Badge key={i} tone="blue">{a === b ? `${Math.round(a)} m` : `${Math.round(a)}–${Math.round(b)} m`}</Badge>)}
                  {result.understanding.wells.map((w) => <Badge key={w} tone="neutral">{w}</Badge>)}
                  {result.understanding.used_context && <Badge tone="amber">used active-well context</Badge>}
                </div>
              </div>

              <div className="rounded-md border border-cockpit-line bg-black/20 p-2 text-[10.5px] leading-relaxed text-cockpit-dim">
                Retrieval: {result.retrieval.method} — keyword {result.retrieval.weights.keyword} · semantic {result.retrieval.weights.semantic} · metadata {result.retrieval.weights.metadata} ·
                embedder {result.retrieval.embedder} · min relevance {result.retrieval.min_relevance} · generator {result.retrieval.generator}. Answers never go beyond the cited evidence.
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ---------------------------------------------------------------- evidence */}
      <Panel
        title="Supporting evidence"
        subtitle={result ? `${result.evidence.length} card${result.evidence.length === 1 ? "" : "s"} · click a superscript to jump` : "Document · page · well · depth · excerpt"}
        bodyClassName="space-y-2 overflow-y-auto p-2"
      >
        {result?.evidence.map((e, i) => (
          <EvidenceCard key={e.id} e={e} index={i + 1} active={activeCite === i + 1} ref={(el) => { cardRefs.current[i + 1] = el; }} />
        ))}
        {result && result.evidence.length === 0 && <Empty title="No evidence cleared the relevance threshold" hint="Try naming a formation, depth or event type, or clear filters." />}
        {!result && <Empty title="Evidence cards appear here" />}
      </Panel>
    </div>
  );
}

/** Screen D — AI Evidence Search. */
export default function SearchPage() {
  return (
    <Suspense fallback={<Loading className="h-full" />}>
      <SearchScreen />
    </Suspense>
  );
}
