"use client";

import { Globe2, Layers3 } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export type FieldView = "surface" | "subsurface";

/** Surface map ↔ subsurface 3D switch for the Command Center's field panel. */
export function ViewSwitch({ value, onChange }: { value: FieldView; onChange: (v: FieldView) => void }) {
  const id = useId();
  const opts: { v: FieldView; label: string; icon: typeof Globe2; title: string }[] = [
    { v: "surface", label: "Surface", icon: Globe2, title: "Satellite field map" },
    { v: "subsurface", label: "Subsurface", icon: Layers3, title: "Cut-away 3D block: strata, well paths and events at depth" },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-[3px] bg-surface-3 p-[3px]" role="tablist" aria-label="Field view">
      {opts.map(({ v, label, icon: Icon, title }) => {
        const on = value === v;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={on}
            title={title}
            onClick={() => onChange(v)}
            className={cn("relative flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-[12.5px] font-bold transition-colors", on ? "text-white" : "text-ink-2 hover:text-ink")}
          >
            {on && <motion.span layoutId={`view-${id}`} className="absolute inset-0 rounded-[3px] bg-brand shadow-brand" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
            <span className="relative flex items-center gap-1.5">
              <Icon size={14} /> {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
