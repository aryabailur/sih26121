"use client";

import { TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { AnimatedNumber } from "@/components/ui/animated";
import { useNWIS } from "@/lib/store";
import type { Parameters } from "@/lib/types";
import { cn } from "@/lib/utils";

type Key = "rop" | "wob" | "torque" | "ecd" | "standpipe_pressure" | "mud_weight";

const KPIS: { key: Key; label: string; unit: string; digits: number; hint: string }[] = [
  { key: "rop", label: "ROP", unit: "m/hr", digits: 1, hint: "Rate of penetration" },
  { key: "wob", label: "WOB", unit: "kN", digits: 0, hint: "Weight on bit" },
  { key: "torque", label: "Torque", unit: "kN·m", digits: 1, hint: "Surface torque" },
  { key: "ecd", label: "ECD", unit: "sg", digits: 3, hint: "Equivalent circulating density" },
  { key: "standpipe_pressure", label: "SPP", unit: "psi", digits: 0, hint: "Standpipe pressure" },
  { key: "mud_weight", label: "MW", unit: "sg", digits: 3, hint: "Mud weight in" },
];

/** Live eRTMAC parameters (simulated). A tile turns orange when any in-horizon assessment flags its signal. */
export function KPIStrip() {
  const evaluation = useNWIS((s) => s.evaluation);
  const p = evaluation?.parameters;
  const trend = evaluation?.trend ?? [];

  const flags = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of evaluation?.assessments ?? []) {
      for (const s of a.contributing_signals) if (s.anomalous && !m.has(s.signal)) m.set(s.signal, s.note);
    }
    return m;
  }, [evaluation]);

  return (
    <div className="grid shrink-0 grid-cols-3 gap-2.5 xl:grid-cols-6">
      {KPIS.map((k, i) => {
        const v = p?.[k.key as keyof Parameters] as number | undefined;
        const flag = flags.get(k.key);
        return (
          <motion.div
            key={k.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, type: "spring", stiffness: 260, damping: 24 }}
            className={cn("card relative min-w-0 overflow-hidden px-3 pb-2 pt-2.5 transition-colors", flag && "border-high/60")}
            style={flag ? { background: "color-mix(in oklab, var(--high) 7%, var(--surface))" } : undefined}
            title={flag ?? `${k.hint} — last ${trend.length} readings (simulated eRTMAC)`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[12.5px] font-bold text-ink-3">{k.label}</span>
              {flag && (
                <span className="flex h-5 w-5 shrink-0 animate-breathe items-center justify-center rounded-full bg-high text-white" aria-label="Anomaly">
                  <TriangleAlert size={11} />
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
                {v === undefined ? "—" : <AnimatedNumber value={v} format={(x) => x.toLocaleString("en-IN", { minimumFractionDigits: k.digits, maximumFractionDigits: k.digits })} />}
              </span>
              <span className={cn("text-[12px] font-bold", flag ? "text-high-ink" : "text-ink-3")}>{k.unit}</span>
            </div>
            <Sparkline
              values={trend.map((t) => t[k.key as keyof Parameters] as number)}
              depths={trend.map((t) => t.md ?? 0)}
              color={flag ? "var(--high)" : "var(--brand)"}
              fluid
              height={26}
              className="mt-1"
              format={(x) => x.toFixed(k.digits)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
