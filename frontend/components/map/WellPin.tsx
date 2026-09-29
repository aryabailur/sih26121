"use client";

import { motion } from "motion/react";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import type { RiskFamily, WellListItem } from "@/lib/types";
import { cn, FAMILY_META, fmtDepth, SEVERITY_STYLE } from "@/lib/utils";

export interface PinHighlight {
  color: string;
  family: RiskFamily;
  depth?: number;
}

function raise(e: React.MouseEvent, on: boolean) {
  const m = (e.currentTarget as HTMLElement).closest(".maplibregl-marker") as HTMLElement | null;
  if (m) m.style.zIndex = on ? "50" : "";
}

/** Map pin rendered (via portal) inside a MapLibre marker element. */
export function WellPin({
  w,
  depth,
  highlight,
  dim,
  selected,
  hover,
  showLabel,
  onClick,
  onHover,
}: {
  w: WellListItem;
  depth: number;
  highlight?: PinHighlight;
  dim: boolean;
  selected: boolean;
  hover: boolean;
  showLabel: boolean;
  onClick: () => void;
  onHover: (on: boolean) => void;
}) {
  const active = w.role === "active";
  const sev = w.history_severity ? SEVERITY_STYLE[w.history_severity] : null;
  const fill = sev?.hex ?? "#94a3b8";
  const big = selected || hover;

  const card = (
    <div className="pointer-events-none absolute bottom-[calc(100%+30px)] left-1/2 z-10 w-60 -translate-x-1/2 rounded-[3px] border border-line bg-surface p-3 text-left opacity-0 shadow-lg transition-all duration-150 group-hover:bottom-[calc(100%+34px)] group-hover:opacity-100">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: active ? "var(--brand)" : fill }} />
        <span className="font-mono text-[13.5px] font-semibold text-ink">{w.name}</span>
        <span className="ml-auto text-[11.5px] font-bold text-ink-3">{w.id}</span>
      </div>
      <div className="mt-1 text-[12.5px] text-ink-3">
        {active ? "Active · drilling" : w.status} · TD {fmtDepth(w.total_depth_md)}
      </div>
      {!active && (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <Mini label="Distance" value={`${w.distance_km.toFixed(2)} km`} />
            <Mini label="Similar" value={`${Math.round((w.similarity ?? 0) * 100)}%`} />
            <Mini label="NPT" value={`${w.npt_hours} h`} />
          </div>
          {w.risk_families.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {w.risk_families.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-[2px] px-1.5 py-px text-[11.5px] font-semibold text-ink-2" style={{ background: `color-mix(in oklab, ${FAMILY_META[f].color} 14%, transparent)` }}>
                  <FamilyIcon family={f} size={10} /> {FAMILY_META[f].short}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 text-[11.5px] font-semibold text-brand-ink">Click for the well profile →</div>
        </>
      )}
    </div>
  );

  if (active) {
    return (
      <button
        className="group relative flex h-7 w-7 items-center justify-center"
        onClick={onClick}
        onMouseEnter={(e) => {
          raise(e, true);
          onHover(true);
        }}
        onMouseLeave={(e) => {
          raise(e, false);
          onHover(false);
        }}
        aria-label={`${w.name} (active well)`}
      >
        <span className="absolute inset-[-6px] animate-pulse-ring rounded-full border-2 border-[#8b7dff]" />
        <span className="absolute inset-[-6px] animate-pulse-ring rounded-full border-2 border-[#8b7dff] [animation-delay:1.2s]" />
        <span className="aurora relative flex h-7 w-7 items-center justify-center rounded-full shadow-[0_0_0_3px_white,0_6px_18px_rgb(91_75_255/0.6)]">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <span className="absolute left-1/2 top-[calc(100%+6px)] -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-brand px-2.5 py-1 text-[12.5px] font-extrabold text-white shadow-brand">
          {w.name} <span className="font-semibold opacity-80">· {fmtDepth(depth)}</span>
        </span>
        {card}
      </button>
    );
  }

  return (
    <motion.button
      className="group relative flex items-center justify-center"
      style={{ width: 18, height: 18 }}
      animate={{ opacity: dim ? 0.32 : 1, scale: big ? 1.3 : 1, y: hover ? -3 : 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      onClick={onClick}
      onMouseEnter={(e) => {
        raise(e, true);
        onHover(true);
      }}
      onMouseLeave={(e) => {
        raise(e, false);
        onHover(false);
      }}
      aria-label={`${w.name}, ${w.distance_km.toFixed(1)} km`}
    >
      {highlight && <span className="absolute inset-[-7px] animate-pulse-ring rounded-full border-2" style={{ borderColor: highlight.color }} />}
      <span
        className="relative h-[14px] w-[14px] rounded-full"
        style={{ background: fill, boxShadow: `0 0 0 2.5px ${big ? "var(--brand)" : "white"}, 0 3px 10px rgb(0 0 0 / 0.35)${highlight ? `, 0 0 18px ${highlight.color}` : ""}` }}
      />
      {(showLabel || highlight || big) && (
        <span
          className={cn(
            "absolute left-[calc(100%+6px)] top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-[2px] py-0.5 pl-1.5 pr-2 text-[12px] font-bold shadow-md transition-colors",
            highlight ? "text-white" : "bg-surface/95 text-ink",
          )}
          style={highlight ? { background: highlight.color } : undefined}
        >
          {highlight && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white">
              <FamilyIcon family={highlight.family} size={10} />
            </span>
          )}
          <span className="font-mono">{w.name}</span>
          {highlight?.depth !== undefined && <span className="font-semibold opacity-85">@{Math.round(highlight.depth)}</span>}
        </span>
      )}
      {card}
    </motion.button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[3px] bg-surface-2 px-1 py-1">
      <div className="text-[12.5px] font-extrabold tabular text-ink">{value}</div>
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}
