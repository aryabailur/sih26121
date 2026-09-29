"use client";

import dynamic from "next/dynamic";

function MapLoading() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit] bg-[#0b1220]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgb(255_255_255/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative flex flex-col items-center gap-3 text-[13px] font-semibold text-white/80">
        <span className="h-16 w-16 animate-spin rounded-full border-[3px] border-white/10 border-t-[#8b7dff]" />
        Loading 3D field map…
      </div>
    </div>
  );
}

// MapLibre needs `window` and WebGL, so the map is client-only.
export const FieldMap = dynamic(() => import("./FieldMap"), { ssr: false, loading: () => <MapLoading /> });
