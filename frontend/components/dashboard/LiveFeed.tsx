"use client";

import { Pause, Play, Radio } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useNWIS } from "@/lib/store";
import type { Parameters } from "@/lib/types";
import { cn, fmtNum } from "@/lib/utils";

const COLS: { key: keyof Parameters; label: string; d: number }[] = [
  { key: "rop", label: "ROP", d: 1 },
  { key: "wob", label: "WOB", d: 0 },
  { key: "torque", label: "TQ", d: 1 },
  { key: "rpm", label: "RPM", d: 0 },
  { key: "flow_rate", label: "Flow", d: 0 },
  { key: "standpipe_pressure", label: "SPP", d: 0 },
  { key: "ecd", label: "ECD", d: 3 },
  { key: "hook_load", label: "HKLD", d: 0 },
  { key: "gas_units", label: "Gas", d: 0 },
];

/** Simulated eRTMAC stream — the last 20 depth-indexed readings feeding the risk engine. */
export function LiveFeed() {
  const trend = useNWIS((s) => s.evaluation?.trend ?? []);
  const demoMode = useNWIS((s) => s.demoMode);
  const liveFeed = useNWIS((s) => s.liveFeed);
  const setLiveFeed = useNWIS((s) => s.setLiveFeed);
  const setDemoMode = useNWIS((s) => s.setDemoMode);
  const flags = useNWIS((s) => {
    const set = new Set<string>();
    for (const a of s.evaluation?.assessments ?? []) for (const x of a.contributing_signals) if (x.anomalous) set.add(x.signal);
    return Array.from(set).join(",");
  });
  const flagged = new Set(flags.split(","));
  const rows = [...trend].reverse();
  const streaming = !demoMode && liveFeed;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("mx-3 mt-1 flex items-center gap-2.5 rounded-[3px] px-3 py-2.5 text-[13px]", streaming ? "bg-low-soft text-low-ink" : "bg-surface-2 text-ink-2")}>
        <Radio size={15} className={streaming ? "animate-breathe" : "text-ink-4"} />
        <span className="font-semibold">{streaming ? "Streaming simulated eRTMAC (+2 m every 2 s)" : "Feed paused — depth follows the wellbore / scenario"}</span>
        <Button
          size="xs"
          variant={streaming ? "secondary" : "primary"}
          className="ml-auto"
          onClick={() => {
            if (streaming) setLiveFeed(false);
            else {
              setDemoMode(false);
              setLiveFeed(true);
            }
          }}
        >
          {streaming ? <Pause size={12} /> : <Play size={12} />} {streaming ? "Pause" : "Go live"}
        </Button>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-auto px-1">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-surface text-[12px] text-ink-3">
            <tr>
              <th className="px-2 py-1.5 text-left font-bold">MD</th>
              {COLS.map((c) => (
                <th key={c.key} className={cn("px-1 py-1.5 text-right font-bold", flagged.has(c.key) && "text-high-ink")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tabular">
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.tr
                  key={r.md}
                  layout
                  initial={{ opacity: 0, backgroundColor: "color-mix(in oklab, var(--brand) 22%, transparent)" }}
                  animate={{ opacity: 1, backgroundColor: i === 0 ? "color-mix(in oklab, var(--brand) 8%, transparent)" : "color-mix(in oklab, var(--brand) 0%, transparent)" }}
                  transition={{ duration: 0.6 }}
                  className="border-t border-line"
                >
                  <td className="px-2 py-1 font-semibold text-brand-ink">{Math.round(r.md ?? 0)}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className={cn("px-1 py-1 text-right text-ink-2", i === 0 && "font-semibold text-ink", i === 0 && flagged.has(c.key) && "text-high-ink")}>
                      {fmtNum(r[c.key] as number, c.d)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-4 py-2 text-[12px] text-ink-3">
        Integration point: swap in the eRTMAC WITSML/REST stream — the risk engine consumes the same parameter schema.
      </div>
    </div>
  );
}
