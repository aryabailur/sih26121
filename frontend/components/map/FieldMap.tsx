"use client";

import type { Feature, FeatureCollection } from "geojson";
import { Box, Focus, Globe2, Map as MapIcon, Orbit, Satellite, Square, WifiOff } from "lucide-react";
import { AttributionControl, LngLatBounds, Map as MLMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FamilyIcon } from "@/components/shared/FamilyIcon";
import { introPlayed, markIntroPlayed, useTheme } from "@/lib/prefs";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, Trajectory, WellListItem } from "@/lib/types";
import { cn, EVENT_LABELS, FAMILY_META, familyOf, fmtDepth, SEVERITY_STYLE } from "@/lib/utils";
import { MapLegend } from "./MapLegend";
import { circleRing, DEM_SOURCE, metersPerPixel, SKY, styleFor, TERRARIUM, type Basemap } from "./mapStyle";
import { WellPin, type PinHighlight } from "./WellPin";

// Served from public/ (see scripts/copy-maplibre-worker.mjs) — the bundler can't resolve MapLibre's worker URL.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const FIELD_VIEW = { center: [95.3522, 27.2503] as [number, number], zoom: 14.2, pitch: 58, bearing: -24 };
const BRAND = "#6d5cff";
const RADAR_KM = 1.6;
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
// "Ant march" dash frames for evidence links.
const DASHES: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

type ZoomBucket = "far" | "mid" | "near";

/** Frame the core field (offsets within 5 km) flat or pitched. */
function fitCore(map: MLMap, pitch: number, duration: number) {
  const core = useNWIS.getState().wells.filter((w) => w.distance_km <= 5);
  if (!core.length) return;
  const b = core.reduce((acc, w) => acc.extend([w.longitude, w.latitude]), new LngLatBounds([core[0].longitude, core[0].latitude], [core[0].longitude, core[0].latitude]));
  map.fitBounds(b, { padding: { top: 110, bottom: 60, left: 60, right: 90 }, pitch, bearing: 0, duration });
}

/** Radar sweep diameter tracks the map scale (RADAR_KM radius); hidden when zoomed far out. */
function sizeRadar(el: HTMLDivElement | null, zoom: number) {
  if (!el) return;
  const px = Math.min(4000, (RADAR_KM * 2000) / metersPerPixel(FIELD_VIEW.center[1], zoom));
  el.style.width = el.style.height = `${px}px`;
  el.style.opacity = zoom < 11.5 ? "0" : "1";
}
const bucketOf = (z: number): ZoomBucket => (z >= 13.2 ? "near" : z >= 10 ? "mid" : "far");

function pointAtMd(traj: Trajectory[] | undefined, md: number): [number, number] | null {
  if (!traj?.length) return null;
  if (md <= traj[0].md) return [traj[0].lon, traj[0].lat];
  for (let i = 1; i < traj.length; i++) {
    if (traj[i].md >= md) {
      const a = traj[i - 1];
      const b = traj[i];
      const t = (md - a.md) / (b.md - a.md || 1);
      return [a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t];
    }
  }
  const last = traj[traj.length - 1];
  return [last.lon, last.lat];
}

