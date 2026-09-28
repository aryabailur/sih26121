"use client";

import { CheckSquare, History, Info, ShieldCheck, Square } from "lucide-react";
import { useState } from "react";
import { SimilarityBadge } from "@/components/shared/SimilarityBadge";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { AlertStatusBadge, FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ScoreBar } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS, type WhyTarget } from "@/lib/store";
import type { AuditEntry, RiskAssessment } from "@/lib/types";
import { cn, fmtDate, fmtDepth, fmtNum, fmtRange, fmtTime, pct, SEVERITY_STYLE } from "@/lib/utils";

const FACTOR_LABEL: Record<string, string> = {
  proximity: "Depth proximity",
  frequency: "Offset event frequency",
  similarity: "Well similarity",
  formation: "Formation match",
  parameter: "Live parameter anomaly",
  trajectory: "Trajectory match",
};

export function WhyExplainer() {
  const target = useNWIS((s) => s.whyTarget);
  if (!target) return null;
  // Keyed per target so the checklist and notes start fresh for each alert.
  return <WhyBody key={target.kind === "alert" ? target.alertId : target.zoneId} target={target} />;
}

function WhyBody({ target }: { target: WhyTarget }) {
  const close = useNWIS((s) => s.openWhy);
  const evaluation = useNWIS((s) => s.evaluation);
  const ackAlert = useNWIS((s) => s.ackAlert);
  const depth = useNWIS((s) => s.depth);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState("");

  const alert = target.kind === "alert" ? evaluation?.active_alerts.find((a) => a.id === target.alertId) : undefined;
  const zoneId = target.kind === "alert" ? alert?.zone_id : target.zoneId;
  const liveNow = evaluation?.assessments.find((a) => a.zone_id === zoneId);
  const alertForZone = alert ?? evaluation?.active_alerts.find((x) => x.zone_id === zoneId);
  // An alert is explained by the evidence at the moment it was raised; a watch item by the live view.
  const a: RiskAssessment | undefined = target.kind === "alert" ? alert?.assessment ?? liveNow : liveNow ?? alertForZone?.assessment;
  const live = target.kind === "alert" ? undefined : liveNow;
  const auditRes = useAsync(
    () => (alertForZone ? api.audit(alertForZone.id) : Promise.resolve({ audit: [] as AuditEntry[] })),
    [alertForZone?.id, alertForZone?.status, alertForZone?.severity],
  );
  const audit = auditRes.data?.audit ?? [];

  if (!a) return null;
  const sev = SEVERITY_STYLE[a.severity];
  const total = a.factors.reduce((s, f) => s + f.contribution, 0);

  return (
    <Dialog
      open
      onClose={() => close(null)}
      className="max-w-5xl"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>Why this alert? — {a.risk_label} risk</span>
          <SeverityBadge severity={a.severity} />
          {alertForZone && <AlertStatusBadge status={alertForZone.status} />}
        </span>
      }
      subtitle={
        <span>
          {live
            ? `Evaluated at ${fmtDepth(depth)}`
            : alertForZone && a.evaluated_at_depth !== alertForZone.triggered_at_depth
              ? `Raised at ${fmtDepth(alertForZone.triggered_at_depth)} · escalated at ${fmtDepth(a.evaluated_at_depth)}`
              : `Raised at ${fmtDepth(alertForZone?.triggered_at_depth ?? a.evaluated_at_depth)}`}{" "}
          · risk window{" "}
          {fmtRange(a.risk_window.start, a.risk_window.end)} · {a.affected_formation} · zone {a.zone_id} ({a.zone_source})
        </span>
      }
      footer={
        alertForZone ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Engineer note (optional) — e.g. LCM pill pre-mixed, ECD held at 1.47 sg"
              className="h-8 min-w-[280px] flex-1 rounded-md border border-cockpit-border bg-black/30 px-2 text-xs text-slate-200 outline-none focus:border-cyan-400/60"
            />
            <Button variant="primary" onClick={() => ackAlert(alertForZone.id, "acknowledged", notes || "Acknowledged — checks in progress")}>Acknowledge</Button>
            <Button onClick={() => ackAlert(alertForZone.id, "reviewed", notes || "Needs review")}>Needs review</Button>
            <Button variant="ghost" onClick={() => ackAlert(alertForZone.id, "dismissed", notes || "Dismissed by engineer")}>Dismiss</Button>
          </div>
        ) : (
          <div className="text-[11px] text-cockpit-muted">
            Watch item — an alert is raised at score ≥ {a.alert_threshold.toFixed(2)} (history severity: {a.historical_severity}).
          </div>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* ------------------------------------------------ left column */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg border border-cockpit-line bg-black/20 p-3">
            <div>
              <div className="label-caps">Risk score</div>
              <div className="flex items-center gap-2 font-mono text-3xl font-semibold tabular text-slate-50">
                <span className="h-3 w-3 rounded-full" style={{ background: sev.hex }} />
                {Math.round(a.score * 100)}
              </div>
            </div>
            <div>
              <div className="label-caps">Confidence</div>
              <div className="font-mono text-3xl font-semibold tabular text-slate-100">{pct(a.confidence)}</div>
            </div>
            <div className="min-w-0 flex-1 text-[11px] text-cockpit-muted">
              <div className="flex items-center gap-1 text-slate-300"><Info size={12} /> {a.confidence_note}</div>
              <div className="mt-1">Lead: {a.position === "inside" ? "bit inside window" : a.position === "ahead" ? `${Math.round(a.lead_depth)} m ahead` : `passed ${Math.round(-a.lead_depth - (a.risk_window.end - a.risk_window.start))} m`}</div>
              {target.kind === "alert" && (
                <div className="mt-1">
                  Now @ {fmtDepth(depth)}:{" "}
                  {liveNow ? (
                    <span className="text-slate-200">score {Math.round(liveNow.score * 100)} · {liveNow.severity}</span>
                  ) : (
                    "outside the evaluation window"
                  )}
                </div>
              )}
            </div>
          </div>

          <section>
            <h4 className="label-caps mb-1.5">Reasons</h4>
            <ol className="space-y-1.5">
              {a.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-slate-200">
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded bg-cyan-400/15 font-mono text-[10px] text-cyan-200">{i + 1}</span>
                  {r}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h4 className="label-caps mb-1.5">Contributing factors (score = Σ weight × factor)</h4>
            <div className="space-y-1.5">
              {a.factors.map((f) => (
                <div key={f.factor} className="grid grid-cols-[132px_1fr_76px] items-center gap-2 text-[11px]">
                  <span className="text-slate-300">{FACTOR_LABEL[f.factor]}</span>
                  <div>
                    <ScoreBar value={f.value} color={f.value >= 0.7 ? sev.hex : "#38bdf8"} />
                    <div className="mt-0.5 text-[10px] text-cockpit-dim">{f.explanation}</div>
                  </div>
                  <span className="text-right font-mono text-slate-300 tabular">
                    {f.weight.toFixed(2)}×{f.value.toFixed(2)} = <span className="text-slate-50">{f.contribution.toFixed(2)}</span>
                  </span>
                </div>
              ))}
              <div className="flex justify-end border-t border-cockpit-line pt-1 font-mono text-[11px] text-slate-200">
                total {total.toFixed(2)} · thresholds 0.35 / 0.55 / 0.75
              </div>
            </div>
          </section>

          {a.contributing_signals.length > 0 && (
            <section>
              <h4 className="label-caps mb-1.5">Live signals (simulated eRTMAC)</h4>
              <table className="w-full text-[11px]">
                <thead className="text-cockpit-dim">
                  <tr className="text-left">
                    <th className="py-1 font-medium">Signal</th>
                    <th className="font-medium">Current</th>
                    <th className="font-medium">Baseline</th>
                    <th className="font-medium">Deviation</th>
                    <th className="font-medium">Offset reference</th>
                  </tr>
                </thead>
                <tbody>
                  {a.contributing_signals.map((s) => (
                    <tr key={s.signal} className={cn("border-t border-cockpit-line", s.anomalous && "text-amber-200")}>
                      <td className="py-1">{s.anomalous ? "⚠ " : ""}{s.label}</td>
                      <td className="font-mono tabular">{fmtNum(s.value, s.unit === "sg" ? 3 : 1)} {s.unit}</td>
                      <td className="font-mono tabular text-cockpit-muted">{s.baseline === null ? "—" : `${fmtNum(s.baseline, s.unit === "sg" ? 3 : 1)}`}</td>
                      <td className="font-mono tabular">{s.deviation}</td>
                      <td className="text-cockpit-muted">{s.reference ? `${s.reference.value} ${s.unit} ${s.reference.meaning} (${s.reference.well})` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h4 className="label-caps mb-1.5 flex items-center gap-1"><ShieldCheck size={12} /> Recommended checks</h4>
            <p className="mb-2 text-[12px] text-slate-200">{a.recommendation}</p>
            <ul className="space-y-1">
              {a.recommended_checks.map((c, i) => (
                <li key={i}>
                  <button onClick={() => setChecked((s) => ({ ...s, [i]: !s[i] }))} className="flex w-full items-start gap-2 text-left text-[12px] text-slate-300 hover:text-slate-100">
                    {checked[i] ? <CheckSquare size={14} className="mt-px shrink-0 text-emerald-300" /> : <Square size={14} className="mt-px shrink-0 text-slate-500" />}
                    <span className={cn(checked[i] && "text-slate-500 line-through")}>{c}</span>
                  </button>
                </li>
              ))}
            </ul>
            {a.offset_practice.length > 0 && (
              <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-[11.5px] text-emerald-100/90">
                <div className="label-caps mb-1 text-emerald-300/80">What worked in offset wells</div>
                {a.offset_practice.map((p, i) => (
                  <div key={i}>• {p}</div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------ right column */}
        <div className="space-y-4">
          <section>
            <h4 className="label-caps mb-1.5">Supporting historical wells & evidence</h4>
            <div className="space-y-2">
              {a.evidence.map((e) => (
                <div key={e.event_id} className="rounded-lg border border-cockpit-line bg-black/20 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[12px] font-semibold text-slate-50">{e.well_name}</span>
                    <FamilyChip eventType={e.event_type} />
                    <SeverityBadge severity={e.severity} />
                    <span className="ml-auto"><SimilarityBadge value={e.similarity} /></span>
                  </div>
                  <div className="mt-1 text-[11px] text-cockpit-muted">
                    {fmtRange(e.depth_start, e.depth_end)} · {e.formation} · {fmtDate(e.date)} · {e.distance_km.toFixed(2)} km · NPT {e.npt_hours} h
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-slate-200">“{e.description}”</p>
                  {e.root_cause && <p className="mt-1 text-[11.5px] text-slate-400"><span className="text-slate-500">Cause:</span> {e.root_cause}</p>}
                  {e.mitigation && <p className="mt-0.5 text-[11.5px] text-slate-400"><span className="text-slate-500">Mitigation:</span> {e.mitigation}</p>}
                  <div className="mt-1.5">
                    <SourceCitation documentId={e.document_id} title={e.document_title} docType={e.document_type} page={e.page}
                      depthStart={e.depth_start} depthEnd={e.depth_end} highlights={[String(Math.round(e.depth_start))]} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {a.related_events.length > 0 && (
            <section>
              <h4 className="label-caps mb-1.5">Related precursor events in this window</h4>
              <div className="space-y-1">
                {a.related_events.map((e) => (
                  <div key={e.event_id} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <FamilyChip eventType={e.event_type} />
                    <span className="font-mono">{e.well_name}</span>
                    <span className="text-cockpit-muted">{fmtRange(e.depth_start, e.depth_end)}</span>
                    <span className="truncate text-cockpit-dim">{e.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {audit.length > 0 && (
            <section>
              <h4 className="label-caps mb-1.5 flex items-center gap-1"><History size={12} /> Audit trail</h4>
              <ol className="space-y-1 border-l border-cockpit-border pl-3">
                {audit.map((x, i) => (
                  <li key={i} className="text-[11px] text-slate-300">
                    <span className="font-mono text-cockpit-dim">{fmtTime(x.timestamp)}</span>{" "}
                    <span className="font-semibold uppercase text-cyan-200/90">{x.action}</span>{" "}
                    {x.depth !== null && <span className="font-mono text-cockpit-muted">@{fmtDepth(x.depth)} </span>}
                    <span className="text-cockpit-muted">· {x.actor}</span>
                    {x.notes && <div className="text-cockpit-dim">{x.notes}</div>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="rounded-md border border-cockpit-line bg-black/20 p-2 text-[10.5px] leading-relaxed text-cockpit-dim">
            Decision support only — the drilling engineer remains in control. Scores rank risk from transparent rules over offset
            history and live signals; they are not calibrated probabilities. Demo data is synthetic.
          </div>
        </div>
      </div>
    </Dialog>
  );
}
