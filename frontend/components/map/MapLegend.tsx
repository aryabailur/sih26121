import { SEVERITY_STYLE } from "@/lib/utils";

export function MapLegend() {
  return (
    <div className="glass pointer-events-none absolute bottom-2 left-2 z-[500] rounded-md px-2.5 py-2 text-[10px] text-slate-300">
      <div className="label-caps mb-1">Legend</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" /> Active well
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 border-2 border-cyan-200 bg-cockpit-bg" /> Bit position
        </span>
        {(["critical", "high", "medium", "low"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_STYLE[s].hex }} /> {SEVERITY_STYLE[s].label.toLowerCase()} history
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-slate-500" /> Well path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rotate-45 bg-sky-400" /> Event near bit depth
        </span>
      </div>
    </div>
  );
}
