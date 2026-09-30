"use client";

import dynamic from "next/dynamic";

function Loading3D() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit] bg-[#0a0d16]">
      <div className="relative flex flex-col items-center gap-3 text-[13px] font-semibold text-white/80">
        <span className="h-14 w-14 animate-spin rounded-full border-[3px] border-white/10 border-t-[#ffb020]" />
        Loading the subsurface view…
      </div>
    </div>
  );
}

// three.js needs `window` and WebGL, so the view is client-only.
export const Subsurface3D = dynamic(() => import("./Subsurface3D"), { ssr: false, loading: () => <Loading3D /> });
export { focusSubsurfaceEvent } from "./focus";
