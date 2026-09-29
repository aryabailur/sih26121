"use client";

import { Download, FileText } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS, type SourceTarget } from "@/lib/store";
import { cn, DOC_TYPE_LABEL, fmtDate, fmtRange, highlightSegments } from "@/lib/utils";

/** "Click source to open the relevant report excerpt" — every citation lands here. */
export function SourceViewer() {
  const source = useNWIS((s) => s.source);
  // Keyed so each citation opens with fresh state on its own page.
  return <AnimatePresence>{source && <SourceViewerBody key={`${source.documentId}:${source.page ?? ""}`} source={source} />}</AnimatePresence>;
}

function SourceViewerBody({ source }: { source: SourceTarget }) {
  const close = useNWIS((s) => s.openSource);
  const { data, error, loading, reload } = useAsync(() => api.document(source.documentId), [source.documentId]);
  const [page, setPage] = useState<number | null>(source.page ?? null);

  const doc = data?.document;
  const chunks = data?.chunks ?? [];
  const current = chunks.find((c) => c.page === page) ?? chunks[0];
  const pageEvents = (data?.events ?? []).filter((e) => e.source_page === current?.page);
  const terms = [...(source.highlights ?? []), ...pageEvents.flatMap((e) => [String(Math.round(e.depth_start)), e.formation.split(" ")[0]])];

  return (
    <Dialog
      open
      onClose={() => close(null)}
      className="max-w-[980px]"
      icon={
        <span className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-brand-soft text-brand-ink">
          <FileText size={19} />
        </span>
      }
      title={
        <span className="flex flex-wrap items-center gap-2">
          {doc?.title ?? "Source document"}
          {doc && <Badge tone="brand">{DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}</Badge>}
          {doc?.source_status === "uploaded" && <Badge tone="green">Uploaded</Badge>}
        </span>
      }
      subtitle={doc ? `${doc.well_name} · ${fmtDate(doc.date)} · ${doc.page_count} pages · ${doc.summary}` : undefined}
      footer={
        doc && (
          <div className="flex items-center justify-between gap-3 text-[12.5px] text-ink-3">
            <span>
              Provenance: document <b className="font-mono text-ink-2">{doc.id}</b> · page {current?.page ?? "—"} · section “{current?.section}”
            </span>
            <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[2px] bg-brand-soft px-3 py-1 font-bold text-brand-ink hover:brightness-95">
              <Download size={13} /> Original file
            </a>
          </div>
        )
      }
    >
      {loading && <Loading label="Opening report…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {doc && (
        <div className="grid gap-5 md:grid-cols-[160px_1fr]">
          <nav className="space-y-1.5">
            <div className="label mb-1">Indexed pages</div>
            {chunks.map((c) => (
              <button
                key={c.id}
                onClick={() => setPage(c.page)}
                className={cn(
                  "block w-full rounded-[3px] border px-3 py-2 text-left text-[12.5px] transition-all",
                  c.page === current?.page ? "border-brand bg-brand-soft text-brand-ink shadow-sm" : "border-line text-ink-2 hover:border-line-2 hover:bg-surface-2",
                )}
              >
                <div className="font-extrabold">Page {c.page}</div>
                <div className="truncate text-[12px] opacity-80">{c.section}</div>
              </button>
            ))}
          </nav>
          <article>
            {current && (
              <>
                <motion.div key={current.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                    <span className="font-bold text-ink">Page {current.page}</span>
                    <span>· {current.section}</span>
                    {current.depth_start !== null && <span>· {fmtRange(current.depth_start, current.depth_end)}</span>}
                    {current.formation && <span>· {current.formation}</span>}
                  </div>
                  {/* the report page — printed-paper treatment */}
                  <div className="relative rounded-[2px] border border-[var(--paper-line)] bg-[var(--paper)] px-8 py-7 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.35)]">
                    <div className="mb-4 flex items-center justify-between border-b border-[var(--paper-line)] pb-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
                      <span>{doc.well_name} · {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}</span>
                      <span>p. {current.page}</span>
                    </div>
                    <p className="whitespace-pre-wrap font-mono text-[13px] leading-[1.75] text-ink-2">
                      {highlightSegments(current.text, terms).map((s, i) => (s.hl ? <mark key={i} className="hl">{s.t}</mark> : <span key={i}>{s.t}</span>))}
                    </p>
                  </div>
                  {pageEvents.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="label">Structured events extracted from this page</div>
                      {pageEvents.map((e) => (
                        <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-[3px] border border-line bg-surface-2 px-3 py-2 text-[12.5px]">
                          <FamilyChip eventType={e.event_type} />
                          <SeverityBadge severity={e.severity} />
                          <span className="font-bold text-ink">{fmtRange(e.depth_start, e.depth_end)}</span>
                          <span className="text-ink-2">{e.title}</span>
                          <span className="ml-auto font-mono text-[12px] text-ink-4">{e.id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </article>
        </div>
      )}
    </Dialog>
  );
}
