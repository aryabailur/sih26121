"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-md border border-cockpit-line bg-black/20 p-0.5", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
            value === t.value ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("rounded px-1 text-[10px]", value === t.value ? "bg-cyan-400/20" : "bg-white/5")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ScoreBar({ value, color, className, height = "h-1.5" }: { value: number; color: string; className?: string; height?: string }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-white/5", height, className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-md border border-cockpit-border bg-cockpit-bg/80 px-2 text-xs text-slate-200 outline-none focus:border-cyan-400/60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 p-6 text-xs text-cockpit-muted", className)}>
      <Loader2 size={14} className="animate-spin text-cyan-300" /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-red-200", className)}>
      <AlertTriangle size={18} className="text-red-400" />
      <div className="max-w-md">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-1 inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 hover:bg-red-500/10">
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint, icon, className }: { title: string; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 p-6 text-center", className)}>
      {icon && <div className="text-slate-600">{icon}</div>}
      <div className="text-xs font-medium text-slate-300">{title}</div>
      {hint && <div className="max-w-sm text-[11px] text-cockpit-dim">{hint}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-cockpit-border bg-black/30 px-1 font-mono text-[10px] text-slate-400">{children}</kbd>;
}
