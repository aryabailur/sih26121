"use client";

import { Radio, Server } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { WellProfileDrawer } from "@/components/well/WellProfileDrawer";
import { AlertToaster } from "@/components/risk/AlertToaster";
import { WhyExplainer } from "@/components/risk/WhyExplainer";
import { SourceViewer } from "@/components/search/SourceViewer";
import { Loading } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

function ScenarioBanner() {
  const scenario = useNWIS((s) => s.scenario);
  if (!scenario?.narration) return null;
  const n = scenario.plan.steps.length;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[950] -translate-x-1/2">
      <div className="glass-strong pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 text-[12px] text-slate-100 animate-fade-in">
        <Radio size={14} className={scenario.running ? "animate-pulse text-red-400" : "text-slate-500"} />
        <span className="font-mono text-cyan-200">
          {Math.min(scenario.index + 1, n)}/{n}
        </span>
        <span className="max-w-[560px] truncate">{scenario.narration}</span>
      </div>
    </div>
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

export function CommandCenter({ children }: { children: ReactNode }) {
  const init = useNWIS((s) => s.init);
  const ready = useNWIS((s) => s.ready);
  const loadError = useNWIS((s) => s.loadError);

  useEffect(() => {
    void init();
  }, [init]);

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="glass max-w-lg rounded-xl p-6 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold text-red-200">
            <Server size={16} /> NWIS backend not reachable
          </div>
          <p className="text-slate-300">{loadError}</p>
          <pre className="mt-3 rounded bg-black/40 p-3 font-mono text-[12px] text-cyan-200">
{`cd backend
.venv\\Scripts\\activate      # or: source .venv/bin/activate
uvicorn main:app --port 8000`}
          </pre>
          <button onClick={() => { useNWIS.setState({ loadError: null }); void init(); }} className="mt-3 rounded border border-cyan-400/50 px-3 py-1 text-cyan-200 hover:bg-cyan-400/10">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{ready ? children : <Loading label="Loading field knowledge base…" className="h-full" />}</main>
      </div>
      <AlertToaster />
      <WhyExplainer />
      <SourceViewer />
      <WellProfileDrawer />
      <ScenarioBanner />
      <LiveTicker />
    </div>
  );
}
