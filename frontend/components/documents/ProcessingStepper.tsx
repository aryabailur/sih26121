"use client";

import { Check, Loader2, UserCheck } from "lucide-react";
import { motion } from "motion/react";
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
  const saved = status?.status === "saved";
  const progress = saved ? 1 : idx < 0 ? 0 : idx / Math.max(1, stages.length - 1);
  return (
    <div className="relative">
      <div className="absolute left-[calc(100%/14)] right-[calc(100%/14)] top-[17px] h-1 rounded-[1px] bg-surface-3">
        <motion.div className="aurora h-full rounded-[1px]" initial={false} animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 80, damping: 20 }} />
      </div>
      <ol className="relative flex items-start">
        {stages.map((s, i) => {
          const done = i < idx || saved;
          const current = i === idx && !saved;
          const waiting = current && s.key === "review";
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center text-center">
              <motion.div
                animate={current && !waiting ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={current && !waiting ? { duration: 1.1, repeat: Infinity } : undefined}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] text-[12.5px] font-extrabold transition-colors",
                  done && "border-brand bg-brand text-white",
                  current && !waiting && "border-brand bg-surface text-brand-ink shadow-brand",
                  waiting && "border-med bg-med-soft text-med-ink",
                  !done && !current && "border-line-2 bg-surface text-ink-4",
                )}
              >
                {done ? <Check size={15} strokeWidth={3} /> : waiting ? <UserCheck size={15} /> : current ? <Loader2 size={15} className="animate-spin" /> : i + 1}
              </motion.div>
              <div className={cn("mt-2 px-1 text-[12.5px] font-semibold leading-tight", done || current ? "text-ink" : "text-ink-4")}>{LABELS[s.key] ?? s.label}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
