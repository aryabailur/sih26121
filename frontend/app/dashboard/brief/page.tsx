"use client";

import { Check, ClipboardCopy, ClipboardList, FileText, Layers3, PartyPopper, Printer, ShieldCheck, Square, Timer, Volume2, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HazardSection } from "@/components/brief/HazardSection";
import { IntervalStrip } from "@/components/brief/IntervalStrip";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { AnimatedNumber } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { ErrorState, inputCls, Skeleton, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { briefSpeech, briefText, DEFAULT_RIG_RATE_LAKH, fmtINR, fmtStamp, nptCostLakh, shiftOf } from "@/lib/brief";
import { getTheme, ROLE_META, setTheme, useRole } from "@/lib/prefs";
import { useNWIS } from "@/lib/store";
import type { LookAheadBrief } from "@/lib/types";
import { cn, fieldName, fmtDepth, fmtNum, fmtRange, formationColor } from "@/lib/utils";
import { speak, stopSpeaking, voiceSupported } from "@/lib/voice";

type Horizon = "150" | "300" | "500" | "td";
const RATE_KEY = "nwis-rig-rate";
const CHECK_KEY = "nwis-brief-checks";
const SIGN_KEY = "nwis-brief-signoff";

function load<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable — kept for this page only */
  }
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 rounded-[3px] border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink-3">
        <span style={tone ? { color: tone } : undefined}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 truncate text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{value}</div>
      {sub && <div className="truncate text-[12.5px] text-ink-3 print:whitespace-normal">{sub}</div>}
    </div>
  );
}

