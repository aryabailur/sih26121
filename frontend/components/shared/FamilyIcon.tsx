import { BrickWall, Droplets, Flame, Lock, Mountain, RotateCw, Timer, type LucideIcon } from "lucide-react";
import type { RiskFamily } from "@/lib/types";
import { cn, FAMILY_META } from "@/lib/utils";

export const FAMILY_ICON: Record<RiskFamily, LucideIcon> = {
  mud_loss: Droplets,
  stuck_pipe: Lock,
  kick: Flame,
  torque_spike: RotateCw,
  wellbore_instability: Mountain,
  cementing_failure: BrickWall,
  NPT: Timer,
};

/** Risk-family glyph. `tile` renders it on a tinted rounded square (list/card leading icon). */
export function FamilyIcon({
  family,
  size = 14,
  tile = false,
  className,
  color: override,
}: {
  family: RiskFamily;
  size?: number;
  tile?: boolean;
  className?: string;
  color?: string;
}) {
  const Icon = FAMILY_ICON[family] ?? Timer;
  const color = override ?? FAMILY_META[family]?.color ?? "#8b93a7";
  if (!tile) return <Icon size={size} className={className} style={{ color }} aria-hidden />;
  const box = Math.round(size * 2.3);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[3px]", className)}
      style={{ width: box, height: box, background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
      aria-hidden
    >
      <Icon size={size} strokeWidth={2.2} />
    </span>
  );
}
