"use client";

import { useEffect } from "react";
import { useNWIS } from "@/lib/store";
import { SEVERITY_STYLE } from "@/lib/utils";
import { speak, useVoice } from "@/lib/voice";

/** Speaks each new or escalated alert once — hands-free for the driller's cabin. Renders nothing. */
export function VoiceCallouts() {
  const on = useVoice();
  const latest = useNWIS((s) => s.toasts.at(-1));
  const key = latest ? `${latest.id}:${latest.at}` : "";

  useEffect(() => {
    const t = useNWIS.getState().toasts.at(-1);
    if (!on || !key || !t) return;
    const a = t.alert;
    const wells = Array.from(new Set(a.assessment.supporting_wells.map((s) => s.well_name)));
    const head = a.recommendation.split(/(?<=\.)\s/)[0] ?? "";
    speak(
      `${SEVERITY_STYLE[a.severity].label} alert${t.kind === "escalated" ? ", escalated" : ""}. ${a.risk_label} risk at ${Math.round(a.triggered_at_depth)} metres. ` +
        `Seen in ${wells.length} offset well${wells.length === 1 ? "" : "s"}: ${wells.join(", ")}. ${head}`,
      { interrupt: true },
    );
  }, [key, on]);

  return null;
}
