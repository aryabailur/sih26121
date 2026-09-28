"use client";

import { AlertOctagon, X } from "lucide-react";
import { useNWIS } from "@/lib/store";
import { FAMILY_META, fmtDepth, pct, SEVERITY_STYLE } from "@/lib/utils";

export function AlertToaster() {
  const toasts = useNWIS((s) => s.toasts);
  const dismiss = useNWIS((s) => s.dismissToast);
  const openWhy = useNWIS((s) => s.openWhy);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[1300] flex w-[380px] flex-col gap-2">
      {toasts.map((t) => {
        const a = t.alert;
        const sev = SEVERITY_STYLE[a.severity];
        const wells = Array.from(new Set(a.assessment.supporting_wells.map((s) => s.well_name)));
        return (
          <div
            key={t.id}
            role="alert"
            className="pointer-events-auto animate-slide-in animate-alert-glow rounded-lg border border-l-4 border-cockpit-border bg-[#0d1424] p-3 shadow-2xl"
            style={{ borderLeftColor: sev.hex }}
          >
            <div className="flex items-start gap-2">
              <AlertOctagon size={18} style={{ color: sev.hex }} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: sev.hex }}>
                  {t.kind === "escalated" ? "Alert escalated" : "Proactive alert"} · {sev.label}
                </div>
                <div className="text-sm font-semibold text-slate-50">
                  <span style={{ color: FAMILY_META[a.risk_type].color }}>{FAMILY_META[a.risk_type].glyph}</span> {a.risk_label} risk at{" "}
                  {fmtDepth(a.triggered_at_depth)}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">
                  {wells.length} offset well{wells.length > 1 ? "s" : ""} ({wells.join(", ")}) · confidence {pct(a.confidence)}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-cockpit-muted">{a.reasons[0]}</div>
                <button
                  onClick={() => {
                    openWhy({ kind: "alert", alertId: a.id });
                    dismiss(t.id);
                  }}
                  className="mt-2 rounded border border-cyan-400/50 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
                >
                  Why? → evidence
                </button>
              </div>
              <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-200" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
