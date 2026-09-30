"use client";

import { Check, ChevronDown, Pause, Play, RotateCcw, Search, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DemoModeToggle } from "@/components/shared/DemoModeToggle";
import { AnimatedNumber } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { ROLE_META, setRole, useRole, type Role } from "@/lib/prefs";
import { useNWIS } from "@/lib/store";
import { cn, fieldName, formationColor, SEVERITY_STYLE } from "@/lib/utils";
import { setVoice, speak, useVoice, voiceSupported } from "@/lib/voice";
import { openCommandPalette } from "./CommandPalette";
import { pageTitle } from "./Sidebar";

function Freshness() {
  const lastUpdated = useNWIS((s) => s.lastUpdated);
  const demoMode = useNWIS((s) => s.demoMode);
  const evalError = useNWIS((s) => s.evalError);
  const evaluating = useNWIS((s) => s.evaluating);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const age = lastUpdated ? Math.max(0, Math.round((now - lastUpdated) / 1000)) : null;
  const stale = Boolean(evalError) || (!demoMode && age !== null && age > 8);
  return (
    <div className="hidden items-center gap-2 text-[12.5px] min-[1800px]:flex" title={evalError ?? "Time since the last risk evaluation"}>
      <span className="relative flex h-2 w-2">
        {!stale && <span className={cn("absolute inset-0 rounded-full bg-low", evaluating ? "animate-ping" : "")} />}
        <span className={cn("relative h-2 w-2 rounded-full", stale ? "bg-med" : "bg-low")} />
      </span>
      <span className={cn("font-medium tabular", stale ? "text-med-ink" : "text-ink-3")}>
        {stale ? "Feed stale" : age === null ? "Connecting…" : age < 2 ? "Updated just now" : `Updated ${age}s ago`}
      </span>
    </div>
  );
}

