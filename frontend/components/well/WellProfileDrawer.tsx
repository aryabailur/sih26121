"use client";

import { ArrowDownToLine, GitCompare, LineChart } from "lucide-react";
import Link from "next/link";
import { SimilarityBadge } from "@/components/shared/SimilarityBadge";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/card";
import { Sheet } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import { fmtDate, fmtDepth, fmtRange, formationColor, pct } from "@/lib/utils";

export function WellProfileDrawer() {
  const id = useNWIS((s) => s.selectedWellId);
  const close = useNWIS((s) => s.openWell);
  const setDepth = useNWIS((s) => s.setDepth);
  const toggleCompare = useNWIS((s) => s.toggleCompare);
  const compareIds = useNWIS((s) => s.compareIds);
  const listItem = useNWIS((s) => s.wells.find((w) => w.id === id));
  const kbVersion = useNWIS((s) => s.kbVersion);
  const { data, error, loading, reload } = useAsync(() => (id ? api.well(id) : Promise.resolve(null)), [id, kbVersion]);

  if (!id) return null;
  const w = data?.well;
  const sim = data?.similarity_to_active;
  const isActive = w?.id === "W001";

  return (
    <Sheet
      open
      onClose={() => close(null)}
      title={
        <span className="flex items-center gap-2 font-mono">
          {w?.name ?? id}
          {w && <Badge tone={isActive ? "cyan" : "neutral"}>{isActive ? "active · drilling" : w.status}</Badge>}
        </span>
      }
      subtitle={w ? `${w.field} · ${w.basin} · ${w.well_type} · rig ${w.rig}` : undefined}
    >
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {w && data && (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="TD (MD)" value={fmtDepth(w.total_depth_md)} sub={`TVD ${fmtDepth(w.total_depth_tvd)}`} />
            <Stat label="Spud" value={fmtDate(w.spud_date)} sub={w.completion_date ? `rel. ${fmtDate(w.completion_date)}` : "drilling"} />
            <Stat label="Distance" value={isActive ? "—" : `${data.distance_to_active_km.toFixed(2)} km`} sub={listItem?.direction} />
            <Stat label="Similarity" value={isActive ? "anchor" : <SimilarityBadge value={sim?.score} />} sub={`${listItem?.event_count ?? 0} events · ${listItem?.npt_hours ?? 0} h NPT`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/well/${w.id}`} onClick={() => close(null)}>
              <Button variant="primary"><LineChart size={13} /> Open well intelligence</Button>
            </Link>
            {!isActive && (
              <Button onClick={() => toggleCompare(w.id)}>
                <GitCompare size={13} /> {compareIds.includes(w.id) ? "Remove from compare" : "Add to compare"}
              </Button>
            )}
          </div>

          {sim && (
            <section className="rounded-lg border border-cockpit-line bg-black/20 p-3">
              <div className="label-caps mb-2">Why this offset is comparable</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
                <span>Formation overlap <b className="font-mono text-slate-100">{pct(sim.formation_overlap)}</b></span>
                <span>Depth coverage <b className="font-mono text-slate-100">{pct(sim.depth_coverage)}</b></span>
                <span>Trajectory match <b className="font-mono text-slate-100">{pct(sim.trajectory_similarity)}</b></span>
                <span>Parameter match <b className="font-mono text-slate-100">{pct(sim.parameter_similarity)}</b></span>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-cockpit-muted">
                {sim.reasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </section>
          )}

          <section>
            <div className="label-caps mb-1.5">Formation tops</div>
            <div className="flex h-5 overflow-hidden rounded">
              {data.formations.map((f) => (
                <div key={f.id} title={`${f.name} ${fmtRange(f.top_md, f.base_md)}`} className="h-full border-r border-black/40"
                  style={{ width: `${((f.base_md - f.top_md) / w.total_depth_md) * 100}%`, background: formationColor(f.name) }} />
              ))}
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-cockpit-muted">
              {data.formations.map((f) => (
                <span key={f.id}><span className="text-slate-300">{f.name.split(" ")[0]}</span> {fmtDepth(f.top_md)}</span>
              ))}
            </div>
          </section>

          <section>
            <div className="label-caps mb-1.5">Drilling events ({data.events.length})</div>
            <div className="space-y-2">
              {data.events.map((e) => (
                <div key={e.id} className="rounded-lg border border-cockpit-line bg-black/20 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FamilyChip eventType={e.event_type} />
                    <SeverityBadge severity={e.severity} />
                    <span className="font-mono text-[11px] text-slate-200">{fmtRange(e.depth_start, e.depth_end)}</span>
                    <span className="text-[11px] text-cockpit-muted">{e.formation} · {fmtDate(e.date)}</span>
                    {!isActive && (
                      <button onClick={() => setDepth(e.depth_start, { immediate: true })} className="ml-auto inline-flex items-center gap-1 rounded border border-cockpit-border px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200" title="Move the active well's bit to this depth">
                        <ArrowDownToLine size={11} /> Jump bit here
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] font-medium text-slate-100">{e.title}</div>
                  <p className="mt-0.5 text-[11.5px] text-slate-300">{e.description}</p>
                  {e.root_cause && <p className="mt-1 text-[11px] text-slate-400"><span className="text-slate-500">Cause:</span> {e.root_cause}</p>}
                  {e.mitigation_action && <p className="text-[11px] text-slate-400"><span className="text-slate-500">Mitigation:</span> {e.mitigation_action}</p>}
                  {e.lessons_learned && <p className="text-[11px] text-emerald-200/80"><span className="text-emerald-400/70">Lesson:</span> {e.lessons_learned}</p>}
                  <div className="mt-1.5">
                    <SourceCitation documentId={e.source_document_id} title={e.document_title ?? e.source_document_id} docType={e.document_type} page={e.source_page} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="label-caps mb-1.5">Source documents ({data.documents.length})</div>
            <div className="flex flex-col gap-1">
              {data.documents.map((d) => (
                <SourceCitation key={d.id} documentId={d.id} title={d.title} docType={d.doc_type} className="w-full" />
              ))}
            </div>
          </section>
        </div>
      )}
    </Sheet>
  );
}
