"use client";

import type { FeatureCollection } from "geojson";
import { Globe2, Map as MapIcon } from "lucide-react";
import { AttributionControl, LngLatBounds, Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { circleRing, satelliteStyle } from "@/components/map/mapStyle";
import type { OpenWellCard, RiskFamily, ShelfScan } from "@/lib/types";
import { cn, FAMILY_META } from "@/lib/utils";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const BRAND = "#6d5cff";
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const famColor = (f: RiskFamily | null | undefined) => (f ? FAMILY_META[f]?.color ?? "#8b93a7" : "#d6dbe6");

interface Hover {
  x: number;
  y: number;
  name: string;
  sub: string;
}

/**
 * Real positions of every published exploration wellbore on the Norwegian shelf (colour = worst problem the
 * extractor found in its history), the detailed study area, the focus well and its offset radius.
 */
export default function ShelfMap({
  shelf,
  area,
  focus,
  offsets,
  radiusKm,
  onSelect,
}: {
  shelf: ShelfScan["wells"];
  area: OpenWellCard[];
  focus: OpenWellCard | null;
  offsets: string[];
  radiusKm: number;
  onSelect: (name: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"area" | "shelf">("area");
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!elRef.current) return;
    const map = new MLMap({
      container: elRef.current,
      style: satelliteStyle(),
      center: [8, 64],
      zoom: 3.4,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true, customAttribution: "Wells: Sodir FactPages (NLOD 2.0)" }), "bottom-right");
    map.on("load", () => {
      for (const id of ["shelf", "area", "radius", "focus"]) map.addSource(id, { type: "geojson", data: EMPTY });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": BRAND, "fill-opacity": 0.08 } });
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#b3aaff", "line-width": 2, "line-dasharray": [2, 1.6] } });
      map.addLayer({
        id: "shelf",
        type: "circle",
        source: "shelf",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 4],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["get", "hasEvents"], 0.95, 0.4],
          "circle-stroke-width": 0,
        },
      });
      map.addLayer({
        id: "area",
        type: "circle",
        source: "area",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 9, ["case", ["get", "offset"], 8, 6]],
          "circle-color": ["get", "color"],
          "circle-stroke-color": ["case", ["get", "offset"], "#ffffff", "#0b1220"],
          "circle-stroke-width": ["case", ["get", "offset"], 2, 1],
          "circle-opacity": ["case", ["get", "offset"], 1, 0.75],
        },
      });
      map.addLayer({ id: "focus-halo", type: "circle", source: "focus", paint: { "circle-radius": 16, "circle-color": BRAND, "circle-opacity": 0.25 } });
      map.addLayer({ id: "focus", type: "circle", source: "focus", paint: { "circle-radius": 8, "circle-color": BRAND, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
      const pick = (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; sub: string };
        setHover({ x: e.point.x, y: e.point.y, name: p.name, sub: p.sub });
      };
      for (const layer of ["area", "shelf"]) {
        map.on("mousemove", layer, (e) => {
          map.getCanvas().style.cursor = "pointer";
          pick(e);
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
          setHover(null);
        });
      }
      map.on("click", "area", (e) => {
        const n = (e.features?.[0]?.properties as { name?: string } | undefined)?.name;
        if (n) onSelectRef.current(n);
      });
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Data layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
    const areaNames = new Set(area.map((w) => w.name));
    const off = new Set(offsets);
    src("shelf")?.setData({
      type: "FeatureCollection",
      features: (shelf ?? [])
        .filter((w) => !areaNames.has(w.name))
        .map((w) => ({
          type: "Feature",
          properties: { name: w.name, color: famColor(w.worst), hasEvents: w.events > 0, sub: `${w.year ?? "—"} · ${w.events} problem${w.events === 1 ? "" : "s"} in the history` },
          geometry: { type: "Point", coordinates: [w.lon, w.lat] },
        })),
    });
    src("area")?.setData({
      type: "FeatureCollection",
      features: area.map((w) => ({
        type: "Feature",
        properties: {
          name: w.name,
          offset: off.has(w.name),
          color: w.events ? famColor(w.families.includes("kick") ? "kick" : w.families[0]) : "#e6e9f0",
          sub: `${w.field ?? w.purpose ?? "wildcat"} · ${w.entry_year ?? "—"} · ${w.events} problem${w.events === 1 ? "" : "s"} · click to focus`,
        },
        geometry: { type: "Point", coordinates: [w.longitude, w.latitude] },
      })),
    });
    if (focus) {
      src("focus")?.setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: focus.name }, geometry: { type: "Point", coordinates: [focus.longitude, focus.latitude] } }] });
      src("radius")?.setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(focus.longitude, focus.latitude, radiusKm)] } }] });
    }
  }, [ready, shelf, area, focus, offsets, radiusKm]);

  // Camera: the focus radius, or the whole shelf.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (view === "shelf") {
      map.flyTo({ center: [8, 64.5], zoom: 3.5, pitch: 0, duration: 1800 });
      return;
    }
    if (!focus) return;
    const ring = circleRing(focus.longitude, focus.latitude, Math.max(radiusKm, 8), 32);
    const b = ring.reduce((acc, p) => acc.extend(p), new LngLatBounds(ring[0], ring[0]));
    map.fitBounds(b, { padding: 50, duration: 2200, pitch: 20 });
  }, [ready, focus, radiusKm, view]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[#0b1220]">
      <div ref={elRef} className="!absolute inset-0" />
      <div className="glass absolute left-3 top-3 z-10 flex items-center gap-1 rounded-[4px] p-1">
        {(
          [
            ["area", "Study area", MapIcon],
            ["shelf", "Whole shelf", Globe2],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn("flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-[12.5px] font-bold transition-all", view === v ? "bg-brand text-white shadow-brand" : "text-ink-2 hover:bg-surface-3 hover:text-ink")}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <div className="glass absolute bottom-3 left-3 z-10 max-w-[320px] rounded-[3px] px-2.5 py-2 text-[12px] text-ink-2">
        <div className="mb-1 font-bold text-ink">Worst problem in each well&apos;s history</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(["kick", "mud_loss", "stuck_pipe", "NPT", "wellbore_instability"] as RiskFamily[]).map((f) => (
            <span key={f} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: FAMILY_META[f].color }} />
              {FAMILY_META[f].short}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#d6dbe6]" /> None found
          </span>
        </div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute z-20 rounded-[3px] border border-line bg-surface px-2.5 py-1.5 shadow-lg" style={{ left: hover.x + 14, top: hover.y + 12 }}>
          <div className="font-mono text-[12.5px] font-bold text-ink">{hover.name}</div>
          <div className="text-[12px] text-ink-2">{hover.sub}</div>
        </div>
      )}
    </div>
  );
}