function RoleMenu() {
  const role = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  const meta = ROLE_META[role];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-[2px] py-1 pl-1 pr-2 transition-colors hover:bg-surface-3" title="Switch role">
        <span className="aurora flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] font-extrabold text-white">{meta.short.slice(0, 2)}</span>
        <span className="hidden text-left leading-tight min-[1800px]:block">
          <span className="block text-[13px] font-bold text-ink">{meta.label}</span>
          <span className="block text-[12px] text-ink-3">Demo session</span>
        </span>
        <ChevronDown size={14} className="text-ink-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[4px] border border-line bg-surface p-1.5 shadow-lg"
          >
            <div className="px-2.5 pb-1 pt-1.5 text-[12.5px] font-semibold text-ink-3">View NWIS as</div>
            {(Object.keys(ROLE_META) as Role[]).map((r) => (
              <Link
                key={r}
                href={ROLE_META[r].home}
                onClick={() => {
                  setRole(r);
                  setOpen(false);
                }}
                className={cn("flex items-start gap-2.5 rounded-[3px] px-2.5 py-2 transition-colors hover:bg-surface-2", r === role && "bg-brand-soft")}
              >
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center">{r === role && <Check size={15} className="text-brand-ink" />}</span>
                <span>
                  <span className="block text-[13.5px] font-bold text-ink">{ROLE_META[r].label}</span>
                  <span className="block text-[12.5px] leading-snug text-ink-3">{ROLE_META[r].blurb}</span>
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScenarioControls() {
  const scenario = useNWIS((s) => s.scenario);
  const runScenario = useNWIS((s) => s.runScenario);
  const stopScenario = useNWIS((s) => s.stopScenario);
  const n = scenario?.plan.steps.length ?? 0;
  const progress = scenario && n ? (scenario.index + 1) / n : 0;

  if (scenario?.running) {
    return (
      <Button variant="danger" size="md" onClick={stopScenario} className="gap-2.5 pl-2.5">
        <span className="relative flex h-6 w-6 items-center justify-center">
          <svg width="24" height="24" className="absolute inset-0 -rotate-90">
            <circle cx="12" cy="12" r="10" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="2.5" />
            <motion.circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" animate={{ pathLength: progress }} transition={{ duration: 0.4 }} />
          </svg>
          <Pause size={11} fill="white" />
        </span>
        Pause scenario
      </Button>
    );
  }
  if (scenario && scenario.index < n - 1) {
    return (
      <div className="flex items-center gap-1.5">
        <Button variant="primary" size="md" onClick={() => runScenario("full")} title="Continue from the paused depth">
          <Play size={14} fill="white" /> Resume
        </Button>
        <Button variant="secondary" size="md" onClick={() => runScenario("full", { fresh: true })} title="Clear alerts and start again at 3,100 m">
          Restart
        </Button>
      </div>
    );
  }
  return (
    <Button variant="aurora" size="md" onClick={() => runScenario("full", { fresh: true })} title="Replay the historical risk scenario: drill 3,100 → 3,600 m through the seeded Barail → Kopili → Sylhet windows">
      <Play size={14} fill="white" /> <span className="2xl:hidden">Run scenario</span>
      <span className="hidden 2xl:inline">Run historical risk scenario</span>
    </Button>
  );
}

function VoiceToggle() {
  const on = useVoice();
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSupported(voiceSupported()), 0);
    return () => clearTimeout(t);
  }, []);
  if (!supported) return null;
  return (
    <Button
      variant={on ? "soft" : "ghost"}
      size="icon"
      onClick={() => {
        setVoice(!on);
        if (!on) speak("Spoken alerts on.", { interrupt: true });
      }}
      title={on ? "Spoken alerts on — click to mute" : "Spoken alerts off — click to hear alerts aloud (hands-free)"}
      aria-label="Toggle spoken alerts"
      aria-pressed={on}
    >
      {on ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </Button>
  );
}

function PaletteButton() {
  return (
    <button
      onClick={openCommandPalette}
      className="flex h-10 items-center gap-2 rounded-[3px] border border-line-2 bg-surface px-2.5 text-[12.5px] font-semibold text-ink-3 shadow-xs transition-colors hover:border-brand/50 hover:text-ink"
      title="Search or jump anywhere (Ctrl K or /)"
      aria-label="Open the command palette"
    >
      <Search size={15} />
      <span className="hidden min-[1700px]:inline">Jump to…</span>
      <span className="rounded-[2px] border border-line-2 bg-surface-2 px-1 font-mono text-[11px] text-ink-3">Ctrl K</span>
    </button>
  );
}

export function TopNav() {
  const path = usePathname();
  const well = useNWIS((s) => s.activeWell);
  const depth = useNWIS((s) => s.depth);
  const evaluation = useNWIS((s) => s.evaluation);
  const demoMode = useNWIS((s) => s.demoMode);
  const resetDemo = useNWIS((s) => s.resetDemo);
  const [resetting, setResetting] = useState(false);
  const formation = evaluation?.current_formation;
  const overall = evaluation?.overall_risk_level ?? "low";
  const activeAlerts = evaluation?.active_alerts.filter((a) => a.status === "active").length ?? 0;
  const sev = SEVERITY_STYLE[overall];

  return (
    <header className="relative z-[1000] flex h-16 shrink-0 items-center gap-5 whitespace-nowrap border-b border-line bg-surface/75 px-5 backdrop-blur-xl print:hidden">
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-ink-3">{fieldName(well?.field)} · Upper Assam</div>
        <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{pageTitle(path)}</h1>
      </div>

      <div className="h-9 w-px bg-line" />

      <div className="flex items-center gap-2.5" title="Active well">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-[3px] bg-brand-soft">
          <span className="absolute inset-0 animate-halo rounded-[3px] border-2 border-brand/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_22%,transparent)]" />
        </span>
        <div className="leading-tight">
          <div className="font-mono text-[14px] font-semibold text-ink">{well?.name ?? "OIL-AX-102"}</div>
          <div className="text-[12.5px] text-ink-3">Drilling · rig {well?.rig ?? "—"}</div>
        </div>
      </div>

      <div className="leading-tight" title="Bit depth (measured depth)">
        <div className="text-[12.5px] font-semibold text-ink-3">Bit depth</div>
        <div className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">
          <AnimatedNumber value={depth} /> <span className="text-[13.5px] font-bold text-ink-3">m</span>
        </div>
      </div>

      <div className="hidden leading-tight min-[1700px]:block">
        <div className="text-[12.5px] font-semibold text-ink-3">Formation</div>
        <div className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
          <span className="h-3 w-3 rounded-[2px]" style={{ background: formationColor(formation) }} />
          {formation ?? "—"}
        </div>
      </div>

      <Link
        href="/dashboard/risk"
        className="group flex items-center gap-2.5 rounded-[2px] py-1.5 pl-1.5 pr-3.5 transition-all hover:brightness-95"
        style={{ background: sev.soft }}
        title="Overall risk at the bit — open the Risk explorer"
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: sev.gradient }}>
          {(overall === "high" || overall === "critical") && <span className="absolute inset-0 animate-halo rounded-full" style={{ border: `2px solid ${sev.hex}` }} />}
          <ShieldCheck size={14} />
        </span>
        <span className="leading-tight">
          <span className="block text-[11.5px] font-semibold" style={{ color: sev.ink }}>Risk level</span>
          <motion.span key={overall} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="block text-[14px] font-extrabold" style={{ color: sev.ink }}>
            {sev.label}
            {activeAlerts > 0 && <span className="ml-1.5 rounded-[2px] bg-crit px-1.5 py-px text-[11.5px] text-white">{activeAlerts} alert{activeAlerts > 1 ? "s" : ""}</span>}
          </motion.span>
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <Freshness />
        <PaletteButton />
        <DemoModeToggle />
        {demoMode && (
          <>
            <ScenarioControls />
            <Button
              variant="ghost"
              size="icon"
              disabled={resetting}
              onClick={async () => {
                setResetting(true);
                await resetDemo().finally(() => setResetting(false));
              }}
              title="Reset demo — clear alerts & uploads, return to 3,100 m"
              aria-label="Reset demo"
            >
              <RotateCcw size={17} className={cn(resetting && "animate-spin")} />
            </Button>
          </>
        )}
        <VoiceToggle />
        <RoleMenu />
      </div>
    </header>
  );
}
