"use client";

import { FileText } from "lucide-react";
import { useNWIS } from "@/lib/store";
import { cn, DOC_TYPE_LABEL, fmtRange } from "@/lib/utils";

export function SourceCitation({
  documentId,
  title,
  docType,
  page,
  depthStart,
  depthEnd,
  wellName,
  highlights,
  className,
}: {
  documentId: string | null | undefined;
  title: string | null | undefined;
  docType?: string | null;
  page?: number | null;
  depthStart?: number | null;
  depthEnd?: number | null;
  wellName?: string;
  highlights?: string[];
  className?: string;
}) {
  const openSource = useNWIS((s) => s.openSource);
  if (!documentId) return <span className="text-[11px] text-cockpit-dim">No source document</span>;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openSource({ documentId, page, highlights });
      }}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded border border-cockpit-border/70 bg-black/20 px-1.5 py-0.5 text-left text-[11px] text-slate-300",
        "hover:border-cyan-400/60 hover:text-cyan-100",
        className,
      )}
      title="Open the source report excerpt"
    >
      <FileText size={11} className="shrink-0 text-cyan-300/80" />
      <span className="truncate">
        {docType && <span className="mr-1 font-semibold text-cyan-200/80">{DOC_TYPE_LABEL[docType] ?? docType}</span>}
        {title}
        {page ? <span className="text-cockpit-muted"> · p.{page}</span> : null}
        {depthStart !== undefined && depthStart !== null ? (
          <span className="text-cockpit-muted"> · {fmtRange(depthStart, depthEnd)}</span>
        ) : null}
        {wellName ? <span className="text-cockpit-muted"> · {wellName}</span> : null}
      </span>
    </button>
  );
}
