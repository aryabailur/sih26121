"use client";

import { Check, Eye, HelpCircle, X } from "lucide-react";
import { motion } from "motion/react";
import { LearnedChip } from "@/components/risk/LearnedOpinion";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { AlertStatusBadge, SeverityBadge } from "@/components/shared/StatusBadge";
import { ScoreRing } from "@/components/ui/animated";
import { Badge } from "@/components/ui/badge";
import { useNWIS } from "@/lib/store";
import type { Alert, RiskAssessment } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth, fmtRange, pct, SEVERITY_STYLE } from "@/lib/utils";

export function leadText(a: RiskAssessment, depth: number) {
  if (a.position === "inside") return "Bit inside window";
  if (a.position === "ahead") return `${Math.round(a.risk_window.start - depth)} m ahead`;
  return `Passed ${Math.round(depth - a.risk_window.end)} m ago`;
}

/** Bit → window approach meter: fills as the bit closes on the window (look-ahead ~150 m). */
function Approach({ a, depth, color }: { a: RiskAssessment; depth: number; color: string }) {
  const gap = a.risk_window.start - depth;
  const fill = a.position === "inside" ? 1 : a.position === "passed" ? 1 : Math.max(0.04, 1 - gap / 150);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 flex-1 overflow-hidden rounded-[1px] bg-surface-3">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-[1px]"
          initial={false}
          animate={{ width: `${fill * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${color} 35%, transparent), ${color})` }}
        />
        {a.position === "inside" && <div className="absolute inset-0 animate-breathe rounded-[1px]" style={{ background: `color-mix(in oklab, ${color} 30%, transparent)` }} />}
      </div>
    </div>
  );
}

