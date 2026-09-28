import { Badge } from "@/components/ui/badge";
import type { AlertStatus, RiskFamily, Severity } from "@/lib/types";
import { cn, EVENT_LABELS, FAMILY_META, familyOf, SEVERITY_STYLE } from "@/lib/utils";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY_STYLE[severity];
  return <Badge className={cn(s.bg, s.text, s.border, className)}>{s.label}</Badge>;
}

const STATUS_TONE: Record<AlertStatus, "red" | "cyan" | "neutral" | "violet"> = {
  active: "red",
  acknowledged: "cyan",
  dismissed: "neutral",
  reviewed: "violet",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status === "active" ? "● Active alert" : status}</Badge>;
}

export function FamilyChip({ family, eventType, className }: { family?: RiskFamily; eventType?: string; className?: string }) {
  const fam = family ?? familyOf(eventType ?? "");
  const m = FAMILY_META[fam];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium", className)}
      style={{ color: m.color, borderColor: `${m.color}55`, background: `${m.color}14` }}
    >
      <span aria-hidden>{m.glyph}</span>
      {eventType ? EVENT_LABELS[eventType] ?? eventType : m.label}
    </span>
  );
}

export function SeverityGlyph({ severity, color, size = 10 }: { severity: Severity; color?: string; size?: number }) {
  const c = color ?? SEVERITY_STYLE[severity].hex;
  if (severity === "critical")
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden>
        <path d="M5 0 L10 5 L5 10 L0 5 Z" fill={c} stroke="#0a0e17" strokeWidth="1" />
      </svg>
    );
  if (severity === "high")
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden>
        <path d="M5 0.5 L9.8 9.5 L0.2 9.5 Z" fill={c} stroke="#0a0e17" strokeWidth="1" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden>
      <circle cx="5" cy="5" r={severity === "medium" ? 4 : 3} fill={c} stroke="#0a0e17" strokeWidth="1" />
    </svg>
  );
}
