"use client";

import { Activity, Database, FileSearch, FileStack, GitCompare, LayoutDashboard, MapPinned, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNWIS } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/nearby", label: "Nearby Wells", icon: MapPinned },
  { href: "/dashboard/well/W002", match: "/dashboard/well", label: "Well Intelligence", icon: Activity },
  { href: "/dashboard/compare", label: "Correlate & Compare", icon: GitCompare },
  { href: "/dashboard/search", label: "Evidence Search", icon: FileSearch },
  { href: "/dashboard/risk", label: "Risk Explorer", icon: ShieldAlert },
  { href: "/dashboard/documents", label: "Document Intelligence", icon: FileStack },
];

export function Sidebar() {
  const path = usePathname();
  const sim = useNWIS((s) => s.sim);
  const alerts = useNWIS((s) => s.evaluation?.active_alerts.filter((a) => a.status === "active").length ?? 0);
  const compare = useNWIS((s) => s.compareIds.length);
  return (
    <nav className="glass-strong group/side z-[900] flex w-[60px] shrink-0 flex-col border-y-0 border-l-0 py-3 transition-[width] duration-200 hover:w-[216px]">
      <ul className="flex flex-col gap-1 px-2">
        {NAV.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.match ?? n.href);
          const Icon = n.icon;
          const badge = n.href === "/dashboard/risk" ? alerts : n.href === "/dashboard/compare" ? compare : 0;
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                className={cn(
                  "relative flex h-10 items-center gap-3 overflow-hidden rounded-md px-2.5 text-[12px] font-medium transition-colors",
                  active ? "bg-cyan-400/12 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                )}
                title={n.label}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-cyan-300" />}
                <Icon size={18} className="shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity group-hover/side:opacity-100">{n.label}</span>
                {badge > 0 && (
                  <span className={cn("absolute right-1.5 top-1.5 rounded px-1 text-[9px] font-bold", n.href === "/dashboard/risk" ? "bg-red-500 text-white" : "bg-cyan-400 text-cockpit-bg")}>
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto overflow-hidden px-2">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-1.5 py-2 text-[9px] leading-snug text-amber-200/80" title="Synthetic demo data — not Oil India operational records">
          <div className="flex items-center gap-1.5 font-bold tracking-wider">
            <Database size={14} className="shrink-0" />
            <span className="hidden group-hover/side:inline">SYNTHETIC DATA</span>
          </div>
          <div className="mt-1 hidden whitespace-normal group-hover/side:block">
            Synthetic demo data — not Oil India operational records.
            {sim && (
              <div className="mt-1 font-mono text-amber-100/70">
                {sim.knowledge_base.wells} wells · {sim.knowledge_base.events} events · {sim.knowledge_base.documents} docs · {sim.knowledge_base.chunks} chunks
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
