"use client";

import { AlertTriangle, Check, Lightbulb, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { SeverityBadge } from "@/components/shared/StatusBadge";
import { fmtINR, nptCostLakh } from "@/lib/brief";
import type { BriefHazard } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth, fmtNum, fmtRange, SEVERITY_STYLE } from "@/lib/utils";

/** Pore → frac window on one bar: kick side, safe band, loss side, planned mud weight. */
export function MudWindowGauge({ mw }: { mw: NonNullable<BriefHazard["mud_window"]> }) {
  if (mw.pore_max == null || mw.frac_min == null) return null;
  const plan = mw.mw_plan;
  const lo = Math.min(mw.pore_max, ...plan) - 0.08;
  const hi = Math.max(mw.frac_min, ...plan) + 0.08;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const bad = plan.some((p) => p < (mw.mw_min ?? 0) || p + 0.05 > (mw.ecd_limit ?? 9));
  return (
    <div>
      <div className="relative mt-5 h-3.5 rounded-[2px] bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded-l-[2px] bg-crit/25" style={{ width: x(mw.pore_max) }} />
        <div className="absolute inset-y-0 right-0 rounded-r-[2px] bg-high/25" style={{ left: x(mw.frac_min) }} />
        {mw.mw_min != null && mw.ecd_limit != null && <div className="absolute inset-y-0 bg-low/35" style={{ left: x(mw.mw_min), width: `calc(${x(mw.ecd_limit)} - ${x(mw.mw_min)})` }} />}
        {plan.map((p) => (
          <div key={p} className="absolute -top-[18px] -translate-x-1/2 text-center" style={{ left: x(p) }}>
            <div className={cn("whitespace-nowrap rounded-[2px] px-1 text-[11px] font-bold text-white", bad ? "bg-crit" : "bg-brand")}>plan {fmtNum(p, 2)}</div>
            <div className={cn("mx-auto h-[26px] w-[2px]", bad ? "bg-crit" : "bg-brand")} />
          </div>
        ))}
      </div>
      <div className="relative mt-1 h-4 whitespace-nowrap font-mono text-[11px] text-ink-3">
        <span className="absolute -translate-x-1/2" style={{ left: x(mw.pore_max) }}>
          pore {fmtNum(mw.pore_max, 2)}
        </span>
        {/* anchored at its right edge so it never wraps past the bar */}
        <span className="absolute -translate-x-full" style={{ left: `calc(${x(mw.frac_min)} + 18px)` }}>
          frac {fmtNum(mw.frac_min, 2)}
        </span>
      </div>
    </div>
  );
}

function Sub({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
      <span className="text-ink-3">{icon}</span>
      {children}
    </h4>
  );
}

