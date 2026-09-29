"use client";

import { Download, FileUp, ScanLine, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TEXT_SAMPLE = "DDR_OIL-AX-22_Day45_SAMPLE.pdf";
export const SCANNED_SAMPLE = "DDR_OIL-AX-44_Day38_SCANNED.pdf";

export function UploadZone({ onFile, onSample, busy }: { onFile: (f: File) => void; onSample: (name: string) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="space-y-3">
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => input.current?.click()}
        animate={{ scale: over ? 1.02 : 1 }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[4px] border-2 border-dashed px-4 py-7 text-center transition-colors",
          over ? "border-brand bg-brand-soft" : "border-line-2 bg-surface-2 hover:border-brand/50 hover:bg-brand-soft/50",
          busy && "pointer-events-none opacity-50",
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload a drilling report"
      >
        <motion.span className="aurora flex h-14 w-14 items-center justify-center rounded-[4px] text-white shadow-brand" animate={{ y: over ? -6 : [0, -5, 0] }} transition={over ? { duration: 0.2 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}>
          <FileUp size={26} />
        </motion.span>
        <div className="mt-1 text-[14px] font-extrabold text-ink">Drop a DDR, WCR or mud log</div>
        <div className="text-[12.5px] text-ink-3">PDF with a text layer or scanned (OCR), TXT, PNG/JPG · max 15 MB</div>
        <input
          ref={input}
          type="file"
          accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.tif,.tiff"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </motion.div>
      <Button variant="aurora" size="md" className="w-full" onClick={() => onSample(TEXT_SAMPLE)} disabled={busy}>
        <Sparkles size={15} /> Process sample report (DDR OIL-AX-22 Day 45)
      </Button>
      <Button variant="secondary" size="md" className="w-full" onClick={() => onSample(SCANNED_SAMPLE)} disabled={busy} title="An image-only PDF — no text layer, so every word comes from OCR">
        <ScanLine size={15} /> Process scanned report · OCR (OIL-AX-44 Day 38)
      </Button>
      <div className="flex items-center justify-center gap-3 text-[12.5px] font-semibold text-brand-ink">
        <Download size={12} />
        <a href={`/api/documents/samples/${TEXT_SAMPLE}`} className="hover:underline" download>
          Text PDF
        </a>
        <span className="text-ink-4">·</span>
        <a href={`/api/documents/samples/${SCANNED_SAMPLE}`} className="hover:underline" download>
          Scanned PDF
        </a>
        <span className="font-medium text-ink-3">to try drag-and-drop</span>
      </div>
    </div>
  );
}
