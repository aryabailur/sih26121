"use client";

import { Database, ExternalLink } from "lucide-react";
import { forwardRef } from "react";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useNWIS } from "@/lib/store";
import type { EvidenceCard as Evidence } from "@/lib/types";
import { cn, DOC_TYPE_LABEL, fmtDate, fmtNum, fmtRange, highlightSegments } from "@/lib/utils";

const MAX_WORDS = 150;

export const EvidenceCard = forwardRef<HTMLDivElement, { e: Evidence; index: number; active?: boolean }>(function EvidenceCard({ e, index, active }, ref) {
  const openSource = useNWIS((s) => s.openSource);
  const words = e.chunk_text.split(/\s+/);
  const excerpt = words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(" ") + " …" : e.chunk_text;
  const ds = e.event_depth_start ?? e.depth_start;
  const de = e.event_depth_end ?? e.depth_end;
  const b = e.score_breakdown;

  return (
    <div
      ref={ref}
      className={cn(
        "glass scroll-mt-2 rounded-lg p-3 transition-shadow",
        active && "ring-2 ring-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.25)]",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-5 min-w-5 items-center justify-center rounded bg-cyan-400/15 px-1 font-mono text-[11px] font-bold text-cyan-200">{index}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[12.5px] font-semibold text-slate-50">{e.document_title}</span>
            <Badge tone={e.kind === "parameter" ? "blue" : "cyan"}>{DOC_TYPE_LABEL[e.document_type] ?? e.document_type}</Badge>
            {e.source_status === "uploaded" && <Badge tone="green">uploaded</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-cockpit-muted">
            <span className="font-mono text-slate-300">{e.well_name}</span>
            {e.page && <span>page {e.page}</span>}
            <span>{fmtRange(ds, de)}</span>
            {(e.event_formation ?? e.formation) && <span>{e.event_formation ?? e.formation}</span>}
            {e.date && <span>{fmtDate(e.date)}</span>}
          </div>
        </div>
        {e.kind !== "parameter" && (
          <div className="w-16 text-right" title={`keyword ${fmtNum(b.keyword, 2)} · semantic ${fmtNum(b.semantic, 2)} · metadata ${fmtNum(b.metadata, 2)}`}>
            <div className="font-mono text-[12px] text-slate-100">{Math.round(e.relevance_score * 100)}%</div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(100, e.relevance_score * 100)}%` }} />
            </div>
            <div className="mt-0.5 text-[9px] text-cockpit-dim">relevance</div>
          </div>
        )}
      </div>

      {e.event_type && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <FamilyChip eventType={e.event_type} />
          {e.severity && <SeverityBadge severity={e.severity} />}
          {e.npt_hours ? <span className="text-[10.5px] text-cockpit-muted">NPT {e.npt_hours} h</span> : null}
          <span className="ml-auto font-mono text-[10px] text-cockpit-dim">{e.event_id}</span>
        </div>
      )}

      {e.kind === "parameter" && e.params ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {Object.entries(e.params).map(([k, v]) => (
            <div key={k} className="rounded border border-cockpit-line bg-black/20 px-2 py-1">
              <div className="label-caps">{k.replaceAll("_", " ")}</div>
              <div className="font-mono text-[12px] text-slate-100">{fmtNum(v as number, k === "ecd" || k === "mud_weight" ? 3 : 1)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
          {highlightSegments(excerpt, e.highlights).map((s, i) => (s.hl ? <mark key={i} className="hl">{s.t}</mark> : <span key={i}>{s.t}</span>))}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-cockpit-dim">{e.section}</span>
        {e.document_id ? (
          <button
            onClick={() => openSource({ documentId: e.document_id!, page: e.page, highlights: e.highlights })}
            className="inline-flex items-center gap-1 rounded border border-cockpit-border px-2 py-0.5 text-[10.5px] text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <ExternalLink size={11} /> Open source page
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-cockpit-dim">
            <Database size={11} /> parameter database record
          </span>
        )}
      </div>
    </div>
  );
});