export function HazardSection({
  h,
  index,
  rateLakh,
  checked,
  onCheck,
}: {
  h: BriefHazard;
  index: number;
  rateLakh: number;
  checked: Set<number>;
  onCheck: (i: number) => void;
}) {
  const fam = FAMILY_META[h.risk_type];
  const sev = SEVERITY_STYLE[h.projected.severity];
  const maxNpt = Math.max(1, ...h.what_worked.map((w) => w.npt_hours));
  const done = checked.size;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1, type: "spring", stiffness: 220, damping: 26 }}
      className="relative overflow-hidden rounded-[4px] border border-line bg-surface break-inside-avoid print:shadow-none"
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: fam.color }} />
      <header className="flex flex-wrap items-start gap-3 border-b border-line py-3 pl-5 pr-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px]" style={{ background: `color-mix(in oklab, ${fam.color} 15%, transparent)` }}>
          <FamilyIcon family={h.risk_type} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-bold text-ink-3">#{index + 1}</span>
            <h3 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">{fam.label}</h3>
            <span className="text-[14px] font-bold text-ink-2">{fmtRange(h.window.start, h.window.end)}</span>
            <span className="text-[13px] text-ink-3">· {h.formation}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-2">
            <b className="text-ink">
              {h.offsets_hit} of {h.offsets_reached}
            </b>{" "}
            offsets that reached this depth hit it · they lost <b className="text-ink">{h.npt.total} h</b> NPT · expected here{" "}
            <b className="text-ink">
              {h.npt.expected} h ≈ {fmtINR(nptCostLakh(h.npt.expected, rateLakh))}
            </b>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-[2px] px-2 py-1 text-[12.5px] font-extrabold tabular", h.position === "inside" ? "bg-crit text-white" : "bg-surface-3 text-ink")}>
            {h.position === "inside" ? "Bit inside" : `In ${fmtDepth(h.distance_m)}`}
          </span>
          <span className="rounded-[2px] px-2 py-1 text-[12.5px] font-extrabold text-white" style={{ background: sev.deep }} title={`Projected score ${Math.round(h.projected.score * 100)} from offset history alone (alert at ${Math.round(h.projected.alert_threshold * 100)})`}>
            Projected {sev.label.toLowerCase()} · {Math.round(h.projected.score * 100)}
          </span>
        </div>
      </header>

      <div className="grid gap-5 py-4 pl-5 pr-4 lg:grid-cols-3">
        {/* What happened */}
        <div className="min-w-0">
          <Sub icon={<AlertTriangle size={13} />}>What happened in the offsets</Sub>
          <ul className="space-y-2.5">
            {h.evidence.map((e) => (
              <li key={e.event_id} className="text-[13px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[12.5px] font-bold text-ink">{e.well_name}</span>
                  <span className="text-ink-3">{fmtRange(e.depth_start, e.depth_end)}</span>
                  <SeverityBadge severity={e.severity} />
                  {e.npt_hours > 0 && <span className="text-[12px] font-semibold text-ink-3">{e.npt_hours} h NPT</span>}
                </div>
                <div className="mt-0.5 leading-snug text-ink-2">{e.title}</div>
                {e.root_cause && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-3">Cause: {e.root_cause}</div>}
                <SourceCitation documentId={e.document_id} title={e.document_title} page={e.page} highlights={[String(Math.round(e.depth_start))]} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </div>

        {/* What worked */}
        <div className="min-w-0">
          <Sub icon={<Trophy size={13} />}>What worked — fastest recovery first</Sub>
          <ol className="space-y-2.5">
            {h.what_worked.map((w, i) => (
              <li key={w.event_id} className="rounded-[3px] border border-line bg-surface-2 p-2.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-[11.5px] font-extrabold", i === 0 ? "bg-[#0b7a58] text-white" : "bg-surface-3 text-ink-2")}>{i + 1}</span>
                  <span className="font-mono text-[12.5px] font-bold text-ink">{w.well_name}</span>
                  <span className="ml-auto text-[12px] font-bold tabular text-ink-2">{w.npt_hours} h</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-[1px] bg-surface-3">
                  <motion.div className="h-full rounded-[1px]" style={{ background: i === 0 ? "var(--low)" : "var(--ink-4)" }} initial={{ width: 0 }} animate={{ width: `${(w.npt_hours / maxNpt) * 100}%` }} transition={{ delay: 0.4 + i * 0.1, duration: 0.6 }} />
                </div>
                <p className="mt-1.5 leading-snug text-ink-2">{w.text}</p>
              </li>
            ))}
          </ol>
          {h.lessons.length > 0 && (
            <div className="mt-3">
              <Sub icon={<Lightbulb size={13} />}>Lessons learned</Sub>
              <ul className="space-y-1.5">
                {h.lessons.map((l) => (
                  <li key={l.event_id} className="border-l-2 border-low pl-2.5 text-[12.5px] leading-snug text-ink-2">
                    {l.text} <span className="font-mono text-[11.5px] font-semibold text-ink-3">— {l.well_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Before you enter */}
        <div className="min-w-0">
          <Sub icon={<Check size={13} />}>
            Before you enter{" "}
            <span className="ml-auto rounded-[2px] bg-surface-3 px-1.5 text-[11.5px] font-bold tabular text-ink-2">
              {done}/{h.checks.length}
            </span>
          </Sub>
          <ul className="space-y-1">
            {h.checks.map((c, i) => {
              const on = checked.has(i);
              return (
                <li key={c}>
                  <button onClick={() => onCheck(i)} className="flex w-full items-start gap-2 rounded-[3px] px-1.5 py-1 text-left text-[13px] leading-snug transition-colors hover:bg-surface-3">
                    <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border-2 transition-colors", on ? "border-low bg-low text-white" : "border-line-2 bg-surface")}>
                      {on && <Check size={11} strokeWidth={3.5} />}
                    </span>
                    <span className={cn(on ? "text-ink-3 line-through" : "text-ink-2")}>{c}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {h.offset_numbers.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[12.5px] font-extrabold text-ink">Numbers the offsets recorded</div>
              <div className="flex flex-wrap gap-1.5">
                {h.offset_numbers.map((n) => (
                  <span key={`${n.event_id}-${n.key}`} className="rounded-[2px] border border-line bg-surface-2 px-1.5 py-0.5 text-[12px] text-ink-2" title={n.event_id}>
                    {n.label} <b className="font-mono text-ink">{n.value.toLocaleString("en-IN")}</b> {n.unit} <span className="font-mono text-[11px] text-ink-3">{n.well_name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {h.mud_window && (
            <div className="mt-3">
              <div className="text-[12.5px] font-extrabold text-ink">Mud-weight window here</div>
              <MudWindowGauge mw={h.mud_window} />
              <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{h.mud_window.note}</p>
              {h.breaches.map((b) => (
                <p key={b.kind} className="mt-1.5 flex items-start gap-1.5 rounded-[3px] bg-crit-soft px-2 py-1.5 text-[12.5px] font-semibold leading-snug text-crit-ink">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {b.message} ({fmtRange(b.start, b.end)}).
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
