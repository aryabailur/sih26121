"use client";

import { ArrowDownToLine, BookOpenCheck, FileText, GitCompare, Layers, ListTree, Lightbulb, Search } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FamilyFilter } from "@/components/shared/FilterBar";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { EventTimeline } from "@/components/well/EventTimeline";
import { ACTIVE_COLOR, OFFSET_COLOR, ParameterChart, type DepthSeries } from "@/components/well/ParameterChart";
import { ScoreRing } from "@/components/ui/animated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Empty, ErrorState, Loading, Select, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, RiskFamily } from "@/lib/types";
import { cn, familyOf, fieldName, fmtDate, fmtDepth, fmtRange, SEVERITY_STYLE } from "@/lib/utils";

const CHARTS: { key: string; title: string; unit: string; digits: number }[] = [
  { key: "rop", title: "ROP", unit: "m/hr", digits: 1 },
  { key: "torque", title: "Torque", unit: "kN·m", digits: 1 },
  { key: "ecd", title: "ECD", unit: "sg", digits: 3 },
  { key: "standpipe_pressure", title: "SPP", unit: "psi", digits: 0 },
];

/** Screen C — Well intelligence. */
export default function WellIntelligencePage() {
  const { wellId } = useParams<{ wellId: string }>();
  const router = useRouter();
  const wells = useNWIS((s) => s.wells);
  const depth = useNWIS((s) => s.depth);
  const setDepth = useNWIS((s) => s.setDepth);
  const activeFormations = useNWIS((s) => s.formations);
  const toggleCompare = useNWIS((s) => s.toggleCompare);
  const compareIds = useNWIS((s) => s.compareIds);
  const kbVersion = useNWIS((s) => s.kbVersion);
  const [overlay, setOverlay] = useState(true);
  // The active well's recorded events are shallow, so it opens on the full well.
  const [section, setSection] = useState(() => wellId !== "W001");
  const [families, setFamilies] = useState<RiskFamily[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"events" | "lessons" | "docs">("events");

  const isActive = wellId === "W001";
  const profile = useAsync(() => api.well(wellId), [wellId, kbVersion]);
  const params = useAsync(() => api.wellParameters(wellId, 10), [wellId]);
  const activeParams = useAsync(() => (isActive ? Promise.resolve(null) : api.wellParameters("W001", 10)), [isActive]);

  const w = profile.data?.well;
  const td = w?.total_depth_md ?? 3800;
  const domain: [number, number] = section ? [2400, Math.max(td, isActive ? 3800 : td)] : [0, Math.max(td, 3800)];

  const events = useMemo(() => (profile.data?.events ?? []).filter((e) => !families.length || families.includes(familyOf(e.event_type))), [profile.data, families]);
  const selectedEvent: DrillingEvent | undefined = events.find((e) => e.id === selected) ?? events.find((e) => e.severity === "critical" || e.severity === "high") ?? events[0];

  // Merge offset + active samples by MD so both series share one depth axis.
  const merged = useMemo(() => {
    const map = new Map<number, Record<string, number> & { md: number }>();
    for (const s of params.data?.samples ?? []) map.set(Math.round(s.md), { ...(s as unknown as Record<string, number>), md: Math.round(s.md) });
    if (overlay && !isActive) {
      const limit = Math.max(3100, depth);
      for (const s of activeParams.data?.samples ?? []) {
        if (s.md > limit) continue;
        const md = Math.round(s.md);
        const row = map.get(md) ?? { md };
        for (const c of CHARTS) row[`${c.key}_active`] = (s as unknown as Record<string, number>)[c.key];
        map.set(md, row);
      }
    }
    if (isActive) {
      // The active well's recorded feed ends at the bit — hide the simulated look-ahead.
      for (const md of Array.from(map.keys())) if (md > Math.max(3100, depth)) map.set(md, { md });
    }
    return Array.from(map.values()).sort((a, b) => a.md - b.md);
  }, [params.data, activeParams.data, overlay, isActive, depth]);

  if (profile.loading && !profile.data) return <Loading label="Loading well intelligence…" className="h-full" />;
  if (profile.error) return <ErrorState message={profile.error} onRetry={profile.reload} className="h-full" />;
  if (!w || !profile.data) return null;
  const sim = profile.data.similarity_to_active;
  const listItem = wells.find((x) => x.id === w.id);
  const lessons = (profile.data.events ?? []).filter((e) => e.lessons_learned);
  const sev = listItem?.history_severity ? SEVERITY_STYLE[listItem.history_severity] : null;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 xl:overflow-hidden">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card relative flex flex-wrap items-center gap-x-7 gap-y-3 overflow-hidden px-5 py-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5" style={{ background: isActive ? "var(--aurora)" : sev?.gradient ?? "var(--line-2)" }} />
        <div className="flex items-center gap-3">
          <Select value={w.id} onChange={(e) => router.push(`/dashboard/well/${e.target.value}`)} className="w-[230px] [&_select]:h-11 [&_select]:font-mono [&_select]:text-[15px] [&_select]:font-semibold">
            {wells.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} {x.role === "active" ? "(active)" : `· ${x.distance_km.toFixed(1)} km`}
              </option>
            ))}
          </Select>
          <Badge tone={isActive ? "brand" : "neutral"}>{isActive ? "Active · drilling" : w.status}</Badge>
        </div>
        {[
          { l: "Field", v: fieldName(w.field), s: w.basin },
          { l: "TD (MD / TVD)", v: `${fmtDepth(w.total_depth_md)}`, s: `TVD ${fmtDepth(w.total_depth_tvd)}` },
          { l: "Spud → release", v: fmtDate(w.spud_date), s: w.completion_date ? `→ ${fmtDate(w.completion_date)}` : "→ drilling" },
          ...(!isActive ? [{ l: "From active well", v: `${profile.data.distance_to_active_km.toFixed(2)} km`, s: listItem?.direction ?? "" }] : []),
          { l: "Events · NPT", v: `${profile.data.events.length} events`, s: `${listItem?.npt_hours ?? 0} h NPT` },
        ].map((x) => (
          <div key={x.l} className="min-w-0">
            <div className="label">{x.l}</div>
            <div className="text-[16px] font-extrabold tabular leading-tight text-ink">{x.v}</div>
            <div className="text-[12.5px] text-ink-3">{x.s}</div>
          </div>
        ))}
        {!isActive && sim && (
          <div className="flex items-center gap-2.5">
            <ScoreRing value={sim.score} color="var(--brand)" size={50} stroke={5} textClassName="text-[14px]" />
            <div className="leading-tight">
              <div className="label">Similarity</div>
              <div className="text-[12.5px] text-ink-3">to OIL-AX-102</div>
            </div>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant={section ? "soft" : "secondary"} onClick={() => setSection(!section)}>
            <Layers size={14} /> {section ? "Reservoir section" : "Full well"}
          </Button>
          {!isActive && (
            <>
              <Button variant={overlay ? "soft" : "secondary"} onClick={() => setOverlay(!overlay)} title="Overlay OIL-AX-102 parameters and formation tops">
                <span className="h-2 w-2 rounded-full" style={{ background: ACTIVE_COLOR }} /> Compare with active well
              </Button>
              <Button onClick={() => toggleCompare(w.id)}>
                <GitCompare size={14} /> {compareIds.includes(w.id) ? "In compare set" : "Add to compare"}
              </Button>
            </>
          )}
        </div>
      </motion.div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[270px_minmax(0,1fr)_380px]">
        <Panel title="Formations & events" icon={<ListTree size={16} />} subtitle="Click or drag to move the bit" bodyClassName="px-3 pb-3" className="min-h-[560px] xl:min-h-0">
          <EventTimeline
            formations={profile.data.formations}
            events={events}
            domain={domain}
            depth={depth}
            onDepth={(d) => setDepth(d)}
            activeFormations={overlay && !isActive ? activeFormations : undefined}
            selectedEventId={selectedEvent?.id}
            onSelectEvent={(e) => {
              setSelected(e.id);
              setTab("events");
            }}
            // Offsets match ParameterChart's plot area (header + legend + top axis / bottom padding) so depths line up.
            header={86}
            className="pb-[14px]"
          />
        </Panel>

        <Panel
          title="Drilling parameters vs depth"
          subtitle={isActive ? "Simulated eRTMAC record up to the bit" : overlay ? `${w.name} (solid) vs OIL-AX-102 up to the bit (dashed) · bands = recorded events` : `${w.name} mud-logging record · bands = recorded events`}
          actions={<FamilyFilter compact value={families} onChange={setFamilies} className="hidden min-[1800px]:flex" />}
          bodyClassName="grid grid-cols-2 gap-2.5 px-3 pb-3 lg:grid-cols-4"
          className="min-h-[560px] xl:min-h-0"
        >
          {params.loading && !params.data ? (
            <Loading className="col-span-4" />
          ) : (
            CHARTS.map((c) => {
              const series: DepthSeries[] = [{ key: c.key, label: w.name, color: isActive ? ACTIVE_COLOR : OFFSET_COLOR }];
              if (overlay && !isActive) series.push({ key: `${c.key}_active`, label: "OIL-AX-102", color: ACTIVE_COLOR, dashed: true });
              return <ParameterChart key={c.key} title={c.title} unit={c.unit} digits={c.digits} data={merged} series={series} domain={domain} depth={depth} events={events} />;
            })
          )}
        </Panel>

        <Panel
          title="Intel"
          subtitle="Events, lessons learned and source reports"
          icon={<BookOpenCheck size={16} />}
          bodyClassName="overflow-y-auto px-3 pb-3"
          className="min-h-[560px] xl:min-h-0"
        >
          <Tabs
            size="xs"
            value={tab}
            onChange={setTab}
            className="sticky top-0 z-10 mb-3 grid grid-cols-3 shadow-[0_0_0_4px_var(--surface)] [&>button]:justify-center"
            tabs={[
              { value: "events", label: "Events", count: events.length },
              { value: "lessons", label: "Lessons", count: lessons.length },
              { value: "docs", label: "Sources", count: profile.data.documents.length },
            ]}
          />
          {tab === "events" && (
            <div className="space-y-2.5">
              {selectedEvent ? (
                  <motion.div
                    key={selectedEvent.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden rounded-[4px] border border-line"
                  >
                    <div className="h-1.5" style={{ background: SEVERITY_STYLE[selectedEvent.severity].gradient }} />
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FamilyChip eventType={selectedEvent.event_type} />
                        <SeverityBadge severity={selectedEvent.severity} />
                        <span className="text-[13px] font-extrabold text-ink">{fmtRange(selectedEvent.depth_start, selectedEvent.depth_end)}</span>
                      </div>
                      <h3 className="mt-2 text-[15px] font-extrabold leading-snug tracking-[-0.01em] text-ink">{selectedEvent.title}</h3>
                      <div className="text-[12.5px] text-ink-3">
                        {selectedEvent.formation} · {fmtDate(selectedEvent.date)} · NPT {selectedEvent.npt_hours} h
                      </div>
                      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{selectedEvent.description}</p>
                      <dl className="mt-3 space-y-2.5 text-[13px]">
                        <div>
                          <dt className="label">Root cause</dt>
                          <dd className="text-ink-2">{selectedEvent.root_cause || "—"}</dd>
                        </div>
                        <div>
                          <dt className="label">Mitigation</dt>
                          <dd className="text-ink-2">{selectedEvent.mitigation_action || "—"}</dd>
                        </div>
                        {selectedEvent.lessons_learned && (
                          <div className="rounded-[3px] bg-low-soft p-2.5">
                            <dt className="flex items-center gap-1 text-[12.5px] font-extrabold text-low-ink">
                              <Lightbulb size={13} /> Lesson learned
                            </dt>
                            <dd className="text-low-ink">{selectedEvent.lessons_learned}</dd>
                          </div>
                        )}
                        {Object.keys(selectedEvent.event_params ?? {}).length > 0 && (
                          <div>
                            <dt className="label">Recorded values</dt>
                            <dd className="mt-1 flex flex-wrap gap-1.5">
                              {Object.entries(selectedEvent.event_params).map(([k, v]) => (
                                <span key={k} className="rounded-[2px] bg-surface-3 px-2.5 py-0.5 font-mono text-[12px] font-medium text-ink-2">
                                  {k.replaceAll("_", " ")}: <b className="text-ink">{v}</b>
                                </span>
                              ))}
                            </dd>
                          </div>
                        )}
                      </dl>
                      <div className="mt-3">
                        <SourceCitation
                          documentId={selectedEvent.source_document_id}
                          title={selectedEvent.document_title ?? selectedEvent.source_document_id}
                          docType={selectedEvent.document_type}
                          page={selectedEvent.source_page}
                          depthStart={selectedEvent.depth_start}
                          depthEnd={selectedEvent.depth_end}
                          highlights={[String(Math.round(selectedEvent.depth_start))]}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {!isActive && (
                          <Button variant="primary" onClick={() => setDepth(selectedEvent.depth_start, { immediate: true })}>
                            <ArrowDownToLine size={14} /> Move active bit to {fmtDepth(selectedEvent.depth_start)}
                          </Button>
                        )}
                        <Link href={`/dashboard/search?q=${encodeURIComponent(`What mitigations were used for ${selectedEvent.event_type.replaceAll("_", " ")} in the ${selectedEvent.formation}?`)}`}>
                          <Button variant="soft">
                            <Search size={14} /> Ask across offsets
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <Empty title="No events recorded for this well" />
                )}
              <div className="label px-1 pt-1">All events</div>
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[3px] border px-2.5 py-2 text-left text-[13px] transition-all",
                    selectedEvent?.id === e.id ? "border-brand bg-brand-soft" : "border-line hover:border-line-2 hover:bg-surface-2",
                  )}
                >
                  <FamilyIcon family={familyOf(e.event_type)} size={14} tile />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-ink">{e.title}</span>
                    <span className="block text-[12.5px] text-ink-3">{fmtRange(e.depth_start, e.depth_end)}</span>
                  </span>
                  <SeverityBadge severity={e.severity} />
                </button>
              ))}
            </div>
          )}
          {tab === "lessons" && (
            <div className="space-y-2.5">
              {lessons.length === 0 && <Empty title="No lessons recorded" />}
              {lessons.map((e, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-[4px] bg-low-soft p-3.5">
                  <div className="flex items-center gap-1.5">
                    <FamilyChip eventType={e.event_type} />
                    <span className="text-[12.5px] font-bold text-ink-2">{fmtRange(e.depth_start, e.depth_end)}</span>
                  </div>
                  <p className="mt-2 text-[13.5px] font-semibold leading-snug text-low-ink">{e.lessons_learned}</p>
                  <p className="mt-1.5 text-[12.5px] text-ink-2">
                    <span className="font-bold text-ink-3">What worked · </span>
                    {e.mitigation_action}
                  </p>
                  <div className="mt-2">
                    <SourceCitation documentId={e.source_document_id} title={e.document_title} docType={e.document_type} page={e.source_page} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {tab === "docs" && (
            <div className="space-y-2">
              {profile.data.documents.map((d) => (
                <div key={d.id} className="rounded-[3px] border border-line p-3">
                  <SourceCitation documentId={d.id} title={d.title} docType={d.doc_type} className="w-full" />
                  <p className="mt-1.5 flex items-start gap-1 text-[12.5px] text-ink-3">
                    <FileText size={12} className="mt-0.5 shrink-0" />
                    {fmtDate(d.date)} · {d.page_count} pages · {d.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
