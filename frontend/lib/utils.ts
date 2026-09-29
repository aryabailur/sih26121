import clsx, { type ClassValue } from "clsx";
import type { RiskFamily, Severity } from "./types";

export const cn = (...v: ClassValue[]) => clsx(v);

export const fmtDepth = (d: number | null | undefined, unit = true) =>
  d === null || d === undefined || Number.isNaN(d) ? "—" : `${Math.round(d).toLocaleString("en-IN")}${unit ? " m" : ""}`;

export const fmtRange = (a: number | null | undefined, b: number | null | undefined) => {
  if (a === null || a === undefined) return "—";
  if (b === null || b === undefined || Math.abs(b - a) < 1) return fmtDepth(a);
  return `${Math.round(a).toLocaleString("en-IN")}–${Math.round(b).toLocaleString("en-IN")} m`;
};

export const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Translucent version of any colour (hex or CSS variable) — works in both themes. */
export const alpha = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

export const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** `hex` is the status colour (fills, markers, map layers); `ink` is the theme-aware text shade;
 *  `deep` is text on a white chip in either theme (≥5:1). */
export const SEVERITY_STYLE: Record<Severity, { hex: string; ink: string; deep: string; soft: string; label: string; gradient: string }> = {
  critical: { hex: "#d92d32", ink: "var(--crit-ink)", deep: "#b91c1f", soft: "var(--crit-soft)", label: "Critical", gradient: "linear-gradient(135deg,#d62f36 0%,#bd1f2f 50%,#8f1236 100%)" },
  high: { hex: "#f76b15", ink: "var(--high-ink)", deep: "#b93e0b", soft: "var(--high-soft)", label: "High", gradient: "linear-gradient(135deg,#cf4a12 0%,#b73c10 50%,#912a12 100%)" },
  medium: { hex: "#f2a60c", ink: "var(--med-ink)", deep: "#93530a", soft: "var(--med-soft)", label: "Medium", gradient: "linear-gradient(135deg,#b35f06 0%,#9a4f08 50%,#7c3d0a 100%)" },
  low: { hex: "#12a679", ink: "var(--low-ink)", deep: "#0b7a58", soft: "var(--low-soft)", label: "Low", gradient: "linear-gradient(135deg,#0d8261 0%,#0b715c 50%,#0a5c5e 100%)" },
};

/** Risk-family identity. Icons live in components/shared/FamilyIcon.tsx. */
export const FAMILY_META: Record<RiskFamily, { label: string; short: string; color: string; verb: string }> = {
  mud_loss: { label: "Mud loss", short: "Losses", color: "#0ea5e9", verb: "losses" },
  stuck_pipe: { label: "Stuck pipe", short: "Stuck pipe", color: "#d946ef", verb: "stuck pipe" },
  kick: { label: "Kick / overpressure", short: "Kick", color: "#ef4444", verb: "a kick" },
  torque_spike: { label: "Torque / drag", short: "Torque", color: "#eab308", verb: "torque spikes" },
  wellbore_instability: { label: "Wellbore instability", short: "Instability", color: "#14b8a6", verb: "instability" },
  cementing_failure: { label: "Cementing", short: "Cement", color: "#64748b", verb: "cementing issues" },
  NPT: { label: "NPT / fishing", short: "NPT", color: "#8b93a7", verb: "NPT" },
};

export const FAMILY_ORDER: RiskFamily[] = ["mud_loss", "stuck_pipe", "kick", "torque_spike", "wellbore_instability", "cementing_failure", "NPT"];

export const EVENT_FAMILY: Record<string, RiskFamily> = {
  mud_loss: "mud_loss",
  lost_circulation: "mud_loss",
  stuck_pipe: "stuck_pipe",
  differential_sticking: "stuck_pipe",
  kick: "kick",
  overpressure: "kick",
  torque_spike: "torque_spike",
  wellbore_instability: "wellbore_instability",
  cementing_failure: "cementing_failure",
  fishing: "NPT",
  NPT: "NPT",
};

export const EVENT_LABELS: Record<string, string> = {
  mud_loss: "Mud loss",
  lost_circulation: "Lost circulation",
  stuck_pipe: "Stuck pipe",
  differential_sticking: "Differential sticking",
  kick: "Kick",
  overpressure: "Overpressure",
  torque_spike: "Torque / drag",
  wellbore_instability: "Wellbore instability",
  cementing_failure: "Cementing failure",
  fishing: "Fishing",
  NPT: "NPT",
};

export const familyOf = (eventType: string): RiskFamily => EVENT_FAMILY[eventType] ?? "NPT";

/** Strata palette — geological hues pushed to be legible as bands in both themes. */
export const FORMATION_COLORS: Record<string, string> = {
  "Girujan Shale": "#7b86a3",
  "Tipam Sandstone": "#e2a13b",
  "Namsang Formation": "#8fb34e",
  "Barail Group": "#2f9fc2",
  "Kopili Shale": "#8d68d6",
  "Sylhet Limestone": "#1fae86",
};

export const formationColor = (name: string | null | undefined) => (name && FORMATION_COLORS[name]) || "#94a3b8";

export const FORMATION_ORDER = ["Girujan Shale", "Tipam Sandstone", "Namsang Formation", "Barail Group", "Kopili Shale", "Sylhet Limestone"];

export const DOC_TYPE_LABEL: Record<string, string> = {
  DDR: "DDR",
  WCR: "WCR",
  mud_log: "Mud log",
  casing_report: "Casing / programme",
  cementing_report: "Cementing",
  NPT_report: "NPT report",
  parameter_log: "Parameter log",
  event: "Event record",
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Field name for display — the demo dataset is disclosed once (welcome, rail chip, report stamp), not on every label. */
export const fieldName = (f: string | null | undefined) => (f ?? "Dikhow East").replace(" (Demo Field)", "");

/** Categorical series for multi-well charts, fixed order, legible on light and dark surfaces:
 *  slot 0 is always the active well (brand indigo); offsets take slots 1..4 in selection order. */
export const SERIES_COLORS = ["#5b4bff", "#f2542d", "#0ea5e9", "#d4912a", "#d946ef"];

/** Chart chrome as CSS variables so Recharts follows the theme. */
export const CHART = {
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  tick: "var(--chart-tick)",
  cursor: "var(--chart-cursor)",
  surface: "var(--surface)",
  bit: "var(--brand)",
};

/** Split text into segments marking highlight terms (case-insensitive). */
export function highlightSegments(text: string, terms: string[]): { t: string; hl: boolean }[] {
  const clean = terms.filter((t) => t && t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!clean.length) return [{ t: text, hl: false }];
  const re = new RegExp(`(${clean.join("|")})`, "gi");
  // With a capturing group, split() puts matches at odd indices.
  return text
    .split(re)
    .map((t, i) => ({ t, hl: i % 2 === 1 }))
    .filter((p) => p.t);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
