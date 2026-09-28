"use client";

import { CheckCircle2, Database, FileStack, FileText, ScanText, Search, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExtractedEvents, type Decision } from "@/components/documents/ExtractedEvents";
import { ProcessingStepper } from "@/components/documents/ProcessingStepper";
import { UploadZone } from "@/components/documents/UploadZone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Empty, ErrorState, Loading, Select, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import type { ExtractionResult, ProcessingStatus } from "@/lib/types";
import { cn, DOC_TYPE_LABEL, fmtDate, highlightSegments } from "@/lib/utils";

const ENTITY_TONE: Record<string, "cyan" | "green" | "blue" | "amber" | "violet" | "neutral"> = {
  well: "cyan",
  formation: "green",
  depth: "blue",
  mud_weight: "amber",
  casing_size: "violet",
  date: "neutral",
  chemical: "amber",
  equipment: "neutral",
};

/** Screen F — Document Intelligence. */
export default function DocumentsPage() {
  const refreshStatic = useNWIS((s) => s.refreshStatic);
  const evaluateNow = useNWIS((s) => s.evaluateNow);
  const openSource = useNWIS((s) => s.openSource);
  const kbVersion = useNWIS((s) => s.kbVersion);
  const [docId, setDocId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [wellId, setWellId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ events_saved: number; chunks_indexed: number; skipped?: { candidate_id: string; reason: string }[] } | null>(null);
  const [view, setView] = useState<"events" | "entities" | "text">("events");
  const [typeFilter, setTypeFilter] = useState("");
  const library = useAsync(() => api.documents(), [kbVersion, saved]);
  const logRef = useRef<HTMLDivElement>(null);

  const busy = Boolean(docId && status && !["review", "saved"].includes(status.status) && !status.error);

  const start = async (fn: () => Promise<{ document_id: string }>) => {
    setError(null);
    setSaved(null);
    setExtraction(null);
    setDecisions([]);
    setStatus(null);
    try {
      const r = await fn();
      setDocId(r.document_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Poll the pipeline until it reaches human review.
  useEffect(() => {
    if (!docId) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await api.docStatus(docId);
        if (stop) return;
        setStatus(s);
        if (s.status === "review" || s.status === "saved") {
          const ex = await api.extracted(docId);
          if (stop) return;
          setExtraction(ex);
          setDecisions(ex.events);
          setWellId(ex.detected.well_id ?? "");
          return;
        }
        setTimeout(tick, 400);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [docId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [status?.log.length]);

  const commit = async () => {
    if (!docId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.commit(
        docId,
        decisions.map((d) => ({
          candidate_id: d.candidate_id, approved: d.approved, event_type: d.event_type, depth_start: d.depth_start, depth_end: d.depth_end,
          formation: d.formation, severity: d.severity, description: d.description, root_cause: d.root_cause, mitigation_action: d.mitigation_action,
        })),
        wellId || null,
      );
      setSaved(res);
      setStatus(await api.docStatus(docId));
      await refreshStatic();
      await evaluateNow();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const approved = decisions.filter((d) => d.approved).length;
  const docs = (library.data?.documents ?? []).filter((d) => !typeFilter || d.doc_type === typeFilter);
  const allHighlights = decisions.map((d) => d.evidence_text.slice(0, 40)).filter(Boolean);

  return (
    <div className="grid h-full grid-cols-1 gap-2 overflow-y-auto p-2 xl:grid-cols-[340px_minmax(0,1fr)] xl:overflow-hidden">
      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Ingest a report" icon={<FileStack size={14} />} subtitle="Upload → OCR/text → chunk → extract → review → save" className="shrink-0" bodyClassName="p-3">
          <UploadZone busy={busy} onFile={(f) => void start(() => api.upload(f))} onSample={() => void start(() => api.uploadSample())} />
        </Panel>
        <Panel
          title="Knowledge-base library"
          icon={<Database size={14} />}
          subtitle={`${library.data?.documents.length ?? 0} documents indexed`}
          className="min-h-[300px] xl:min-h-0 xl:flex-1"
          actions={
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-7 w-28">
              <option value="">All types</option>
              {Object.entries(DOC_TYPE_LABEL).slice(0, 6).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          }
          bodyClassName="overflow-y-auto p-2"
        >
          {library.loading && !library.data && <Loading />}
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id} className="group flex items-center gap-2 rounded border border-cockpit-line px-2 py-1.5 hover:border-cyan-400/40">
                <button onClick={() => openSource({ documentId: d.id, page: null })} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="shrink-0 text-cyan-300/80" />
                    <span className="truncate text-[11.5px] text-slate-100">{d.title}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-cockpit-dim">
                    <span>{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</span>
                    <span>{d.well_name}</span>
                    <span>{fmtDate(d.date)}</span>
                    <span>{d.chunk_count} chunks · {d.event_count} events</span>
                  </div>
                </button>
                {d.source_status === "uploaded" ? (
                  <>
                    <Badge tone={d.processing_status === "indexed" ? "green" : "amber"}>{d.processing_status === "indexed" ? "uploaded" : d.processing_status}</Badge>
                    <button
                      title="Remove uploaded document"
                      onClick={async () => {
                        await api.deleteDocument(d.id);
                        if (d.id === docId) {
                          setDocId(null);
                          setStatus(null);
                          setExtraction(null);
                          setSaved(null);
                        }
                        await refreshStatic();
                        await evaluateNow();
                      }}
                      className="text-slate-500 hover:text-red-300"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <Badge tone="amber">synthetic</Badge>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Processing pipeline" icon={<ScanText size={14} />} subtitle={status ? `${status.title} · ${status.ocr_engine}` : "Waiting for a document"} className="shrink-0" bodyClassName="p-3">
          <ProcessingStepper status={status} />
          <div ref={logRef} className="mt-3 h-[108px] overflow-y-auto rounded-md border border-cockpit-line bg-[#070b13] p-2 font-mono text-[11px] leading-relaxed">
            {!status && <span className="text-slate-600">$ nwis-ingest --await-document</span>}
            {status?.log.map((l, i) => (
              <div key={i} className="text-slate-300">
                <span className="text-slate-600">[{l.t.toFixed(2).padStart(5, " ")}s]</span> <span className="text-cyan-300/80">{l.stage}</span> {l.message}
              </div>
            ))}
            {busy && <div className="animate-pulse text-cyan-300">▌</div>}
          </div>
          {error && <ErrorState message={error} className="p-2" />}
        </Panel>

        <Panel
          title="Review extracted knowledge"
          icon={<Tags size={14} />}
          subtitle={extraction ? `${decisions.length} candidate events · ${extraction.entities.length} entities · ${extraction.chunks.length} chunks · approve before saving` : "Nothing enters the knowledge base without engineer approval"}
          className="min-h-[360px] xl:min-h-0 xl:flex-1"
          actions={
            extraction && (
              <Tabs value={view} onChange={setView} tabs={[
                { value: "events", label: "Events", count: decisions.length },
                { value: "entities", label: "Entities", count: extraction.entities.length },
                { value: "text", label: "Text", count: extraction.pages.length },
              ]} />
            )
          }
          bodyClassName="flex min-h-0 flex-col"
        >
          {!extraction ? (
            busy ? <Loading label="Extracting…" className="flex-1" /> : <Empty icon={<ScanText size={22} />} title="Upload a report or process the sample" hint="The sample DDR for OIL-AX-22 contains a tight-hole event, a bit-balling NPT event and a torque rise that duplicates an existing record." className="flex-1" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-cockpit-line px-3 py-2 text-[11px]">
                <label className="flex items-center gap-1.5">
                  <span className="label-caps">Well</span>
                  <Select value={wellId} onChange={(e) => setWellId(e.target.value)} className="h-7 w-40" disabled={Boolean(saved)}>
                    <option value="">— assign well —</option>
                    {extraction.wells.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </label>
                <span className="text-cockpit-muted">Type <b className="text-slate-200">{DOC_TYPE_LABEL[extraction.detected.doc_type ?? ""] ?? extraction.detected.doc_type}</b></span>
                <span className="text-cockpit-muted">Date <b className="text-slate-200">{fmtDate(extraction.detected.date)}</b></span>
                <span className="text-cockpit-muted">Pages <b className="text-slate-200">{extraction.pages.length}</b> ({Array.from(new Set(extraction.pages.map((p) => p.method))).join(", ")})</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {view === "events" && (decisions.length ? <ExtractedEvents events={decisions} onChange={setDecisions} locked={Boolean(saved)} /> : <Empty title="No drilling events detected in this document" />)}
                {view === "entities" && (
                  <div className="space-y-2">
                    {Array.from(new Set(extraction.entities.map((e) => e.type))).map((t) => (
                      <div key={t}>
                        <div className="label-caps mb-1">{t.replace("_", " ")}</div>
                        <div className="flex flex-wrap gap-1">
                          {extraction.entities.filter((e) => e.type === t).map((e) => (
                            <Badge key={e.value} tone={ENTITY_TONE[t] ?? "neutral"} className="normal-case tracking-normal">
                              {e.value} <span className="opacity-60">×{e.count} · p.{e.page}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {view === "text" && (
                  <div className="space-y-2">
                    {extraction.pages.map((p) => (
                      <div key={p.page} className="rounded border border-cockpit-line bg-[#0c1322] p-3">
                        <div className="mb-1 flex items-center gap-2 text-[10.5px] text-cockpit-muted">
                          <span className="font-mono text-slate-200">page {p.page}</span> <Badge tone={p.method === "text-layer" ? "cyan" : "amber"}>{p.method}</Badge>
                        </div>
                        <p className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-slate-300">
                          {highlightSegments(p.text, allHighlights).map((s, i) => (s.hl ? <mark key={i} className="hl">{s.t}</mark> : <span key={i}>{s.t}</span>))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={cn("flex flex-wrap items-center gap-2 border-t border-cockpit-line px-3 py-2", saved && "bg-emerald-500/5")}>
                {saved ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-300" />
                    <span className="text-[12px] text-emerald-100">
                      Saved {saved.events_saved} event{saved.events_saved === 1 ? "" : "s"} and indexed {saved.chunks_indexed} chunk{saved.chunks_indexed === 1 ? "" : "s"} — searchable and used by the risk engine now.{saved.skipped?.length ? ` ${saved.skipped.length} approved candidate(s) skipped (no depth).` : ""}
                    </span>
                    <Link href={`/dashboard/search?q=${encodeURIComponent("tight hole overpull in Kopili near 3432 m")}`} className="ml-auto">
                      <Button size="xs" variant="primary"><Search size={12} /> Search it</Button>
                    </Link>
                    {wellId && (
                      <Link href={`/dashboard/well/${wellId}`}>
                        <Button size="xs">Open well intelligence</Button>
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-cockpit-muted">
                      {approved} of {decisions.length} events approved · provenance kept: document · page · section · evidence span
                    </span>
                    <Button className="ml-auto" variant="primary" disabled={saving || !wellId || status?.status !== "review"} onClick={() => void commit()}>
                      <Database size={13} /> {saving ? "Saving…" : "Save to knowledge base"}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
