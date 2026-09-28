"use client";

import { X } from "lucide-react";
import type { RiskFamily } from "@/lib/types";
import { cn, FAMILY_META } from "@/lib/utils";

const ORDER: RiskFamily[] = ["mud_loss", "stuck_pipe", "kick", "torque_spike", "wellbore_instability", "cementing_failure", "NPT"];

const SHORT: Record<RiskFamily, string> = {
  mud_loss: "Losses",
  stuck_pipe: "Stuck pipe",
  kick: "Kick",
  torque_spike: "Torque",
  wellbore_instability: "Instability",
  cementing_failure: "Cement",
  NPT: "NPT",
};

export function FamilyFilter({ value, onChange, className, compact = false }: { value: RiskFamily[]; onChange: (v: RiskFamily[]) => void; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {ORDER.map((f) => {
        const on = value.includes(f);
        const m = FAMILY_META[f];
        return (
          <button
            key={f}
            onClick={() => onChange(on ? value.filter((x) => x !== f) : [...value, f])}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
              on ? "bg-white/10 text-slate-50" : "border-cockpit-border text-slate-400 hover:text-slate-200",
            )}
            style={on ? { borderColor: m.color } : undefined}
            aria-pressed={on}
          >
            <span style={{ color: m.color }} aria-hidden>{m.glyph}</span>
            {compact ? SHORT[f] : m.label}
          </button>
        );
      })}
      {value.length > 0 && (
        <button onClick={() => onChange([])} className="flex items-center gap-0.5 px-1 text-[10.5px] text-cockpit-muted hover:text-slate-200">
          <X size={11} /> clear
        </button>
      )}
    </div>
  );
}
