"use client";

import dynamic from "next/dynamic";
import { Loading } from "@/components/ui/misc";

// Leaflet touches `window`, so the map is client-only.
export const FieldMap = dynamic(() => import("./FieldMap"), {
  ssr: false,
  loading: () => <Loading label="Loading field map…" className="h-full" />,
});
