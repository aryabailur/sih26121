"use client";

import { FileText } from "lucide-react";
import { useNWIS } from "@/lib/store";
import { cn, DOC_TYPE_LABEL, fmtRange } from "@/lib/utils";

/** Every insight links to its report page — this chip opens the Source viewer. */
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
  if (!documentId) return <span className="text-[12.5px] text-ink-4">No source document</span>;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openSource({ documentId, page, highlights });
      }}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-[3px] border border-line bg-surface-2 py-1 pl-1 pr-2.5 text-left text-[12.5px] text-ink-2 transition-all",
        "hover:-translate-y-px hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink hover:shadow-sm",
        className,
      )}
      title="Open the source report page"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-surface text-brand-ink shadow-xs">
        <FileText size={12} />
      </span>
      <span className="truncate">
        {docType && <span className="mr-1 font-bold text-ink group-hover:text-brand-ink">{DOC_TYPE_LABEL[docType] ?? docType}</span>}
        {title}
        {page ? <span className="text-ink-3"> · p.{page}</span> : null}
        {depthStart !== undefined && depthStart !== null ? <span className="text-ink-3"> · {fmtRange(depthStart, depthEnd)}</span> : null}
        {wellName ? <span className="text-ink-3"> · {wellName}</span> : null}
      </span>
    </button>
  );
}
