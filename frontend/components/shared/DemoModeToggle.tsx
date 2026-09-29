"use client";

import { motion } from "motion/react";
import { useNWIS } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Demo = deterministic seeded data + scenario controls. Live = simulated eRTMAC feed auto-advancing the bit. */
export function DemoModeToggle() {
  const demoMode = useNWIS((s) => s.demoMode);
  const setDemoMode = useNWIS((s) => s.setDemoMode);
  const setLiveFeed = useNWIS((s) => s.setLiveFeed);
  const opts = [
    { on: demoMode, label: "Demo", title: "Deterministic seeded demo: scenario controls, no auto-advance", click: () => setDemoMode(true) },
    {
      on: !demoMode,
      label: "Live",
      title: "Simulated live eRTMAC feed — the bit advances automatically",
      click: () => {
        setDemoMode(false);
        setLiveFeed(true);
      },
    },
  ];
  return (
    <div className="flex shrink-0 items-center rounded-[3px] bg-surface-3 p-[3px] text-[12.5px] font-bold">
      {opts.map((o) => (
        <button key={o.label} onClick={o.click} title={o.title} className={cn("relative flex items-center gap-1.5 rounded-[2px] px-3 py-1 transition-colors", o.on ? "text-ink" : "text-ink-3 hover:text-ink-2")}>
          {o.on && <motion.span layoutId="demo-toggle" className="absolute inset-0 rounded-[2px] bg-surface shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative flex items-center gap-1.5">
            {o.label === "Live" && <span className={cn("h-1.5 w-1.5 rounded-full", o.on ? "animate-breathe bg-low" : "bg-ink-4")} />}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}
