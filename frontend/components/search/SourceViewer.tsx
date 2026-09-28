"use client";

import { Download, FileText } from "lucide-react";
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
  if (!source) return null;
  // Keyed so each citation opens with fresh state on its own page.
  return <SourceViewerBody key={`${source.documentId}:${source.page ?? ""}`} source={source} />;
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
      className="max-w-4xl"
      title={
        <span className="flex items-center gap-2">
          <FileText size={15} className="text-cyan-300" /> {doc?.title ?? "Source document"}
          {doc && <Badge tone="cyan">{DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}</Badge>}
          {doc && <Badge tone={doc.source_status === "uploaded" ? "green" : "amber"}>{doc.source_status === "uploaded" ? "uploaded" : "synthetic demo"}</Badge>}
        </span>
      }
      subtitle={doc ? `${doc.well_name} · ${fmtDate(doc.date)} · ${doc.page_count} pages · ${doc.summary}` : undefined}
      footer={
        doc && (
          <div className="flex items-center justify-between text-[11px] text-cockpit-dim">
            <span>Provenance: document {doc.id} · page {current?.page ?? "—"} · section “{current?.section}”</span>
            <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">
              <Download size={12} /> Original file
            </a>
          </div>
        )
      }
    >
      {loading && <Loading label="Opening report…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {doc && (
        <div className="grid gap-4 md:grid-cols-[150px_1fr]">
          <nav className="space-y-1">
            <div className="label-caps mb-1">Indexed pages</div>
            {chunks.map((c) => (
              <button
                key={c.id}
                onClick={() => setPage(c.page)}
                className={cn(
                  "block w-full rounded border px-2 py-1 text-left text-[11px]",
                  c.page === current?.page ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100" : "border-cockpit-line text-slate-400 hover:text-slate-200",
                )}
              >
                <div className="font-mono">p.{c.page}</div>
                <div className="truncate text-[10px] opacity-80">{c.section}</div>
              </button>
            ))}
          </nav>
          <article>
            {current && (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-cockpit-muted">
                  <span className="font-mono text-slate-200">Page {current.page}</span>
                  <span>· {current.section}</span>
                  {current.depth_start !== null && <span>· {fmtRange(current.depth_start, current.depth_end)}</span>}
                  {current.formation && <span>· {current.formation}</span>}
                </div>
                <div className="rounded-lg border border-cockpit-line bg-[#0c1322] p-4 font-mono text-[12.5px] leading-relaxed text-slate-200">
                  {highlightSegments(current.text, terms).map((s, i) => (s.hl ? <mark key={i} className="hl">{s.t}</mark> : <span key={i}>{s.t}</span>))}
                </div>
                {pageEvents.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="label-caps">Structured events extracted from this page</div>
                    {pageEvents.map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center gap-2 rounded border border-cockpit-line bg-black/20 px-2 py-1.5 text-[11px]">
                        <FamilyChip eventType={e.event_type} />
                        <SeverityBadge severity={e.severity} />
                        <span className="font-mono text-slate-200">{fmtRange(e.depth_start, e.depth_end)}</span>
                        <span className="text-slate-300">{e.title}</span>
                        <span className="ml-auto font-mono text-cockpit-dim">{e.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </article>
        </div>
      )}
    </Dialog>
  );
}
