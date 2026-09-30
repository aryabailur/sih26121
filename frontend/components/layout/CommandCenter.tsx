"use client";

import { Radio, Server } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AlertToaster } from "@/components/risk/AlertToaster";
import { VoiceCallouts } from "@/components/risk/VoiceCallouts";
import { WhyExplainer } from "@/components/risk/WhyExplainer";
import { SourceViewer } from "@/components/search/SourceViewer";
import { WellProfileDrawer } from "@/components/well/WellProfileDrawer";
import { Button } from "@/components/ui/button";
import { useNWIS } from "@/lib/store";
import { cn, FAMILY_META, fmtDepth, SEVERITY_STYLE } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { LogoMark } from "./Logo";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

/** Floating replay dock: step progress with the expected alert beats, plus the live narration. */
function ScenarioDock() {
  const scenario = useNWIS((s) => s.scenario);
  const depth = useNWIS((s) => s.depth);
  const show = Boolean(scenario?.narration);
  const n = scenario?.plan.steps.length ?? 1;
  const index = Math.min((scenario?.index ?? 0) + 1, n);
  const beats = scenario?.plan.alerts_expected ?? [];
  const first = scenario?.plan.steps[0]?.depth ?? 3100;
  const last = scenario?.plan.steps[n - 1]?.depth ?? 3600;
  const at = (d: number) => `${((d - first) / Math.max(1, last - first)) * 100}%`;
  return (
    <AnimatePresence>
      {show && scenario && (
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="pointer-events-none fixed bottom-5 left-[calc(50%+42px)] z-[950] w-[min(680px,calc(100vw-140px))] -translate-x-1/2"
        >
          <div className="glass pointer-events-auto rounded-[4px] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", scenario.running ? "bg-crit text-white" : "bg-surface-3 text-ink-3")}>
                <Radio size={15} className={scenario.running ? "animate-breathe" : ""} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-[12.5px] font-bold text-ink-3">
                  <span className={scenario.running ? "text-crit-ink" : ""}>{scenario.running ? "Replaying historical scenario" : index >= n ? "Scenario complete" : "Scenario paused"}</span>
                  <span className="tabular">
                    step {index}/{n}
                  </span>
                  <span className="ml-auto font-mono text-[12.5px] text-ink">{fmtDepth(depth)}</span>
                </div>
                <motion.div key={scenario.narration} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="truncate text-[13.5px] font-semibold text-ink">
                  {scenario.narration}
                </motion.div>
              </div>
            </div>
            <div className="relative mt-2.5 h-1.5 rounded-[1px] bg-surface-3">
              <motion.div className="aurora absolute inset-y-0 left-0 rounded-[1px]" animate={{ width: `${(index / n) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 22 }} />
              {beats.map((b) => (
                <span
                  key={`${b.risk_type}-${b.depth}`}
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                  style={{ left: at(b.depth), background: SEVERITY_STYLE[b.severity].hex }}
                  title={`${FAMILY_META[b.risk_type].label} alert expected at ${fmtDepth(b.depth)}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** LIVE (simulated) mode: the bit advances like a real eRTMAC stream. */
function LiveTicker() {
  const liveFeed = useNWIS((s) => s.liveFeed);
  const demoMode = useNWIS((s) => s.demoMode);
  useEffect(() => {
    if (!liveFeed || demoMode) return;
    const t = setInterval(() => {
      const s = useNWIS.getState();
      if (s.depth < (s.activeWell?.total_depth_md ?? 3800)) s.setDepth(s.depth + 2, { immediate: true });
    }, 2000);
    return () => clearInterval(t);
  }, [liveFeed, demoMode]);
  return null;
}

function BootScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
        <LogoMark size={72} animated />
      </motion.div>
      <div className="text-center">
        <div className="text-[15px] font-bold text-ink">Loading the field knowledge base</div>
        <div className="mt-1 text-[13px] text-ink-3">Wells · formations · 36 events · 84 report pages</div>
      </div>
      <div className="h-1.5 w-56 overflow-hidden rounded-[1px] bg-surface-3">
        <motion.div className="aurora h-full w-1/2 rounded-[1px]" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
      </div>
    </div>
  );
}

export function CommandCenter({ children }: { children: ReactNode }) {
  const init = useNWIS((s) => s.init);
  const ready = useNWIS((s) => s.ready);
  const loadError = useNWIS((s) => s.loadError);
  const path = usePathname();

  useEffect(() => {
    void init();
  }, [init]);

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card max-w-lg p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-crit-soft text-crit-ink">
              <Server size={20} />
            </span>
            <div>
              <div className="text-[16px] font-extrabold text-ink">NWIS backend not reachable</div>
              <p className="text-[13px] text-ink-3">{loadError}</p>
            </div>
          </div>
          <pre className="mt-4 rounded-[3px] bg-[#0c0e14] p-4 font-mono text-[12.5px] leading-relaxed text-[#c7c3ff]">
            {`cd backend
.venv\\Scripts\\activate      # or: source .venv/bin/activate
uvicorn main:app --port 8000`}
          </pre>
          <Button
            variant="primary"
            size="md"
            className="mt-4"
            onClick={() => {
              useNWIS.setState({ loadError: null });
              void init();
            }}
          >
            Retry connection
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="relative min-h-0 flex-1 overflow-hidden print:overflow-visible">
          {ready ? (
            <motion.div
              key={path}
              className="h-full print:h-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {children}
            </motion.div>
          ) : (
            <BootScreen />
          )}
        </main>
      </div>
      <div className="print:hidden">
        <AlertToaster />
        <WhyExplainer />
        <SourceViewer />
        <WellProfileDrawer />
        <ScenarioDock />
        <CommandPalette />
      </div>
      <LiveTicker />
      <VoiceCallouts />
    </div>
  );
}
