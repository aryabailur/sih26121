"use client";

import { ArrowDownToLine, GitCompare, LineChart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { ScoreRing } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import { fieldName, fmtDate, fmtDepth, fmtRange, formationColor, SEVERITY_STYLE } from "@/lib/utils";

export function WellProfileDrawer() {
  const id = useNWIS((s) => s.selectedWellId);
  return <AnimatePresence>{id && <Drawer key={id} id={id} />}</AnimatePresence>;
}

function Drawer({ id }: { id: string }) {
  const close = useNWIS((s) => s.openWell);
  const setDepth = useNWIS((s) => s.setDepth);
  const toggleCompare = useNWIS((s) => s.toggleCompare);
  const compareIds = useNWIS((s) => s.compareIds);
  const listItem = useNWIS((s) => s.wells.find((w) => w.id === id));
  const kbVersion = useNWIS((s) => s.kbVersion);
  const { data, error, loading, reload } = useAsync(() => api.well(id), [id, kbVersion]);

  const w = data?.well;
  const sim = data?.similarity_to_active;
  const isActive = w?.id === "W001";
  const sev = listItem?.history_severity ? SEVERITY_STYLE[listItem.history_severity] : null;

  const hero = (
    <div className="relative overflow-hidden px-6 pb-5 pt-6 text-white" style={{ background: isActive ? "var(--aurora)" : sev?.gradient ?? "linear-gradient(135deg,#64748b,#334155)" }}>
      <div className="relative">
        <div className="text-[12.5px] font-bold text-white/80">{isActive ? "Active well · drilling" : `Offset well · ${w?.status ?? ""}`}</div>
        <div className="mt-0.5 font-mono text-[26px] font-semibold leading-tight">{w?.name ?? listItem?.name ?? id}</div>
        <div className="mt-1 text-[13px] text-white/85">{w ? `${fieldName(w.field)} · ${w.basin} · ${w.well_type} · rig ${w.rig}` : "Loading…"}</div>
        {listItem && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { l: "Distance", v: isActive ? "—" : `${listItem.distance_km.toFixed(2)} km`, s: listItem.direction },
              { l: "TD (MD)", v: fmtDepth(listItem.total_depth_md), s: `TVD ${fmtDepth(listItem.total_depth_tvd)}` },
              { l: "Events", v: String(listItem.event_count), s: `${listItem.npt_hours} h NPT` },
              { l: "Spud", v: fmtDate(listItem.spud_date).slice(3), s: listItem.completion_date ? `rel. ${fmtDate(listItem.completion_date).slice(3)}` : "drilling" },
            ].map((x) => (
              <div key={x.l} className="rounded-[3px] bg-white/15 px-2.5 py-2 backdrop-blur">
                <div className="text-[11.5px] font-bold text-white/75">{x.l}</div>
                <div className="truncate text-[14px] font-extrabold tabular">{x.v}</div>
                <div className="truncate text-[11.5px] text-white/75">{x.s}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open onClose={() => close(null)} hero={hero} title={isActive ? "Anchor well for every comparison" : "Why this offset matters"} subtitle={!isActive && sim ? `${Math.round(sim.score * 100)}% similar to OIL-AX-102` : undefined}>
      {loading && !data && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {w && data && (
        <div className="space-y-6 p-6">
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/well/${w.id}`} onClick={() => close(null)}>
              <Button variant="primary" size="md">
                <LineChart size={15} /> Open well intelligence
              </Button>
            </Link>
            {!isActive && (
              <Button size="md" onClick={() => toggleCompare(w.id)}>
                <GitCompare size={15} /> {compareIds.includes(w.id) ? "Remove from compare" : "Add to compare"}
              </Button>
            )}
          </div>

          {sim && (
            <section>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: "Formations", v: sim.formation_overlap },
                  { l: "Depth coverage", v: sim.depth_coverage },
                  { l: "Trajectory", v: sim.trajectory_similarity },
                  { l: "Parameters", v: sim.parameter_similarity },
                ].map((x) => (
                  <div key={x.l} className="flex flex-col items-center rounded-[3px] bg-surface-2 py-3">
                    <ScoreRing value={x.v} color="var(--brand)" size={52} stroke={5} textClassName="text-[14px]" />
                    <div className="mt-1.5 text-[12px] font-bold text-ink-3">{x.l}</div>
                  </div>
                ))}
              </div>
              <ul className="mt-3 space-y-1 text-[13px] text-ink-2">
                {sim.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="label mb-2">Formation tops</div>
            <div className="flex h-7 overflow-hidden rounded-[3px]">
              {data.formations.map((f, i) => (
                <motion.div
                  key={f.id}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  title={`${f.name} ${fmtRange(f.top_md, f.base_md)}`}
                  className="h-full origin-left border-r-2 border-surface"
                  style={{ width: `${((f.base_md - f.top_md) / w.total_depth_md) * 100}%`, background: formationColor(f.name) }}
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
              {data.formations.map((f) => (
                <span key={f.id} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: formationColor(f.name) }} />
                  <span className="font-semibold text-ink-2">{f.name.split(" ")[0]}</span> {fmtDepth(f.top_md)}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="label mb-2">Drilling events ({data.events.length})</div>
            <div className="space-y-2.5">
              {data.events.map((e, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }} className="rounded-[4px] border border-line p-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FamilyChip eventType={e.event_type} />
                    <SeverityBadge severity={e.severity} />
                    <span className="text-[12.5px] font-bold text-ink">{fmtRange(e.depth_start, e.depth_end)}</span>
                    <span className="text-[12.5px] text-ink-3">
                      {e.formation} · {fmtDate(e.date)}
                    </span>
                    {!isActive && (
                      <button
                        onClick={() => setDepth(e.depth_start, { immediate: true })}
                        className="ml-auto inline-flex items-center gap-1 rounded-[2px] bg-brand-soft px-2.5 py-1 text-[12.5px] font-bold text-brand-ink transition-transform hover:scale-[1.04]"
                        title="Move the active well's bit to this depth"
                      >
                        <ArrowDownToLine size={12} /> Jump bit here
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 text-[14px] font-bold text-ink">{e.title}</div>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{e.description}</p>
                  {e.root_cause && (
                    <p className="mt-1.5 text-[12.5px] text-ink-2">
                      <span className="font-bold text-ink-3">Cause · </span>
                      {e.root_cause}
                    </p>
                  )}
                  {e.mitigation_action && (
                    <p className="text-[12.5px] text-ink-2">
                      <span className="font-bold text-ink-3">Mitigation · </span>
                      {e.mitigation_action}
                    </p>
                  )}
                  {e.lessons_learned && (
                    <p className="mt-1.5 rounded-[3px] bg-low-soft px-2.5 py-1.5 text-[12.5px] text-low-ink">
                      <b>Lesson · </b>
                      {e.lessons_learned}
                    </p>
                  )}
                  <div className="mt-2">
                    <SourceCitation documentId={e.source_document_id} title={e.document_title ?? e.source_document_id} docType={e.document_type} page={e.source_page} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section>
            <div className="label mb-2">Source documents ({data.documents.length})</div>
            <div className="flex flex-col gap-1.5">
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
