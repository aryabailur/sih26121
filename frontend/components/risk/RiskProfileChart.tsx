"use client";

import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { useNWIS } from "@/lib/store";
import { CHART, FAMILY_META, fmtDepth, SEVERITY_STYLE } from "@/lib/utils";

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
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12.5px] font-semibold text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-[1px]" style={{ background: "linear-gradient(90deg,#12a679,#f2a60c,#f76b15,#e5383b)" }} /> Max risk score
        </span>
        {fams.map((f) => (
          <span key={f} className="flex items-center gap-1">
            <FamilyIcon family={f} size={12} /> {FAMILY_META[f].label}
          </span>
        ))}
        <span className="ml-auto rounded-[2px] bg-brand-soft px-2 py-0.5 text-[12px] font-bold text-brand-ink">Click the chart to move the bit</span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 22, right: 12, bottom: 0, left: -12 }}
            onClick={(s) => {
              const d = Number(s?.activeLabel);
              if (!Number.isNaN(d)) setDepth(d, { immediate: true });
            }}
            className="cursor-crosshair"
          >
            <defs>
              <linearGradient id="riskStroke" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={SEVERITY_STYLE.low.hex} />
                <stop offset="35%" stopColor={SEVERITY_STYLE.medium.hex} />
                <stop offset="55%" stopColor={SEVERITY_STYLE.high.hex} />
                <stop offset="75%" stopColor={SEVERITY_STYLE.critical.hex} />
              </linearGradient>
              <linearGradient id="riskFill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={SEVERITY_STYLE.low.hex} stopOpacity={0.05} />
                <stop offset="55%" stopColor={SEVERITY_STYLE.high.hex} stopOpacity={0.22} />
                <stop offset="100%" stopColor={SEVERITY_STYLE.critical.hex} stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="depth" type="number" domain={domain} tick={{ fill: CHART.tick, fontSize: 12 }} stroke={CHART.axis} tickCount={8} tickFormatter={(v) => `${Number(v).toLocaleString("en-IN")}`} />
            <YAxis domain={[0, 1]} ticks={[0, 0.35, 0.55, 0.75, 1]} tick={{ fill: CHART.tick, fontSize: 12 }} stroke={CHART.axis} tickFormatter={(v) => `${Math.round(v * 100)}`} />
            {zones.map((z) => (
              <ReferenceArea key={z.id} x1={z.depth_start} x2={z.depth_end} y1={0} y2={1} fill={FAMILY_META[z.risk_type].color} fillOpacity={0.12} stroke="none" ifOverflow="hidden" />
            ))}
            <ReferenceLine y={0.55} stroke={SEVERITY_STYLE.high.hex} strokeOpacity={0.6} strokeDasharray="4 4" label={{ value: "high", position: "insideTopLeft", fill: CHART.tick, fontSize: 11.5 }} />
            <ReferenceLine y={0.75} stroke={SEVERITY_STYLE.critical.hex} strokeOpacity={0.6} strokeDasharray="4 4" label={{ value: "critical", position: "insideTopLeft", fill: CHART.tick, fontSize: 11.5 }} />
            <ReferenceLine x={depth} stroke={CHART.bit} strokeWidth={2.5} label={{ value: `bit ${fmtDepth(depth)}`, position: "top", fill: "var(--brand-ink)", fontSize: 12, fontWeight: 700 }} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: CHART.cursor, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-[3px] bg-ink px-2.5 py-1.5 text-[12px] text-surface shadow-lg">
                    <div className="font-mono font-semibold">{fmtDepth(p.depth)}</div>
                    <div className="opacity-90">
                      score <span className="font-mono font-semibold">{Math.round(p.score * 100)}</span>
                      {p.risk_type && <> · {FAMILY_META[p.risk_type].label}</>} · {p.severity}
                    </div>
                  </div>
                );
              }}
            />
            <Area dataKey="score" type="monotone" stroke="url(#riskStroke)" strokeWidth={2.5} fill="url(#riskFill)" isAnimationActive animationDuration={1100} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
