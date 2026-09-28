"use client";

import { Pause, Play, RotateCcw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { DemoModeToggle } from "@/components/shared/DemoModeToggle";
import { Button } from "@/components/ui/button";
import { useNWIS } from "@/lib/store";
import { cn, fmtDepth, formationColor, SEVERITY_STYLE } from "@/lib/utils";

function Freshness() {
  const lastUpdated = useNWIS((s) => s.lastUpdated);
  const demoMode = useNWIS((s) => s.demoMode);
  const evalError = useNWIS((s) => s.evalError);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const age = lastUpdated ? Math.round((now - lastUpdated) / 1000) : null;
  const stale = evalError || (!demoMode && age !== null && age > 8);
  return (
    <div className="text-right leading-tight" title={evalError ?? "Time since the last risk evaluation"}>
      <div className="label-caps">Last update</div>
      <div className={cn("font-mono text-[11px] tabular", stale ? "text-amber-300 line-through decoration-amber-500/60" : "text-slate-300")}>
        {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-GB") : "—"} {age !== null && <span className="text-cockpit-dim">({age}s)</span>}
      </div>
    </div>
  );
}

export function TopNav() {
  const well = useNWIS((s) => s.activeWell);
  const depth = useNWIS((s) => s.depth);
  const evaluation = useNWIS((s) => s.evaluation);
  const demoMode = useNWIS((s) => s.demoMode);
  const scenario = useNWIS((s) => s.scenario);
  const runScenario = useNWIS((s) => s.runScenario);
  const stopScenario = useNWIS((s) => s.stopScenario);
  const resetDemo = useNWIS((s) => s.resetDemo);
  const [resetting, setResetting] = useState(false);
  const formation = evaluation?.current_formation;
  const overall = evaluation?.overall_risk_level ?? "low";
  const activeAlerts = evaluation?.active_alerts.filter((a) => a.status === "active").length ?? 0;

  return (
    <header className="glass-strong relative z-[1000] flex h-14 shrink-0 items-center gap-4 whitespace-nowrap border-x-0 border-t-0 px-4">
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-md border border-cyan-400/50 bg-cyan-400/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 2 L7 10 H17 Z" />
            <path d="M9 10 L8 22 M15 10 L16 22 M8.5 16 H15.5" />
            <circle cx="12" cy="6.5" r="1.1" fill="currentColor" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-[0.2em] text-cyan-200">NWIS</div>
          <div className="hidden text-[10px] text-cockpit-muted xl:block">Nearby Wells Intelligence System</div>
        </div>
      </div>

      <div className="h-8 w-px bg-cockpit-line" />

      <label className="leading-tight">
        <div className="label-caps">Active well</div>
        <select className="bg-transparent font-mono text-[13px] font-semibold text-slate-50 outline-none" value={well?.id ?? "W001"} onChange={() => undefined}>
          <option value="W001" className="bg-cockpit-surface">{well?.name ?? "OIL-AX-102"}</option>
        </select>
      </label>
      <div className="leading-tight">
        <div className="label-caps">Bit depth</div>
        <div className="font-mono text-[15px] font-semibold tabular text-cyan-200">{fmtDepth(depth)}</div>
      </div>
      <div className="hidden leading-tight md:block">
        <div className="label-caps">Formation</div>
        <div className="flex items-center gap-1.5 text-[12px] text-slate-100">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: formationColor(formation) }} />
          {formation ?? "—"}
        </div>
      </div>
      <div className="hidden leading-tight 2xl:block">
        <div className="label-caps">Field</div>
        <div className="text-[12px] text-slate-300">{well?.field ?? "—"}</div>
      </div>
      <div className="hidden leading-tight lg:block">
        <div className="label-caps">Risk level</div>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: SEVERITY_STYLE[overall].hex }}>
          <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_STYLE[overall].hex }} />
          {SEVERITY_STYLE[overall].label}
          {activeAlerts > 0 && <span className="rounded bg-red-500/20 px-1 text-[10px] text-red-200">{activeAlerts} alert{activeAlerts > 1 ? "s" : ""}</span>}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {demoMode && (
          <>
            {scenario?.running ? (
              <Button variant="danger" size="sm" onClick={stopScenario}>
                <Pause size={13} /> Pause scenario
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => runScenario("full")} title="Drill through the seeded Barail → Kopili → Sylhet risk windows">
                <Play size={13} /> <span className="2xl:hidden">Run scenario</span><span className="hidden 2xl:inline">Run historical risk scenario</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={resetting}
              onClick={async () => {
                setResetting(true);
                await resetDemo().finally(() => setResetting(false));
              }}
              title="Clear alerts & uploads, return to 3,100 m"
            >
              <RotateCcw size={13} className={cn(resetting && "animate-spin")} /> Reset
            </Button>
          </>
        )}
        <DemoModeToggle />
        <Freshness />
        <div className="hidden items-center gap-1.5 rounded-md border border-cockpit-border px-2 py-1 text-[11px] text-slate-300 2xl:flex" title="Demo role">
          <UserRound size={13} className="text-cyan-300" /> Drilling Engineer
        </div>
      </div>
    </header>
  );
}
