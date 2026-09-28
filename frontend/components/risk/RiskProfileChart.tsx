"use client";

import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNWIS } from "@/lib/store";
import { CHART, FAMILY_META, fmtDepth } from "@/lib/utils";

/** Highest predicted risk score along the planned well path (simulated look-ahead parameters). */
export function RiskProfileChart({ domain = [2400, 3800] as [number, number] }: { domain?: [number, number] }) {
  const profile = useNWIS((s) => s.profile);
  const zones = useNWIS((s) => s.zones);
  const depth = useNWIS((s) => s.depth);
  const setDepth = useNWIS((s) => s.setDepth);
  const data = profile.filter((p) => p.depth >= domain[0] && p.depth <= domain[1]);
  const fams = Array.from(new Set(zones.filter((z) => z.depth_end >= domain[0] && z.depth_start <= domain[1]).map((z) => z.risk_type)));

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-cockpit-muted">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-sky-400" /> max risk score</span>
        {fams.map((f) => (
          <span key={f} className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ background: `${FAMILY_META[f].color}40` }} /> {FAMILY_META[f].label} zone
          </span>
        ))}
        <span className="ml-auto">click the chart to move the bit</span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 12, bottom: 0, left: -12 }}
            onClick={(s) => {
              const d = Number(s?.activeLabel);
              if (!Number.isNaN(d)) setDepth(d, { immediate: true });
            }}
          >
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="depth" type="number" domain={domain} tick={{ fill: CHART.tick, fontSize: 10 }} stroke={CHART.grid} tickCount={8}
              tickFormatter={(v) => `${Number(v).toLocaleString("en-IN")}`} />
            <YAxis domain={[0, 1]} ticks={[0, 0.35, 0.55, 0.75, 1]} tick={{ fill: CHART.tick, fontSize: 10 }} stroke={CHART.grid} tickFormatter={(v) => `${Math.round(v * 100)}`} />
            {zones.map((z) => (
              <ReferenceArea key={z.id} x1={z.depth_start} x2={z.depth_end} y1={0} y2={1} fill={FAMILY_META[z.risk_type].color} fillOpacity={0.1} stroke="none" ifOverflow="hidden" />
            ))}
            <ReferenceLine y={0.55} stroke="#f97316" strokeOpacity={0.5} strokeWidth={1} label={{ value: "high", position: "insideTopLeft", fill: CHART.tick, fontSize: 9 }} />
            <ReferenceLine y={0.75} stroke="#ef4444" strokeOpacity={0.5} strokeWidth={1} label={{ value: "critical", position: "insideTopLeft", fill: CHART.tick, fontSize: 9 }} />
            <ReferenceLine x={depth} stroke="#22d3ee" strokeWidth={1.5} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded border border-cockpit-border bg-[#0d1424] px-2 py-1 text-[10.5px] shadow-xl">
                    <div className="font-mono text-slate-200">{fmtDepth(p.depth)}</div>
                    <div className="text-slate-300">
                      score <span className="font-mono text-slate-50">{Math.round(p.score * 100)}</span>
                      {p.risk_type && <> · {FAMILY_META[p.risk_type].label}</>} · {p.severity}
                    </div>
                  </div>
                );
              }}
            />
            <Area dataKey="score" type="monotone" stroke="#38bdf8" strokeWidth={2} fill="#38bdf8" fillOpacity={0.1} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
