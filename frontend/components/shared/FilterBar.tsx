"use client";

import { X } from "lucide-react";
import type { RiskFamily } from "@/lib/types";
import { cn, FAMILY_META, FAMILY_ORDER } from "@/lib/utils";
import { FamilyIcon } from "./FamilyIcon";

export function FamilyFilter({
  value,
  onChange,
  className,
  compact = false,
  onDark = false,
  dense = false,
}: {
  value: RiskFamily[];
  onChange: (v: RiskFamily[]) => void;
  className?: string;
  compact?: boolean;
  onDark?: boolean;
  /** Tighter chips for overlays (e.g. over the map) so seven families fit in two rows. */
  dense?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center", dense ? "gap-1" : "gap-1.5", className)}>
      {FAMILY_ORDER.map((f) => {
        const on = value.includes(f);
        const m = FAMILY_META[f];
        return (
          <button
            key={f}
            onClick={() => onChange(on ? value.filter((x) => x !== f) : [...value, f])}
            className={cn(
              "flex items-center rounded-[2px] border font-semibold transition-all",
              dense ? "gap-1 px-2 py-[3px] text-[12px]" : "gap-1.5 px-2.5 py-1 text-[12.5px]",
              on ? "font-bold text-ink shadow-sm" : onDark ? "border-white/15 bg-black/35 text-white/85 backdrop-blur hover:bg-black/50" : "border-line-2 bg-surface text-ink-2 hover:border-ink-4/60",
            )}
            style={on ? { background: `color-mix(in oklab, ${m.color} 20%, var(--surface))`, borderColor: m.color, boxShadow: `inset 0 -2px 0 ${m.color}` } : undefined}
            aria-pressed={on}
          >
            <FamilyIcon family={f} size={12} />
            {compact ? m.short : m.label}
          </button>
        );
      })}
      {value.length > 0 && (
        <button
          onClick={() => onChange([])}
          className={cn("flex items-center gap-1 rounded-[2px] px-2 py-1 text-[12.5px] font-semibold", onDark ? "text-white/80 hover:text-white" : "text-ink-3 hover:text-ink")}
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
