import { cn } from "@/lib/utils";

export function SimilarityBadge({ value, className, showLabel = false }: { value: number | null | undefined; className?: string; showLabel?: boolean }) {
  if (value === null || value === undefined) return <span className="text-ink-4">—</span>;
  const p = Math.round(value * 100);
  // Brand intensity carries similarity: stronger = more comparable offset.
  const mix = p >= 90 ? 100 : p >= 75 ? 78 : p >= 60 ? 55 : 35;
  const color = `color-mix(in oklab, var(--brand-ink) ${mix}%, var(--ink-3))`;
  return (
    <span className={cn("inline-flex items-center gap-2 text-[12.5px] font-bold tabular", className)} title="Similarity to the active well">
      <span className="relative h-1.5 w-12 overflow-hidden rounded-[1px] bg-surface-3">
        <span className="absolute inset-y-0 left-0 rounded-[1px]" style={{ width: `${p}%`, background: color }} />
      </span>
      <span style={{ color }}>{p}%</span>
      {showLabel && <span className="font-medium text-ink-3">similar</span>}
    </span>
  );
}
