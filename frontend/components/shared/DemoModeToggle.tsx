"use client";

import { useNWIS } from "@/lib/store";
import { cn } from "@/lib/utils";

/** DEMO = deterministic seeded data + scenario controls. LIVE = simulated eRTMAC feed auto-advancing the bit. */
export function DemoModeToggle() {
  const demoMode = useNWIS((s) => s.demoMode);
  const setDemoMode = useNWIS((s) => s.setDemoMode);
  const setLiveFeed = useNWIS((s) => s.setLiveFeed);
  return (
    <div className="flex shrink-0 items-center overflow-hidden whitespace-nowrap rounded-md border border-cockpit-border text-[10px] font-bold uppercase tracking-wider">
      <button
        onClick={() => setDemoMode(true)}
        className={cn("px-2 py-1", demoMode ? "bg-amber-500/20 text-amber-200" : "text-slate-500 hover:text-slate-300")}
        title="Deterministic seeded demo: scenario controls enabled, no auto-advance"
      >
        Demo mode
      </button>
      <button
        onClick={() => {
          setDemoMode(false);
          setLiveFeed(true);
        }}
        className={cn("flex items-center gap-1 border-l border-cockpit-border px-2 py-1", !demoMode ? "bg-emerald-500/15 text-emerald-200" : "text-slate-500 hover:text-slate-300")}
        title="Simulated live eRTMAC feed — the bit advances automatically"
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", !demoMode ? "animate-pulse bg-emerald-400" : "bg-slate-600")} /> Live (sim)
      </button>
    </div>
  );
}
