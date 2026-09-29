"use client";

import { Boxes, Gauge, History, Layers, ScrollText, ShieldAlert, Siren, Telescope, Timer } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useRiskStack } from "@/components/dashboard/RiskWatch";
import { LearnedWeights } from "@/components/risk/LearnedOpinion";
import { PressureWindowChart } from "@/components/risk/PressureWindowChart";
import { RiskCard } from "@/components/risk/RiskCard";
import { RiskProfileChart } from "@/components/risk/RiskProfileChart";
import { FACTOR_COLOR, FACTOR_LABEL } from "@/components/risk/WhyExplainer";
import { DepthScrubber } from "@/components/shared/DepthScrubber";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { AlertStatusBadge, FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { AnimatedNumber } from "@/components/ui/animated";
import { Panel } from "@/components/ui/card";
import { Empty, Loading } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import { FAMILY_META, fmtDepth, fmtRange, fmtTime, pct, SEVERITY_STYLE } from "@/lib/utils";

function StatTile({ icon, label, value, sub, tint, i }: { icon: React.ReactNode; label: string; value: number; sub: string; tint: string; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="card flex items-center gap-3.5 px-4 py-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] text-white shadow-md" style={{ background: tint }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className="text-[24px] font-extrabold leading-none tracking-[-0.02em] text-ink">
          <AnimatedNumber value={value} from={0} />
        </div>
        <div className="truncate text-[12.5px] text-ink-3">{sub}</div>
      </div>
    </motion.div>
  );
}

/** Screen E — Risk explorer. */
export default function RiskExplorerPage() {
  const radiusKm = useNWIS((s) => s.radiusKm);
  const kbVersion = useNWIS((s) => s.kbVersion);
  const evaluation = useNWIS((s) => s.evaluation);
  const wells = useNWIS((s) => s.wells);
  const openWhy = useNWIS((s) => s.openWhy);
  const { alertItems, watch, horizon } = useRiskStack();
  const model = useAsync(() => api.modelCard(), []);
  const clusters = useAsync(() => api.clusters(radiusKm), [radiusKm, kbVersion]);
  const alerts = evaluation?.active_alerts ?? [];
  const recurring = useMemo(() => (clusters.data?.clusters ?? []).filter((c) => c.well_count >= 2), [clusters.data]);
  const npt = wells.filter((w) => w.role === "offset" && w.distance_km <= radiusKm).reduce((s, w) => s + w.npt_hours, 0);
  const activeCount = alerts.filter((a) => a.status === "active").length;

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[minmax(0,1fr)_400px] xl:overflow-hidden">
      {/* On wide screens each column scrolls on its own, so neither leaves a blank gutter. */}
      <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile i={0} icon={<Siren size={20} />} label="Active alerts" value={activeCount} sub={`${alerts.length} raised this run`} tint={SEVERITY_STYLE.critical.gradient} />
          <StatTile i={1} icon={<ShieldAlert size={20} />} label="Watching" value={watch.length} sub="medium+ windows near the bit" tint={SEVERITY_STYLE.medium.gradient} />
          <StatTile i={2} icon={<Telescope size={20} />} label="On the horizon" value={horizon.length} sub="low-score windows in look-ahead" tint="var(--aurora)" />
          <StatTile i={3} icon={<Timer size={20} />} label="Offset NPT in radius" value={npt} sub={`hours across wells within ${radiusKm} km`} tint={SEVERITY_STYLE.low.gradient} />
        </div>

        <Panel title="Predicted risk along the well path" icon={<Gauge size={16} />} subtitle="Max score of all risk windows at each depth (simulated look-ahead feed) · shaded = risk-zone register" className="shrink-0" bodyClassName="px-4 pb-4">
          <div className="h-[220px]">
            <RiskProfileChart />
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <DepthScrubber />
          </div>
        </Panel>

        <Panel
          title={`Risk assessments at ${fmtDepth(evaluation?.depth)}`}
          icon={<ShieldAlert size={16} />}
          subtitle={`${alertItems.length} alert${alertItems.length === 1 ? "" : "s"} · ${watch.length} watching · ${horizon.length} low · radius ${radiusKm} km`}
          className="shrink-0"
          bodyClassName="px-3 pb-3"
        >
          {!evaluation ? (
            <Loading />
          ) : alertItems.length + watch.length + horizon.length === 0 ? (
            <Empty title="No risk windows within the look-ahead" hint="Move the bit towards a shaded zone above." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {alertItems.map(({ alert, assessment, now, live }) => (
                <RiskCard key={alert.id} alert={alert} assessment={assessment} now={now} live={live} />
              ))}
              {[...watch, ...horizon].map((a) => (
                <RiskCard key={a.zone_id} assessment={a} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
        <Panel title="Alert log & audit" icon={<History size={16} />} subtitle="Acknowledge, review or dismiss from any card or the “Why?” view" className="shrink-0" bodyClassName="px-3 pb-3">
          {alerts.length === 0 ? (
            <Empty title="No alerts raised yet" hint="Run the historical risk scenario or drag the bit into a window." className="p-3" />
          ) : (
            <ol className="relative space-y-2 pl-4 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-0.5 before:rounded-[2px] before:bg-line-2">
              {alerts.map((a, i) => (
                <motion.li key={a.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="relative">
                  <span className="absolute -left-4 top-4 h-3.5 w-3.5 rounded-full border-[3px] border-surface" style={{ background: SEVERITY_STYLE[a.severity].hex }} />
                  <button onClick={() => openWhy({ kind: "alert", alertId: a.id })} className="w-full rounded-[3px] border border-line px-3 py-2.5 text-left transition-all hover:border-brand/40 hover:bg-surface-2">
                    <div className="flex items-center gap-1.5">
                      <FamilyChip family={a.risk_type} />
                      <SeverityBadge severity={a.severity} />
                      <span className="ml-auto">
                        <AlertStatusBadge status={a.status} />
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3">
                      <span className="font-bold text-ink">Raised @ {fmtDepth(a.triggered_at_depth)}</span>
                      <span>{fmtTime(a.created_at)}</span>
                      <span>
                        score {Math.round(a.score * 100)} · conf {pct(a.confidence)}
                      </span>
                    </div>
                    {a.notes && <div className="mt-0.5 truncate text-[12.5px] italic text-ink-3">“{a.notes}”</div>}
                  </button>
                </motion.li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Mud-weight window" icon={<Layers size={16} />} subtitle="OIL-AX-102 · prognosis vs offset-calibrated pore & fracture gradients" className="h-[600px] shrink-0" bodyClassName="px-3 pb-3">
          <PressureWindowChart />
        </Panel>

        <Panel title="How the score works" icon={<ScrollText size={16} />} subtitle={model.data?.name} className="shrink-0" bodyClassName="space-y-4 px-4 pb-4">
          {model.loading && <Loading />}
          {model.data && (
            <>
              <div>
                <div className="flex h-4 overflow-hidden rounded-[1px]">
                  {Object.entries(model.data.weights).map(([k, w], i) => (
                    <motion.div key={k} initial={{ width: 0 }} animate={{ width: `${w * 100}%` }} transition={{ delay: 0.1 * i, type: "spring", stiffness: 90, damping: 18 }} style={{ background: FACTOR_COLOR[k] ?? "#94a3b8" }} title={`${FACTOR_LABEL[k] ?? k} ${w}`} />
                  ))}
                </div>
                <div className="mt-3 space-y-2.5">
                  {Object.entries(model.data.weights).map(([k, w]) => (
                    <div key={k} className="flex gap-2.5">
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-[2px]" style={{ background: FACTOR_COLOR[k] ?? "#94a3b8" }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-[13px]">
                          <span className="font-bold text-ink">{FACTOR_LABEL[k] ?? k}</span>
                          <span className="font-mono font-semibold text-ink-2">{Math.round(w * 100)}%</span>
                        </div>
                        <div className="text-[12.5px] leading-snug text-ink-3">{model.data!.factors[k]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[3px] bg-brand-soft p-3 text-[12.5px] text-ink-2">
                <div className="mb-0.5 font-extrabold text-brand-ink">Alert policy</div>
                {model.data.alert_policy}
              </div>
              <ul className="space-y-1 text-[12.5px] text-ink-3">
                {model.data.limitations.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                    {l}
                  </li>
                ))}
              </ul>
              {model.data.learned && <LearnedWeights m={model.data.learned} />}
            </>
          )}
        </Panel>

        <Panel title="Recurring event clusters" icon={<Boxes size={16} />} subtitle={`Offsets within ${radiusKm} km grouped by risk family, formation and depth`} className="shrink-0" bodyClassName="space-y-2.5 px-3 pb-3">
          {clusters.loading && <Loading />}
          {recurring.map((c) => (
            <div key={`${c.risk_type}-${c.formation}-${c.depth_start}`} className="rounded-[4px] border border-line p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <FamilyIcon family={c.risk_type} size={15} tile />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-ink">
                    {FAMILY_META[c.risk_type].label} <SeverityBadge severity={c.max_severity} />
                  </div>
                  <div className="text-[12.5px] font-semibold text-ink-3">
                    {fmtRange(c.depth_start, c.depth_end)} · {c.formation}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[12.5px] text-ink-3">
                {c.event_count} events in {c.well_count} wells ({c.wells.join(", ")}) · <b className="text-ink-2">{c.total_npt_hours} h NPT</b>
              </div>
              <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink-2">
                {c.common_mitigations.slice(0, 3).map((m) => (
                  <li key={m} className="line-clamp-2 flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-low" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!clusters.loading && recurring.length === 0 && <Empty title="No multi-well clusters in this radius" />}
        </Panel>
      </div>
    </div>
  );
}
