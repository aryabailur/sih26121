"use client";

import { useSyncExternalStore } from "react";

/** Viewer-local preferences (theme, role). Storage can be unavailable — every access is guarded. */
export type Theme = "light" | "dark";
export type Role = "field" | "analyst" | "manager";

export const ROLE_META: Record<Role, { label: string; short: string; home: string; blurb: string }> = {
  field: { label: "Drilling engineer", short: "Field", home: "/dashboard", blurb: "Live depth, look-ahead risk and what offset wells did at this depth." },
  analyst: { label: "Office analyst", short: "Analyst", home: "/dashboard/search", blurb: "Search every report, correlate offsets and curate new evidence." },
  manager: { label: "Drilling manager", short: "Manager", home: "/dashboard/risk", blurb: "Risk exposure along the plan, alert audit and NPT drivers." },
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode — preference lasts for this page only */
  }
}

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  write("nwis-theme", t);
  emit();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}

let roleMemo: Role | null = null;
function getRole(): Role {
  if (roleMemo) return roleMemo;
  const r = read("nwis-role");
  roleMemo = r === "analyst" || r === "manager" ? r : "field";
  return roleMemo;
}

export function setRole(r: Role) {
  roleMemo = r;
  write("nwis-role", r);
  emit();
}

export function useRole(): Role {
  return useSyncExternalStore(subscribe, getRole, () => "field");
}

/** The cinematic globe fly-in plays once per browser session. */
export function introPlayed(): boolean {
  try {
    return window.sessionStorage.getItem("nwis-intro") === "1";
  } catch {
    return true;
  }
}
export function markIntroPlayed() {
  try {
    window.sessionStorage.setItem("nwis-intro", "1");
  } catch {
    /* ignore */
  }
}
