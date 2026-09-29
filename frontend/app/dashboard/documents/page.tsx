"use client";

import { CheckCircle2, Database, FileStack, FileText, ScanText, Search, Tags, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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

const ENTITY_TONE: Record<string, "brand" | "green" | "blue" | "amber" | "violet" | "neutral"> = {
  well: "brand",
  formation: "green",
  depth: "blue",
  mud_weight: "amber",
  casing_size: "violet",
  date: "neutral",
  chemical: "amber",
  equipment: "neutral",
};

const DOC_TINT: Record<string, string> = {
  DDR: "#5b4bff",
  WCR: "#0ea5e9",
  mud_log: "#1fae86",
  casing_report: "#e2a13b",
  cementing_report: "#64748b",
  NPT_report: "#e5383b",
};

/** A query that finds the just-saved report (samples get a precise one; uploads a generic one). */
function searchAfterSave(wellId: string | null) {
  if (wellId === "W009") return "tight hole overpull in Kopili near 3432 m";
  if (wellId === "W007") return "differential sticking in the Barail near 2655 m OIL-AX-44";
  return "What lessons were recorded in the latest uploaded report?";
}

/** Screen F — Document intelligence. */
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
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [status?.log.length]);

  const commit = async () => {
    if (!docId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.commit(
        docId,
        decisions.map((d) => ({
          candidate_id: d.candidate_id,
          approved: d.approved,
          event_type: d.event_type,
          depth_start: d.depth_start,
          depth_end: d.depth_end,
          formation: d.formation,
          severity: d.severity,
          description: d.description,
          root_cause: d.root_cause,
          mitigation_action: d.mitigation_action,
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
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[360px_minmax(0,1fr)] xl:overflow-hidden">
      <div className="flex min-h-0 flex-col gap-3">
        <Panel title="Ingest a report" icon={<FileStack size={16} />} subtitle="Upload → OCR/text → chunk → extract → review → save" className="shrink-0" bodyClassName="px-4 pb-4">
          <UploadZone busy={busy} onFile={(f) => void start(() => api.upload(f))} onSample={(name) => void start(() => api.uploadSample(name))} />
        </Panel>
        <Panel
          title="Knowledge-base library"
          icon={<Database size={16} />}
          subtitle={`${library.data?.documents.length ?? 0} documents indexed`}
          className="min-h-[320px] xl:min-h-0 xl:flex-1"
          actions={
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-32 [&_select]:h-8 [&_select]:text-[12.5px]">
              <option value="">All types</option>
              {Object.entries(DOC_TYPE_LABEL)
                .slice(0, 6)
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </Select>
          }
          bodyClassName="overflow-y-auto px-3 pb-3"
        >
          {library.loading && !library.data && <Loading />}
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {docs.map((d) => (
                <motion.li key={d.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="group flex items-center gap-2.5 rounded-[3px] border border-line px-2.5 py-2 transition-all hover:border-brand/40 hover:bg-surface-2">
                  <button onClick={() => openSource({ documentId: d.id, page: null })} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] text-white" style={{ background: DOC_TINT[d.doc_type] ?? "#8b93a7" }}>
                      <FileText size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-ink">{d.title}</span>
                      <span className="flex flex-wrap gap-x-2 text-[12px] text-ink-3">
                        <span className="font-semibold">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</span>
                        <span>{d.well_name}</span>
                        <span>{fmtDate(d.date)}</span>
                        <span>
                          {d.chunk_count} chunks · {d.event_count} events
                        </span>
                      </span>
                    </span>
                  </button>
                  {d.source_status === "uploaded" ? (
                    <>
                      <Badge tone={d.processing_status === "indexed" ? "green" : "amber"}>{d.processing_status === "indexed" ? "Uploaded" : d.processing_status}</Badge>
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
                        className="rounded-[3px] p-1.5 text-ink-4 hover:bg-crit-soft hover:text-crit-ink"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <Badge tone="neutral">Archive</Badge>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Panel>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <Panel title="Processing pipeline" icon={<ScanText size={16} />} subtitle={status ? `${status.title} · ${status.ocr_engine}` : "Waiting for a document"} className="shrink-0" bodyClassName="px-5 pb-4">
          <ProcessingStepper status={status} />
          <div ref={logRef} className="mt-4 h-[112px] overflow-y-auto rounded-[3px] bg-[#0c0e14] p-3 font-mono text-[12.5px] leading-relaxed ring-1 ring-white/5">
            {!status && <span className="text-[#9097a8]">$ nwis-ingest --await-document</span>}
            {status?.log.map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="text-[#d6d9e2]">
                <span className="text-[#9097a8]">[{l.t.toFixed(2).padStart(5, " ")}s]</span> <span className="text-[#a79dff]">{l.stage}</span> {l.message}
              </motion.div>
            ))}
            {busy && <div className="animate-breathe text-[#a79dff]">▌</div>}
          </div>
          {error && <ErrorState message={error} className="p-2" />}
        </Panel>

        <Panel
          title="Review extracted knowledge"
          icon={<Tags size={16} />}
          subtitle={extraction ? `${decisions.length} candidate events · ${extraction.entities.length} entities · ${extraction.chunks.length} chunks · approve before saving` : "Nothing enters the knowledge base without engineer approval"}
          className="min-h-[380px] xl:min-h-0 xl:flex-1"
          actions={
            extraction && (
              <Tabs
                size="xs"
                value={view}
                onChange={setView}
                tabs={[
                  { value: "events", label: "Events", count: decisions.length },
                  { value: "entities", label: "Entities", count: extraction.entities.length },
                  { value: "text", label: "Text", count: extraction.pages.length },
                ]}
              />
            )
          }
          bodyClassName="flex min-h-0 flex-col"
        >
          {!extraction ? (
            busy ? (
              <Loading label="Extracting…" className="flex-1" />
            ) : (
              <Empty icon={<ScanText size={24} />} title="Upload a report or process the sample" hint="The OIL-AX-22 sample has a text layer (tight hole, bit balling, and a torque rise that duplicates an existing record). The OIL-AX-44 sample is a scanned image — every word is read by OCR." className="flex-1" />
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-y border-line bg-surface-2 px-4 py-2.5 text-[12.5px]">
                <label className="flex items-center gap-2">
                  <span className="label">Well</span>
                  <Select value={wellId} onChange={(e) => setWellId(e.target.value)} className="w-44 [&_select]:h-8 [&_select]:text-[12.5px]" disabled={Boolean(saved)}>
                    <option value="">— assign well —</option>
                    {extraction.wells.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <span className="text-ink-3">
                  Type <b className="text-ink">{DOC_TYPE_LABEL[extraction.detected.doc_type ?? ""] ?? extraction.detected.doc_type}</b>
                </span>
                <span className="text-ink-3">
                  Date <b className="text-ink">{fmtDate(extraction.detected.date)}</b>
                </span>
                <span className="text-ink-3">
                  Pages <b className="text-ink">{extraction.pages.length}</b> ({Array.from(new Set(extraction.pages.map((p) => p.method))).join(", ")})
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {view === "events" && (decisions.length ? <ExtractedEvents events={decisions} onChange={setDecisions} locked={Boolean(saved)} /> : <Empty title="No drilling events detected in this document" />)}
                {view === "entities" && (
                  <div className="space-y-3">
                    {Array.from(new Set(extraction.entities.map((e) => e.type))).map((t) => (
                      <div key={t}>
                        <div className="label mb-1.5 capitalize">{t.replace("_", " ")}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {extraction.entities
                            .filter((e) => e.type === t)
                            .map((e) => (
                              <Badge key={e.value} tone={ENTITY_TONE[t] ?? "neutral"}>
                                {e.value}{" "}
                                <span className="opacity-60">
                                  ×{e.count} · p.{e.page}
                                </span>
                              </Badge>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {view === "text" && (
                  <div className="space-y-3">
                    {extraction.pages.map((p) => (
                      <div key={p.page} className="rounded-[3px] border border-[var(--paper-line)] bg-[var(--paper)] p-5 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-[12.5px] text-ink-3">
                          <span className="font-mono font-bold text-ink">page {p.page}</span>{" "}
                          <Badge tone={p.method === "text-layer" ? "brand" : p.method === "ocr" ? "green" : "amber"}>
                            {p.method === "ocr" ? "OCR · scanned page" : p.method}
                            {p.ocr_confidence ? ` · ${Math.round(p.ocr_confidence * 100)}% word confidence` : ""}
                          </Badge>
                        </div>
                        <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink-2">
                          {highlightSegments(p.text, allHighlights).map((s, i) => (s.hl ? <mark key={i} className="hl">{s.t}</mark> : <span key={i}>{s.t}</span>))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={cn("flex flex-wrap items-center gap-2 border-t border-line px-4 py-3", saved && "bg-low-soft")}>
                {saved ? (
                  <>
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 12 }}>
                      <CheckCircle2 size={20} className="text-low-ink" />
                    </motion.span>
                    <span className="text-[13px] font-semibold text-low-ink">
                      Saved {saved.events_saved} event{saved.events_saved === 1 ? "" : "s"} and indexed {saved.chunks_indexed} chunk{saved.chunks_indexed === 1 ? "" : "s"} — searchable and used by the risk engine now.
                      {saved.skipped?.length ? ` ${saved.skipped.length} approved candidate(s) skipped (no depth).` : ""}
                    </span>
                    <Link href={`/dashboard/search?q=${encodeURIComponent(searchAfterSave(extraction.detected.well_id))}`} className="ml-auto">
                      <Button variant="primary">
                        <Search size={14} /> Search it
                      </Button>
                    </Link>
                    {wellId && (
                      <Link href={`/dashboard/well/${wellId}`}>
                        <Button>Open well intelligence</Button>
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[12.5px] text-ink-3">
                      <b className="text-ink">
                        {approved} of {decisions.length}
                      </b>{" "}
                      events approved · provenance kept: document · page · section · evidence span
                    </span>
                    <Button className="ml-auto" variant="aurora" size="md" disabled={saving || !wellId || status?.status !== "review"} onClick={() => void commit()}>
                      <Database size={15} /> {saving ? "Saving…" : "Save to knowledge base"}
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
