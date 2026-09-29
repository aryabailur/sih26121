"use client";

import { BrainCircuit, Check, History, Info, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { LearnedCrossCheck } from "@/components/risk/LearnedOpinion";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { SimilarityBadge } from "@/components/shared/SimilarityBadge";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { AlertStatusBadge, FamilyChip, SeverityBadge } from "@/components/shared/StatusBadge";
import { ScoreRing } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { inputCls } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS, type WhyTarget } from "@/lib/store";
import type { AuditEntry, RiskAssessment } from "@/lib/types";
import { cn, FAMILY_META, fmtDate, fmtDepth, fmtNum, fmtRange, fmtTime, pct, SEVERITY_STYLE } from "@/lib/utils";

export const FACTOR_LABEL: Record<string, string> = {
  proximity: "Depth proximity",
  frequency: "Offset event frequency",
  similarity: "Well similarity",
  formation: "Formation match",
  parameter: "Live parameter anomaly",
  trajectory: "Trajectory match",
};

export const FACTOR_COLOR: Record<string, string> = {
  proximity: "#5b4bff",
  frequency: "#0ea5e9",
  similarity: "#d946ef",
  formation: "#1fae86",
  parameter: "#f76b15",
  trajectory: "#e2a13b",
};

export function WhyExplainer() {
  const target = useNWIS((s) => s.whyTarget);
  // Keyed per target so the checklist and notes start fresh for each alert.
  return <AnimatePresence>{target && <WhyBody key={target.kind === "alert" ? target.alertId : target.zoneId} target={target} />}</AnimatePresence>;
}

