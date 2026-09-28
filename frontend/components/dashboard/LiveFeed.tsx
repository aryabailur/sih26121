"use client";

import { Radio } from "lucide-react";
import { useNWIS } from "@/lib/store";
import { cn, fmtNum } from "@/lib/utils";

const COLS: { key: keyof import("@/lib/types").Parameters; label: string; d: number }[] = [
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
      <div className="flex items-center gap-2 border-b border-cockpit-line px-3 py-2 text-[11px]">
        <Radio size={13} className={streaming ? "animate-pulse text-emerald-400" : "text-slate-500"} />
        <span className="text-slate-300">{streaming ? "Streaming simulated eRTMAC feed (+2 m / 2 s)" : "Feed paused — depth driven by scrubber / scenario"}</span>
        <button
          onClick={() => {
            if (streaming) setLiveFeed(false);
            else {
              setDemoMode(false);
              setLiveFeed(true);
            }
          }}
          className="ml-auto rounded border border-cockpit-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300 hover:border-emerald-400/60"
        >
          {streaming ? "Pause" : "Start live sim"}
        </button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto", !streaming && "hatched")}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-cockpit-surface/95 text-cockpit-dim">
            <tr>
              <th className="px-2 py-1 text-left font-medium">MD</th>
              {COLS.map((c) => (
                <th key={c.key} className={cn("px-1 py-1 text-right font-medium", flagged.has(c.key) && "text-amber-300")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tabular">
            {rows.map((r, i) => (
              <tr key={r.md} className={cn("border-t border-cockpit-line/60", i === 0 && "bg-cyan-400/5 text-slate-50")}>
                <td className="px-2 py-0.5 text-cyan-200/90">{Math.round(r.md ?? 0)}</td>
                {COLS.map((c) => (
                  <td key={c.key} className={cn("px-1 py-0.5 text-right text-slate-300", i === 0 && flagged.has(c.key) && "text-amber-200")}>
                    {fmtNum(r[c.key] as number, c.d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-cockpit-line px-3 py-1.5 text-[10px] text-cockpit-dim">
        Integration point: replace with the eRTMAC WITSML/REST stream — the risk engine consumes the same parameter schema.
      </div>
    </div>
  );
}
