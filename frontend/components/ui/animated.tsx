"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const fmtInt = (v: number) => Math.round(v).toLocaleString("en-IN");

/** Number that springs to each new value (depths, scores, KPIs) without re-rendering React per frame. */
export function AnimatedNumber({
  value,
  format = fmtInt,
  from,
  className,
  stiffness = 110,
  damping = 22,
}: {
  value: number;
  format?: (v: number) => string;
  /** Start value for a count-up on mount (defaults to `value`: no intro animation). */
  from?: number;
  className?: string;
  stiffness?: number;
  damping?: number;
}) {
  const mv = useSpring(from ?? value, { stiffness, damping });
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  const text = useTransform(mv, (v) => format(v));
  return <motion.span className={cn("tabular", className)}>{text}</motion.span>;
}

/** Circular 0–1 gauge with an animated sweep and centred score. */
export function ScoreRing({
  value,
  color,
  size = 56,
  stroke = 6,
  label,
  className,
  textClassName,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
  textClassName?: string;
}) {
  const r = (size - stroke) / 2;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} title={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.02, Math.min(1, value)) }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
          style={{ filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 45%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <AnimatedNumber value={value * 100} from={0} className={cn("font-extrabold text-ink", textClassName ?? "text-[17px]")} />
      </div>
    </div>
  );
}
