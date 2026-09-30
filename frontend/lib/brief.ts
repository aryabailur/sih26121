import type { LookAheadBrief } from "./types";
import { fmtDate, fmtDepth, fmtRange, SEVERITY_STYLE } from "./utils";

/** Rig spread rate (₹ lakh per day) used to price NPT hours — an editable assumption, see docs/ASSUMPTIONS.md. */
export const DEFAULT_RIG_RATE_LAKH = 30;

export const nptCostLakh = (hours: number, rateLakhPerDay: number) => (hours / 24) * rateLakhPerDay;

/** ₹ in Indian units: lakh below one crore, crore above. */
export function fmtINR(lakh: number) {
  if (!Number.isFinite(lakh)) return "—";
  if (lakh >= 100) return `₹${(lakh / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
  return `₹${lakh.toLocaleString("en-IN", { maximumFractionDigits: lakh < 10 ? 1 : 0 })} lakh`;
}

export function shiftOf(d = new Date()) {
  const h = d.getHours();
  return h >= 6 && h < 18 ? "Day shift (06:00–18:00)" : "Night shift (18:00–06:00)";
}

export const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  return `${fmtDate(iso)} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Plain-text brief for WhatsApp / e-mail / the shift log. Every line keeps its source. */
export function briefText(b: LookAheadBrief, rateLakh: number) {
  const lines = [
    `NWIS look-ahead brief — ${b.well.name} · ${fmtDepth(b.window.start)} → ${fmtDepth(b.window.end)} MD`,
    `${shiftOf()} · generated ${fmtStamp(b.generated_at)} · ${b.offsets_in_radius} offsets within ${b.radius_km} km`,
    "",
    b.headline,
  ];
  b.hazards.forEach((h, i) => {
    lines.push(
      "",
      `${i + 1}) ${h.risk_label} ${fmtRange(h.window.start, h.window.end)} (${h.formation}) — ${h.position === "inside" ? "bit inside" : `in ${fmtDepth(h.distance_m)}`} · projected ${SEVERITY_STYLE[h.projected.severity].label.toUpperCase()} · ${h.offsets_hit}/${h.offsets_reached} offsets · expected NPT ${h.npt.expected} h`,
    );
    const w = h.what_worked[0];
    if (w) lines.push(`   What worked: ${w.well_name} — ${w.text} (${w.npt_hours} h NPT)${w.document_title ? ` [${w.document_title}${w.page ? ` p.${w.page}` : ""}]` : ""}`);
    if (h.mud_window?.note) lines.push(`   Mud window: ${h.mud_window.note}`);
    for (const br of h.breaches) lines.push(`   ⚠ ${br.message} (${fmtRange(br.start, br.end)})`);
    h.checks.slice(0, 3).forEach((c) => lines.push(`   ☐ ${c}`));
  });
  lines.push(
    "",
    `NPT exposure: expected ${b.npt.expected_hours} h (≈ ${fmtINR(nptCostLakh(b.npt.expected_hours, rateLakh))}), worst case ${b.npt.worst_case_hours} h (≈ ${fmtINR(nptCostLakh(b.npt.worst_case_hours, rateLakh))}) at ₹${rateLakh} lakh/day.`,
  );
  if (b.sources.length) lines.push(`Sources: ${b.sources.map((s) => `${s.title} p.${s.pages.join(",")}`).join("; ")}`);
  return lines.join("\n");
}

/** Short spoken version. */
export function briefSpeech(b: LookAheadBrief) {
  const parts = [`Look-ahead brief for ${b.well.name}, next ${Math.round(b.window.end - b.window.start)} metres.`];
  if (!b.hazards.length) parts.push("No offset hazard windows recorded in this interval.");
  for (const h of b.hazards) {
    const w = h.what_worked[0];
    parts.push(
      `${h.risk_label} from ${Math.round(h.window.start)} metres, ${h.position === "inside" ? "the bit is inside it" : `${Math.round(h.distance_m)} metres ahead`}. ${h.offsets_hit} of ${h.offsets_reached} offsets saw it.` +
        (w ? ` What worked fastest: ${w.text}` : ""),
    );
  }
  return parts.join(" ");
}
