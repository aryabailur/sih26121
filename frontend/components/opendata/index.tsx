"use client";

import dynamic from "next/dynamic";

// MapLibre needs `window` and WebGL, so the map is client-only.
export const ShelfMap = dynamic(() => import("./ShelfMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center rounded-[inherit] bg-[#0b1220] text-[13px] font-semibold text-white/80">Loading the shelf map…</div>,
});
