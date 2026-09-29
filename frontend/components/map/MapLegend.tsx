"use client";

import { ChevronDown, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { SEVERITY_STYLE } from "@/lib/utils";

export function MapLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-3 left-3 z-10">
      <div className="glass overflow-hidden rounded-[3px]">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] font-bold text-ink">
          <Info size={14} className="text-brand-ink" /> Legend
          <ChevronDown size={14} className={`ml-auto text-ink-3 transition-transform ${open ? "" : "rotate-180"}`} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 pb-3 text-[12.5px] font-medium text-ink-2">
                <Item swatch={<span className="aurora h-3 w-3 rounded-full" />}>Active well</Item>
                <Item swatch={<span className="h-3 w-3 rotate-45 rounded-[2px] border-2 border-white bg-[#6d5cff]" />}>Bit position</Item>
                {(["critical", "high", "medium", "low"] as const).map((s) => (
                  <Item key={s} swatch={<span className="h-3 w-3 rounded-full ring-2 ring-white" style={{ background: SEVERITY_STYLE[s].hex }} />}>
                    {SEVERITY_STYLE[s].label} history
                  </Item>
                ))}
                <Item swatch={<span className="h-1 w-4 rounded-[1px] bg-[#6d5cff]" />}>Well path</Item>
                <Item swatch={<span className="h-0 w-4 border-t-2 border-dashed border-[#0ea5e9]" />}>Evidence link</Item>
                <Item swatch={<span className="h-3 w-3 rotate-45 rounded-[2px] bg-[#0ea5e9]" />}>Event near bit</Item>
                <Item swatch={<span className="h-3 w-2 rounded-t-[2px] bg-gradient-to-t from-[#f76b15] to-[#ffc38f]" />}>History tower</Item>
              </div>
              <div className="border-t border-line px-3 py-2 text-[11.5px] leading-snug text-ink-3">Tower height = NPT hours + event count · colour = worst recorded event</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Item({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="flex w-4 items-center justify-center">{swatch}</span>
      {children}
    </span>
  );
}
