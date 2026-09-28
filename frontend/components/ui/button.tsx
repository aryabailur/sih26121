import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warning" | "outline";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-cyan-400/15 text-cyan-200 border-cyan-400/50 hover:bg-cyan-400/25 hover:border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.12)]",
  secondary: "bg-cockpit-elevated/70 text-slate-200 border-cockpit-border hover:bg-cockpit-elevated hover:border-slate-500",
  ghost: "bg-transparent text-slate-300 border-transparent hover:bg-white/5 hover:text-white",
  danger: "bg-red-500/15 text-red-200 border-red-500/50 hover:bg-red-500/25",
  warning: "bg-amber-500/15 text-amber-200 border-amber-500/50 hover:bg-amber-500/25",
  outline: "bg-transparent text-slate-300 border-cockpit-border hover:border-cyan-400/60 hover:text-cyan-200",
};
const SIZES: Record<Size, string> = {
  xs: "h-6 px-2 text-[11px] gap-1",
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-40 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
