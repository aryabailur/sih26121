"use client";

import { ArrowDownToLine, BookOpenCheck, FileText, GitCompare, Layers, ListTree, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FamilyFilter } from "@/components/shared/FilterBar";
import { SimilarityBadge } from "@/components/shared/SimilarityBadge";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { EventTimeline } from "@/components/well/EventTimeline";
import { ACTIVE_COLOR, OFFSET_COLOR, ParameterChart, type DepthSeries } from "@/components/well/ParameterChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, Stat } from "@/components/ui/card";
import { Empty, ErrorState, Loading, Select, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, RiskFamily } from "@/lib/types";
import { cn, fmtDate, fmtDepth, fmtRange, familyOf } from "@/lib/utils";

const CHARTS: { key: string; title: string; unit: string; digits: number; second?: { key: string; label: string } }[] = [
  { key: "rop", title: "ROP", unit: "m/hr", digits: 1 },
  { key: "torque", title: "Torque", unit: "kN·m", digits: 1 },
  { key: "ecd", title: "ECD", unit: "sg", digits: 3 },
  { key: "standpipe_pressure", title: "Standpipe pressure", unit: "psi", digits: 0 },
];

/** Screen C — Well Intelligence. */
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

  const events = useMemo(
    () => (profile.data?.events ?? []).filter((e) => !families.length || families.includes(familyOf(e.event_type))),
    [profile.data, families],
  );
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

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {/* header */}
      <div className="glass flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Select value={w.id} onChange={(e) => router.push(`/dashboard/well/${e.target.value}`)} className="h-8 w-auto font-mono text-sm font-semibold">
            {wells.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} {x.role === "active" ? "(active)" : `· ${x.distance_km.toFixed(1)} km`}
              </option>
            ))}
          </Select>
          <Badge tone={isActive ? "cyan" : "neutral"}>{isActive ? "active · drilling" : w.status}</Badge>
          <Badge tone="amber">synthetic</Badge>
        </div>
        <Stat label="Field" value={<span className="font-sans text-[12px]">{w.field}</span>} />
        <Stat label="TD (MD / TVD)" value={`${fmtDepth(w.total_depth_md)} / ${fmtDepth(w.total_depth_tvd)}`} />
        <Stat label="Spud → release" value={`${fmtDate(w.spud_date)} → ${w.completion_date ? fmtDate(w.completion_date) : "drilling"}`} />
        {!isActive && <Stat label="From active" value={`${profile.data.distance_to_active_km.toFixed(2)} km ${listItem?.direction ?? ""}`} />}
        {!isActive && <Stat label="Similarity" value={<SimilarityBadge value={sim?.score} />} />}
        <Stat label="Events · NPT" value={`${profile.data.events.length} · ${listItem?.npt_hours ?? 0} h`} />
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="xs" variant={section ? "primary" : "outline"} onClick={() => setSection(!section)}>
            <Layers size={12} /> {section ? "Reservoir section" : "Full well"}
          </Button>
          {!isActive && (
            <>
              <Button size="xs" variant={overlay ? "primary" : "outline"} onClick={() => setOverlay(!overlay)} title="Overlay OIL-AX-102 parameters and formation tops">
                Compare with active well
              </Button>
              <Button size="xs" variant="outline" onClick={() => toggleCompare(w.id)}>
                <GitCompare size={12} /> {compareIds.includes(w.id) ? "In compare set" : "Add to compare"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[250px_minmax(0,1fr)_380px]">
        <Panel title="Formations & events" icon={<ListTree size={14} />} subtitle="Click / drag to move the bit" bodyClassName="p-2">
          <EventTimeline
            formations={profile.data.formations}
            events={events}
            domain={domain}
            depth={depth}
            onDepth={(d) => setDepth(d)}
            activeFormations={overlay && !isActive ? activeFormations : undefined}
            selectedEventId={selectedEvent?.id}
            className="pb-1 pt-[72px]"
            onSelectEvent={(e) => {
              setSelected(e.id);
              setTab("events");
            }}
          />
        </Panel>

        <Panel
          title="Drilling parameters vs depth"
          subtitle={isActive ? "Simulated eRTMAC record up to the bit" : overlay ? `${w.name} (solid) vs OIL-AX-102 up to the bit (dashed) · bands = recorded events` : `${w.name} mud-logging record · bands = recorded events`}
          actions={<FamilyFilter compact value={families} onChange={setFamilies} className="hidden 2xl:flex" />}
          bodyClassName="grid grid-cols-2 gap-2 p-2 lg:grid-cols-4"
        >
          {params.loading && !params.data ? (
            <Loading className="col-span-4" />
          ) : (
            CHARTS.map((c) => {
              const series: DepthSeries[] = [{ key: c.key, label: w.name, color: isActive ? ACTIVE_COLOR : OFFSET_COLOR }];
              if (overlay && !isActive) series.push({ key: `${c.key}_active`, label: "OIL-AX-102", color: ACTIVE_COLOR, dashed: true });
              return (
                <ParameterChart key={c.key} title={c.title} unit={c.unit} digits={c.digits} data={merged} series={series} domain={domain} depth={depth} events={events} />
              );
            })
          )}
        </Panel>

        <Panel
          title="Intel"
          icon={<BookOpenCheck size={14} />}
          actions={
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "events", label: "Events", count: events.length },
                { value: "lessons", label: "Lessons", count: lessons.length },
                { value: "docs", label: "Sources", count: profile.data.documents.length },
              ]}
            />
          }
          bodyClassName="overflow-y-auto p-2"
        >
          {tab === "events" && (
            <div className="space-y-2">
              {selectedEvent ? (
                <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/[0.04] p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FamilyChip eventType={selectedEvent.event_type} />
                    <SeverityBadge severity={selectedEvent.severity} />
                    <span className="font-mono text-[12px] text-slate-100">{fmtRange(selectedEvent.depth_start, selectedEvent.depth_end)}</span>
                  </div>
                  <h3 className="mt-1.5 text-[13px] font-semibold text-slate-50">{selectedEvent.title}</h3>
                  <div className="text-[11px] text-cockpit-muted">{selectedEvent.formation} · {fmtDate(selectedEvent.date)} · NPT {selectedEvent.npt_hours} h</div>
                  <p className="mt-2 text-[12.5px] leading-snug text-slate-200">{selectedEvent.description}</p>
                  <dl className="mt-2 space-y-1.5 text-[12px]">
                    <div><dt className="label-caps">Root cause</dt><dd className="text-slate-300">{selectedEvent.root_cause || "—"}</dd></div>
                    <div><dt className="label-caps">Mitigation</dt><dd className="text-slate-300">{selectedEvent.mitigation_action || "—"}</dd></div>
                    {selectedEvent.lessons_learned && <div><dt className="label-caps text-emerald-300/80">Lesson learned</dt><dd className="text-emerald-100/90">{selectedEvent.lessons_learned}</dd></div>}
                    {Object.keys(selectedEvent.event_params ?? {}).length > 0 && (
                      <div>
                        <dt className="label-caps">Recorded values</dt>
                        <dd className="mt-0.5 flex flex-wrap gap-1">
                          {Object.entries(selectedEvent.event_params).map(([k, v]) => (
                            <span key={k} className="rounded border border-cockpit-border px-1.5 py-px font-mono text-[10.5px] text-slate-300">{k.replaceAll("_", " ")}: {v}</span>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-2">
                    <SourceCitation documentId={selectedEvent.source_document_id} title={selectedEvent.document_title ?? selectedEvent.source_document_id} docType={selectedEvent.document_type}
                      page={selectedEvent.source_page} depthStart={selectedEvent.depth_start} depthEnd={selectedEvent.depth_end} highlights={[String(Math.round(selectedEvent.depth_start))]} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {!isActive && (
                      <Button size="xs" variant="primary" onClick={() => setDepth(selectedEvent.depth_start, { immediate: true })}>
                        <ArrowDownToLine size={12} /> Move active bit to {fmtDepth(selectedEvent.depth_start)}
                      </Button>
                    )}
                    <Link href={`/dashboard/search?q=${encodeURIComponent(`What mitigations were used for ${selectedEvent.event_type.replaceAll("_", " ")} in the ${selectedEvent.formation}?`)}`}>
                      <Button size="xs" variant="outline"><Search size={12} /> Ask across offsets</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <Empty title="No events recorded for this well" />
              )}
              <div className="label-caps px-1 pt-1">All events</div>
              {events.map((e) => (
                <button key={e.id} onClick={() => setSelected(e.id)} className={cn("flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px]", selectedEvent?.id === e.id ? "border-cyan-400/50 bg-cyan-400/5" : "border-cockpit-line hover:border-cockpit-border")}>
                  <FamilyChip eventType={e.event_type} />
                  <span className="font-mono text-slate-200">{fmtRange(e.depth_start, e.depth_end)}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-400">{e.title}</span>
                  <SeverityBadge severity={e.severity} />
                </button>
              ))}
            </div>
          )}
          {tab === "lessons" && (
            <div className="space-y-2">
              {lessons.length === 0 && <Empty title="No lessons recorded" />}
              {lessons.map((e) => (
                <div key={e.id} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
                  <div className="flex items-center gap-1.5">
                    <FamilyChip eventType={e.event_type} />
                    <span className="font-mono text-[11px] text-slate-300">{fmtRange(e.depth_start, e.depth_end)}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-emerald-50/90">{e.lessons_learned}</p>
                  <p className="mt-1 text-[11px] text-slate-400"><span className="text-slate-500">Mitigation that worked:</span> {e.mitigation_action}</p>
                  <div className="mt-1.5"><SourceCitation documentId={e.source_document_id} title={e.document_title} docType={e.document_type} page={e.source_page} /></div>
                </div>
              ))}
            </div>
          )}
          {tab === "docs" && (
            <div className="space-y-1.5">
              {profile.data.documents.map((d) => (
                <div key={d.id} className="rounded border border-cockpit-line p-2">
                  <SourceCitation documentId={d.id} title={d.title} docType={d.doc_type} className="w-full" />
                  <p className="mt-1 text-[11px] text-cockpit-muted"><FileText size={10} className="mr-1 inline" />{fmtDate(d.date)} · {d.page_count} pages · {d.summary}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