function hexagon(lon: number, lat: number, meters: number): [number, number][] {
  const dLat = meters / 111320;
  const dLon = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

function addNwisLayers(map: MLMap) {
  if (!map.getSource(DEM_SOURCE)) {
    map.addSource(DEM_SOURCE, { type: "raster-dem", tiles: [TERRARIUM], encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: "Terrain: Mapzen / AWS Open Data" });
  }
  for (const id of ["nwis-radius", "nwis-rings", "nwis-traj", "nwis-links", "nwis-towers"]) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY });
  }
  const add = (layer: Parameters<MLMap["addLayer"]>[0]) => !map.getLayer(layer.id) && map.addLayer(layer);
  add({ id: "nwis-radius-fill", type: "fill", source: "nwis-radius", paint: { "fill-color": BRAND, "fill-opacity": 0.035 } });
  add({ id: "nwis-radius-line", type: "line", source: "nwis-radius", paint: { "line-color": BRAND, "line-width": 2.2, "line-opacity": 0.9, "line-dasharray": [2.5, 1.8] } });
  add({ id: "nwis-rings", type: "line", source: "nwis-rings", paint: { "line-color": "#ffffff", "line-width": 1.3, "line-opacity": 0.6, "line-dasharray": [1, 2.2] } });
  add({
    id: "nwis-traj-glow",
    type: "line",
    source: "nwis-traj",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["*", ["get", "width"], 3.2], "line-blur": 5, "line-opacity": ["*", ["get", "opacity"], 0.45] },
  });
  add({
    id: "nwis-traj",
    type: "line",
    source: "nwis-traj",
    filter: ["!", ["get", "planned"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-opacity": ["get", "opacity"] },
  });
  add({
    id: "nwis-traj-planned",
    type: "line",
    source: "nwis-traj",
    filter: ["get", "planned"],
    layout: { "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-opacity": 0.85, "line-dasharray": [1.2, 1.6] },
  });
  add({
    id: "nwis-links-glow",
    type: "line",
    source: "nwis-links",
    layout: { "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 9, "line-blur": 7, "line-opacity": 0.5 },
  });
  add({ id: "nwis-links", type: "line", source: "nwis-links", paint: { "line-color": ["get", "color"], "line-width": 3, "line-dasharray": DASHES[0] } });
  add({
    id: "nwis-towers",
    type: "fill-extrusion",
    source: "nwis-towers",
    paint: {
      "fill-extrusion-color": ["get", "color"],
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.86,
      "fill-extrusion-vertical-gradient": true,
    },
  });
}

export default function FieldMap({
  className,
  showControls = true,
  overlay,
  modeSwitch,
}: {
  className?: string;
  showControls?: boolean;
  overlay?: ReactNode;
  /** Optional view switch (e.g. Surface / Subsurface) rendered first in the control row. */
  modeSwitch?: ReactNode;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const styleKeyRef = useRef<string>("");
  const mode3dRef = useRef(true);
  const bitPos = useRef<[number, number] | null>(null);
  const bitMarker = useRef<Marker | null>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [zoomBucket, setZoomBucket] = useState<ZoomBucket>(() => (introPlayed() ? "near" : "far"));
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [mode3d, setMode3d] = useState(true);
  const [orbit, setOrbit] = useState(false);
  const [towers, setTowers] = useState(true);
  const [offline, setOffline] = useState(false);

  const wells = useNWIS((s) => s.wells);
  const trajectories = useNWIS((s) => s.trajectories);
  const radiusKm = useNWIS((s) => s.radiusKm);
  const depth = useNWIS((s) => s.depth);
  const events = useNWIS((s) => s.events);
  const evaluation = useNWIS((s) => s.evaluation);
  const scenarioHighlight = useNWIS((s) => s.scenarioHighlight);
  const selectedWellId = useNWIS((s) => s.selectedWellId);
  const hoverWellId = useNWIS((s) => s.hoverWellId);
  const familyFilter = useNWIS((s) => s.familyFilter);
  const latestToast = useNWIS((s) => s.toasts.at(-1));
  const openWell = useNWIS((s) => s.openWell);
  const setHover = useNWIS((s) => s.setHover);

  const active = wells.find((w) => w.role === "active");
  const inRadius = wells.filter((w) => w.role === "offset" && w.distance_km <= radiusKm).length;

  // Wells to glow: offsets with events near the bit + the scenario's supporting wells.
  const highlight = useMemo(() => {
    const m = new Map<string, PinHighlight>();
    for (const h of evaluation?.context.highlighted_wells ?? []) {
      const fam = familyOf(h.event_types[0]);
      const ev = events
        .filter((e) => e.well_id === h.well_id && familyOf(e.event_type) === fam)
        .sort((a, b) => Math.abs(a.depth_start - depth) - Math.abs(b.depth_start - depth))[0];
      m.set(h.well_id, { color: FAMILY_META[fam].color, family: fam, depth: ev?.depth_start });
    }
    for (const id of scenarioHighlight) if (!m.has(id)) m.set(id, { color: SEVERITY_STYLE.critical.hex, family: "kick" });
    return m;
  }, [evaluation, scenarioHighlight, events, depth]);

  const nearEvents: DrillingEvent[] = useMemo(() => {
    if (!active) return [];
    const dist = new Map(wells.map((w) => [w.id, w.distance_km]));
    return events.filter((e) => e.well_id !== active.id && Math.abs((e.depth_start + e.depth_end) / 2 - depth) <= 150 && (dist.get(e.well_id) ?? 99) <= radiusKm);
  }, [events, wells, active, depth, radiusKm]);

  // ------------------------------------------------------------------ DOM hosts for portal-rendered markers
  const wellIds = wells.map((w) => w.id).join(",");
  const pinEls = useMemo(() => Object.fromEntries(wellIds.split(",").filter(Boolean).map((id) => [id, document.createElement("div")])), [wellIds]);
  const eventKey = nearEvents.map((e) => e.id).join(",");
  const eventEls = useMemo(() => Object.fromEntries(eventKey.split(",").filter(Boolean).map((id) => [id, document.createElement("div")])), [eventKey]);
  const radarEl = useMemo(() => document.createElement("div"), []);
  const bitEl = useMemo(() => document.createElement("div"), []);

  // ------------------------------------------------------------------ init
  useEffect(() => {
    if (!elRef.current) return;
    const intro = !introPlayed();
    const dark = document.documentElement.dataset.theme === "dark";
    styleKeyRef.current = "satellite:any";
    const map = new MLMap({
      container: elRef.current,
      style: styleFor("satellite", dark),
      center: intro ? [84.5, 22] : FIELD_VIEW.center,
      zoom: intro ? 2.3 : FIELD_VIEW.zoom,
      pitch: intro ? 0 : FIELD_VIEW.pitch,
      bearing: intro ? 0 : FIELD_VIEW.bearing,
      maxPitch: 78,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    let errors = 0;
    map.on("style.load", () => {
      addNwisLayers(map);
      map.setProjection({ type: "globe" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setSky(SKY as any);
      map.setTerrain(mode3dRef.current ? { source: DEM_SOURCE, exaggeration: 1.7 } : null);
      setStyleEpoch((e) => e + 1);
    });
    map.on("load", () => {
      elRef.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      if (!intro) return;
      markIntroPlayed();
      map.flyTo({ ...FIELD_VIEW, duration: 7000, curve: 1.65, essential: true });
    });
    map.on("zoom", () => sizeRadar(radarRef.current, map.getZoom()));
    map.on("zoomend", () => setZoomBucket(bucketOf(map.getZoom())));
    map.on("dragstart", () => setOrbit(false));
    map.on("error", (e) => {
      const src = (e as unknown as { sourceId?: string }).sourceId;
      if (src === "sat" || src === "labels" || src === "openmaptiles") {
        errors += 1;
        if (errors > 4) setOffline(true);
      }
    });
    mapRef.current = map;
    (window as unknown as { __nwisMap?: MLMap }).__nwisMap = map; // handle for E2E checks / screenshots
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------ basemap / theme
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dark = theme === "dark";
    const key = `${basemap}:${basemap === "streets" ? dark : "any"}`;
    if (key === styleKeyRef.current) return;
    styleKeyRef.current = key;
    map.setStyle(styleFor(basemap, dark));
  }, [basemap, theme]);

  // ------------------------------------------------------------------ 3D / 2D
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode3dRef.current === mode3d) return;
    mode3dRef.current = mode3d;
    map.setTerrain(mode3d ? { source: DEM_SOURCE, exaggeration: 1.7 } : null);
    // A flat view shows less ground than a pitched one at the same zoom — refit the core field.
    if (mode3d) map.flyTo({ ...FIELD_VIEW, duration: 1100 });
    else fitCore(map, 0, 1100);
  }, [mode3d]);

  // ------------------------------------------------------------------ vector data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active || !styleEpoch) return;
    const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
    const filtered = new Set(familyFilter);
    const isDim = (w: WellListItem) => w.role === "offset" && ((filtered.size > 0 && !w.risk_families.some((f) => filtered.has(f))) || w.distance_km > radiusKm);

    src("nwis-radius")?.setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(active.longitude, active.latitude, radiusKm)] } }],
    });
    src("nwis-rings")?.setData({
      type: "FeatureCollection",
      features: [1, 2].map((km) => ({ type: "Feature", properties: { km }, geometry: { type: "LineString", coordinates: circleRing(active.longitude, active.latitude, km) } })),
    });

    const traj: Feature[] = [];
    for (const w of wells) {
      const t = trajectories[w.id];
      if (!t?.length) continue;
      if (w.role === "active") {
        const drilled = t.filter((p) => !p.planned).map((p) => [p.lon, p.lat]);
        const planned = t.filter((p) => p.planned).map((p) => [p.lon, p.lat]);
        if (drilled.length) planned.unshift(drilled[drilled.length - 1]);
        traj.push({ type: "Feature", properties: { color: BRAND, width: 4, opacity: 1, planned: false }, geometry: { type: "LineString", coordinates: drilled } });
        if (planned.length > 1) traj.push({ type: "Feature", properties: { color: "#b9b1ff", width: 3, opacity: 0.9, planned: true }, geometry: { type: "LineString", coordinates: planned } });
      } else {
        const hl = highlight.get(w.id);
        const dim = isDim(w);
        traj.push({
          type: "Feature",
          properties: { color: hl?.color ?? "#ffffff", width: hl ? 3.2 : 2, opacity: dim ? 0.18 : hl ? 1 : 0.7, planned: false },
          geometry: { type: "LineString", coordinates: t.map((p) => [p.lon, p.lat]) },
        });
      }
    }
    src("nwis-traj")?.setData({ type: "FeatureCollection", features: traj });

    const links: Feature[] = [];
    for (const [id, hl] of highlight) {
      const w = wells.find((x) => x.id === id);
      if (!w || isDim(w)) continue;
      links.push({ type: "Feature", properties: { color: hl.color }, geometry: { type: "LineString", coordinates: [[active.longitude, active.latitude], [w.longitude, w.latitude]] } });
    }
    src("nwis-links")?.setData({ type: "FeatureCollection", features: links });

    const tw: Feature[] = [];
    if (towers) {
      for (const w of wells) {
        if (w.role === "active") {
          tw.push({ type: "Feature", properties: { color: BRAND, height: 300 }, geometry: { type: "Polygon", coordinates: [hexagon(w.longitude, w.latitude, 22)] } });
        } else if (!isDim(w)) {
          const color = highlight.get(w.id)?.color ?? (w.history_severity ? SEVERITY_STYLE[w.history_severity].hex : "#94a3b8");
          tw.push({ type: "Feature", properties: { color, height: 30 + w.npt_hours * 3.2 + w.event_count * 12 }, geometry: { type: "Polygon", coordinates: [hexagon(w.longitude, w.latitude, 34)] } });
        }
      }
    }
    src("nwis-towers")?.setData({ type: "FeatureCollection", features: tw });
  }, [styleEpoch, wells, trajectories, radiusKm, highlight, familyFilter, towers, active]);

  // Towers rise out of the ground whenever the style (re)loads.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleEpoch) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1600);
      const ease = 1 - Math.pow(1 - k, 3);
      if (map.getLayer("nwis-towers")) map.setPaintProperty("nwis-towers", "fill-extrusion-height", ["*", ["get", "height"], ease]);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [styleEpoch]);

  // Evidence links march from the active well towards the offsets that saw this depth before.
  const hasLinks = highlight.size > 0;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleEpoch || !hasLinks) return;
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % DASHES.length;
      if (map.getLayer("nwis-links")) map.setPaintProperty("nwis-links", "line-dasharray", DASHES[i]);
    }, 55);
    return () => clearInterval(timer);
  }, [styleEpoch, hasLinks]);

  // ------------------------------------------------------------------ markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = wells
      .filter((w) => pinEls[w.id])
      .map((w) => new Marker({ element: pinEls[w.id], anchor: "center", opacityWhenCovered: "1", subpixelPositioning: true }).setLngLat([w.longitude, w.latitude]).addTo(map));
    return () => markers.forEach((m) => m.remove());
  }, [wells, pinEls]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = nearEvents
      .map((e) => {
        const p = pointAtMd(trajectories[e.well_id], (e.depth_start + e.depth_end) / 2);
        const el = eventEls[e.id];
        return p && el ? new Marker({ element: el, anchor: "center", opacityWhenCovered: "1" }).setLngLat(p).addTo(map) : null;
      })
      .filter((m): m is Marker => Boolean(m));
    return () => markers.forEach((m) => m.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventEls, trajectories]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    const m = new Marker({ element: radarEl, anchor: "center", pitchAlignment: "map", rotationAlignment: "map", opacityWhenCovered: "1" }).setLngLat([active.longitude, active.latitude]).addTo(map);
    sizeRadar(radarRef.current, map.getZoom());
    return () => {
      m.remove();
    };
  }, [active, radarEl]);

  // The bit glides along the (surface projection of the) active trajectory.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    const start = pointAtMd(trajectories[active.id], useNWIS.getState().depth) ?? [active.longitude, active.latitude];
    bitPos.current = start;
    const m = new Marker({ element: bitEl, anchor: "center", opacityWhenCovered: "1" }).setLngLat(start).addTo(map);
    bitMarker.current = m;
    return () => {
      m.remove();
      bitMarker.current = null;
    };
  }, [active, trajectories, bitEl]);

  useEffect(() => {
    const marker = bitMarker.current;
    if (!marker || !active) return;
    const target = pointAtMd(trajectories[active.id], depth);
    if (!target) return;
    const from = bitPos.current ?? target;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 420);
      const e = 1 - Math.pow(1 - k, 3);
      const p: [number, number] = [from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e];
      bitPos.current = p;
      marker.setLngLat(p);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, trajectories, depth]);

  // ------------------------------------------------------------------ camera choreography
  // A new alert flies the camera to frame the active well and the offsets behind it.
  const toastKey = latestToast ? `${latestToast.id}:${latestToast.at}` : "";
  useEffect(() => {
    const map = mapRef.current;
    const toast = useNWIS.getState().toasts.at(-1);
    if (!map || !toastKey || !toast) return;
    const ids = new Set(toast.alert.assessment.supporting_wells.map((s) => s.well_id));
    const all = useNWIS.getState().wells;
    const pts = all.filter((w) => ids.has(w.id) || w.role === "active").map((w) => [w.longitude, w.latitude] as [number, number]);
    if (pts.length < 2) return;
    const b = pts.reduce((acc, p) => acc.extend(p), new LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, { padding: { top: 140, bottom: 140, left: 160, right: 160 }, maxZoom: 15.2, pitch: mode3dRef.current ? 60 : 0, bearing: map.getBearing() - 25, duration: 2200 });
  }, [toastKey]);

  useEffect(() => {
    const map = mapRef.current;
    const w = useNWIS.getState().wells.find((x) => x.id === selectedWellId);
    if (!map || !w || w.role === "active") return;
    map.easeTo({ center: [w.longitude, w.latitude], offset: [-160, 40], zoom: Math.max(map.getZoom(), 14.6), duration: 1200 });
  }, [selectedWellId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !orbit) return;
    let raf = 0;
    const step = () => {
      map.setBearing(map.getBearing() + 0.07);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [orbit]);

  const fit = (what: "field" | "radius") => {
    const map = mapRef.current;
    if (!map || !active) return;
    if (what === "radius") {
      const ring = circleRing(active.longitude, active.latitude, radiusKm, 32);
      const b = ring.reduce((acc, p) => acc.extend(p), new LngLatBounds(ring[0], ring[0]));
      map.fitBounds(b, { padding: 40, pitch: mode3dRef.current ? 45 : 0, duration: 1600 });
    } else if (mode3dRef.current) {
      map.flyTo({ ...FIELD_VIEW, duration: 1600 });
    } else {
      fitCore(map, 0, 1600);
    }
  };

  const filtered = new Set(familyFilter);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-[inherit] bg-[#0b1220]", className)}>
      {/* `!absolute`: maplibre-gl.css sets .maplibregl-map { position: relative }, which would collapse the height. */}
      <div ref={elRef} className="!absolute inset-0" />

      {/* portal-rendered markers */}
      {wells.map((w) => {
        const el = pinEls[w.id];
        if (!el) return null;
        const dim = w.role === "offset" && ((filtered.size > 0 && !w.risk_families.some((f) => filtered.has(f))) || w.distance_km > radiusKm);
        const hidden = zoomBucket === "far";
        return createPortal(
          <div className={cn("transition-opacity duration-500", hidden ? "pointer-events-none opacity-0" : "opacity-100")}>
            <WellPin
              w={w}
              depth={depth}
              highlight={highlight.get(w.id)}
              dim={dim}
              selected={selectedWellId === w.id}
              hover={hoverWellId === w.id}
              showLabel={zoomBucket === "near" || w.distance_km > 5}
              onClick={() => openWell(w.id)}
              onHover={(on) => setHover(on ? w.id : null)}
            />
          </div>,
          el,
          w.id,
        );
      })}
      {nearEvents.map((e) => {
        const el = eventEls[e.id];
        if (!el) return null;
        const fam = familyOf(e.event_type);
        const c = FAMILY_META[fam].color;
        return createPortal(
          <button
            onClick={() => openWell(e.well_id)}
            className={cn("group relative flex h-6 w-6 items-center justify-center transition-opacity", zoomBucket !== "near" && "opacity-0")}
            title={`${e.well_name}: ${EVENT_LABELS[e.event_type] ?? e.event_type} ${fmtDepth(e.depth_start)}–${fmtDepth(e.depth_end)} · ${e.formation} (subsurface position at event depth)`}
          >
            <span className="absolute inset-0 animate-pulse-ring rounded-[2px]" style={{ border: `2px solid ${c}` }} />
            <span className="flex h-5 w-5 rotate-45 items-center justify-center rounded-[2px] border-2 border-white shadow-lg" style={{ background: c, boxShadow: `0 0 16px ${c}` }}>
              <span className="-rotate-45">
                <FamilyIcon family={fam} size={10} color="#fff" />
              </span>
            </span>
          </button>,
          el,
          e.id,
        );
      })}
      {createPortal(
        // The marker element stays 0×0 at the well; this child is centred on it and sized per zoom.
        <div ref={radarRef} className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500">
          <div className="absolute inset-0 rounded-full border border-white/25 bg-[radial-gradient(circle,rgb(109_92_255/0.16)_0%,rgb(109_92_255/0.05)_55%,transparent_71%)]" />
          <div className="absolute inset-[25%] rounded-full border border-white/20" />
          <div className="absolute inset-0 animate-radar rounded-full [background:conic-gradient(from_0deg,rgb(160_150_255/0)_0deg,rgb(160_150_255/0)_290deg,rgb(170_160_255/0.22)_356deg,rgb(255_255_255/0.55)_360deg)] [mask:radial-gradient(circle,black_0%,black_70%,transparent_71%)]" />
        </div>,
        radarEl,
      )}
      {createPortal(
        <div className={cn("relative flex h-4 w-4 items-center justify-center transition-opacity duration-500", zoomBucket === "far" && "opacity-0")} title={`Bit at ${fmtDepth(depth)} MD (surface projection)`}>
          <span className="absolute h-4 w-4 rotate-45 rounded-[2px] border-2 border-white bg-[#6d5cff] shadow-[0_0_16px_#6d5cff]" />
        </div>,
        bitEl,
      )}

      {showControls && (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3">
            <div className="glass pointer-events-auto rounded-[4px] p-1.5">
              {modeSwitch ? (
                <div className="flex items-center gap-2 pb-1.5 pr-2">
                  {modeSwitch}
                  <span className="whitespace-nowrap text-[12.5px] font-bold text-ink-2">
                    {inRadius} offsets · {radiusKm} km
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand/70" />
                    <span className="relative h-2 w-2 rounded-full bg-brand" />
                  </span>
                  <span className="text-[13px] font-bold text-ink">
                    {inRadius} offset wells within {radiusKm} km
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Seg on={basemap === "satellite"} onClick={() => setBasemap("satellite")} title="Satellite imagery (Esri World Imagery)">
                  <Satellite size={14} /> Satellite
                </Seg>
                <Seg on={basemap === "streets"} onClick={() => setBasemap("streets")} title="Vector street map (OpenFreeMap)">
                  <MapIcon size={14} /> Map
                </Seg>
                <span className="mx-0.5 h-5 w-px bg-line-2" />
                <Seg on={mode3d} onClick={() => setMode3d(true)} title="3D terrain + pitched camera">
                  <Box size={14} /> 3D
                </Seg>
                <Seg on={!mode3d} onClick={() => setMode3d(false)} title="Flat plan view">
                  <Square size={13} /> 2D
                </Seg>
              </div>
            </div>
            {overlay && <div className="pointer-events-auto max-w-[58%]">{overlay}</div>}
          </div>
          <div className="glass absolute bottom-[132px] right-[10px] z-10 flex flex-col gap-1 rounded-[3px] p-1">
            <Tool onClick={() => fit("field")} title="Fly back to the core field">
              <Focus size={16} />
            </Tool>
            <Tool onClick={() => fit("radius")} title={`Zoom out to the ${radiusKm} km search radius`}>
              <Globe2 size={16} />
            </Tool>
            <Tool on={orbit} onClick={() => setOrbit(!orbit)} title="Orbit the field (presentation mode)">
              <Orbit size={16} />
            </Tool>
            <Tool on={towers} onClick={() => setTowers(!towers)} title="3D history towers: height = NPT + events, colour = worst event">
              <Box size={16} />
            </Tool>
          </div>
          {offline && (
            <div className="glass absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-[2px] px-3 py-1.5 text-[12.5px] font-semibold text-med-ink">
              <WifiOff size={13} /> Basemap offline — well layers unaffected
            </div>
          )}
        </>
      )}
      <MapLegend />
    </div>
  );
}

function Tool({ children, on = false, onClick, title }: { children: ReactNode; on?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn("flex h-[34px] w-[34px] items-center justify-center rounded-[3px] transition-all", on ? "bg-brand text-white shadow-brand" : "text-ink-2 hover:bg-surface-3 hover:text-ink")}
    >
      {children}
    </button>
  );
}

function Seg({ children, on = false, onClick, title }: { children: ReactNode; on?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-[12.5px] font-bold transition-all",
        on ? "bg-brand text-white shadow-brand" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
