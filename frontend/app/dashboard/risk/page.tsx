"use client";

import { Boxes, Gauge, History, ScrollText, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { useRiskStack } from "@/components/dashboard/RiskWatch";
import { RiskCard } from "@/components/risk/RiskCard";
import { RiskProfileChart } from "@/components/risk/RiskProfileChart";
import { DepthScrubber } from "@/components/shared/DepthScrubber";
import { AlertStatusBadge, FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { Panel } from "@/components/ui/card";
import { Empty, Loading, ScoreBar } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import { fmtDepth, fmtRange, fmtTime, pct } from "@/lib/utils";

const FACTOR_LABEL: Record<string, string> = {
  proximity: "Depth proximity",
  frequency: "Offset event frequency",
  similarity: "Well similarity",
  formation: "Formation match",
  parameter: "Live parameter anomaly",
  trajectory: "Trajectory match",
};

/** Screen E — Risk Explorer. */
export default function RiskExplorerPage() {
  const radiusKm = useNWIS((s) => s.radiusKm);
  const kbVersion = useNWIS((s) => s.kbVersion);
  const evaluation = useNWIS((s) => s.evaluation);
  const openWhy = useNWIS((s) => s.openWhy);
  const { alertItems, watch, horizon } = useRiskStack();
  const model = useAsync(() => api.modelCard(), []);
  const clusters = useAsync(() => api.clusters(radiusKm), [radiusKm, kbVersion]);
  const alerts = evaluation?.active_alerts ?? [];
  const recurring = useMemo(() => (clusters.data?.clusters ?? []).filter((c) => c.well_count >= 2), [clusters.data]);

  return (
    <div className="grid h-full grid-cols-1 gap-2 overflow-y-auto p-2 xl:grid-cols-[minmax(0,1fr)_380px] xl:overflow-hidden">
      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Predicted risk along the well path" icon={<Gauge size={14} />} subtitle="Max score of all risk windows at each depth (simulated look-ahead feed) · shaded = risk-zone register" className="h-[260px] shrink-0" bodyClassName="p-2">
          <RiskProfileChart />
        </Panel>
        <div className="glass shrink-0 rounded-lg px-3 py-2.5">
          <DepthScrubber />
        </div>
        <Panel
          title={`Risk assessments at ${fmtDepth(evaluation?.depth)}`}
          icon={<ShieldAlert size={14} />}
          subtitle={`${alertItems.length} alert${alertItems.length === 1 ? "" : "s"} · ${watch.length} watch · ${horizon.length} low · radius ${radiusKm} km`}
          className="min-h-[420px] xl:min-h-0 xl:flex-1"
          bodyClassName="overflow-y-auto p-2"
        >
          {!evaluation ? (
            <Loading />
          ) : alertItems.length + watch.length + horizon.length === 0 ? (
            <Empty title="No risk windows within the look-ahead" hint="Move the bit towards a shaded zone above." />
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {alertItems.map(({ alert, assessment, now, live }) => <RiskCard key={alert.id} alert={alert} assessment={assessment} now={now} live={live} />)}
              {[...watch, ...horizon].map((a) => <RiskCard key={a.zone_id} assessment={a} />)}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex min-h-0 flex-col gap-2 xl:overflow-y-auto">
        <Panel title="Alert log & audit" icon={<History size={14} />} subtitle="Acknowledge / dismiss / review from any card or the “Why?” view" className="shrink-0" bodyClassName="p-2">
          {alerts.length === 0 ? (
            <Empty title="No alerts raised yet" hint="Run the historical risk scenario or drag the bit into a window." className="p-3" />
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button onClick={() => openWhy({ kind: "alert", alertId: a.id })} className="w-full rounded border border-cockpit-line px-2 py-1.5 text-left hover:border-cyan-400/40">
                    <div className="flex items-center gap-1.5">
                      <FamilyChip family={a.risk_type} />
                      <SeverityBadge severity={a.severity} />
                      <span className="ml-auto"><AlertStatusBadge status={a.status} /></span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-cockpit-muted">
                      <span className="font-mono text-slate-200">raised @ {fmtDepth(a.triggered_at_depth)}</span>
                      <span>{fmtTime(a.created_at)}</span>
                      <span>score {Math.round(a.score * 100)} · conf {pct(a.confidence)}</span>
                    </div>
                    {a.notes && <div className="mt-0.5 truncate text-[10.5px] text-cockpit-dim">“{a.notes}”</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="How the score works" icon={<ScrollText size={14} />} subtitle={model.data?.name} className="shrink-0" bodyClassName="space-y-3 p-3">
          {model.loading && <Loading />}
          {model.data && (
            <>
              <div className="space-y-1.5">
                {Object.entries(model.data.weights).map(([k, w]) => (
                  <div key={k} title={model.data!.factors[k]}>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">{FACTOR_LABEL[k] ?? k}</span>
                      <span className="font-mono text-slate-100">{w.toFixed(2)}</span>
                    </div>
                    <ScoreBar value={w / 0.3} color="#38bdf8" />
                    <div className="mt-0.5 text-[10px] leading-snug text-cockpit-dim">{model.data!.factors[k]}</div>
                  </div>
                ))}
              </div>
              <div className="rounded border border-cockpit-line bg-black/20 p-2 text-[11px] text-slate-300">
                <div className="label-caps mb-0.5">Alert policy</div>
                {model.data.alert_policy}
              </div>
              <ul className="space-y-0.5 text-[10.5px] text-cockpit-dim">
                {model.data.limitations.map((l) => <li key={l}>• {l}</li>)}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Recurring event clusters" icon={<Boxes size={14} />} subtitle={`Offsets within ${radiusKm} km grouped by risk family, formation and depth`} className="shrink-0" bodyClassName="space-y-2 p-2">
          {clusters.loading && <Loading />}
          {recurring.map((c) => (
            <div key={`${c.risk_type}-${c.formation}-${c.depth_start}`} className="rounded-lg border border-cockpit-line bg-black/20 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <FamilyChip family={c.risk_type} />
                <SeverityBadge severity={c.max_severity} />
                <span className="font-mono text-[11px] text-slate-200">{fmtRange(c.depth_start, c.depth_end)}</span>
              </div>
              <div className="mt-1 text-[11px] text-cockpit-muted">
                {c.formation} · {c.event_count} events in {c.well_count} wells ({c.wells.join(", ")}) · {c.total_npt_hours} h NPT
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                {c.common_mitigations.slice(0, 3).map((m) => <li key={m} className="line-clamp-2">• {m}</li>)}
              </ul>
            </div>
          ))}
          {!clusters.loading && recurring.length === 0 && <Empty title="No multi-well clusters in this radius" />}
        </Panel>
      </div>
    </div>
  );
}
