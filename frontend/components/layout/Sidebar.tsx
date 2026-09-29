"use client";

import { Activity, FileStack, GitCompare, LayoutDashboard, MapPinned, Moon, ShieldAlert, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { setTheme, useTheme } from "@/lib/prefs";
import { useNWIS } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";

export const NAV: { href: string; match?: string; label: string; title: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/dashboard", label: "Command", title: "Command center", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/nearby", label: "Nearby", title: "Nearby wells", icon: MapPinned },
  { href: "/dashboard/well/W002", match: "/dashboard/well", label: "Well intel", title: "Well intelligence", icon: Activity },
  { href: "/dashboard/compare", label: "Compare", title: "Correlate & compare", icon: GitCompare },
  { href: "/dashboard/search", label: "Ask", title: "Evidence search", icon: Sparkles },
  { href: "/dashboard/risk", label: "Risk", title: "Risk explorer", icon: ShieldAlert },
  { href: "/dashboard/documents", label: "Docs", title: "Document intelligence", icon: FileStack },
];

export function pageTitle(path: string) {
  const n = NAV.find((x) => (x.exact ? path === x.href : path.startsWith(x.match ?? x.href)));
  return n?.title ?? "NWIS";
}

function ThemeToggle() {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[3px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
      title={dark ? "Switch to daylight theme" : "Switch to night-shift theme"}
      aria-label="Toggle theme"
    >
      <motion.span key={theme} initial={{ rotate: -90, scale: 0.4, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
        {dark ? <Moon size={19} /> : <Sun size={19} />}
      </motion.span>
    </button>
  );
}

export function Sidebar() {
  const path = usePathname();
  const sim = useNWIS((s) => s.sim);
  const alerts = useNWIS((s) => s.evaluation?.active_alerts.filter((a) => a.status === "active").length ?? 0);
  const compare = useNWIS((s) => s.compareIds.length);
  return (
    <nav className="relative z-[900] flex w-[84px] shrink-0 flex-col items-center border-r border-line bg-surface/80 py-3 backdrop-blur-xl" aria-label="Main">
      <Link href="/" title="NWIS home" className="mb-3">
        <LogoMark size={44} />
      </Link>
      <ul className="flex w-full flex-1 flex-col items-center gap-1 px-2">
        {NAV.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.match ?? n.href);
          const Icon = n.icon;
          const badge = n.href === "/dashboard/risk" ? alerts : n.href === "/dashboard/compare" ? compare : 0;
          return (
            <li key={n.href} className="w-full">
              <Link
                href={n.href}
                title={n.title}
                className={cn("group relative flex w-full flex-col items-center gap-1 rounded-[3px] py-2 transition-colors", active ? "text-brand-ink" : "text-ink-3 hover:text-ink")}
              >
                {active && (
                  <motion.span layoutId="rail-active" className="absolute inset-0 rounded-[3px] bg-brand-soft" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className="relative flex h-8 w-10 items-center justify-center rounded-[3px] transition-transform group-hover:scale-110">
                  <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
                  {badge > 0 && (
                    <motion.span
                      key={badge}
                      initial={{ scale: 0.3 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 14 }}
                      className={cn(
                        "absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[2px] px-1 text-[11px] font-extrabold text-white ring-2 ring-surface",
                        n.href === "/dashboard/risk" ? "bg-crit" : "bg-brand",
                      )}
                    >
                      {badge}
                    </motion.span>
                  )}
                </span>
                <span className={cn("relative text-[11.5px] font-semibold leading-none", active ? "text-ink" : "")}>{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col items-center gap-2">
        <ThemeToggle />
        <div className="group relative">
          <div className="flex h-10 w-10 cursor-help flex-col items-center justify-center rounded-[3px] bg-surface-3 text-[11px] font-extrabold leading-tight tracking-wide text-ink-3">
            <span>DEMO</span>
            <span className="font-semibold opacity-80">DATA</span>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-full z-50 ml-3 w-64 translate-x-1 rounded-[3px] border border-line bg-surface p-3 text-[12.5px] text-ink-2 opacity-0 shadow-lg transition-all group-hover:translate-x-0 group-hover:opacity-100">
            <div className="font-bold text-ink">Demo dataset</div>
            <p className="mt-1 leading-snug text-ink-3">
              Realistic synthetic wells on real Upper Assam stratigraphy, shaped like OIL&apos;s WCRs, DDRs and eRTMAC stream — not Oil India operational records.
              Swap in the archive and the same pipeline runs.
            </p>
            {sim && (
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12.5px]">
                {Object.entries(sim.knowledge_base).map(([k, v]) => (
                  <div key={k} className="rounded-[3px] bg-surface-2 px-2 py-1">
                    <div className="font-extrabold tabular text-ink">{v}</div>
                    <div className="capitalize text-ink-3">{k}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
