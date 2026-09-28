"use client";

import { Lightbulb } from "lucide-react";
import { DepthScrubber } from "@/components/shared/DepthScrubber";
import { FamilyChip } from "@/components/shared/StatusBadge";
import { useNWIS } from "@/lib/store";
import { fmtRange } from "@/lib/utils";

/** Bottom panel of the Command Center: the depth scrubber + "what happened here before". */
export function DepthTimeline() {
  const ctx = useNWIS((s) => s.evaluation?.context);
  const openWell = useNWIS((s) => s.openWell);
  return (
    <div className="glass shrink-0 rounded-lg px-3 pb-2 pt-2.5">
      <DepthScrubber />
      <div className="mt-2 flex items-start gap-2 border-t border-cockpit-line pt-2">
        <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-slate-200">{ctx?.text ?? "Evaluating offset history at this depth…"}</div>
          {ctx && ctx.nearby_events.length > 0 && (
            <div className="mt-1 flex gap-1.5 overflow-x-auto pb-0.5">
              {ctx.nearby_events.slice(0, 8).map((e) => (
                <button
                  key={e.event_id}
                  onClick={() => openWell(e.well_id)}
                  className="flex shrink-0 items-center gap-1.5 rounded border border-cockpit-border bg-black/20 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:border-cyan-400/50"
                  title={e.description}
                >
                  <span className="font-mono text-slate-100">{e.well_name}</span>
                  <FamilyChip eventType={e.event_type} />
                  <span className="font-mono text-cockpit-muted">{fmtRange(e.depth_start, e.depth_end)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
