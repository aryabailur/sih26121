"use client";

import { TriangleAlert } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loading } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useNWIS } from "@/lib/store";
import type { PressureRow } from "@/lib/types";
import { CHART, fmtDepth, fmtNum } from "@/lib/utils";

// Four identities, fixed order; prognosis vs calibrated is carried by dash (secondary encoding).
const PORE = "#e5383b";
const FRAC = "#d4912a";
const PLAN = "#8b93a7";
const ECD = "#5b4bff";

type Row = PressureRow & { ecd_live: number | null };

/**
 * Mud-weight window for the active well: prognosed pore pressure / fracture gradient (dashed),
 * the same lines calibrated by offset events (solid), the planned mud weight and the live ECD.
 */
export function PressureWindowChart({ domain = [2400, 3800] as [number, number] }: { domain?: [number, number] }) {
  const radiusKm = useNWIS((s) => s.radiusKm);
  const depth = useNWIS((s) => s.depth);
  const kbVersion = useNWIS((s) => s.kbVersion);
  const pw = useAsync(() => api.pressureWindow("W001", radiusKm), [radiusKm, kbVersion]);
  if (!pw.data) return <Loading label="Computing pressure window…" className="h-full" />;

  const bit = Math.max(3100, depth);
  const rows: Row[] = pw.data.rows.filter((r) => r.md >= domain[0] && r.md <= domain[1]).map((r) => ({ ...r, ecd_live: r.md <= bit ? r.ecd : null }));
  const series: { key: keyof Row; label: string; color: string; dash?: string; width: number }[] = [
    { key: "pore_prognosed", label: "", color: PORE, dash: "4 3", width: 1.5 },
    { key: "pore_calibrated", label: "Pore pressure", color: PORE, width: 2.4 },
    { key: "frac_prognosed", label: "", color: FRAC, dash: "4 3", width: 1.5 },
    { key: "frac_calibrated", label: "Fracture gradient", color: FRAC, width: 2.4 },
    { key: "mw_plan", label: "Planned MW", color: PLAN, dash: "2 3", width: 2 },
    { key: "ecd_live", label: "ECD (to bit)", color: ECD, width: 2.6 },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[12px] font-semibold text-ink-3">
        {series
          .filter((s) => s.label)
          .map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <svg width="16" height="4" aria-hidden>
                <line x1="0" y1="2" x2="16" y2="2" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinecap="round" />
              </svg>
              {s.label}
            </span>
          ))}
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden>
            <line x1="0" y1="2" x2="16" y2="2" stroke="var(--chart-tick)" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          dashed = prognosis · solid = offset-calibrated
        </span>
      </div>
      <div className="min-h-0 flex-1 rounded-[3px] bg-surface-2 p-1.5">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} layout="vertical" margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" orientation="top" domain={[1.2, 1.7]} ticks={[1.2, 1.3, 1.4, 1.5, 1.6, 1.7]} tick={{ fill: CHART.tick, fontSize: 11.5 }} stroke={CHART.axis} tickFormatter={(v) => Number(v).toFixed(1)} />
            {/* Recharts vertical layout: numeric Y minimum is at the top — depth increases downward. */}
            <YAxis type="number" dataKey="md" domain={domain} tick={{ fill: CHART.tick, fontSize: 11.5 }} stroke={CHART.axis} width={40} tickCount={8} allowDataOverflow />
            {pw.data.breaches.map((b) => (
              <ReferenceArea key={b.kind} y1={b.start} y2={b.end} fill={b.kind === "kick" ? PORE : FRAC} fillOpacity={0.14} stroke="none" ifOverflow="hidden" />
            ))}
            {pw.data.casing
              .filter((c) => c.shoe_md >= domain[0] && c.shoe_md <= domain[1])
              .map((c) => (
                <ReferenceLine key={c.shoe_md} y={c.shoe_md} stroke={CHART.tick} strokeDasharray="1 3" label={{ value: `${c.size} shoe${c.planned ? " (plan)" : ""}`, position: "insideBottomRight", fill: CHART.tick, fontSize: 11.5 }} />
              ))}
            <ReferenceLine y={depth} stroke={CHART.bit} strokeWidth={2} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: CHART.cursor, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as Row;
                return (
                  <div className="rounded-[3px] bg-ink px-2.5 py-1.5 text-[12px] text-surface shadow-lg">
                    <div className="font-mono font-semibold">
                      {fmtDepth(r.md)} · {r.formation}
                    </div>
                    <div className="opacity-90">
                      Pore <b className="font-mono">{fmtNum(r.pore_calibrated, 2)}</b> (prog. {fmtNum(r.pore_prognosed, 2)}) sg
                    </div>
                    <div className="opacity-90">
                      Frac <b className="font-mono">{fmtNum(r.frac_calibrated, 2)}</b> (prog. {fmtNum(r.frac_prognosed, 2)}) sg
                    </div>
                    <div className="opacity-90">
                      Planned MW <b className="font-mono">{fmtNum(r.mw_plan, 2)}</b> sg
                      {r.ecd_live !== null && (
                        <>
                          {" "}
                          · ECD <b className="font-mono">{fmtNum(r.ecd_live, 2)}</b> sg
                        </>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} dot={false} isAnimationActive={false} connectNulls={false} strokeLinejoin="round" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1.5 px-1">
        {pw.data.breaches.map((b) => (
          <div key={b.kind} className="flex items-start gap-2 rounded-[3px] bg-med-soft px-2.5 py-1.5 text-[12.5px] text-med-ink">
            <TriangleAlert size={13} className="mt-px shrink-0" />
            <span>
              <b>
                {fmtDepth(b.start)}–{fmtDepth(b.end)}:
              </b>{" "}
              {b.message}.
            </span>
          </div>
        ))}
        <div className="text-[12px] leading-snug text-ink-3">
          Calibrated from {Array.from(new Set(pw.data.calibrations.map((c) => c.well))).join(", ") || "no offsets"}: {pw.data.calibrations.map((c) => `${c.well} ${c.note}`).join("; ")}.
        </div>
      </div>
    </div>
  );
}
