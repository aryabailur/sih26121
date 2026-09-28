"use client";

import { AlertTriangle, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { CandidateEvent, Severity } from "@/lib/types";
import { cn, EVENT_LABELS } from "@/lib/utils";

export type Decision = CandidateEvent;

const TYPES = Object.keys(EVENT_LABELS);
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const FORMATIONS = ["Girujan Shale", "Tipam Sandstone", "Namsang Formation", "Barail Group", "Kopili Shale", "Sylhet Limestone"];

const inputCls = "h-7 rounded border border-cockpit-border bg-cockpit-bg/80 px-1.5 text-[11px] text-slate-200 outline-none focus:border-cyan-400/60";

/** Human-review table: every extracted fact is editable and must be approved before it enters the KB. */
export function ExtractedEvents({ events, onChange, locked }: { events: Decision[]; onChange: (e: Decision[]) => void; locked: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const update = (id: string, patch: Partial<Decision>) => onChange(events.map((e) => (e.candidate_id === id ? { ...e, ...patch } : e)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11.5px]">
        <thead className="text-left text-[10px] uppercase tracking-wider text-cockpit-dim">
          <tr>
            <th className="px-1.5 py-1.5">Save</th>
            <th className="px-1.5">Event type</th>
            <th className="px-1.5">Depth (m)</th>
            <th className="px-1.5">Formation</th>
            <th className="px-1.5">Severity</th>
            <th className="px-1.5">Source</th>
            <th className="px-1.5">Confidence</th>
            <th className="px-1.5" />
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <FragmentRow key={e.candidate_id}>
              <tr className={cn("border-t border-cockpit-line align-top", !e.approved && "opacity-60")}>
                <td className="px-1.5 py-2">
                  <input type="checkbox" checked={e.approved} disabled={locked} onChange={(x) => update(e.candidate_id, { approved: x.target.checked })} className="accent-cyan-400" aria-label={`Approve ${e.candidate_id}`} />
                </td>
                <td className="px-1.5 py-1.5">
                  <select className={inputCls} value={e.event_type} disabled={locked} onChange={(x) => update(e.candidate_id, { event_type: x.target.value, event_label: EVENT_LABELS[x.target.value] })}>
                    {TYPES.map((t) => <option key={t} value={t}>{EVENT_LABELS[t]}</option>)}
                  </select>
                </td>
                <td className="px-1.5 py-1.5">
                  <div className="flex items-center gap-1">
                    <input type="number" className={cn(inputCls, "w-[70px] font-mono")} value={e.depth_start ?? ""} disabled={locked}
                      onChange={(x) => update(e.candidate_id, { depth_start: x.target.value === "" ? null : Number(x.target.value) })} />
                    <span className="text-cockpit-dim">–</span>
                    <input type="number" className={cn(inputCls, "w-[70px] font-mono")} value={e.depth_end ?? ""} disabled={locked}
                      onChange={(x) => update(e.candidate_id, { depth_end: x.target.value === "" ? null : Number(x.target.value) })} />
                  </div>
                </td>
                <td className="px-1.5 py-1.5">
                  <select className={inputCls} value={e.formation ?? ""} disabled={locked} onChange={(x) => update(e.candidate_id, { formation: x.target.value || null })}>
                    <option value="">—</option>
                    {FORMATIONS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </td>
                <td className="px-1.5 py-1.5">
                  <select className={inputCls} value={e.severity} disabled={locked} onChange={(x) => update(e.candidate_id, { severity: x.target.value as Severity })}>
                    {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-1.5 py-2 font-mono text-slate-400">p.{e.source_page}</td>
                <td className="px-1.5 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-mono text-slate-100">{Math.round(e.confidence * 100)}%</span>
                    {e.needs_review && <Badge tone="amber"><AlertTriangle size={9} /> human review</Badge>}
                    {e.possible_duplicate_of && <Badge tone="violet"><Copy size={9} /> possible duplicate</Badge>}
                  </div>
                </td>
                <td className="px-1.5 py-2">
                  <button onClick={() => setOpen(open === e.candidate_id ? null : e.candidate_id)} className="text-slate-400 hover:text-slate-100" aria-label="Details">
                    {open === e.candidate_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </td>
              </tr>
              {(open === e.candidate_id || e.possible_duplicate_of) && (
                <tr className="bg-black/20">
                  <td />
                  <td colSpan={7} className="px-1.5 pb-2.5 pt-1 text-[11.5px]">
                    {e.possible_duplicate_of && (
                      <div className="mb-1.5 rounded border border-violet-500/30 bg-violet-500/5 px-2 py-1 text-violet-200">
                        Overlaps existing event <span className="font-mono">{e.possible_duplicate_of.id}</span> — “{e.possible_duplicate_of.title}” ({Math.round(e.possible_duplicate_of.depth_start)}–{Math.round(e.possible_duplicate_of.depth_end)} m). Left unticked to avoid double counting.
                      </div>
                    )}
                    {open === e.candidate_id && (
                      <div className="space-y-1.5">
                        <label className="block">
                          <span className="label-caps">Description</span>
                          <textarea className={cn(inputCls, "h-14 w-full py-1")} value={e.description} disabled={locked} onChange={(x) => update(e.candidate_id, { description: x.target.value })} />
                        </label>
                        <div className="grid gap-1.5 md:grid-cols-2">
                          <label className="block">
                            <span className="label-caps">Root cause</span>
                            <textarea className={cn(inputCls, "h-12 w-full py-1")} value={e.root_cause} disabled={locked} onChange={(x) => update(e.candidate_id, { root_cause: x.target.value })} />
                          </label>
                          <label className="block">
                            <span className="label-caps">Mitigation</span>
                            <textarea className={cn(inputCls, "h-12 w-full py-1")} value={e.mitigation_action} disabled={locked} onChange={(x) => update(e.candidate_id, { mitigation_action: x.target.value })} />
                          </label>
                        </div>
                        <div className="rounded border border-cockpit-line bg-[#0c1322] p-2 font-mono text-[11px] leading-relaxed text-slate-300">
                          <span className="label-caps mr-1">Evidence span p.{e.source_page}:</span>“{e.evidence_text}”
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </FragmentRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
