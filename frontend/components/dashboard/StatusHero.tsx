"use client";

import { ArrowDown, Lightbulb, ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { AnimatedNumber } from "@/components/ui/animated";
import { useNWIS } from "@/lib/store";
import type { Severity } from "@/lib/types";
import { FAMILY_META, familyOf, fmtDepth, fmtRange, SEVERITY_STYLE } from "@/lib/utils";

const HEADLINE: Record<Severity, { title: string; icon: typeof ShieldCheck }> = {
  low: { title: "All clear", icon: ShieldCheck },
  medium: { title: "Watch closely", icon: ShieldAlert },
  high: { title: "Heads up", icon: ShieldAlert },
  critical: { title: "Act now", icon: Siren },
};

/** "Right now" — the one card an engineer glances at: overall status, the next window, and what offsets saw here. */
export function StatusHero() {
  const evaluation = useNWIS((s) => s.evaluation);
  const depth = useNWIS((s) => s.depth);
  const openWell = useNWIS((s) => s.openWell);
  const overall = evaluation?.overall_risk_level ?? "low";
  const sev = SEVERITY_STYLE[overall];
  const H = HEADLINE[overall];
  const next = evaluation?.next_risk_zone;
  const ctx = evaluation?.context;
  const alerts = evaluation?.active_alerts.filter((a) => a.status === "active").length ?? 0;

  return (
    <motion.section layout className="relative shrink-0 overflow-hidden rounded-[4px] text-white shadow-md">
      {/* Cross-fade between status gradients (gradients don't interpolate). */}
      <AnimatePresence initial={false}>
        <motion.div key={overall} className="absolute inset-0" style={{ background: sev.gradient }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} />
      </AnimatePresence>
      <div className="relative p-4">
        <div className="flex items-center gap-2 text-[12.5px] font-bold text-white/85">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/80" />
            <span className="relative h-2 w-2 rounded-full bg-white" />
          </span>
          Right now at <AnimatedNumber value={depth} /> m
          <span className="ml-auto rounded-[2px] bg-white/20 px-2 py-0.5 text-[12px]">{alerts ? `${alerts} active alert${alerts > 1 ? "s" : ""}` : "no active alerts"}</span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-white/20 backdrop-blur">
            <H.icon size={21} />
          </span>
          <motion.div key={overall} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="text-[24px] font-extrabold leading-none tracking-[-0.02em]">{H.title}</div>
            <div className="mt-1 text-[12.5px] font-semibold text-white/85">{sev.label} risk at the bit</div>
          </motion.div>
        </div>

        {next ? (
          <div className="mt-3.5 rounded-[3px] bg-black/15 p-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                <FamilyIcon family={next.type} size={13} />
              </span>
              <span className="flex-1 truncate">
                Next: {FAMILY_META[next.type].label} at {fmtDepth(next.depth)}
              </span>
              <span className="flex items-center gap-0.5 rounded-[2px] bg-white px-2 py-0.5 text-[12.5px] font-extrabold tabular" style={{ color: sev.deep }}>
                <ArrowDown size={12} />
                {Math.round(next.distance)} m
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-[1px] bg-white/25">
              <motion.div className="h-full rounded-[1px] bg-white" initial={false} animate={{ width: `${Math.max(6, 100 - (next.distance / 300) * 100)}%` }} transition={{ type: "spring", stiffness: 110, damping: 20 }} />
            </div>
            <div className="mt-1 text-[12px] font-medium text-white/75">{next.formation} · look-ahead from the offset-well risk register</div>
          </div>
        ) : (
          <div className="mt-3.5 rounded-[3px] bg-black/15 px-3 py-2 text-[13px] font-semibold">No further risk windows ahead of the bit.</div>
        )}
      </div>

      {ctx && (
        <div className="relative border-t border-white/15 bg-black/10 px-4 py-3">
          <div className="flex gap-2 text-[13px] leading-snug text-white/95">
            <Lightbulb size={15} className="mt-0.5 shrink-0" />
            <span>{ctx.text}</span>
          </div>
          {ctx.nearby_events.length > 0 && (
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
              {ctx.nearby_events.slice(0, 6).map((e) => (
                <button
                  key={e.event_id}
                  onClick={() => openWell(e.well_id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-[2px] bg-white/90 px-2 py-1 text-[12.5px] font-semibold text-ink shadow-sm transition-transform hover:scale-[1.04] dark:bg-white"
                  title={e.description}
                >
                  <FamilyIcon family={familyOf(e.event_type)} size={12} />
                  <span className="font-mono text-[#0c0e14]">{e.well_name}</span>
                  <span className="text-[#555c6b]">{fmtRange(e.depth_start, e.depth_end)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}
