"use client";

import { ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskCard } from "@/components/risk/RiskCard";
import { Empty } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";
import type { Alert, RiskAssessment } from "@/lib/types";
import { FAMILY_META, fmtDepth, SEVERITY_RANK } from "@/lib/utils";

const STATUS_ORDER: Record<Alert["status"], number> = { active: 0, reviewed: 1, acknowledged: 2, dismissed: 3 };

export function useRiskStack() {
  const evaluation = useNWIS((s) => s.evaluation);
  return useMemo(() => {
    const assessments = evaluation?.assessments ?? [];
    const alerts = [...(evaluation?.active_alerts ?? [])].sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
    );
    const alertZones = new Set(alerts.map((a) => a.zone_id));
    // Alerts keep their trigger-time evidence; the live score rides along as "now".
    const alertItems = alerts.map((al) => {
      const now = assessments.find((x) => x.zone_id === al.zone_id);
      return { alert: al, assessment: al.assessment, now, live: false };
    });
    const watch = assessments.filter((a) => !alertZones.has(a.zone_id) && SEVERITY_RANK[a.severity] >= 1);
    const horizon = assessments.filter((a) => !alertZones.has(a.zone_id) && a.severity === "low");
    return { alertItems, watch, horizon };
  }, [evaluation]);
}

export function RiskWatch({ compact = false }: { compact?: boolean }) {
  const { alertItems, watch, horizon } = useRiskStack();
  const [showHorizon, setShowHorizon] = useState(false);
  const depth = useNWIS((s) => s.depth);
  const openWhy = useNWIS((s) => s.openWhy);

  if (!alertItems.length && !watch.length && !horizon.length) {
    return <Empty icon={<ShieldAlert size={22} />} title="No offset-well risk windows within the look-ahead" hint="Move the depth scrubber towards a historical risk interval." />;
  }
  return (
    <div className="space-y-2 p-2">
      {alertItems.map(({ alert, assessment, now, live }) => (
        <RiskCard key={alert.id} alert={alert} assessment={assessment} now={now} live={live} compact={compact} />
      ))}
      {watch.map((a: RiskAssessment) => (
        <RiskCard key={a.zone_id} assessment={a} compact={compact} />
      ))}
      {horizon.length > 0 && (
        <div className="rounded-lg border border-cockpit-line bg-black/10">
          <button onClick={() => setShowHorizon(!showHorizon)} className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] text-cockpit-muted hover:text-slate-200">
            {showHorizon ? <ChevronDown size={12} /> : <ChevronRight size={12} />} On the horizon ({horizon.length} low-score windows)
          </button>
          {showHorizon && (
            <ul className="space-y-1 px-3 pb-2">
              {horizon.map((a) => (
                <li key={a.zone_id}>
                  <button onClick={() => openWhy({ kind: "assessment", zoneId: a.zone_id })} className="flex w-full items-center gap-2 text-left text-[11px] text-slate-300 hover:text-cyan-200">
                    <span style={{ color: FAMILY_META[a.risk_type].color }}>{FAMILY_META[a.risk_type].glyph}</span>
                    <span className="flex-1">{a.risk_label}</span>
                    <span className="font-mono text-cockpit-muted">{fmtDepth(a.risk_window.start)}</span>
                    <span className="font-mono text-cockpit-dim">{a.position === "ahead" ? `+${Math.round(a.risk_window.start - depth)} m` : a.position}</span>
                    <span className="w-8 text-right font-mono">{Math.round(a.score * 100)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
