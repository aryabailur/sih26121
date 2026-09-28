"use client";

import { Activity, MapPinned, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { DepthTimeline } from "@/components/dashboard/DepthTimeline";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { RiskWatch, useRiskStack } from "@/components/dashboard/RiskWatch";
import { FamilyFilter } from "@/components/shared/FilterBar";
import { FieldMap } from "@/components/map";
import { Panel } from "@/components/ui/card";
import { Tabs } from "@/components/ui/misc";
import { useNWIS } from "@/lib/store";

/** Screen A — Operations Command Center. */
export default function CommandCenterPage() {
  const [tab, setTab] = useState<"risk" | "feed">("risk");
  const familyFilter = useNWIS((s) => s.familyFilter);
  const setFamilyFilter = useNWIS((s) => s.setFamilyFilter);
  const radiusKm = useNWIS((s) => s.radiusKm);
  const wells = useNWIS((s) => s.wells);
  const { alertItems, watch } = useRiskStack();
  const inRadius = wells.filter((w) => w.role === "offset" && w.distance_km <= radiusKm);
  const matching = familyFilter.length ? inRadius.filter((w) => w.risk_families.some((f) => familyFilter.includes(f))) : inRadius;

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <KPIStrip />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
        <Panel
          title="Field map"
          icon={<MapPinned size={14} />}
          subtitle={`${inRadius.length} offset wells within ${radiusKm} km${familyFilter.length ? ` · ${matching.length} match the event filter` : ""} · wells glow when they recorded events near the bit depth`}
          bodyClassName="relative p-1.5"
        >
          <div className="absolute right-3 top-3 z-[600] max-w-[70%]">
            <FamilyFilter compact value={familyFilter} onChange={setFamilyFilter} className="glass justify-end rounded-md px-1.5 py-1" />
          </div>
          <FieldMap />
        </Panel>
        <Panel
          title={tab === "risk" ? "Risk watch" : "eRTMAC feed"}
          icon={tab === "risk" ? <ShieldAlert size={14} /> : <Activity size={14} />}
          subtitle={tab === "risk" ? "Alerts & watch items for the look-ahead window — sorted by status and severity" : "Simulated real-time parameters"}
          actions={
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "risk", label: "Risk", count: alertItems.length + watch.length },
                { value: "feed", label: "Feed" },
              ]}
            />
          }
          bodyClassName="overflow-y-auto"
        >
          {tab === "risk" ? <RiskWatch /> : <LiveFeed />}
        </Panel>
      </div>
      <DepthTimeline />
    </div>
  );
}
