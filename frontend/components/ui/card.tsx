import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-lg", className)} {...props} />;
}

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("glass flex min-h-0 flex-col rounded-lg", className)}>
      <header className="flex items-center gap-2 border-b border-cockpit-line px-3 py-2">
        {icon && <span className="text-cyan-300/80">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-200">{title}</h2>
          {subtitle && <p className="truncate text-[11px] text-cockpit-dim">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="label-caps">{label}</div>
      <div className="tabular truncate font-mono text-sm text-slate-100">{value}</div>
      {sub && <div className="truncate text-[11px] text-cockpit-dim">{sub}</div>}
    </div>
  );
}
