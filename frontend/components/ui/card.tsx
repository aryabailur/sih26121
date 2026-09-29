import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

/** Titled surface. `icon` sits in a tinted tile; `accent` tints that tile (identity colour). */
export function Panel({
  title,
  subtitle,
  icon,
  accent,
  actions,
  className,
  bodyClassName,
  headerClassName,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className={cn("flex items-center gap-3 px-4 pb-3 pt-3.5", headerClassName)}>
        {icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-brand-soft text-brand-ink"
            style={accent ? { background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent } : undefined}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14.5px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {subtitle && <p className="truncate text-[12.5px] text-ink-3">{subtitle}</p>}
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
      <div className="label">{label}</div>
      <div className="tabular mt-0.5 truncate text-[15px] font-bold text-ink">{value}</div>
      {sub && <div className="truncate text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  );
}
