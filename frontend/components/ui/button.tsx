import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "aurora" | "secondary" | "soft" | "ghost" | "danger" | "outline";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white border-transparent shadow-brand hover:brightness-110 active:brightness-95",
  aurora: "aurora animate-aurora text-white border-transparent shadow-brand hover:brightness-110 active:brightness-95",
  secondary: "bg-surface text-ink border-line-2 shadow-xs hover:bg-surface-2 hover:border-ink-4/60",
  soft: "bg-brand-soft text-brand-ink border-transparent hover:bg-brand/20",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-3 hover:text-ink",
  danger: "bg-crit text-white border-transparent shadow-[0_8px_22px_-8px_rgb(229_56_59/0.6)] hover:brightness-110",
  outline: "bg-transparent text-ink-2 border-line-2 hover:border-brand/60 hover:text-brand-ink",
};
const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[12.5px] gap-1 rounded-[3px]",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[3px]",
  md: "h-10 px-4 text-[14px] gap-2 rounded-[3px]",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-[3px]",
  icon: "h-10 w-10 rounded-[3px]",
  "icon-sm": "h-8 w-8 rounded-[3px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap border font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
