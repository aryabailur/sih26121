import { cn } from "@/lib/utils";

/**
 * NWIS mark — an "N" drawn from wells: the left stroke is an offset well, the diagonal a deviated
 * well path, the right stroke the active well ending in the drill bit (amber). The lower third crosses
 * the Barail / Kopili / Sylhet strata. Square, flat, no gradient — reads at 16 px.
 */
export function LogoGlyph({ size = 40, className, title = "NWIS" }: { size?: number; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} role="img" aria-label={title}>
      <rect width="48" height="48" rx="3" fill="#11131a" />
      {/* strata: Barail · Kopili · Sylhet */}
      <rect y="28" width="48" height="7" fill="#2f9fc2" />
      <rect y="35" width="48" height="6" fill="#8d68d6" />
      <rect y="41" width="48" height="7" fill="#1fae86" />
      {/* offset well (drilled to TD) | deviated path \ active well | */}
      <path d="M13 7.5 V48" stroke="#ffffff" strokeWidth="4.4" />
      <path d="M13.6 8.2 L33.4 31.8" stroke="#ffffff" strokeWidth="4.4" strokeLinecap="square" />
      <path d="M34.5 7.5 V33" stroke="#ffffff" strokeWidth="4.4" />
      {/* the bit, inside the Kopili risk band */}
      <path d="M34.5 32.6 L39 37.1 L34.5 41.6 L30 37.1 Z" fill="#f2a60c" stroke="#11131a" strokeWidth="1.3" />
      {/* hairline edge so the mark holds on dark surfaces */}
      <rect x="0.5" y="0.5" width="47" height="47" rx="2.5" fill="none" stroke="#ffffff" strokeOpacity="0.16" />
    </svg>
  );
}

export function LogoMark({ size = 40, className, animated = false }: { size?: number; className?: string; animated?: boolean }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <LogoGlyph size={size} />
      {animated && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[3px]">
          {/* a scan line sweeps down the bore while loading */}
          <span className="absolute inset-x-0 h-[18%] animate-[logo-scan_1.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-white/35 to-transparent" />
        </span>
      )}
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("leading-none", className)}>
      <span className="block text-[17px] font-extrabold tracking-[-0.02em] text-ink">NWIS</span>
      <span className="block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Nearby Wells Intelligence</span>
    </span>
  );
}
