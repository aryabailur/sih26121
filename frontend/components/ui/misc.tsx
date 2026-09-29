"use client";

import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Segmented control with a sliding thumb. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = "sm",
}: {
  tabs: { value: T; label: ReactNode; count?: number; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "xs" | "sm";
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-0.5 rounded-[3px] bg-surface-3 p-[3px]", className)} role="tablist">
      {tabs.map((t) => {
        const on = value === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap rounded-[3px] font-semibold transition-colors",
              size === "xs" ? "px-2 py-1 text-[12.5px]" : "px-2.5 py-1.5 text-[13px]",
              on ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {on && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-0 rounded-[3px] bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={cn("rounded-[2px] px-1.5 text-[11.5px] tabular leading-4", on ? "bg-brand text-white" : "bg-line-2/70 text-ink-2")}>{t.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ScoreBar({ value, color, className, height = "h-1.5" }: { value: number; color: string; className?: string; height?: string }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-[1px] bg-surface-3", height, className)}>
      <motion.div
        className="h-full rounded-[1px]"
        initial={false}
        animate={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
        style={{ background: color }}
      />
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-9 w-full appearance-none rounded-[3px] border border-line-2 bg-surface pl-3 pr-8 text-[13.5px] font-medium text-ink shadow-xs outline-none transition-colors hover:border-ink-4/60 focus:border-brand focus:ring-4 focus:ring-brand/15"
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

export const inputCls =
  "h-9 w-full rounded-[3px] border border-line-2 bg-surface px-3 text-[13.5px] text-ink shadow-xs outline-none transition-colors placeholder:text-ink-4 hover:border-ink-4/60 focus:border-brand focus:ring-4 focus:ring-brand/15";

export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-6 text-[13px] text-ink-3", className)}>
      <span className="relative flex h-9 w-9">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-surface-3 border-t-brand" />
        <span className="absolute inset-[9px] animate-pulse rounded-full bg-brand/25" />
      </span>
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-[3px]", className)} />;
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 p-6 text-center text-[13px] text-crit-ink", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-crit-soft">
        <AlertTriangle size={18} />
      </span>
      <div className="max-w-md">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-1 inline-flex items-center gap-1.5 rounded-[2px] bg-crit-soft px-3 py-1 font-semibold hover:brightness-95">
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint, icon, className, action }: { title: string; hint?: ReactNode; icon?: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 p-6 text-center", className)}>
      {icon && (
        <div className="relative mb-1 flex h-14 w-14 items-center justify-center rounded-[4px] bg-brand-soft text-brand-ink">
          <span className="absolute inset-0 rounded-[4px] ring-1 ring-inset ring-brand/15" />
          {icon}
        </div>
      )}
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {hint && <div className="max-w-sm text-[13px] leading-relaxed text-ink-3">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[3px] border border-line-2 bg-surface-2 px-1.5 py-px font-mono text-[11.5px] text-ink-3 shadow-xs">{children}</kbd>;
}

export function Dot({ color, pulse = false, className }: { color: string; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)}>
      {pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: color }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
