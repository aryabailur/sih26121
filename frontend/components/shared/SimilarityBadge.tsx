import { cn } from "@/lib/utils";

export function SimilarityBadge({ value, className, showLabel = false }: { value: number | null | undefined; className?: string; showLabel?: boolean }) {
  if (value === null || value === undefined) return <span className="text-cockpit-dim">—</span>;
  const p = Math.round(value * 100);
  const color = p >= 90 ? "#22d3ee" : p >= 75 ? "#38bdf8" : p >= 60 ? "#94a3b8" : "#64748b";
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] tabular", className)} title="Well similarity to the active well">
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-white/10">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p}%`, background: color }} />
      </span>
      <span style={{ color }}>{p}%</span>
      {showLabel && <span className="text-cockpit-dim">similar</span>}
    </span>
  );
}
