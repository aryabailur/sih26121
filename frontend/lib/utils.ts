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

export const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export const SEVERITY_STYLE: Record<Severity, { text: string; bg: string; border: string; hex: string; label: string }> = {
  critical: { text: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/60", hex: "#ef4444", label: "CRITICAL" },
  high: { text: "text-orange-300", bg: "bg-orange-500/15", border: "border-orange-500/50", hex: "#f97316", label: "HIGH" },
  medium: { text: "text-amber-300", bg: "bg-amber-500/12", border: "border-amber-500/40", hex: "#f59e0b", label: "MEDIUM" },
  low: { text: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/30", hex: "#64748b", label: "LOW" },
};

export const FAMILY_META: Record<RiskFamily, { label: string; short: string; color: string; glyph: string }> = {
  mud_loss: { label: "Mud Loss", short: "LOSS", color: "#38bdf8", glyph: "◈" },
  stuck_pipe: { label: "Stuck Pipe", short: "STUCK", color: "#f97316", glyph: "▣" },
  kick: { label: "Kick / Overpressure", short: "KICK", color: "#ef4444", glyph: "▲" },
  torque_spike: { label: "Torque / Drag", short: "TORQ", color: "#eab308", glyph: "✦" },
  wellbore_instability: { label: "Wellbore Instability", short: "WBI", color: "#a78bfa", glyph: "◆" },
  cementing_failure: { label: "Cementing", short: "CMT", color: "#94a3b8", glyph: "■" },
  NPT: { label: "NPT / Fishing", short: "NPT", color: "#64748b", glyph: "●" },
};

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
  mud_loss: "Mud Loss",
  lost_circulation: "Lost Circulation",
  stuck_pipe: "Stuck Pipe",
  differential_sticking: "Differential Sticking",
  kick: "Kick",
  overpressure: "Overpressure",
  torque_spike: "Torque / Drag",
  wellbore_instability: "Wellbore Instability",
  cementing_failure: "Cementing Failure",
  fishing: "Fishing",
  NPT: "NPT",
};

export const familyOf = (eventType: string): RiskFamily => EVENT_FAMILY[eventType] ?? "NPT";

export const FORMATION_COLORS: Record<string, string> = {
  "Girujan Shale": "#3f4a5c",
  "Tipam Sandstone": "#7a6a3a",
  "Namsang Formation": "#5b6b3f",
  "Barail Group": "#2f5d6e",
  "Kopili Shale": "#4b3b63",
  "Sylhet Limestone": "#2f5f4d",
};

export const formationColor = (name: string | null | undefined) =>
  (name && FORMATION_COLORS[name]) || "#334155";

export const DOC_TYPE_LABEL: Record<string, string> = {
  DDR: "DDR",
  WCR: "WCR",
  mud_log: "Mud Log",
  casing_report: "Casing / Programme",
  cementing_report: "Cementing",
  NPT_report: "NPT Report",
  parameter_log: "Parameter log",
  event: "Event record",
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Categorical series for multi-well charts, fixed order (validated on the dark surface):
 *  slot 0 is always the active well; offsets take slots 1..4 in selection order. */
export const SERIES_COLORS = ["#0fa3c2", "#d95926", "#3987e5", "#c98500", "#d55181"];

export const CHART = {
  grid: "#1a2740",
  axis: "#475569",
  tick: "#64748b",
  text: "#cbd5e1",
  surface: "#0a0e17",
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
