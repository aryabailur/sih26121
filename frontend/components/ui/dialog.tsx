"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;

/** Centered modal. Mount inside <AnimatePresence> for the exit animation. */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  className,
  footer,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  headerExtra?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <motion.div
        className="absolute inset-0 bg-[rgb(8_10_20/0.45)] backdrop-blur-[6px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className={cn("relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[4px] border border-line bg-surface shadow-lg", className)}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15 } }}
        transition={spring}
      >
        <header className="flex items-start gap-3 border-b border-line px-6 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
            {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
          </div>
          {headerExtra}
          <button onClick={onClose} className="rounded-[3px] p-2 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-line bg-surface-2 px-6 py-3.5">{footer}</footer>}
      </motion.div>
    </div>
  );
}

/** Right-hand drawer. Mount inside <AnimatePresence> for the exit animation. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "w-[580px]",
  headerExtra,
  hero,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: string;
  headerExtra?: ReactNode;
  hero?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
      <motion.div
        className="absolute inset-0 bg-[rgb(8_10_20/0.22)]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        className={cn("absolute bottom-2 right-2 top-2 flex max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[4px] border border-line bg-surface shadow-lg", width)}
        initial={{ x: "105%" }}
        animate={{ x: 0 }}
        exit={{ x: "105%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
      >
        {hero}
        <header className="flex items-start gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-bold tracking-[-0.01em] text-ink">{title}</div>
            {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
          </div>
          {headerExtra}
          <button onClick={onClose} className="rounded-[3px] p-2 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </motion.aside>
    </div>
  );
}
