"use client";

import { ArrowDownToLine, CornerDownLeft, Moon, Play, RotateCcw, Search, Sparkles, Sun, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { Kbd } from "@/components/ui/misc";
import { setTheme, useTheme } from "@/lib/prefs";
import { useNWIS } from "@/lib/store";
import type { RiskFamily } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth, fmtRange, SEVERITY_STYLE } from "@/lib/utils";
import { setVoice, useVoice, voiceSupported } from "@/lib/voice";
import { NAV } from "./Sidebar";

interface Item {
  id: string;
  group: "Jump" | "Pages" | "Wells" | "Hazard windows" | "Actions" | "Ask";
  label: string;
  hint?: string;
  keywords?: string;
  icon?: LucideIcon;
  family?: RiskFamily;
  dot?: string;
  run: () => void;
}

const OPEN_EVENT = "nwis:palette";
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

function score(item: Item, q: string) {
  if (!q) return 1;
  const hay = `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => hay.includes(w))) return 0;
  return item.label.toLowerCase().startsWith(words[0]) ? 3 : 2;
}

/** Ctrl/⌘ K — jump to any screen, well, depth or hazard window; run demo actions; or ask the knowledge base. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const voice = useVoice();
  const wells = useNWIS((s) => s.wells);
  const zones = useNWIS((s) => s.zones);
  const demoMode = useNWIS((s) => s.demoMode);
  const td = useNWIS((s) => s.activeWell?.total_depth_md ?? 3800);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const close = () => {
    setOpen(false);
    setQ("");
    setSel(0);
  };

  const items = useMemo<Item[]>(() => {
    const st = () => useNWIS.getState();
    const go = (href: string) => () => router.push(href);
    const out: Item[] = [];
    const n = Number(q.replace(/[,\s]|m$/gi, ""));
    if (q && Number.isFinite(n) && n >= 100 && n <= td) {
      out.push({ id: "jump", group: "Jump", label: `Move the bit to ${fmtDepth(n)}`, hint: "Re-evaluates risk at that depth", icon: ArrowDownToLine, run: () => st().setDepth(n, { immediate: true }) });
    }
    for (const p of NAV) out.push({ id: `p-${p.href}`, group: "Pages", label: p.title, keywords: p.label, icon: p.icon, run: go(p.href) });
    for (const w of wells)
      out.push({
        id: `w-${w.id}`,
        group: "Wells",
        label: w.name,
        hint: w.role === "active" ? "active well" : `${w.distance_km.toFixed(1)} km ${w.direction} · ${w.event_count} events · ${w.npt_hours} h NPT`,
        keywords: `${w.id} ${w.risk_families.map((f) => FAMILY_META[f].label).join(" ")}`,
        dot: w.role === "active" ? "var(--brand)" : w.history_severity ? SEVERITY_STYLE[w.history_severity].hex : "var(--ink-4)",
        run: go(w.role === "active" ? "/dashboard" : `/dashboard/well/${w.id}`),
      });
    for (const z of zones)
      out.push({
        id: `z-${z.id}`,
        group: "Hazard windows",
        label: `${FAMILY_META[z.risk_type].label} · ${fmtRange(z.depth_start, z.depth_end)}`,
        hint: `${z.formation} — put the bit 50 m above it`,
        keywords: z.risk_label,
        family: z.risk_type,
        run: () => st().setDepth(Math.max(0, z.depth_start - 50), { immediate: true }),
      });
    if (demoMode) out.push({ id: "a-run", group: "Actions", label: "Run the historical risk scenario", hint: "3,100 → 3,600 m, three alerts", icon: Play, keywords: "demo replay", run: () => void st().runScenario("full", { fresh: true }) });
    out.push({ id: "a-reset", group: "Actions", label: "Reset the demo", hint: "Clear alerts & uploads, back to 3,100 m", icon: RotateCcw, run: () => void st().resetDemo() });
    out.push({ id: "a-theme", group: "Actions", label: theme === "dark" ? "Switch to the daylight theme" : "Switch to the night-shift theme", icon: theme === "dark" ? Sun : Moon, keywords: "dark light theme", run: () => setTheme(theme === "dark" ? "light" : "dark") });
    if (voiceSupported())
      out.push({ id: "a-voice", group: "Actions", label: voice ? "Turn spoken alerts off" : "Turn spoken alerts on", hint: "Hands-free callouts for the rig floor", icon: voice ? VolumeX : Volume2, keywords: "voice speech audio", run: () => setVoice(!voice) });
    if (q.trim().length > 2 && !(Number.isFinite(n) && n >= 100 && n <= td))
      out.push({ id: "ask", group: "Ask", label: `Ask: “${q.trim()}”`, hint: "Cited answer from the offset-well reports", icon: Sparkles, run: go(`/dashboard/search?q=${encodeURIComponent(q.trim())}`) });
    return out;
  }, [q, wells, zones, demoMode, theme, voice, router, td]);

  const results = useMemo(() => {
    const scored = items.map((i) => ({ i, s: i.group === "Ask" || i.group === "Jump" ? 5 : score(i, q) })).filter((x) => x.s > 0);
    scored.sort((a, b) => b.s - a.s);
    const order: Item["group"][] = ["Jump", "Pages", "Hazard windows", "Wells", "Actions", "Ask"];
    const top = scored.slice(0, q ? 14 : 30).map((x) => x.i);
    return order.flatMap((g) => top.filter((i) => i.group === g));
  }, [items, q]);

  const safeSel = Math.min(sel, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${safeSel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safeSel]);

  const run = (i: Item | undefined) => {
    if (!i) return;
    close();
    i.run();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1400] flex items-start justify-center bg-[#0b0d14]/45 px-4 pt-[13vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
          <motion.div
            role="dialog"
            aria-label="Command palette"
            initial={{ y: -14, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] overflow-hidden rounded-[4px] border border-line bg-surface shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-ink-3" />
              <input
                ref={inputRef}
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSel(Math.min(results.length - 1, safeSel + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSel(Math.max(0, safeSel - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    run(results[safeSel]);
                  } else if (e.key === "Escape") close();
                }}
                placeholder="Jump to a screen, well, depth (e.g. 3380) — or ask a question"
                className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-4"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
              {results.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-ink-3">Nothing matches “{q}”.</div>}
              {results.map((i, idx) => {
                const first = idx === 0 || results[idx - 1].group !== i.group;
                const Icon = i.icon;
                const on = idx === safeSel;
                return (
                  <div key={i.id}>
                    {first && <div className="px-2.5 pb-1 pt-2 text-[11.5px] font-bold text-ink-3">{i.group}</div>}
                    <button
                      data-idx={idx}
                      onMouseMove={() => sel !== idx && setSel(idx)}
                      onClick={() => run(i)}
                      className={cn("relative flex w-full items-center gap-3 rounded-[3px] px-2.5 py-2 text-left transition-colors", on ? "bg-brand-soft" : "hover:bg-surface-2")}
                    >
                      {on && <motion.span layoutId="palette-sel" className="absolute inset-y-1 left-0 w-[3px] rounded-[1px] bg-brand" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-surface-3 text-ink-2">
                        {i.family ? <FamilyIcon family={i.family} size={14} /> : Icon ? <Icon size={15} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.dot }} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[13.5px] font-semibold", on ? "text-brand-ink" : "text-ink", i.group === "Wells" && "font-mono")}>{i.label}</span>
                        {i.hint && <span className="block truncate text-[12.5px] text-ink-3">{i.hint}</span>}
                      </span>
                      {on && <CornerDownLeft size={14} className="shrink-0 text-brand-ink" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 border-t border-line bg-surface-2 px-4 py-2 text-[12px] text-ink-3">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> move
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Enter</Kbd> open
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd> or <Kbd>/</Kbd> anywhere
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
