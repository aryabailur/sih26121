"use client";

import { ChevronDown, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { RiskCard } from "@/components/risk/RiskCard";
import { Empty } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";
import type { Alert } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth, SEVERITY_RANK } from "@/lib/utils";

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
    return (
      <Empty
        icon={<ShieldCheck size={24} />}
        title="All clear in the look-ahead"
        hint="No offset-well risk windows near the bit. Drag the bit towards a coloured window on the wellbore to preview what's coming."
        className="h-full"
      />
    );
  }
  return (
    <div className="space-y-3 p-3">
      <AnimatePresence initial={false} mode="popLayout">
        {alertItems.map(({ alert, assessment, now, live }) => (
          <RiskCard key={alert.id} alert={alert} assessment={assessment} now={now} live={live} compact={compact} />
        ))}
        {watch.map((a) => (
          <RiskCard key={a.zone_id} assessment={a} compact={compact} />
        ))}
      </AnimatePresence>
      {horizon.length > 0 && (
        <motion.div layout className="overflow-hidden rounded-[4px] border border-dashed border-line-2 bg-surface-2">
          <button onClick={() => setShowHorizon(!showHorizon)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-ink-3 hover:text-ink">
            <ChevronDown size={14} className={cn("transition-transform", !showHorizon && "-rotate-90")} />
            On the horizon · {horizon.length} low-score window{horizon.length > 1 ? "s" : ""}
          </button>
          <AnimatePresence initial={false} mode="popLayout">
            {showHorizon && (
              <motion.ul initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="space-y-1 overflow-hidden px-2 pb-2">
                {horizon.map((a) => (
                  <li key={a.zone_id}>
                    <button
                      onClick={() => openWhy({ kind: "assessment", zoneId: a.zone_id })}
                      className="flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left text-[13px] text-ink-2 hover:bg-surface"
                    >
                      <FamilyIcon family={a.risk_type} size={13} />
                      <span className="flex-1 font-semibold">{FAMILY_META[a.risk_type].label}</span>
                      <span className="font-mono text-[12.5px] text-ink-3">{fmtDepth(a.risk_window.start)}</span>
                      <span className="w-20 text-right text-[12.5px] text-ink-3">{a.position === "ahead" ? `+${Math.round(a.risk_window.start - depth)} m` : a.position}</span>
                      <span className="w-7 text-right font-bold tabular">{Math.round(a.score * 100)}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
