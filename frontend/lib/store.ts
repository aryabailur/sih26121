"use client";

import { create } from "zustand";
import { api } from "./api";
import type {
  Alert,
  DrillingEvent,
  Evaluation,
  Formation,
  RiskFamily,
  RiskProfilePoint,
  RiskZone,
  ScenarioPlan,
  SimState,
  Trajectory,
  WellDetail,
  WellListItem,
} from "./types";
import { sleep } from "./utils";

export interface Toast {
  id: string;
  alert: Alert;
  kind: "raised" | "escalated";
  at: number;
}

export type WhyTarget = { kind: "assessment"; zoneId: string } | { kind: "alert"; alertId: string };

export interface SourceTarget {
  documentId: string;
  page?: number | null;
  highlights?: string[];
}

interface ScenarioState {
  running: boolean;
  index: number;
  plan: ScenarioPlan;
  narration: string | null;
  kind: string;
}

interface NWISState {
  ready: boolean;
  loadError: string | null;
  sim: SimState | null;
  wells: WellListItem[];
  activeWell: WellDetail | null;
  formations: Formation[];
  zones: RiskZone[];
  events: DrillingEvent[];
  trajectories: Record<string, Trajectory[]>;
  profile: RiskProfilePoint[];
  kbVersion: number;

  depth: number;
  radiusKm: number;
  demoMode: boolean;
  liveFeed: boolean;
  evaluation: Evaluation | null;
  evaluating: boolean;
  evalError: string | null;
  lastUpdated: number | null;
  toasts: Toast[];
  flashAlertIds: string[];
  scenarioHighlight: string[];

  selectedWellId: string | null;
  hoverWellId: string | null;
  compareIds: string[];
  familyFilter: RiskFamily[];
  whyTarget: WhyTarget | null;
  source: SourceTarget | null;
  scenario: ScenarioState | null;

  init: () => Promise<void>;
  refreshStatic: () => Promise<void>;
  setDepth: (d: number, opts?: { immediate?: boolean }) => void;
  evaluateNow: () => Promise<void>;
  setRadius: (r: number) => void;
  setDemoMode: (on: boolean) => void;
  setLiveFeed: (on: boolean) => void;
  runScenario: (kind?: "full" | "mud_loss" | "stuck_pipe" | "kick") => Promise<void>;
  stopScenario: () => void;
  resetDemo: () => Promise<void>;
  ackAlert: (id: string, status: Alert["status"], notes?: string) => Promise<void>;
  openWell: (id: string | null) => void;
  setHover: (id: string | null) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setFamilyFilter: (f: RiskFamily[]) => void;
  openWhy: (t: WhyTarget | null) => void;
  openSource: (s: SourceTarget | null) => void;
  dismissToast: (id: string) => void;
}

let debounce: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

