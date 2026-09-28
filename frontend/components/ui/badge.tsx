import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "cyan" | "amber" | "red" | "orange" | "green" | "blue" | "violet";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  cyan: "bg-cyan-400/10 text-cyan-200 border-cyan-400/40",
  amber: "bg-amber-500/10 text-amber-200 border-amber-500/40",
  red: "bg-red-500/15 text-red-200 border-red-500/50",
  orange: "bg-orange-500/12 text-orange-200 border-orange-500/45",
  green: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
  blue: "bg-blue-500/10 text-blue-200 border-blue-500/40",
  violet: "bg-violet-500/10 text-violet-200 border-violet-500/40",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
