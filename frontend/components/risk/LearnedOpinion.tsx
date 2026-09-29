"use client";

import { BrainCircuit } from "lucide-react";
import { ScoreRing } from "@/components/ui/animated";
import type { LearnedModel, LearnedOpinion, RiskFamily } from "@/lib/types";
import { cn, FAMILY_META, pct } from "@/lib/utils";

export const VERDICT: Record<LearnedOpinion["verdict"], { label: string; cls: string; line: string }> = {
  agrees: { label: "Model agrees", cls: "bg-brand-soft text-brand-ink", line: "agrees with the rule score" },
  more_concerned: { label: "Model more concerned", cls: "bg-high-soft text-high-ink", line: "is more concerned than the rule score, which keeps this a watch item" },
  less_sure: { label: "Model less sure", cls: "bg-surface-3 text-ink-2", line: "is less sure than the rule score — the alert rests mainly on proximity and history" },
};

/** Compact chip for risk cards: learned probability and lift over the field base rate. */
export function LearnedChip({ ml }: { ml: LearnedOpinion }) {
  const v = VERDICT[ml.verdict];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-[2px] px-2 py-0.5 text-[12px] font-bold tabular", v.cls)}
      title={`Learned model: ${pct(ml.probability)} chance an offset-like well hits this within ${ml.horizon_m} m — ${ml.lift.toFixed(1)}× the field base rate (${pct(ml.base_rate, 1)}). ${v.label}.`}
    >
      <BrainCircuit size={11} /> ML {pct(ml.probability)} · {ml.lift.toFixed(1)}×
    </span>
  );
}

const FACTOR_NAMES: Record<string, string> = {
  proximity: "Depth proximity",
  frequency: "Offset frequency",
  similarity: "Well similarity",
  formation: "Formation match",
  parameter: "Live parameters",
  trajectory: "Trajectory",
};

/** One-sentence reading of the learned weights (recomputed whenever the model retrains). */
function insight(m: LearnedModel) {
  const lw = m.learned_weights ?? {};
  const hw = m.hand_weights ?? {};
  const ranked = Object.keys(lw).sort((a, b) => lw[b] - lw[a]);
  const top = ranked.slice(0, 2).filter((k) => lw[k] > 0);
  const up = top.filter((k) => lw[k] > (hw[k] ?? 0) + 0.05);
  const idle = ranked.filter((k) => lw[k] < 0.02);
  const name = (k: string) => (FACTOR_NAMES[k] ?? k).toLowerCase();
  let s = `History leans most on ${top.map((k) => `${name(k)} (${Math.round(lw[k] * 100)}%)`).join(" and ")}`;
  s += up.length ? ` — more than the hand-set weights assume.` : ".";
  if (idle.length) s += ` ${idle.map((k) => FACTOR_NAMES[k] ?? k).join(" and ")} add${idle.length === 1 ? "s" : ""} little once the other factors are known.`;
  return s;
}