export const useNWIS = create<NWISState>((set, get) => ({
  ready: false,
  loadError: null,
  sim: null,
  wells: [],
  activeWell: null,
  formations: [],
  zones: [],
  events: [],
  trajectories: {},
  profile: [],
  kbVersion: 0,

  depth: 3100,
  radiusKm: 25,
  demoMode: true,
  liveFeed: false,
  evaluation: null,
  evaluating: false,
  evalError: null,
  lastUpdated: null,
  toasts: [],
  flashAlertIds: [],
  scenarioHighlight: [],

  selectedWellId: null,
  hoverWellId: null,
  compareIds: [],
  familyFilter: [],
  whyTarget: null,
  source: null,
  scenario: null,

  init: async () => {
    if (get().ready) return;
    try {
      const [active, sim] = await Promise.all([api.activeWell(), api.state()]);
      set({ activeWell: active.well, formations: active.formations, depth: active.current_state.depth, sim, radiusKm: sim.default_radius_km });
      await get().refreshStatic();
      set({ ready: true, loadError: null });
      await get().evaluateNow();
    } catch (e) {
      set({ loadError: e instanceof Error ? e.message : String(e) });
    }
  },

  refreshStatic: async () => {
    const r = get().radiusKm;
    const [wells, zones, events, traj, profile, sim] = await Promise.all([
      api.wells(),
      api.zones(),
      api.events(),
      api.trajectories(),
      api.profile(r, 10),
      api.state(),
    ]);
    set((s) => ({
      wells: wells.wells,
      zones: zones.zones,
      events: events.events,
      trajectories: traj.trajectories,
      profile: profile.profile,
      sim,
      kbVersion: s.kbVersion + 1,
    }));
  },

  setDepth: (d, opts) => {
    const max = get().activeWell?.total_depth_md ?? 3800;
    const depth = Math.max(0, Math.min(max, Math.round(d)));
    set({ depth });
    if (debounce) clearTimeout(debounce);
    if (opts?.immediate) {
      void get().evaluateNow();
    } else {
      debounce = setTimeout(() => void get().evaluateNow(), 140);
    }
  },

  evaluateNow: async () => {
    const { depth, radiusKm, activeWell } = get();
    const my = ++seq;
    set({ evaluating: true });
    try {
      const ev = await api.evaluate({ well_id: activeWell?.id ?? "W001", current_depth: depth, radius_km: radiusKm, persist: true });
      if (my !== seq) return;
      const prevAlerts = get().evaluation?.active_alerts ?? [];
      const newToasts: Toast[] = ev.new_alert_ids
        .map((id) => ev.active_alerts.find((a) => a.id === id))
        .filter((a): a is Alert => Boolean(a))
        .map((a) => ({
          id: a.id, // one toast per alert — an escalation replaces the earlier toast
          alert: a,
          kind: prevAlerts.some((p) => p.id === a.id) ? "escalated" : "raised",
          at: Date.now(),
        }));
      set((s) => ({
        evaluation: ev,
        evaluating: false,
        evalError: null,
        lastUpdated: Date.now(),
        toasts: [...s.toasts.filter((t) => !newToasts.some((n) => n.id === t.id)), ...newToasts].slice(-4),
        flashAlertIds: [...s.flashAlertIds, ...ev.new_alert_ids],
      }));
      if (ev.new_alert_ids.length) {
        const ids = ev.new_alert_ids;
        setTimeout(() => set((s) => ({ flashAlertIds: s.flashAlertIds.filter((x) => !ids.includes(x)) })), 5200);
        for (const t of newToasts)
          setTimeout(() => {
            // Only auto-dismiss if this toast wasn't replaced by a later escalation.
            if (get().toasts.find((x) => x.id === t.id)?.at === t.at) get().dismissToast(t.id);
          }, 9000);
      }
    } catch (e) {
      if (my === seq) set({ evaluating: false, evalError: e instanceof Error ? e.message : String(e) });
    }
  },

  setRadius: (r) => {
    set({ radiusKm: r });
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const profile = await api.profile(r, 10).catch(() => null);
      if (profile) set({ profile: profile.profile });
      await get().evaluateNow();
    }, 250);
  },

  setDemoMode: (on) => set({ demoMode: on, liveFeed: on ? false : get().liveFeed }),
  setLiveFeed: (on) => set({ liveFeed: on }),

  runScenario: async (kind = "full") => {
    if (get().scenario?.running) return;
    const plan = await api.scenario(kind);
    set({ scenario: { running: true, index: 0, plan, narration: plan.steps[0]?.narration ?? null, kind }, scenarioHighlight: [] });
    for (let i = 0; i < plan.steps.length; i++) {
      const st = get().scenario;
      if (!st?.running) return;
      const step = plan.steps[i];
      set((s) => ({
        scenario: s.scenario ? { ...s.scenario, index: i, narration: step.narration ?? s.scenario.narration } : null,
        scenarioHighlight: step.highlight_wells.length ? step.highlight_wells : s.scenarioHighlight,
      }));
      if (debounce) clearTimeout(debounce);
      set({ depth: step.depth });
      await get().evaluateNow();
      await sleep(plan.step_delay_ms);
    }
    set((s) => ({ scenario: s.scenario ? { ...s.scenario, running: false, narration: "Scenario complete — open “Why?” on any alert to see the evidence." } : null }));
  },

  stopScenario: () => set((s) => ({ scenario: s.scenario ? { ...s.scenario, running: false } : null })),

  resetDemo: async () => {
    get().stopScenario();
    await api.reset();
    set({
      depth: get().sim?.default_depth ?? 3100,
      radiusKm: get().sim?.default_radius_km ?? 25,
      evaluation: null,
      toasts: [],
      flashAlertIds: [],
      scenario: null,
      scenarioHighlight: [],
      whyTarget: null,
      familyFilter: [],
      compareIds: [],
    });
    await get().refreshStatic();
    await get().evaluateNow();
  },

  ackAlert: async (id, status, notes) => {
    await api.acknowledge(id, status, notes);
    await get().evaluateNow();
  },

  openWell: (id) => set({ selectedWellId: id }),
  setHover: (id) => set({ hoverWellId: id }),
  toggleCompare: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id) ? s.compareIds.filter((x) => x !== id) : [...s.compareIds, id].slice(-4),
    })),
  clearCompare: () => set({ compareIds: [] }),
  setFamilyFilter: (f) => set({ familyFilter: f }),
  openWhy: (t) => set({ whyTarget: t }),
  openSource: (s) => set({ source: s }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Assessment for a zone — current if still in the evaluation horizon, else the alert snapshot. */
export function findAssessment(zoneId: string) {
  const ev = useNWIS.getState().evaluation;
  return (
    ev?.assessments.find((a) => a.zone_id === zoneId) ??
    ev?.active_alerts.find((a) => a.zone_id === zoneId)?.assessment ??
    null
  );
}
