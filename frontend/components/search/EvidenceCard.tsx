"use client";

import { Database, ExternalLink, FileText } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useNWIS } from "@/lib/store";
import type { EvidenceCard as Evidence } from "@/lib/types";
import { cn, DOC_TYPE_LABEL, fmtDate, fmtNum, fmtRange, highlightSegments } from "@/lib/utils";

const MAX_WORDS = 110;

export const EvidenceCard = forwardRef<HTMLDivElement, { e: Evidence; index: number; active?: boolean }>(function EvidenceCard({ e, index, active }, ref) {
  const openSource = useNWIS((s) => s.openSource);
  const words = e.chunk_text.split(/\s+/);
  const excerpt = words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(" ") + " …" : e.chunk_text;
  const ds = e.event_depth_start ?? e.depth_start;
  const de = e.event_depth_end ?? e.depth_end;
  const b = e.score_breakdown;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, scale: active ? 1.01 : 1 }}
      transition={{ delay: 0.06 * index, type: "spring", stiffness: 260, damping: 24 }}
      className={cn("scroll-mt-3 rounded-[4px] border bg-surface p-4 shadow-sm transition-shadow", active ? "border-brand shadow-brand ring-4 ring-brand/15" : "border-line hover:shadow-md")}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex h-7 min-w-7 items-center justify-center rounded-[2px] px-1.5 text-[12.5px] font-extrabold", active ? "bg-brand text-white" : "bg-brand-soft text-brand-ink")}>{index}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14px] font-bold text-ink">{e.document_title}</span>
            <Badge tone={e.kind === "parameter" ? "blue" : "brand"}>{DOC_TYPE_LABEL[e.document_type] ?? e.document_type}</Badge>
            {e.source_status === "uploaded" && <Badge tone="green">Uploaded</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-ink-3">
            <span className="font-mono font-medium text-ink-2">{e.well_name}</span>
            {e.page && <span>page {e.page}</span>}
            <span>{fmtRange(ds, de)}</span>
            {(e.event_formation ?? e.formation) && <span>{e.event_formation ?? e.formation}</span>}
            {e.date && <span>{fmtDate(e.date)}</span>}
          </div>
        </div>
        {e.kind !== "parameter" && (
          <div className="w-[70px] text-right" title={`keyword ${fmtNum(b.keyword, 2)} · semantic ${fmtNum(b.semantic, 2)} · metadata ${fmtNum(b.metadata, 2)}`}>
            <div className="text-[15px] font-extrabold tabular text-ink">{Math.round(e.relevance_score * 100)}%</div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-[1px] bg-surface-3">
              <span style={{ width: `${(b.keyword ?? 0) * 100 * 0.45}%`, background: "#5b4bff" }} />
              <span style={{ width: `${(b.semantic ?? 0) * 100 * 0.35}%`, background: "#d946ef" }} />
              <span style={{ width: `${(b.metadata ?? 0) * 100 * 0.2}%`, background: "#0ea5e9" }} />
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-ink-4">relevance</div>
          </div>
        )}
      </div>

      {e.event_type && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <FamilyChip eventType={e.event_type} />
          {e.severity && <SeverityBadge severity={e.severity} />}
          {e.npt_hours ? <span className="text-[12.5px] font-semibold text-ink-3">NPT {e.npt_hours} h</span> : null}
          <span className="ml-auto font-mono text-[11.5px] text-ink-4">{e.event_id}</span>
        </div>
      )}

      {e.kind === "parameter" && e.params ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {Object.entries(e.params).map(([k, v]) => (
            <div key={k} className="rounded-[3px] bg-surface-2 px-2.5 py-1.5">
              <div className="text-[11.5px] font-bold capitalize text-ink-3">{k.replaceAll("_", " ")}</div>
              <div className="font-mono text-[13.5px] font-semibold text-ink">{fmtNum(v as number, k === "ecd" || k === "mud_weight" ? 3 : 1)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{highlightSegments(excerpt, e.highlights).map((s, i) => (s.hl ? <mark key={i} className="hl">{s.t}</mark> : <span key={i}>{s.t}</span>))}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate text-[12px] font-medium text-ink-3">
          <FileText size={11} className="shrink-0" /> {e.section}
        </span>
        {e.document_id ? (
          <button
            onClick={() => openSource({ documentId: e.document_id!, page: e.page, highlights: e.highlights })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] bg-brand-soft px-3 py-1 text-[12.5px] font-bold text-brand-ink transition-transform hover:scale-[1.04]"
          >
            <ExternalLink size={12} /> Open source page
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-3">
            <Database size={12} /> Parameter database record
          </span>
        )}
      </div>
    </motion.div>
  );
});
