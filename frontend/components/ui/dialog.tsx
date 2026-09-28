"use client";

import { X } from "lucide-react";
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

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={cn("glass-strong relative flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl animate-fade-in", className)}>
        <header className="flex items-start gap-3 border-b border-cockpit-line px-5 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            {subtitle && <div className="mt-0.5 text-xs text-cockpit-muted">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-cockpit-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "w-[560px]",
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: string;
  headerExtra?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className={cn("glass-strong absolute right-0 top-0 flex h-full max-w-[96vw] flex-col animate-slide-in", width)}>
        <header className="flex items-start gap-3 border-b border-cockpit-line px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-slate-50">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-cockpit-muted">{subtitle}</div>}
          </div>
          {headerExtra}
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