export function RiskCard({
  assessment,
  alert,
  now,
  live = true,
  compact = false,
  className,
  ref,
}: {
  /** Forwarded to the root so <AnimatePresence mode="popLayout"> can measure exiting cards. */
  ref?: React.Ref<HTMLElement>;
  assessment: RiskAssessment;
  alert?: Alert;
  /** For alerts: the live assessment at the current depth (the card itself shows trigger-time evidence). */
  now?: RiskAssessment;
  live?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const depth = useNWIS((s) => s.depth);
  const openWhy = useNWIS((s) => s.openWhy);
  const ackAlert = useNWIS((s) => s.ackAlert);
  const flash = useNWIS((s) => (alert ? s.flashAlertIds.includes(alert.id) : false));
  const a = assessment;
  const fam = FAMILY_META[a.risk_type];
  const sev = SEVERITY_STYLE[a.severity];
  const muted = alert && (alert.status === "dismissed" || alert.status === "acknowledged");
  const isAlert = Boolean(alert && alert.status === "active");
  const tracking = now ?? (live ? a : undefined);

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={flash ? { opacity: 1, y: 0, scale: [1, 1.025, 1] } : { opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ default: { type: "spring", stiffness: 300, damping: 26 }, scale: { duration: 0.6, ease: "easeInOut" } }}
      className={cn("relative overflow-hidden rounded-[4px] border bg-surface p-4 shadow-sm", muted && "opacity-70", className)}
      style={{ borderColor: isAlert ? `color-mix(in oklab, ${sev.hex} 55%, transparent)` : "var(--line)" }}
    >
      {isAlert && <div className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: sev.gradient }} />}
      {flash && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[4px]"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.4 }}
          style={{ boxShadow: `inset 0 0 0 2px ${sev.hex}, 0 0 40px ${sev.hex}` }}
        />
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-[-0.01em] text-ink">
              <FamilyIcon family={a.risk_type} size={16} />
              {fam.label}
            </h3>
            <SeverityBadge severity={a.severity} solid={isAlert} />
            {alert ? (
              <AlertStatusBadge status={alert.status} />
            ) : (
              <Badge tone="neutral" title={a.alert_eligible ? "" : `Alerts at score ≥ ${a.alert_threshold.toFixed(2)} (history: ${a.historical_severity})`}>
                Watching
              </Badge>
            )}
            {a.zone_source === "derived" && <Badge tone="violet">Derived zone</Badge>}
          </div>
          <div className="mt-1 text-[13px] text-ink-3">
            <span className="font-semibold text-ink-2">{fmtRange(a.risk_window.start, a.risk_window.end)}</span> · {a.affected_formation}
          </div>
        </div>
        <ScoreRing value={a.score} color={sev.hex} size={52} label={`Risk score ${Math.round(a.score * 100)} / 100 · confidence ${pct(a.confidence)}`} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className={cn("font-bold", a.position === "inside" ? "text-crit-ink" : "text-ink-2")}>
            {live ? leadText(a, depth) : `Raised at ${fmtDepth(alert?.triggered_at_depth)}`}
          </span>
          <span className="flex items-center gap-1.5 text-ink-3">
            {a.ml && <LearnedChip ml={a.ml} />}
            <span>conf. {pct(a.confidence)}</span>
          </span>
        </div>
        {tracking && <Approach a={tracking} depth={depth} color={SEVERITY_STYLE[tracking.severity].hex} />}
        {alert && (
          <div className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
            <span className="font-semibold">Now at {fmtDepth(depth)}:</span>
            {now ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_STYLE[now.severity].hex }} />
                <span className="font-bold tabular text-ink">{Math.round(now.score * 100)}</span>
                <span>
                  {SEVERITY_STYLE[now.severity].label.toLowerCase()} · {leadText(now, depth).toLowerCase()}
                </span>
              </>
            ) : (
              <span>outside the evaluation window</span>
            )}
          </div>
        )}
      </div>

      <ul className={cn("mt-3 space-y-1.5 text-[13px] leading-snug text-ink-2", compact && "line-clamp-3")}>
        {a.reasons.slice(0, compact ? 2 : 3).map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: fam.color }} />
            <span>{r}</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from(new Map(a.supporting_wells.map((s) => [s.well_id, s])).values()).map((s) => (
            <span key={s.well_id} className="inline-flex items-center gap-1 rounded-[2px] bg-surface-2 px-2 py-0.5 font-mono text-[12px] font-medium text-ink-2 ring-1 ring-inset ring-line">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_STYLE[s.severity].hex }} />
              {s.well_name}
              <span className="text-ink-4">@{Math.round(s.depth)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => openWhy(alert ? { kind: "alert", alertId: alert.id } : { kind: "assessment", zoneId: a.zone_id })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-[13px] font-bold transition-all hover:scale-[1.03]",
            isAlert ? "text-white shadow-md" : "bg-brand-soft text-brand-ink",
          )}
          style={isAlert ? { background: sev.gradient } : undefined}
        >
          <HelpCircle size={14} /> Why?
        </button>
        {alert && alert.status === "active" && (
          <>
            <IconAction label="Acknowledge" onClick={() => ackAlert(alert.id, "acknowledged", "Acknowledged from Risk radar")} className="hover:bg-low-soft hover:text-low-ink">
              <Check size={14} /> Acknowledge
            </IconAction>
            <IconAction label="Flag for review" onClick={() => ackAlert(alert.id, "reviewed", "Flagged for review")} className="hover:bg-brand-soft hover:text-brand-ink">
              <Eye size={14} /> Review
            </IconAction>
            <IconAction label="Dismiss" onClick={() => ackAlert(alert.id, "dismissed", "Dismissed by engineer")} className="hover:bg-surface-3 hover:text-ink">
              <X size={14} /> Dismiss
            </IconAction>
          </>
        )}
        {alert && alert.status !== "active" && <span className="truncate text-[12.5px] italic text-ink-3">“{alert.notes}”</span>}
      </div>
    </motion.article>
  );
}

function IconAction({ children, label, onClick, className }: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} title={label} className={cn("inline-flex items-center gap-1 rounded-[2px] px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-3 transition-colors", className)}>
      {children}
    </button>
  );
}
