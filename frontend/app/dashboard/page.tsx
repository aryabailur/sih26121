"use client";

import { Activity, Radar } from "lucide-react";
import { useState } from "react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { RiskWatch, useRiskStack } from "@/components/dashboard/RiskWatch";
import { StatusHero } from "@/components/dashboard/StatusHero";
import { WellboreNavigator } from "@/components/dashboard/WellboreNavigator";
import { FamilyFilter } from "@/components/shared/FilterBar";
import { FieldMap } from "@/components/map";
import { Panel } from "@/components/ui/card";
import { Tabs } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";

/** Screen A — Operations command center: wellbore · live parameters · 3D field map · risk radar. */
export default function CommandCenterPage() {
  const [tab, setTab] = useState<"risk" | "feed">("risk");
  const familyFilter = useNWIS((s) => s.familyFilter);
  const setFamilyFilter = useNWIS((s) => s.setFamilyFilter);
  const { alertItems, watch } = useRiskStack();

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[212px_minmax(0,1fr)_372px] xl:overflow-hidden 2xl:grid-cols-[236px_minmax(0,1fr)_396px]">
      <WellboreNavigator className="min-h-[640px] xl:min-h-0" />

      <div className="flex min-h-[640px] flex-col gap-3 xl:min-h-0">
        <KPIStrip />
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[4px] border border-line shadow-md">
          <FieldMap overlay={<FamilyFilter compact dense value={familyFilter} onChange={setFamilyFilter} className="justify-end" />} />
        </div>
      </div>

      <div className="flex min-h-[640px] flex-col gap-3 xl:min-h-0">
        <StatusHero />
        <Panel
          title={tab === "risk" ? "Risk radar" : "eRTMAC feed"}
          icon={tab === "risk" ? <Radar size={16} /> : <Activity size={16} />}
          subtitle={tab === "risk" ? "Look-ahead windows from offset history" : "Simulated real-time parameters"}
          className="min-h-0 flex-1"
          actions={
            <Tabs
              size="xs"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "risk", label: "Risks", count: alertItems.length + watch.length },
                { value: "feed", label: "Feed" },
              ]}
            />
          }
          bodyClassName="overflow-y-auto"
        >
          {tab === "risk" ? <RiskWatch /> : <LiveFeed />}
        </Panel>
      </div>
    </div>
  );
}