/** Risk Explorer: what the backtest learned vs the hand-set weights. */
export function LearnedWeights({ m }: { m: LearnedModel }) {
  if (m.status !== "ready" || !m.learned_weights || !m.hand_weights) {
    return <div className="rounded-[3px] bg-surface-2 p-3 text-[12.5px] text-ink-3">Learned model {m.status === "training" ? "is training…" : "unavailable"}.</div>;
  }
  const keys = Object.keys(m.hand_weights);
  return (
    <div className="rounded-[4px] border border-line p-3.5">
      <div className="flex items-center gap-2 text-[13.5px] font-extrabold text-ink">
        <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-brand-soft text-brand-ink">
          <BrainCircuit size={15} />
        </span>
        Learned from offset-well history
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-3">
        Each completed offset well is replayed as if it were being drilled; a logistic model learns which factors actually preceded its events. Every well is
        scored by a model that never saw it.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[3px] bg-brand-soft px-2 py-2">
          <div className="text-[18px] font-extrabold tabular text-brand-ink">{m.auc_model?.toFixed(2)}</div>
          <div className="text-[11.5px] font-bold text-ink-3">AUC · learned</div>
        </div>
        <div className="rounded-[3px] bg-surface-2 px-2 py-2">
          <div className="text-[18px] font-extrabold tabular text-ink">{m.auc_rule?.toFixed(2)}</div>
          <div className="text-[11.5px] font-bold text-ink-3">AUC · hand-set</div>
        </div>
        <div className="rounded-[3px] bg-surface-2 px-2 py-2">
          <div className="text-[18px] font-extrabold tabular text-ink">{m.rows?.toLocaleString("en-IN")}</div>
          <div className="text-[11.5px] font-bold text-ink-3">backtest points</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-end gap-3 text-[11.5px] font-bold text-ink-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-[1px] bg-ink-4" /> hand-set
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-[1px] bg-brand" /> learned
          </span>
        </div>
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[112px_1fr_44px] items-center gap-2 text-[12.5px]">
            <span className="font-semibold text-ink-2">{FACTOR_NAMES[k] ?? k}</span>
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-[1px] bg-surface-3">
                <div className="h-full rounded-[1px] bg-ink-4" style={{ width: `${(m.hand_weights![k] ?? 0) * 100}%` }} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-[1px] bg-surface-3">
                <div className="h-full rounded-[1px] bg-brand" style={{ width: `${(m.learned_weights![k] ?? 0) * 100}%` }} />
              </div>
            </div>
            <span className="text-right font-mono text-[12px] tabular text-ink-2">{Math.round((m.learned_weights![k] ?? 0) * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-[3px] bg-surface-2 px-2.5 py-2 text-[12.5px] leading-snug text-ink-2">{insight(m)}</p>
      <p className="mt-2 rounded-[3px] bg-med-soft px-2.5 py-2 text-[12px] leading-snug text-med-ink">{m.caveat}</p>
    </div>
  );
}

/** Why-view section: the learned cross-check in plain language. */
export function LearnedCrossCheck({ ml, family, model }: { ml: LearnedOpinion; family: RiskFamily; model?: LearnedModel | null }) {
  const v = VERDICT[ml.verdict];
  return (
    <div className="rounded-[4px] border border-line bg-surface-2 p-3.5">
      <div className="flex items-center gap-3.5">
        <div className="rounded-full bg-surface p-1 shadow-sm">
          <ScoreRing value={ml.probability} color={ml.elevated ? "var(--high)" : "var(--brand)"} size={62} stroke={6} textClassName="text-[16px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-[2px] px-2 py-0.5 text-[12px] font-extrabold", v.cls)}>{v.label}</span>
            <span className="rounded-[2px] bg-surface px-2 py-0.5 text-[12px] font-bold tabular text-ink-2 ring-1 ring-line">{ml.lift.toFixed(1)}× base rate</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-ink-2">
            In backtests on the offset wells, factor patterns like this were followed by <b>{FAMILY_META[family].verb}</b> within {ml.horizon_m} m{" "}
            <b className="text-ink">{pct(ml.probability)}</b> of the time, against a field base rate of {pct(ml.base_rate, 1)}. The learned model {v.line}.
          </p>
        </div>
      </div>
      {model?.status === "ready" && (
        <div className="mt-2.5 border-t border-line pt-2 text-[12px] leading-snug text-ink-3">
          Logistic model on the same six factors · {model.rows?.toLocaleString("en-IN")} backtest points from {model.wells} wells · leave-one-well-out AUC{" "}
          <b className="text-ink-2">{model.auc_model?.toFixed(2)}</b> vs <b className="text-ink-2">{model.auc_rule?.toFixed(2)}</b> for the hand-set score. Cross-check only — alerts follow the
          explainable score.
        </div>
      )}
    </div>
  );
}