/** Screen — Look-ahead brief: the next N metres as a citable handover / DWOP document. */
export default function BriefPage() {
  const depth = useNWIS((s) => s.depth);
  const radiusKm = useNWIS((s) => s.radiusKm);
  const well = useNWIS((s) => s.activeWell);
  const role = useRole();
  const [horizon, setHorizon] = useState<Horizon>("300");
  const [brief, setBrief] = useState<LookAheadBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(() => (typeof window === "undefined" ? DEFAULT_RIG_RATE_LAKH : load(RATE_KEY, DEFAULT_RIG_RATE_LAKH)));
  const [checks, setChecks] = useState<Record<string, number[]>>(() => (typeof window === "undefined" ? {} : load(CHECK_KEY, {})));
  const [sign, setSign] = useState<Record<string, string>>(() => (typeof window === "undefined" ? {} : load(SIGN_KEY, {})));
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const td = well?.total_depth_md ?? 3800;
  const horizonM = horizon === "td" ? Math.max(50, td - depth) : Number(horizon);

  const fetchBrief = useCallback(async () => {
    try {
      const b = await api.brief(depth, Math.min(1500, horizonM), radiusKm, well?.id ?? "W001");
      setBrief(b);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [depth, horizonM, radiusKm, well]);

  useEffect(() => {
    const t = setTimeout(() => void fetchBrief(), 220);
    return () => clearTimeout(t);
  }, [fetchBrief]);

  useEffect(() => () => stopSpeaking(), []);

  const toggleCheck = (zone: string, i: number) =>
    setChecks((c) => {
      const cur = new Set(c[zone] ?? []);
      if (cur.has(i)) cur.delete(i);
      else cur.add(i);
      const next = { ...c, [zone]: [...cur] };
      save(CHECK_KEY, next);
      return next;
    });

  const totals = useMemo(() => {
    if (!brief) return null;
    const pages = brief.sources.reduce((n, s) => n + s.pages.length, 0);
    const checksTotal = brief.hazards.reduce((n, h) => n + h.checks.length, 0);
    const checksDone = brief.hazards.reduce((n, h) => n + (checks[h.zone_id]?.filter((i) => i < h.checks.length).length ?? 0), 0);
    return { pages, checksTotal, checksDone, alertGrade: brief.hazards.filter((h) => h.projected.alert_eligible).length };
  }, [brief, checks]);

  const print = () => {
    // Print on paper colours whatever the screen theme.
    const prev = getTheme();
    if (prev === "dark") {
      setTheme("light");
      window.addEventListener("afterprint", () => setTheme("dark"), { once: true });
    }
    setTimeout(() => window.print(), 60);
  };

  const copy = async () => {
    if (!brief) return;
    const text = briefText(brief, rate);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const readAloud = () => {
    if (!brief) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    speak(briefSpeech(brief), { interrupt: true, rate: 1 });
    setSpeaking(true);
    const poll = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        clearInterval(poll);
      }
    }, 500);
  };

  return (
    <div className="h-full overflow-y-auto print:h-auto print:overflow-visible">
      {/* toolbar */}
      <div className="sticky top-0 z-20 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2.5">
          <div className="mr-auto">
            <div className="text-[15px] font-extrabold text-ink">Look-ahead brief</div>
            <div className="text-[12.5px] text-ink-3">Shift handover · drill-the-well-on-paper</div>
          </div>
          <Tabs
            size="sm"
            value={horizon}
            onChange={setHorizon}
            tabs={[
              { value: "150", label: "150 m" },
              { value: "300", label: "300 m" },
              { value: "500", label: "500 m" },
              { value: "td", label: "To TD" },
            ]}
          />
          <label className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-ink-3" title="Rig spread rate used to price NPT hours (assumption — edit to your contract rate)">
            Rig ₹
            <input
              type="number"
              min={1}
              max={500}
              value={rate}
              onChange={(e) => {
                const v = Math.max(1, Math.min(500, Number(e.target.value) || DEFAULT_RIG_RATE_LAKH));
                setRate(v);
                save(RATE_KEY, v);
              }}
              className={cn(inputCls, "h-8 w-[58px] px-2 text-right font-mono")}
            />
            lakh/day
          </label>
          <Button variant="secondary" size="sm" onClick={copy} disabled={!brief} title="Copy as text for WhatsApp, e-mail or the shift log">
            {copied ? <Check size={14} /> : <ClipboardCopy size={14} />} {copied ? "Copied" : "Copy text"}
          </Button>
          {voiceSupported() && (
            <Button variant="secondary" size="sm" onClick={readAloud} disabled={!brief} title="Read the brief aloud">
              {speaking ? <Square size={13} /> : <Volume2 size={14} />} {speaking ? "Stop" : "Read aloud"}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={print} disabled={!brief} title="Print or save as PDF">
            <Printer size={14} /> Print / PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] p-4 print:max-w-none print:p-0">
        {error && !brief && <ErrorState message={error} onRetry={() => void fetchBrief()} className="card" />}
        {!brief && !error && (
          <div className="card space-y-4 p-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {brief && totals && (
          <motion.article key={horizon} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card space-y-5 bg-surface p-6 print:border-0 print:p-0 print:shadow-none">
            {/* document header */}
            <header className="flex flex-wrap items-start gap-4 border-b border-line pb-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[3px] bg-brand text-white">
                <ClipboardList size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-ink-3">
                  {fieldName(brief.well.field)} · {brief.well.rig} · {shiftOf()}
                </div>
                <h2 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
                  {brief.well.name}: {fmtDepth(brief.window.start)} → {fmtDepth(brief.window.end)} MD
                </h2>
                <div className="mt-0.5 text-[13px] text-ink-3">
                  Generated {fmtStamp(brief.generated_at)} for the {ROLE_META[role].label.toLowerCase()} · bit in{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
                    <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: formationColor(brief.current_formation) }} />
                    {brief.current_formation}
                  </span>{" "}
                  · {brief.offsets_in_radius} offsets within {brief.radius_km} km
                </div>
              </div>
              <div className="text-right text-[12.5px] text-ink-3">
                <div className="font-bold text-ink-2">Checklist</div>
                <div className="text-[20px] font-extrabold tabular text-ink">
                  {totals.checksDone}/{totals.checksTotal}
                </div>
              </div>
            </header>

            <p className="text-[16px] font-semibold leading-relaxed text-ink">{brief.headline}</p>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi icon={<ShieldCheck size={14} />} label="Hazard windows" value={<AnimatedNumber value={brief.hazards.length} />} sub={`${totals.alertGrade} alert-grade on history alone`} />
              <Kpi
                icon={<Timer size={14} />}
                label="Expected NPT"
                tone="var(--high)"
                value={
                  <>
                    <AnimatedNumber value={brief.npt.expected_hours} format={(v) => v.toFixed(1)} /> h
                  </>
                }
                sub={`≈ ${fmtINR(nptCostLakh(brief.npt.expected_hours, rate))} · likelihood-weighted`}
              />
              <Kpi
                icon={<Wallet size={14} />}
                label="Worst case"
                tone="var(--crit)"
                value={
                  <>
                    <AnimatedNumber value={brief.npt.worst_case_hours} format={(v) => v.toFixed(0)} /> h
                  </>
                }
                sub={`≈ ${fmtINR(nptCostLakh(brief.npt.worst_case_hours, rate))} if every window repeats`}
              />
              <Kpi icon={<FileText size={14} />} label="Evidence" value={`${brief.sources.length} reports`} sub={`${totals.pages} cited pages · ${brief.hazards.reduce((n, h) => n + h.evidence.length, 0)} events`} />
            </div>

            {/* interval */}
            <section className="rounded-[3px] border border-line p-4 break-inside-avoid">
              <div className="mb-3 flex items-center gap-2 text-[13.5px] font-extrabold text-ink">
                <Layers3 size={15} className="text-ink-3" /> The interval ahead
              </div>
              <IntervalStrip brief={brief} />
            </section>

            {/* hazards */}
            {brief.hazards.length ? (
              <div className="space-y-4">
                {brief.hazards.map((h, i) => (
                  <HazardSection key={h.zone_id} h={h} index={i} rateLakh={rate} checked={new Set(checks[h.zone_id] ?? [])} onCheck={(k) => toggleCheck(h.zone_id, k)} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-[4px] border border-line bg-low-soft p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-low text-white">
                  <PartyPopper size={22} />
                </span>
                <div>
                  <div className="text-[16px] font-extrabold text-ink">Clear interval</div>
                  <p className="text-[13px] text-ink-2">No offset well within {brief.radius_km} km recorded a hazard between these depths. Keep standard practice and watch the live parameters.</p>
                </div>
              </div>
            )}

            {/* formations + casing */}
            <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] break-inside-avoid">
              <div className="rounded-[3px] border border-line">
                <div className="border-b border-line px-4 py-2.5 text-[13.5px] font-extrabold text-ink">Formations in the interval</div>
                <table className="w-full text-left text-[13px]">
                  <thead className="text-[12px] text-ink-3">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Formation</th>
                      <th className="px-2 py-2 font-semibold">Top–base (m MD)</th>
                      <th className="px-2 py-2 font-semibold">Lithology</th>
                      <th className="px-2 py-2 font-semibold">Pore / frac (sg)</th>
                      <th className="px-2 py-2 font-semibold">Plan MW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brief.formations.map((f) => (
                      <tr key={f.name} className="border-t border-line">
                        <td className="px-4 py-2 font-semibold text-ink">
                          <span className="mr-2 inline-block h-3 w-3 rounded-[2px] align-[-2px]" style={{ background: formationColor(f.name) }} />
                          {f.name}
                          {f.enters_in_window && <span className="ml-2 rounded-[2px] bg-brand-soft px-1.5 py-px text-[11.5px] font-bold text-brand-ink">top ahead</span>}
                        </td>
                        <td className="px-2 py-2 font-mono text-[12.5px] text-ink-2">{fmtRange(f.top_md, f.base_md)}</td>
                        <td className="px-2 py-2 text-ink-2">{f.lithology}</td>
                        <td className="px-2 py-2 font-mono text-[12.5px] text-ink-2">
                          {fmtNum(f.pore_pressure_sg, 2)} / {fmtNum(f.frac_gradient_sg, 2)}
                        </td>
                        <td className="px-2 py-2 font-mono text-[12.5px] text-ink-2">{fmtNum(f.mw_plan, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-[3px] border border-line">
                <div className="border-b border-line px-4 py-2.5 text-[13.5px] font-extrabold text-ink">Casing programme</div>
                <ul className="px-4 py-2 text-[13px]">
                  {brief.casing.map((c) => (
                    <li key={c.name} className={cn("flex items-center gap-2 py-1", c.in_window ? "font-bold text-ink" : "text-ink-3")}>
                      <span className="w-14 font-mono text-[12.5px]">{c.size}</span>
                      <span className="flex-1 capitalize">{c.name}</span>
                      <span className="font-mono text-[12.5px]">{fmtDepth(c.shoe_md)}</span>
                      {c.planned && <span className="rounded-[2px] bg-surface-3 px-1.5 text-[11px] font-bold text-ink-2">plan</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* sources */}
            {brief.sources.length > 0 && (
              <section className="break-inside-avoid">
                <div className="mb-2 text-[13.5px] font-extrabold text-ink">Sources cited</div>
                <div className="flex flex-wrap gap-2">
                  {brief.sources.map((s) => (
                    <SourceCitation key={s.document_id} documentId={s.document_id} title={s.title} page={s.pages[0]} />
                  ))}
                </div>
              </section>
            )}

            {/* sign-off */}
            <section className="grid gap-3 border-t border-line pt-4 md:grid-cols-3 break-inside-avoid">
              {[
                ["out", "Outgoing driller / shift"],
                ["in", "Incoming driller / shift"],
                ["rep", "Company representative"],
              ].map(([k, label]) => (
                <label key={k} className="block">
                  <span className="text-[12.5px] font-bold text-ink-3">{label}</span>
                  <input
                    value={sign[k] ?? ""}
                    onChange={(e) => {
                      const next = { ...sign, [k]: e.target.value };
                      setSign(next);
                      save(SIGN_KEY, next);
                    }}
                    placeholder="Name · signature"
                    className={cn(inputCls, "mt-1 print:rounded-none print:border-0 print:border-b print:shadow-none")}
                  />
                </label>
              ))}
            </section>

            <p className="text-[12px] leading-relaxed text-ink-3">
              Method: {brief.method} NPT cost uses a spread rate of ₹{rate} lakh/day (editable assumption). Decision support only — the driller and company
              representative remain responsible for well-control and operational decisions.
            </p>
          </motion.article>
        )}
      </div>
    </div>
  );
}
