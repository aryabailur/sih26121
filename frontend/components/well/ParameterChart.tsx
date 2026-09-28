"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DrillingEvent } from "@/lib/types";
import { CHART, FAMILY_META, familyOf, fmtNum, SERIES_COLORS } from "@/lib/utils";

export interface DepthSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

type Row = Record<string, number | null | undefined> & { md: number };

/** One parameter vs depth (depth increases downward). Small multiples share the depth domain. */
export function ParameterChart({
  title,
  unit,
  data,
  series,
  domain,
  depth,
  events = [],
  digits = 1,
}: {
  title: string;
  unit: string;
  data: Row[];
  series: DepthSeries[];
  domain: [number, number];
  depth?: number;
  events?: DrillingEvent[];
  digits?: number;
}) {
  // In vertical layout Recharts puts the numeric Y minimum at the top, so plain MD already
  // reads as depth increasing downward (no `reversed` — it desyncs lines from reference marks).
  const rows = data.filter((r) => r.md >= domain[0] && r.md <= domain[1]);
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
        <span className="text-[11px] font-semibold text-slate-200">{title}</span>
        <span className="text-[10px] text-cockpit-dim">{unit}</span>
      </div>
      {/* Legend row height is always reserved so every depth chart shares the same plot top. */}
      <div className="mb-1 flex h-[14px] flex-wrap gap-x-2 overflow-hidden px-1 text-[9.5px] leading-[14px] text-cockpit-muted">
        {series.length > 1 &&
          series.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <svg width="14" height="4" aria-hidden>
                <line x1="0" y1="2" x2="14" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "3 2" : undefined} />
              </svg>
              {s.label}
            </span>
          ))}
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} layout="vertical" margin={{ top: 4, right: 6, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" orientation="top" domain={["auto", "auto"]} tick={{ fill: CHART.tick, fontSize: 9 }} stroke={CHART.grid} tickCount={4} />
            <YAxis type="number" dataKey="md" domain={domain} allowDataOverflow hide />
            {events.map((e) => (
              <ReferenceArea
                key={e.id}
                y1={e.depth_start}
                y2={Math.max(e.depth_end, e.depth_start + 8)}
                fill={FAMILY_META[familyOf(e.event_type)].color}
                fillOpacity={0.14}
                stroke="none"
                ifOverflow="hidden"
              />
            ))}
            {depth !== undefined && depth >= domain[0] && depth <= domain[1] && (
              <ReferenceLine y={depth} stroke="#22d3ee" strokeWidth={1.5} />
            )}
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const md = (payload[0].payload as Row).md;
                return (
                  <div className="rounded border border-cockpit-border bg-[#0d1424] px-2 py-1 text-[10.5px] shadow-xl">
                    <div className="font-mono text-slate-200">{Math.round(md).toLocaleString("en-IN")} m MD</div>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center gap-1.5 text-slate-300">
                        <span className="h-0.5 w-2.5" style={{ background: p.color }} />
                        {series.find((s) => s.key === p.dataKey)?.label}: <span className="font-mono text-slate-100">{fmtNum(p.value as number, digits)}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "4 3" : undefined}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                strokeLinejoin="round"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const OFFSET_COLOR = SERIES_COLORS[1];
export const ACTIVE_COLOR = SERIES_COLORS[0];
