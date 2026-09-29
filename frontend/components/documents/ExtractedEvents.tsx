"use client";

import { ChevronDown, Copy, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { Badge } from "@/components/ui/badge";
import type { CandidateEvent, Severity } from "@/lib/types";
import { cn, EVENT_LABELS, familyOf, FORMATION_ORDER, SEVERITY_STYLE } from "@/lib/utils";

export type Decision = CandidateEvent;

const TYPES = Object.keys(EVENT_LABELS);
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

const field = "h-8 rounded-[3px] border border-line-2 bg-surface px-2 text-[12.5px] font-medium text-ink outline-none transition-colors focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:opacity-70";

/** Human-review table: every extracted fact is editable and must be approved before it enters the KB. */
export function ExtractedEvents({ events, onChange, locked }: { events: Decision[]; onChange: (e: Decision[]) => void; locked: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const update = (id: string, patch: Partial<Decision>) => onChange(events.map((e) => (e.candidate_id === id ? { ...e, ...patch } : e)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="text-left text-[12px] text-ink-3">
          <tr>
            <th className="px-2 py-2 font-bold">Save</th>
            <th className="px-2 font-bold">Event type</th>
            <th className="px-2 font-bold">Depth (m)</th>
            <th className="px-2 font-bold">Formation</th>
            <th className="px-2 font-bold">Severity</th>
            <th className="px-2 font-bold">Source</th>
            <th className="px-2 font-bold">Confidence</th>
            <th className="px-2" />
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <Fragment key={e.candidate_id}>
              <motion.tr initial={{ opacity: 0, y: 8 }} animate={{ opacity: e.approved ? 1 : 0.6, y: 0 }} transition={{ delay: 0.05 * i }} className="border-t border-line align-top">
                <td className="px-2 py-2.5">
                  <button
                    disabled={locked}
                    onClick={() => update(e.candidate_id, { approved: !e.approved })}
                    className={cn("relative h-6 w-10 rounded-[3px] transition-colors", e.approved ? "bg-brand" : "bg-line-2", locked && "opacity-60")}
                    aria-label={`Approve ${e.candidate_id}`}
                    aria-pressed={e.approved}
                  >
                    <motion.span className="absolute top-1 h-4 w-4 rounded-[2px] bg-white shadow" animate={{ left: e.approved ? 20 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                  </button>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    <FamilyIcon family={familyOf(e.event_type)} size={14} />
                    <select className={field} value={e.event_type} disabled={locked} onChange={(x) => update(e.candidate_id, { event_type: x.target.value, event_label: EVENT_LABELS[x.target.value] })}>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {EVENT_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <input type="number" className={cn(field, "w-[76px] font-mono")} value={e.depth_start ?? ""} disabled={locked} onChange={(x) => update(e.candidate_id, { depth_start: x.target.value === "" ? null : Number(x.target.value) })} />
                    <span className="text-ink-4">–</span>
                    <input type="number" className={cn(field, "w-[76px] font-mono")} value={e.depth_end ?? ""} disabled={locked} onChange={(x) => update(e.candidate_id, { depth_end: x.target.value === "" ? null : Number(x.target.value) })} />
                  </div>
                </td>
                <td className="px-2 py-2">
                  <select className={field} value={e.formation ?? ""} disabled={locked} onChange={(x) => update(e.candidate_id, { formation: x.target.value || null })}>
                    <option value="">—</option>
                    {FORMATION_ORDER.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select className={field} value={e.severity} disabled={locked} onChange={(x) => update(e.candidate_id, { severity: x.target.value as Severity })} style={{ color: SEVERITY_STYLE[e.severity].ink }}>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {SEVERITY_STYLE[s].label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2.5 font-mono font-semibold text-ink-2">p.{e.source_page}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 overflow-hidden rounded-[1px] bg-surface-3">
                        <div className="h-full rounded-[1px] bg-brand" style={{ width: `${e.confidence * 100}%` }} />
                      </div>
                      <span className="font-bold tabular text-ink">{Math.round(e.confidence * 100)}%</span>
                    </div>
                    {e.needs_review && (
                      <Badge tone="amber">
                        <TriangleAlert size={10} /> Human review
                      </Badge>
                    )}
                    {e.possible_duplicate_of && (
                      <Badge tone="violet">
                        <Copy size={10} /> Possible duplicate
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <button onClick={() => setOpen(open === e.candidate_id ? null : e.candidate_id)} className="rounded-[3px] p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Details">
                    <ChevronDown size={15} className={cn("transition-transform", open === e.candidate_id && "rotate-180")} />
                  </button>
                </td>
              </motion.tr>
              {(open === e.candidate_id || e.possible_duplicate_of) && (
                <tr>
                  <td />
                  <td colSpan={7} className="px-2 pb-3 pt-0 text-[13px]">
                    {e.possible_duplicate_of && (
                      <div className="mb-2 rounded-[3px] bg-[color-mix(in_oklab,#d946ef_10%,transparent)] px-3 py-2 text-ink-2">
                        Overlaps existing event <span className="font-mono font-semibold">{e.possible_duplicate_of.id}</span> — “{e.possible_duplicate_of.title}” ({Math.round(e.possible_duplicate_of.depth_start)}–
                        {Math.round(e.possible_duplicate_of.depth_end)} m). Left unticked to avoid double counting.
                      </div>
                    )}
                    <AnimatePresence initial={false}>
                      {open === e.candidate_id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2 overflow-hidden">
                          <label className="block">
                            <span className="label">Description</span>
                            <textarea className={cn(field, "mt-1 h-16 w-full py-1.5")} value={e.description} disabled={locked} onChange={(x) => update(e.candidate_id, { description: x.target.value })} />
                          </label>
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="block">
                              <span className="label">Root cause</span>
                              <textarea className={cn(field, "mt-1 h-14 w-full py-1.5")} value={e.root_cause} disabled={locked} onChange={(x) => update(e.candidate_id, { root_cause: x.target.value })} />
                            </label>
                            <label className="block">
                              <span className="label">Mitigation</span>
                              <textarea className={cn(field, "mt-1 h-14 w-full py-1.5")} value={e.mitigation_action} disabled={locked} onChange={(x) => update(e.candidate_id, { mitigation_action: x.target.value })} />
                            </label>
                          </div>
                          <div className="rounded-[3px] bg-[var(--paper)] p-3 font-mono text-[12.5px] leading-relaxed text-ink-2 ring-1 ring-[var(--paper-line)]">
                            <span className="mr-1 font-sans text-[12px] font-bold text-ink-3">Evidence span p.{e.source_page}:</span>“{e.evidence_text}”
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
