"use client";

import { FileUp, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadZone({ onFile, onSample, busy }: { onFile: (f: File) => void; onSample: () => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="space-y-2">
      <div
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
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors",
          over ? "border-cyan-300 bg-cyan-400/10" : "border-cockpit-border hover:border-cyan-400/50 hover:bg-white/[0.02]",
          busy && "pointer-events-none opacity-50",
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload a drilling report"
      >
        <FileUp size={26} className="text-cyan-300" />
        <div className="text-[13px] font-medium text-slate-100">Drop a DDR / WCR / mud log here</div>
        <div className="text-[11px] text-cockpit-muted">PDF (text layer or scanned → OCR adapter), TXT, PNG/JPG · max 15 MB</div>
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
      </div>
      <Button variant="primary" className="w-full" onClick={onSample} disabled={busy}>
        <Sparkles size={13} /> Process sample report (DDR OIL-AX-22 Day 45)
      </Button>
      <a href="/api/documents/samples/DDR_OIL-AX-22_Day45_SAMPLE.pdf" className="block text-center text-[11px] text-cyan-300/90 hover:underline" download>
        Download the sample PDF to try the drag-and-drop path
      </a>
    </div>
  );
}
