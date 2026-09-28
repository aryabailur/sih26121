"use client";

import { Check, Eye, HelpCircle, X } from "lucide-react";
import { AlertStatusBadge, SeverityBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";
import type { Alert, RiskAssessment } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth, fmtRange, pct, SEVERITY_STYLE } from "@/lib/utils";

export function leadText(a: RiskAssessment, depth: number) {
  if (a.position === "inside") return "Bit inside window";
  if (a.position === "ahead") return `${Math.round(a.risk_window.start - depth)} m ahead`;
  return `Passed ${Math.round(depth - a.risk_window.end)} m`;
}

export function RiskCard({
  assessment,
  alert,
  now,
  live = true,
  compact = false,
  className,
}: {
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

  return (
    <article
      className={cn(
        "glass relative overflow-hidden rounded-lg border-l-[3px] p-3 transition-colors",
        flash && "animate-alert-glow animate-slide-in",
        muted && "opacity-70",
        className,
      )}
      style={{ borderLeftColor: sev.hex }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base leading-none" style={{ color: fam.color }} aria-hidden>
          {fam.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[13px] font-semibold text-slate-50">{a.risk_label} risk</h3>
            <SeverityBadge severity={a.severity} />
            {alert ? (
              <AlertStatusBadge status={alert.status} />
            ) : (
              <Badge tone="neutral" title={a.alert_eligible ? "" : `Alert threshold ${a.alert_threshold.toFixed(2)} (history: ${a.historical_severity})`}>
                Watch
              </Badge>
            )}
            {a.zone_source === "derived" && <Badge tone="violet">derived zone</Badge>}
          </div>
          <div className="mt-0.5 text-[11px] text-cockpit-muted">
            {fmtRange(a.risk_window.start, a.risk_window.end)} · {a.affected_formation} ·{" "}
            <span className={cn("font-medium", a.position === "inside" ? "text-red-300" : "text-slate-300")}>{live ? leadText(a, depth) : `raised at ${fmtDepth(alert?.triggered_at_depth)}`}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-semibold leading-none tabular text-slate-50" title="Risk score (0–100)">
            {Math.round(a.score * 100)}
          </div>
          <div className="mt-0.5 text-[10px] text-cockpit-dim">conf {pct(a.confidence)}</div>
        </div>
      </div>

      <ScoreBar value={a.score} color={sev.hex} className="mt-2" />
      {alert && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-cockpit-muted">
          <span className="label-caps">Now @ {fmtDepth(depth)}</span>
          {now ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_STYLE[now.severity].hex }} />
              <span className="font-mono text-slate-200">{Math.round(now.score * 100)}</span>
              <span>{now.severity} · {leadText(now, depth).toLowerCase()}</span>
            </>
          ) : (
            <span>outside the evaluation window</span>
          )}
        </div>
      )}

      <ul className={cn("mt-2 space-y-1 text-[11.5px] leading-snug text-slate-300", compact && "line-clamp-2")}>
        {a.reasons.slice(0, compact ? 2 : 3).map((r, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-cyan-300/70" />
            <span>{r}</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from(new Map(a.supporting_wells.map((s) => [s.well_id, s])).values()).map((s) => (
            <span key={s.well_id} className="rounded border border-cockpit-border bg-black/20 px-1.5 py-px font-mono text-[10px] text-slate-300">
              {s.well_name} <span className="text-cockpit-dim">@{Math.round(s.depth)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => openWhy(alert ? { kind: "alert", alertId: alert.id } : { kind: "assessment", zoneId: a.zone_id })}
          className="inline-flex items-center gap-1 rounded border border-cyan-400/50 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
        >
          <HelpCircle size={12} /> Why?
        </button>
        {alert && alert.status === "active" && (
          <>
            <button onClick={() => ackAlert(alert.id, "acknowledged", "Acknowledged from Risk Watch")} className="inline-flex items-center gap-1 rounded border border-cockpit-border px-2 py-1 text-[11px] text-slate-300 hover:border-emerald-400/60 hover:text-emerald-200">
              <Check size={12} /> Acknowledge
            </button>
            <button onClick={() => ackAlert(alert.id, "reviewed", "Flagged for review")} className="inline-flex items-center gap-1 rounded border border-cockpit-border px-2 py-1 text-[11px] text-slate-300 hover:border-violet-400/60 hover:text-violet-200">
              <Eye size={12} /> Review
            </button>
            <button onClick={() => ackAlert(alert.id, "dismissed", "Dismissed by engineer")} className="inline-flex items-center gap-1 rounded border border-cockpit-border px-2 py-1 text-[11px] text-slate-400 hover:border-slate-400 hover:text-slate-200">
              <X size={12} /> Dismiss
            </button>
          </>
        )}
        {alert && alert.status !== "active" && <span className="text-[10px] text-cockpit-dim">{alert.notes}</span>}
      </div>
    </article>
  );
}
