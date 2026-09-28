"use client";

import { Check, Loader2 } from "lucide-react";
import type { ProcessingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  uploaded: "Upload",
  extracting_text: "Extract text / OCR",
  chunking: "Chunk & tag",
  identifying_events: "Identify events",
  structuring: "Structure & provenance",
  review: "Human review",
  saved: "Saved to KB",
};

export function ProcessingStepper({ status }: { status: ProcessingStatus | null }) {
  const stages = status?.stages ?? Object.keys(LABELS).map((key) => ({ key, label: LABELS[key] }));
  const idx = status?.stage_index ?? -1;
  return (
    <ol className="flex items-start">
      {stages.map((s, i) => {
        const done = i < idx || status?.status === "saved";
        const current = i === idx && status?.status !== "saved";
        const waiting = current && s.key === "review";
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : done || current ? "bg-cyan-400/70" : "bg-cockpit-line")} />
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                  done && "border-cyan-400 bg-cyan-400/20 text-cyan-100",
                  current && !waiting && "border-cyan-300 bg-cockpit-bg text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.5)]",
                  waiting && "border-amber-400 bg-amber-500/15 text-amber-200",
                  !done && !current && "border-cockpit-border bg-cockpit-bg text-slate-500",
                )}
              >
                {done ? <Check size={13} /> : current && !waiting ? <Loader2 size={13} className="animate-spin" /> : i + 1}
              </div>
              <div className={cn("h-0.5 flex-1", i === stages.length - 1 ? "bg-transparent" : done ? "bg-cyan-400/70" : "bg-cockpit-line")} />
            </div>
            <div className={cn("mt-1.5 px-1 text-[10.5px] leading-tight", done || current ? "text-slate-200" : "text-slate-500")}>{LABELS[s.key] ?? s.label}</div>
          </li>
        );
      })}
    </ol>
  );
}
