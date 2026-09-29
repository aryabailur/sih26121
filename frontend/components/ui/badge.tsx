import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "amber" | "red" | "orange" | "green" | "blue" | "violet" | "solid";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  brand: "bg-brand-soft text-brand-ink",
  amber: "bg-med-soft text-med-ink",
  red: "bg-crit-soft text-crit-ink",
  orange: "bg-high-soft text-high-ink",
  green: "bg-low-soft text-low-ink",
  blue: "bg-[color-mix(in_oklab,#0ea5e9_14%,transparent)] text-[#0369a1] dark:text-[#7dd3fc]",
  violet: "bg-[color-mix(in_oklab,#d946ef_14%,transparent)] text-[#a21caf] dark:text-[#f0abfc]",
  solid: "bg-ink text-surface",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-[2px] px-2 py-0.5 text-[12px] font-semibold leading-4", TONES[tone], className)}
      {...props}
    />
  );
}
