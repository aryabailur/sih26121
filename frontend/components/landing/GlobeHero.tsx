"use client";

import { Map as MLMap, Marker, setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { satelliteStyle } from "@/components/map/mapStyle";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export const FIELD: [number, number] = [95.3522, 27.2503];

/** Spinning satellite globe for the welcome screen; `flying` dives the camera onto the field. */
export default function GlobeHero({ flying }: { flying: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const spinning = useRef(true);
  const pinEl = useMemo(() => document.createElement("div"), []);

  useEffect(() => {
    if (!el.current) return;
    const map = new MLMap({
      container: el.current,
      style: satelliteStyle(),
      center: [FIELD[0] - 38, FIELD[1] - 4],
      zoom: 2.15,
      attributionControl: { compact: true },
      renderWorldCopies: false,
      scrollZoom: false,
      canvasContextAttributes: { antialias: true },
    });
    const marker = new Marker({ element: pinEl, anchor: "center" }).setLngLat(FIELD).addTo(map);
    let raf = 0;
    const spin = () => {
      if (spinning.current && !map.isMoving()) {
        const c = map.getCenter();
        map.setCenter([c.lng + 0.035, c.lat]);
      }
      raf = requestAnimationFrame(spin);
    };
    // Keep the globe clear of the headline column on wide screens.
    map.setPadding({ left: Math.min(760, window.innerWidth * 0.42), top: 0, right: 0, bottom: 0 });
    map.on("load", () => {
      el.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      raf = requestAnimationFrame(spin);
    });
    map.on("mousedown", () => (spinning.current = false));
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(raf);
      marker.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [pinEl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flying) return;
    spinning.current = false;
    map.flyTo({ center: FIELD, zoom: 12.6, pitch: 55, bearing: -20, padding: { left: 0, top: 0, right: 0, bottom: 0 }, duration: 2600, curve: 1.5, essential: true });
  }, [flying]);

  return (
    <>
      {/* `!absolute`: maplibre-gl.css sets .maplibregl-map { position: relative }. */}
      <div ref={el} className="!absolute inset-0" />
      {createPortal(
        <div className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inset-[-10px] animate-pulse-ring rounded-full border-2 border-[#b3a9ff]" />
          <span className="absolute inset-[-10px] animate-pulse-ring rounded-full border-2 border-[#b3a9ff] [animation-delay:1.2s]" />
          <span className="aurora h-5 w-5 rounded-full shadow-[0_0_0_3px_white,0_0_24px_#8b7dff]" />
          <span className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[2px] bg-white/95 px-2.5 py-1 text-[12.5px] font-extrabold text-[#0c0e14] shadow-lg">Dikhow East · Upper Assam</span>
        </div>,
        pinEl,
      )}
    </>
  );
}
