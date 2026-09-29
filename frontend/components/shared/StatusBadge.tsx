import type { AlertStatus, RiskFamily, Severity } from "@/lib/types";
import { cn, EVENT_LABELS, FAMILY_META, familyOf, SEVERITY_STYLE } from "@/lib/utils";
import { FamilyIcon } from "./FamilyIcon";

export function SeverityBadge({ severity, className, solid = false }: { severity: Severity; className?: string; solid?: boolean }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-[2px] px-2 py-0.5 text-[12px] font-bold leading-4", className)}
      style={solid ? { background: s.deep, color: "#fff" } : { background: s.soft, color: s.ink }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: solid ? "#fff" : s.hex }} />
      {s.label}
    </span>
  );
}

const STATUS: Record<AlertStatus, { label: string; cls: string }> = {
  active: { label: "Active alert", cls: "bg-crit text-white" },
  acknowledged: { label: "Acknowledged", cls: "bg-low-soft text-low-ink" },
  dismissed: { label: "Dismissed", cls: "bg-surface-3 text-ink-3" },
  reviewed: { label: "In review", cls: "bg-brand-soft text-brand-ink" },
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-[2px] px-2 py-0.5 text-[12px] font-bold leading-4", s.cls)}>
      {status === "active" && <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-white" />}
      {s.label}
    </span>
  );
}

export function FamilyChip({ family, eventType, className, size = "sm" }: { family?: RiskFamily; eventType?: string; className?: string; size?: "sm" | "xs" }) {
  const fam = family ?? familyOf(eventType ?? "");
  const m = FAMILY_META[fam];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[2px] font-semibold",
        size === "xs" ? "px-1.5 py-px text-[11.5px]" : "px-2 py-0.5 text-[12.5px]",
        className,
      )}
      style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 13%, transparent)` }}
    >
      <FamilyIcon family={fam} size={size === "xs" ? 10 : 12} />
      <span className="text-ink-2 dark:text-ink">{eventType ? EVENT_LABELS[eventType] ?? eventType : m.label}</span>
    </span>
  );
}

/** Compact severity marker for depth tracks: ◆ critical, ▲ high, ● medium/low. */
export function SeverityGlyph({ severity, color, size = 10 }: { severity: Severity; color?: string; size?: number }) {
  const c = color ?? SEVERITY_STYLE[severity].hex;
  const ring = "var(--surface)";
  if (severity === "critical")
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden>
        <path d="M5 0.3 L9.7 5 L5 9.7 L0.3 5 Z" fill={c} stroke={ring} strokeWidth="1.1" />
      </svg>
    );
  if (severity === "high")
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden>
        <path d="M5 0.6 L9.6 9.3 L0.4 9.3 Z" fill={c} stroke={ring} strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden>
      <circle cx="5" cy="5" r={severity === "medium" ? 4 : 3.2} fill={c} stroke={ring} strokeWidth="1.1" />
    </svg>
  );
}
