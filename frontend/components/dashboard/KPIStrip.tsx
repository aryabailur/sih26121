"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { useNWIS } from "@/lib/store";
import type { Parameters } from "@/lib/types";
import { cn, fmtDepth, formationColor } from "@/lib/utils";

type Key = "rop" | "wob" | "torque" | "ecd" | "standpipe_pressure" | "mud_weight";

const KPIS: { key: Key; label: string; unit: string; digits: number; color: string }[] = [
  { key: "rop", label: "ROP", unit: "m/hr", digits: 1, color: "#38bdf8" },
  { key: "wob", label: "WOB", unit: "kN", digits: 0, color: "#38bdf8" },
  { key: "torque", label: "Torque", unit: "kN·m", digits: 1, color: "#38bdf8" },
  { key: "ecd", label: "ECD", unit: "sg", digits: 3, color: "#38bdf8" },
  { key: "standpipe_pressure", label: "SPP", unit: "psi", digits: 0, color: "#38bdf8" },
  { key: "mud_weight", label: "Mud weight", unit: "sg", digits: 3, color: "#38bdf8" },
];

export function KPIStrip() {
  const evaluation = useNWIS((s) => s.evaluation);
  const depth = useNWIS((s) => s.depth);
  const p = evaluation?.parameters;
  const trend = evaluation?.trend ?? [];

  // A KPI is flagged when any in-horizon assessment marks its signal anomalous.
  const flags = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of evaluation?.assessments ?? []) {
      for (const s of a.contributing_signals) if (s.anomalous && !m.has(s.signal)) m.set(s.signal, s.note);
    }
    return m;
  }, [evaluation]);

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <div className="glass rounded-lg px-3 py-2">
        <div className="label-caps">Bit depth (MD)</div>
        <div className="font-mono text-xl font-semibold tabular text-slate-50">{fmtDepth(depth, false)}<span className="ml-1 text-xs text-cockpit-muted">m</span></div>
        <div className="text-[10px] text-cockpit-dim">TD plan {fmtDepth(3800)}</div>
      </div>
      <div className="glass rounded-lg px-3 py-2">
        <div className="label-caps">Formation</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-50">
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: formationColor(evaluation?.current_formation) }} />
          <span className="truncate">{evaluation?.current_formation ?? "—"}</span>
        </div>
        <div className="truncate text-[10px] text-cockpit-dim">
          {evaluation?.next_risk_zone ? `next window ${Math.round(evaluation.next_risk_zone.distance)} m` : "no window ahead"}
        </div>
      </div>
      {KPIS.map((k) => {
        const v = p?.[k.key as keyof Parameters] as number | undefined;
        const flag = flags.get(k.key);
        return (
          <div
            key={k.key}
            className={cn("glass relative rounded-lg px-3 py-2", flag && "border-amber-500/60 bg-amber-500/[0.06]")}
            title={flag ?? `${k.label} — last 20 readings (simulated eRTMAC)`}
          >
            <div className="flex items-center justify-between">
              <span className="label-caps">{k.label}</span>
              {flag && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-amber-300">
                  <AlertTriangle size={10} /> anomaly
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="font-mono text-lg font-semibold leading-tight tabular text-slate-50">
                {v === undefined ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: k.digits, maximumFractionDigits: k.digits })}
                <span className="ml-1 text-[10px] font-normal text-cockpit-muted">{k.unit}</span>
              </div>
              <Sparkline
                values={trend.map((t) => t[k.key as keyof Parameters] as number)}
                depths={trend.map((t) => t.md ?? 0)}
                color={flag ? "#f59e0b" : k.color}
                width={64}
                height={24}
                format={(x) => x.toFixed(k.digits)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
