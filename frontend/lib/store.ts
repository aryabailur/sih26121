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
  /** Failed start-up attempts so far while the backend wakes (a free host sleeps when idle); 0 = first try. */
  connectAttempts: number;
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
  runScenario: (kind?: "full" | "mud_loss" | "stuck_pipe" | "kick", opts?: { fresh?: boolean }) => Promise<void>;
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

let depthTimer: ReturnType<typeof setTimeout> | null = null;
let radiusTimer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;
let scenarioRun = 0;
let initRun: Promise<void> | null = null;
const START_TIMEOUT_MS = 180_000;

function clearTimers() {
  if (depthTimer) clearTimeout(depthTimer);
  if (radiusTimer) clearTimeout(radiusTimer);
  depthTimer = radiusTimer = null;
}

export const useNWIS = create<NWISState>((set, get) => ({
  ready: false,
  loadError: null,
  connectAttempts: 0,
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

  init: () => {
    if (get().ready) return Promise.resolve();
    // One start-up loop at a time (Strict Mode runs effects twice; Retry may be pressed mid-loop).
    initRun ??= (async () => {
      const started = Date.now();
      for (let attempt = 0; ; attempt++) {
        try {
          const [active, sim] = await Promise.all([api.activeWell(), api.state()]);
          set({ activeWell: active.well, formations: active.formations, depth: active.current_state.depth, sim, radiusKm: sim.default_radius_km });
          await get().refreshStatic();
          set({ ready: true, loadError: null, connectAttempts: 0 });
          await get().evaluateNow();
          return;
        } catch (e) {
          // A sleeping free host takes ~1 min to wake: keep retrying for up to 3 min before giving up.
          if (Date.now() - started > START_TIMEOUT_MS) {
            set({ loadError: e instanceof Error ? e.message : String(e), connectAttempts: 0 });
            return;
          }
          set({ connectAttempts: attempt + 1 });
          await sleep(Math.min(2000 + attempt * 1500, 8000));
        }
      }
    })().finally(() => {
      initRun = null;
    });
    return initRun;
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
    if (depthTimer) clearTimeout(depthTimer);
    if (opts?.immediate) {
      void get().evaluateNow();
    } else {
      depthTimer = setTimeout(() => void get().evaluateNow(), 140);
    }
  },

  evaluateNow: async () => {
    const { depth, radiusKm, activeWell } = get();
    const my = ++seq;
    set({ evaluating: true });
    try {
      const ev = await api.evaluate({ well_id: activeWell?.id ?? "W001", current_depth: depth, radius_km: radiusKm, persist: true });
      // The server records an alert exactly once, so announce it even if a newer response supersedes this one.
      announceNewAlerts(ev);
      if (my !== seq) return;
      set({ evaluation: ev, evaluating: false, evalError: null, lastUpdated: Date.now() });
    } catch (e) {
      if (my === seq) set({ evaluating: false, evalError: e instanceof Error ? e.message : String(e) });
    }
  },

  setRadius: (r) => {
    set({ radiusKm: r });
    if (radiusTimer) clearTimeout(radiusTimer);
    radiusTimer = setTimeout(async () => {
      radiusTimer = null;
      const profile = await api.profile(r, 10).catch(() => null);
      if (profile && get().radiusKm === r) set({ profile: profile.profile });
      await get().evaluateNow();
    }, 250);
  },

  setDemoMode: (on) => {
    if (!on) get().stopScenario(); // the scenario controls live only in demo mode
    set({ demoMode: on, liveFeed: on ? false : get().liveFeed });
  },
  setLiveFeed: (on) => {
    if (on) get().stopScenario();
    set({ liveFeed: on });
  },

  runScenario: async (kind = "full", opts) => {
    if (get().scenario?.running) return;
    const prev = get().scenario;
    const resume = !opts?.fresh && prev && prev.kind === kind && prev.index < prev.plan.steps.length - 1;
    const run = ++scenarioRun;
    let plan: ScenarioPlan;
    let start: number;
    if (resume && prev) {
      plan = prev.plan;
      start = prev.index + 1;
      set({ scenario: { ...prev, running: true } });
    } else {
      // A fresh run must be reproducible whatever was explored before: clear alerts, default radius.
      clearTimers();
      const defaultRadius = get().sim?.default_radius_km ?? 25;
      await api.clearAlerts().catch(() => null);
      if (get().radiusKm !== defaultRadius) {
        set({ radiusKm: defaultRadius });
        const profile = await api.profile(defaultRadius, 10).catch(() => null);
        if (profile) set({ profile: profile.profile });
      }
      plan = await api.scenario(kind);
      if (run !== scenarioRun) return;
      start = 0;
      set({
        toasts: [],
        flashAlertIds: [],
        scenarioHighlight: [],
        scenario: { running: true, index: 0, plan, narration: plan.steps[0]?.narration ?? null, kind },
      });
    }
    for (let i = start; i < plan.steps.length; i++) {
      if (run !== scenarioRun || !get().scenario?.running) return;
      const step = plan.steps[i];
      set((s) => ({
        scenario: s.scenario ? { ...s.scenario, index: i, narration: step.narration ?? s.scenario.narration } : null,
        scenarioHighlight: step.highlight_wells.length ? step.highlight_wells : s.scenarioHighlight,
      }));
      if (depthTimer) clearTimeout(depthTimer);
      set({ depth: step.depth });
      await get().evaluateNow();
      await sleep(plan.step_delay_ms);
    }
    if (run !== scenarioRun) return;
    set((s) => ({ scenario: s.scenario ? { ...s.scenario, running: false, narration: "Scenario complete — open “Why?” on any alert to see the evidence." } : null }));
  },

  stopScenario: () => {
    scenarioRun++; // any in-flight loop exits at its next step
    set((s) => ({ scenario: s.scenario ? { ...s.scenario, running: false } : null }));
  },

  resetDemo: async () => {
    get().stopScenario();
    clearTimers();
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

/** Toast + flash every alert the server reports as newly raised or escalated in this evaluation. */
function announceNewAlerts(ev: Evaluation) {
  if (!ev.new_alert_ids.length) return;
  const { evaluation, toasts, flashAlertIds, dismissToast } = useNWIS.getState();
  const prevAlerts = evaluation?.active_alerts ?? [];
  const now = Date.now();
  const fresh: Toast[] = ev.new_alert_ids
    .map((id) => ev.active_alerts.find((a) => a.id === id))
    .filter((a): a is Alert => Boolean(a))
    // Keyed by risk zone, not alert id: one toast per risk window even if the alert was re-raised
    // (e.g. another tab cleared alerts on the shared backend).
    .map((a) => ({ id: a.zone_id ?? a.id, alert: a, kind: prevAlerts.some((p) => p.id === a.id) ? "escalated" : "raised", at: now }));
  useNWIS.setState({
    // One toast per risk window — an escalation replaces the earlier toast.
    toasts: [...toasts.filter((t) => !fresh.some((n) => n.id === t.id)), ...fresh].slice(-4),
    flashAlertIds: [...flashAlertIds, ...ev.new_alert_ids],
  });
  const ids = ev.new_alert_ids;
  setTimeout(() => useNWIS.setState((s) => ({ flashAlertIds: s.flashAlertIds.filter((x) => !ids.includes(x)) })), 5200);
  for (const t of fresh)
    setTimeout(() => {
      // Only auto-dismiss if this toast wasn't replaced by a later escalation.
      if (useNWIS.getState().toasts.find((x) => x.id === t.id)?.at === t.at) dismissToast(t.id);
    }, 9000);
}

/** Assessment for a zone — current if still in the evaluation horizon, else the alert snapshot. */
export function findAssessment(zoneId: string) {
  const ev = useNWIS.getState().evaluation;
  return (
    ev?.assessments.find((a) => a.zone_id === zoneId) ??
    ev?.active_alerts.find((a) => a.zone_id === zoneId)?.assessment ??
    null
  );
}
