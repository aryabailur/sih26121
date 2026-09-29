"use client";

import { ArrowUp, BrainCircuit, Crosshair, Filter, Search, Sparkles, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { EvidenceCard } from "@/components/search/EvidenceCard";
import { ScoreRing } from "@/components/ui/animated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Empty, ErrorState, inputCls, Select } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useNWIS } from "@/lib/store";
import type { SearchFilters, SearchResponse } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth, FORMATION_ORDER } from "@/lib/utils";

const DEFAULT_SUGGESTIONS = [
  "What caused mud loss in the Barail Group near 3150m?",
  "Show stuck pipe events in Kopili Shale across all offset wells.",
  "What mitigations were used for overpressure in nearby wells?",
  "Compare drilling parameters between OIL-AX-102 and OIL-AX-99 at 3200m.",
  "What cementing issues were encountered in the Barail Group?",
  "Show evidence for the current stuck pipe risk alert.",
];

const STEPS = ["Understanding the question", "Keyword + semantic + metadata retrieval", "Composing a cited answer"];

function Thinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 420);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="relative h-16 w-16">
        <span className="aurora absolute inset-0 animate-spin-slow rounded-[4px] opacity-80 blur-md" />
        <span className="aurora relative flex h-16 w-16 items-center justify-center rounded-[4px] text-white">
          <Sparkles size={26} className="animate-breathe" />
        </span>
      </div>
      <ol className="space-y-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 text-[13.5px] font-semibold transition-colors", i <= step ? "text-ink" : "text-ink-4")}>
            <span className={cn("h-2 w-2 rounded-full", i < step ? "bg-low" : i === step ? "animate-breathe bg-brand" : "bg-line-2")} />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

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
      // A short floor keeps the retrieval animation readable even on a fast local backend.
      const [res] = await Promise.all([api.search(q, filters, ctx, 6), new Promise((r) => setTimeout(r, 900))]);
      setResult(res);
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

  const setF = (k: keyof SearchFilters, v: string) => setFilters((f) => ({ ...f, [k]: v === "" ? undefined : k === "depth_min" || k === "depth_max" ? Number(v) : v }));
  const suggestions = result?.suggested_queries ?? [`What happened in the ${formation ?? "Barail Group"} near ${Math.round(depth)} m in nearby wells?`, ...DEFAULT_SUGGESTIONS];
  const nFilters = Object.values(filters).filter((v) => v !== undefined).length;

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[250px_minmax(0,1fr)_minmax(0,0.92fr)] xl:overflow-hidden">
      {/* ---------------------------------------------------------------- filters */}
      <Panel title="Filters" icon={<Filter size={16} />} subtitle="Narrow what gets retrieved" bodyClassName="space-y-3.5 overflow-y-auto px-4 pb-4">
        <button
          onClick={() => setUseContext(!useContext)}
          className={cn("w-full rounded-[4px] p-3 text-left text-[12.5px] transition-all", useContext ? "aurora text-white shadow-brand" : "bg-surface-2 text-ink-2 ring-1 ring-line")}
        >
          <div className="flex items-center gap-1.5 text-[13.5px] font-extrabold">
            <Crosshair size={14} /> Active-well context {useContext ? "on" : "off"}
          </div>
          <div className={cn("mt-1 leading-snug", useContext ? "text-white" : "text-ink-3")}>
            OIL-AX-102 @ {fmtDepth(depth)} · {formation ?? "—"} · offsets within {radiusKm} km. Resolves “here”, “this formation”, “current risk”.
          </div>
        </button>
        <label className="block">
          <span className="label">Well</span>
          <Select value={filters.well_id ?? ""} onChange={(e) => setF("well_id", e.target.value)} className="mt-1">
            <option value="">All wells</option>
            {wells.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="label">Formation</span>
          <Select value={filters.formation ?? ""} onChange={(e) => setF("formation", e.target.value)} className="mt-1">
            <option value="">Any</option>
            {FORMATION_ORDER.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="label">Event type</span>
          <Select value={filters.event_type ?? ""} onChange={(e) => setF("event_type", e.target.value)} className="mt-1">
            <option value="">Any</option>
            {Object.entries(FAMILY_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </Select>
        </label>
        <div>
          <span className="label">Depth range (m MD)</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <input type="number" placeholder="min" value={filters.depth_min ?? ""} onChange={(e) => setF("depth_min", e.target.value)} className={cn(inputCls, "font-mono")} />
            <input type="number" placeholder="max" value={filters.depth_max ?? ""} onChange={(e) => setF("depth_max", e.target.value)} className={cn(inputCls, "font-mono")} />
          </div>
        </div>
        <label className="block">
          <span className="label">Document type</span>
          <Select value={filters.doc_type ?? ""} onChange={(e) => setF("doc_type", e.target.value)} className="mt-1">
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
          <span className="label">Event date</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <input type="date" value={filters.date_from ?? ""} onChange={(e) => setF("date_from", e.target.value)} className={cn(inputCls, "px-2 text-[12.5px]")} />
            <input type="date" value={filters.date_to ?? ""} onChange={(e) => setF("date_to", e.target.value)} className={cn(inputCls, "px-2 text-[12.5px]")} />
          </div>
        </div>
        {nFilters > 0 && (
          <Button size="xs" variant="ghost" onClick={() => setFilters({})}>
            Clear {nFilters} filter{nFilters > 1 ? "s" : ""}
          </Button>
        )}
      </Panel>

      {/* ---------------------------------------------------------------- query + answer */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="card relative shrink-0 overflow-hidden p-4">
          <div className="relative">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="aurora flex h-8 w-8 items-center justify-center rounded-[3px] text-white">
                <Sparkles size={16} />
              </span>
              <div>
                <div className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">Ask the offset-well knowledge base</div>
                <div className="text-[12.5px] text-ink-3">Answers are built only from report pages and structured events — every sentence cited.</div>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run();
              }}
              className="group flex items-center gap-2 rounded-[4px] bg-surface p-1.5 pl-4 shadow-md ring-2 ring-line transition-shadow focus-within:shadow-brand focus-within:ring-brand"
            >
              <Search size={18} className="shrink-0 text-ink-3 group-focus-within:text-brand-ink" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Which nearby wells experienced stuck pipe here?"
                className="h-11 min-w-0 flex-1 bg-transparent text-[14.5px] font-medium text-ink outline-none placeholder:text-ink-4"
                aria-label="Evidence query"
              />
              <Button type="submit" variant="aurora" size="md" disabled={loading || query.trim().length < 2} aria-label="Search">
                Ask <ArrowUp size={15} />
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.slice(0, 5).map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  onClick={() => void run(s)}
                  className="rounded-[2px] bg-surface-3 px-3 py-1.5 text-left text-[12.5px] font-semibold text-ink-2 transition-all hover:-translate-y-px hover:bg-brand-soft hover:text-brand-ink"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <Panel
          title="Answer"
          icon={<BrainCircuit size={16} />}
          subtitle={result ? (result.insufficient ? "No grounded answer" : `Based on ${result.evidence.length} evidence source${result.evidence.length === 1 ? "" : "s"} — every sentence is cited`) : "Evidence-first: no answer without source cards"}
          className="min-h-[360px] flex-1"
          bodyClassName="overflow-y-auto px-4 pb-4"
        >
          {loading && <Thinking />}
          {error && <ErrorState message={error} onRetry={() => void run()} />}
          {!loading && !error && !result && (
            <Empty icon={<Sparkles size={24} />} title="Ask about any depth, formation, event or well" hint="Answers are composed only from retrieved report pages and structured events, with document · page · well · depth citations." />
          )}
          {!loading && result && (
            <div className="space-y-5">
              <div className={cn("rounded-[4px] p-4", result.insufficient ? "bg-med-soft" : "bg-surface-2")}>
                {result.insufficient && (
                  <div className="mb-2 flex items-center gap-1.5 text-[13px] font-extrabold text-med-ink">
                    <TriangleAlert size={14} /> Insufficient evidence
                  </div>
                )}
                <div className="space-y-2.5 text-[14.5px] leading-relaxed text-ink">
                  {result.answer_sentences.map((s, i) => (
                    <motion.p key={i} initial={{ opacity: 0, y: 6, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.25 * i, duration: 0.4 }}>
                      {s.text}
                      {s.citations.map((c) => (
                        <button
                          key={c}
                          onClick={() => cite(c)}
                          className={cn("ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-[2px] px-1 align-[2px] text-[11.5px] font-extrabold transition-all", activeCite === c ? "bg-brand text-white shadow-brand" : "bg-brand-soft text-brand-ink hover:bg-brand hover:text-white")}
                          aria-label={`Evidence ${c}`}
                        >
                          {c}
                        </button>
                      ))}
                    </motion.p>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <ScoreRing value={result.confidence} color="var(--brand)" size={48} stroke={5} textClassName="text-[13.5px]" />
                  <div>
                    <div className="label">Confidence</div>
                    <div className="text-[12.5px] text-ink-3">retrieval agreement</div>
                  </div>
                </div>
                {result.related_wells.length > 0 && (
                  <div>
                    <div className="label">Related wells</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {result.related_wells.map((n) => {
                        const w = wells.find((x) => x.name === n);
                        return (
                          <button key={n} onClick={() => w && openWell(w.id)} className="rounded-[2px] bg-surface-3 px-2.5 py-1 font-mono text-[12.5px] font-semibold text-ink-2 transition-colors hover:bg-brand hover:text-white">
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="label mb-1.5">How NWIS read your question</div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="brand">intent: {result.understanding.intent.replace("_", " ")}</Badge>
                  {result.understanding.families.map((f) => (
                    <Badge key={f} tone="violet">
                      {FAMILY_META[f]?.label ?? f}
                    </Badge>
                  ))}
                  {result.understanding.formations.map((f) => (
                    <Badge key={f} tone="green">
                      {f}
                    </Badge>
                  ))}
                  {result.understanding.depth_ranges.map(([a, b], i) => (
                    <Badge key={i} tone="blue">
                      {a === b ? `${Math.round(a)} m` : `${Math.round(a)}–${Math.round(b)} m`}
                    </Badge>
                  ))}
                  {result.understanding.wells.map((w) => (
                    <Badge key={w} tone="neutral">
                      {w}
                    </Badge>
                  ))}
                  {result.understanding.used_context && <Badge tone="amber">used active-well context</Badge>}
                </div>
              </div>

              <div className="rounded-[3px] bg-surface-2 p-3 text-[12.5px] leading-relaxed text-ink-3">
                Retrieval: {result.retrieval.method} — keyword {result.retrieval.weights.keyword} · semantic {result.retrieval.weights.semantic} · metadata {result.retrieval.weights.metadata} · embedder {result.retrieval.embedder} · min relevance{" "}
                {result.retrieval.min_relevance} · generator {result.retrieval.generator}. Answers never go beyond the cited evidence.
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ---------------------------------------------------------------- evidence */}
      <Panel
        title="Supporting evidence"
        subtitle={result ? `${result.evidence.length} card${result.evidence.length === 1 ? "" : "s"} · click a number in the answer to jump` : "Document · page · well · depth · excerpt"}
        bodyClassName="space-y-3 overflow-y-auto px-3 pb-3"
        className="min-h-[360px]"
      >
        <AnimatePresence mode="popLayout">
          {!loading &&
            result?.evidence.map((e, i) => (
              <EvidenceCard
                key={e.id}
                e={e}
                index={i + 1}
                active={activeCite === i + 1}
                ref={(el) => {
                  cardRefs.current[i + 1] = el;
                }}
              />
            ))}
        </AnimatePresence>
        {!loading && result && result.evidence.length === 0 && <Empty title="No evidence cleared the relevance threshold" hint="Try naming a formation, depth or event type, or clear filters." />}
        {!result && !loading && <Empty title="Evidence cards appear here" hint="Each card links to the exact report page it came from." />}
        {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-[4px]" />)}
      </Panel>
    </div>
  );
}

/** Screen D — AI evidence search. */
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <SearchScreen />
    </Suspense>
  );
}