function Section({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
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
  const modelCard = useAsync(() => api.modelCard(), []);

  if (!a) return null;
  const sev = SEVERITY_STYLE[a.severity];
  const total = a.factors.reduce((s, f) => s + f.contribution, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <Dialog
      open
      onClose={() => close(null)}
      className="max-w-[1120px]"
      icon={<FamilyIcon family={a.risk_type} size={20} tile />}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>Why this {alertForZone ? "alert" : "watch item"}? {FAMILY_META[a.risk_type].label} risk</span>
          <SeverityBadge severity={a.severity} solid />
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
          · window {fmtRange(a.risk_window.start, a.risk_window.end)} · {a.affected_formation} · zone {a.zone_id} ({a.zone_source})
        </span>
      }
      footer={
        alertForZone ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Engineer note (optional) — e.g. LCM pill pre-mixed, ECD held at 1.47 sg"
              className={cn(inputCls, "min-w-[280px] flex-1")}
            />
            <Button variant="primary" size="md" onClick={() => ackAlert(alertForZone.id, "acknowledged", notes || "Acknowledged — checks in progress")}>
              <Check size={15} /> Acknowledge
            </Button>
            <Button size="md" onClick={() => ackAlert(alertForZone.id, "reviewed", notes || "Needs review")}>
              Needs review
            </Button>
            <Button variant="ghost" size="md" onClick={() => ackAlert(alertForZone.id, "dismissed", notes || "Dismissed by engineer")}>
              Dismiss
            </Button>
          </div>
        ) : (
          <div className="text-[13px] text-ink-3">
            Watch item — an alert is raised at score ≥ {a.alert_threshold.toFixed(2)} (history severity: {a.historical_severity}).
          </div>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.08fr_1fr]">
        {/* ------------------------------------------------ left: the reasoning */}
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[4px] p-4 text-white" style={{ background: sev.gradient }}>
            <div className="relative flex items-center gap-5">
              <div className="rounded-full bg-white/95 p-1.5 shadow-lg">
                <ScoreRing value={a.score} color={sev.hex} size={84} stroke={8} textClassName="text-[26px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-white/80">Risk score · confidence {pct(a.confidence)}</div>
                <div className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
                  {a.position === "inside" ? "Bit is inside the window" : a.position === "ahead" ? `${Math.round(a.lead_depth)} m of warning` : "Window already passed"}
                </div>
                <div className="mt-1 flex items-start gap-1.5 text-[12.5px] text-white/85">
                  <Info size={13} className="mt-0.5 shrink-0" /> {a.confidence_note}
                </div>
                {target.kind === "alert" && (
                  <div className="mt-1.5 inline-flex rounded-[2px] bg-black/20 px-2.5 py-0.5 text-[12.5px] font-semibold">
                    Now at {fmtDepth(depth)}: {liveNow ? `score ${Math.round(liveNow.score * 100)} · ${liveNow.severity}` : "outside the evaluation window"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Section title="Reasons">
            <ol className="space-y-2">
              {a.reasons.map((r, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }} className="flex gap-2.5 text-[14px] leading-snug text-ink-2">
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-extrabold text-white">{i + 1}</span>
                  {r}
                </motion.li>
              ))}
            </ol>
          </Section>

          <Section title="How the score adds up" icon={<Sparkles size={14} className="text-brand-ink" />}>
            {/* stacked contribution bar with the alert thresholds */}
            <div className="relative mb-4 mt-1">
              <div className="flex h-4 overflow-hidden rounded-[1px] bg-surface-3">
                {a.factors.map((f, i) => (
                  <motion.div
                    key={f.factor}
                    initial={{ width: 0 }}
                    animate={{ width: `${f.contribution * 100}%` }}
                    transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 90, damping: 18 }}
                    style={{ background: FACTOR_COLOR[f.factor] }}
                    title={`${FACTOR_LABEL[f.factor]} ${f.contribution.toFixed(2)}`}
                  />
                ))}
              </div>
              {[0.35, 0.55, 0.75].map((t) => (
                <div key={t} className="absolute -top-1 h-6 border-l-2 border-dashed border-ink/40" style={{ left: `${t * 100}%` }}>
                  <span className="absolute left-1 top-5 whitespace-nowrap text-[11px] font-bold text-ink-3">{t === 0.35 ? "watch" : t === 0.55 ? "high" : "critical"}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-2.5">
              {a.factors.map((f) => (
                <div key={f.factor} className="grid grid-cols-[150px_1fr_92px] items-center gap-3 text-[13px]">
                  <span className="flex items-center gap-2 font-semibold text-ink-2">
                    <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: FACTOR_COLOR[f.factor] }} />
                    {FACTOR_LABEL[f.factor]}
                  </span>
                  <div className="min-w-0">
                    <div className="h-1.5 overflow-hidden rounded-[1px] bg-surface-3">
                      <motion.div className="h-full rounded-[1px]" initial={{ width: 0 }} animate={{ width: `${f.value * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.2 }} style={{ background: FACTOR_COLOR[f.factor] }} />
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-3" title={f.explanation}>
                      {f.explanation}
                    </div>
                  </div>
                  <span className="text-right font-mono text-[12.5px] tabular text-ink-3">
                    {f.weight.toFixed(2)}×{f.value.toFixed(2)} = <b className="text-ink">{f.contribution.toFixed(2)}</b>
                  </span>
                </div>
              ))}
              <div className="flex justify-end border-t border-line pt-2 font-mono text-[12.5px] text-ink-2">
                total <b className="mx-1 text-ink">{total.toFixed(2)}</b> · thresholds 0.35 / 0.55 / 0.75
              </div>
            </div>
          </Section>

          {a.ml && (
            <Section title="Learned-model cross-check" icon={<BrainCircuit size={14} className="text-brand-ink" />}>
              <LearnedCrossCheck ml={a.ml} family={a.risk_type} model={modelCard.data?.learned} />
            </Section>
          )}

          {a.contributing_signals.length > 0 && (
            <Section title="Live signals (simulated eRTMAC)">
              <div className="overflow-hidden rounded-[3px] border border-line">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface-2 text-[12px] text-ink-3">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-bold">Signal</th>
                      <th className="font-bold">Current</th>
                      <th className="font-bold">Baseline</th>
                      <th className="font-bold">Deviation</th>
                      <th className="pr-3 font-bold">Offset reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.contributing_signals.map((s) => (
                      <tr key={s.signal} className={cn("border-t border-line", s.anomalous && "bg-high-soft")}>
                        <td className={cn("px-3 py-2 font-semibold", s.anomalous ? "text-high-ink" : "text-ink-2")}>
                          {s.anomalous && <TriangleAlert size={12} className="mr-1 inline" />}
                          {s.label}
                        </td>
                        <td className="font-mono tabular text-ink">
                          {fmtNum(s.value, s.unit === "sg" ? 3 : 1)} {s.unit}
                        </td>
                        <td className="font-mono tabular text-ink-3">{s.baseline === null ? "—" : `${fmtNum(s.baseline, s.unit === "sg" ? 3 : 1)}`}</td>
                        <td className="font-mono tabular text-ink-2">{s.deviation}</td>
                        <td className="pr-3 text-ink-3">{s.reference ? `${s.reference.value} ${s.unit} ${s.reference.meaning} (${s.reference.well})` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section title={`Recommended checks · ${done}/${a.recommended_checks.length} done`} icon={<ShieldCheck size={14} className="text-low-ink" />}>
            <p className="mb-2.5 text-[13.5px] leading-snug text-ink-2">{a.recommendation}</p>
            <ul className="space-y-1.5">
              {a.recommended_checks.map((c, i) => (
                <li key={i}>
                  <button
                    onClick={() => setChecked((s) => ({ ...s, [i]: !s[i] }))}
                    className={cn("flex w-full items-start gap-2.5 rounded-[3px] border px-3 py-2 text-left text-[13.5px] transition-colors", checked[i] ? "border-low/40 bg-low-soft" : "border-line hover:border-line-2 hover:bg-surface-2")}
                  >
                    <span className={cn("mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border-2 transition-colors", checked[i] ? "border-low bg-low text-white" : "border-line-2")}>
                      <AnimatePresence>{checked[i] && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={12} strokeWidth={3} /></motion.span>}</AnimatePresence>
                    </span>
                    <span className={cn(checked[i] ? "text-ink-3 line-through" : "text-ink-2")}>{c}</span>
                  </button>
                </li>
              ))}
            </ul>
            {a.offset_practice.length > 0 && (
              <div className="mt-3 rounded-[3px] bg-low-soft p-3 text-[13px] text-low-ink">
                <div className="mb-1 font-extrabold">What worked in offset wells</div>
                {a.offset_practice.map((p, i) => (
                  <div key={i} className="leading-snug">• {p}</div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ------------------------------------------------ right: the evidence */}
        <div className="space-y-6">
          <Section title={`Evidence from ${a.evidence.length} offset event${a.evidence.length === 1 ? "" : "s"}`}>
            <div className="space-y-3">
              {a.evidence.map((e, i) => (
                <motion.div
                  key={e.event_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="rounded-[4px] border border-line bg-surface-2 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[13.5px] font-semibold text-ink">{e.well_name}</span>
                    <FamilyChip eventType={e.event_type} />
                    <SeverityBadge severity={e.severity} />
                    <span className="ml-auto">
                      <SimilarityBadge value={e.similarity} />
                    </span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-3">
                    {fmtRange(e.depth_start, e.depth_end)} · {e.formation} · {fmtDate(e.date)} · {e.distance_km.toFixed(2)} km away · NPT {e.npt_hours} h
                  </div>
                  <p className="mt-2 border-l-[3px] pl-3 text-[13.5px] leading-snug text-ink" style={{ borderColor: FAMILY_META[a.risk_type].color }}>
                    “{e.description}”
                  </p>
                  {e.root_cause && (
                    <p className="mt-2 text-[12.5px] text-ink-2">
                      <span className="font-bold text-ink-3">Cause · </span>
                      {e.root_cause}
                    </p>
                  )}
                  {e.mitigation && (
                    <p className="mt-1 text-[12.5px] text-ink-2">
                      <span className="font-bold text-ink-3">Mitigation · </span>
                      {e.mitigation}
                    </p>
                  )}
                  <div className="mt-2.5">
                    <SourceCitation documentId={e.document_id} title={e.document_title} docType={e.document_type} page={e.page} depthStart={e.depth_start} depthEnd={e.depth_end} highlights={[String(Math.round(e.depth_start))]} />
                  </div>
                </motion.div>
              ))}
            </div>
          </Section>

          {a.related_events.length > 0 && (
            <Section title="Related precursor events in this window">
              <div className="space-y-1.5">
                {a.related_events.map((e) => (
                  <div key={e.event_id} className="flex items-center gap-2 rounded-[3px] bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-2">
                    <FamilyChip eventType={e.event_type} size="xs" />
                    <span className="font-mono font-medium">{e.well_name}</span>
                    <span className="text-ink-3">{fmtRange(e.depth_start, e.depth_end)}</span>
                    <span className="truncate text-ink-3">{e.title}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {audit.length > 0 && (
            <Section title="Audit trail" icon={<History size={14} className="text-brand-ink" />}>
              <ol className="relative space-y-3 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-0.5 before:rounded-[2px] before:bg-line-2">
                {audit.map((x, i) => (
                  <li key={i} className="relative text-[12.5px] text-ink-2">
                    <span className="absolute -left-5 top-1 h-3 w-3 rounded-full border-2 border-surface bg-brand" />
                    <span className="font-extrabold capitalize text-ink">{x.action}</span>{" "}
                    {x.depth !== null && <span className="font-mono text-ink-3">@{fmtDepth(x.depth)} </span>}
                    <span className="text-ink-3">
                      · {fmtTime(x.timestamp)} · {x.actor}
                    </span>
                    {x.notes && <div className="text-ink-3">“{x.notes}”</div>}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <div className="rounded-[3px] bg-surface-2 p-3 text-[12.5px] leading-relaxed text-ink-3">
            Decision support only — the drilling engineer remains in control. Scores rank risk from transparent rules over offset history and live signals; they are not
            calibrated probabilities.
          </div>
        </div>
      </div>
    </Dialog>
  );
}
