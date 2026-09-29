"use client";

import { ArrowRight, Siren, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { useNWIS } from "@/lib/store";
import { FAMILY_META, fmtDepth, pct, SEVERITY_STYLE } from "@/lib/utils";

const TOAST_MS = 9000;

/** Screen-edge glow when a new alert lands — peripheral vision catches it even mid-conversation. */
function EdgeFlash() {
  const latest = useNWIS((s) => s.toasts[s.toasts.length - 1]);
  return (
    <AnimatePresence>
      {latest && (
        <motion.div
          key={`${latest.id}-${latest.at}`}
          className="pointer-events-none fixed inset-0 z-[1250]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.35, 0.8, 0] }}
          transition={{ duration: 2.2, times: [0, 0.12, 0.4, 0.55, 1] }}
          style={{ boxShadow: `inset 0 0 0 3px ${SEVERITY_STYLE[latest.alert.severity].hex}, inset 0 0 120px ${SEVERITY_STYLE[latest.alert.severity].hex}66` }}
        />
      )}
    </AnimatePresence>
  );
}

export function AlertToaster() {
  const toasts = useNWIS((s) => s.toasts);
  const dismiss = useNWIS((s) => s.dismissToast);
  const openWhy = useNWIS((s) => s.openWhy);
  return (
    <>
      <EdgeFlash />
      {/* Below dialogs (z-1200) so an open "Why?" view is never covered; above drawers (z-1100). */}
      <div className="pointer-events-none fixed right-5 top-20 z-[1150] flex w-[400px] flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const a = t.alert;
            const sev = SEVERITY_STYLE[a.severity];
            const wells = Array.from(new Set(a.assessment.supporting_wells.map((s) => s.well_name)));
            return (
              <motion.div
                layout
                key={t.id}
                role="alert"
                initial={{ x: 440, opacity: 0, rotate: 4 }}
                animate={{ x: 0, opacity: 1, rotate: 0 }}
                exit={{ x: 440, opacity: 0, transition: { duration: 0.25 } }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
                className="pointer-events-auto relative overflow-hidden rounded-[4px] text-white shadow-lg"
                style={{ background: sev.gradient }}
              >
                <div className="relative p-4">
                  <div className="flex items-start gap-3">
                    <motion.span
                      key={t.at}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-white/20 backdrop-blur"
                      animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                      transition={{ duration: 0.7, delay: 0.25 }}
                    >
                      <Siren size={22} />
                    </motion.span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-white/85">
                        {t.kind === "escalated" ? "Alert escalated" : "Proactive alert"} · {sev.label}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[17px] font-extrabold leading-tight tracking-[-0.01em]">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                          <FamilyIcon family={a.risk_type} size={13} />
                        </span>
                        {FAMILY_META[a.risk_type].label} risk at {fmtDepth(a.triggered_at_depth)}
                      </div>
                      <div className="mt-1.5 text-[13px] font-medium text-white/90">
                        Seen in {wells.length} offset well{wells.length > 1 ? "s" : ""}: <b>{wells.join(", ")}</b> · confidence {pct(a.confidence)}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-white/80">{a.reasons[0]}</div>
                      <button
                        onClick={() => {
                          openWhy({ kind: "alert", alertId: a.id });
                          dismiss(t.id);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-[2px] bg-white px-3.5 py-1.5 text-[13px] font-extrabold shadow-md transition-transform hover:scale-[1.03]"
                        style={{ color: sev.deep }}
                      >
                        Why? See the evidence <ArrowRight size={14} />
                      </button>
                    </div>
                    <button onClick={() => dismiss(t.id)} className="rounded-[3px] p-1 text-white/75 hover:bg-white/15 hover:text-white" aria-label="Dismiss">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <motion.div key={t.at} className="h-1 origin-left bg-white/60" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: TOAST_MS / 1000, ease: "linear" }} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
