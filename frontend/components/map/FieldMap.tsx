"use client";

import L from "leaflet";
import { Focus, Globe2, Layers, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNWIS } from "@/lib/store";
import type { Trajectory, WellListItem } from "@/lib/types";
import { cn, EVENT_LABELS, FAMILY_META, familyOf, fmtDepth, SEVERITY_STYLE } from "@/lib/utils";
import { MapLegend } from "./MapLegend";

const TILE_DARK = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const TILE_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function pointAtMd(traj: Trajectory[] | undefined, md: number): [number, number] | null {
  if (!traj?.length) return null;
  if (md <= traj[0].md) return [traj[0].lat, traj[0].lon];
  for (let i = 1; i < traj.length; i++) {
    if (traj[i].md >= md) {
      const a = traj[i - 1];
      const b = traj[i];
      const t = (md - a.md) / (b.md - a.md || 1);
      return [a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t];
    }
  }
  const last = traj[traj.length - 1];
  return [last.lat, last.lon];
}

function markerHtml(w: WellListItem, o: { highlight?: string; dim: boolean; selected: boolean; hover: boolean }) {
  if (w.role === "active") {
    return `<div class="well-marker active" style="width:16px;height:16px;color:#22d3ee"><div class="ring"></div><div class="ring" style="animation-delay:1.1s"></div><div class="dot"></div></div>`;
  }
  const sev = w.history_severity;
  const fill = sev ? SEVERITY_STYLE[sev].hex : "#475569";
  const size = o.selected || o.hover ? 15 : 12;
  const ring = o.highlight ? `<div class="ring" style="color:${o.highlight}"></div>` : "";
  const border = o.selected || o.hover ? "border-color:#f8fafc" : o.highlight ? `border-color:${o.highlight}` : "";
  return `<div class="well-marker" style="width:${size}px;height:${size}px;opacity:${o.dim ? 0.28 : 1};color:${o.highlight ?? fill}">${ring}<div class="dot" style="background:${fill};${border};box-shadow:0 0 ${o.highlight ? 14 : 6}px ${o.highlight ?? fill}66"></div></div>`;
}

export default function FieldMap({ className, showControls = true }: { className?: string; showControls?: boolean }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<{ traj: L.LayerGroup; wells: L.LayerGroup; overlay: L.LayerGroup; labels: L.LayerGroup; base?: L.TileLayer } | null>(null);
  const [zoom, setZoom] = useState(14);
  const [offline, setOffline] = useState(false);
  const [basemap, setBasemap] = useState<"dark" | "sat">("dark");

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
  const openWell = useNWIS((s) => s.openWell);
  const setHover = useNWIS((s) => s.setHover);

  const active = wells.find((w) => w.role === "active");

  // Wells to glow: offsets with events near the bit + alerts' supporting wells in the scenario.
  const highlight = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of evaluation?.context.highlighted_wells ?? []) {
      m.set(h.well_id, FAMILY_META[familyOf(h.event_types[0])].color);
    }
    for (const id of scenarioHighlight) if (!m.has(id)) m.set(id, "#ef4444");
    return m;
  }, [evaluation, scenarioHighlight]);

  // ---------------------------------------------------------------- init
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: true, minZoom: 8, maxZoom: 17, zoomSnap: 0.25 });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.setView([27.2515, 95.3525], 14);
    const traj = L.layerGroup().addTo(map);
    const overlay = L.layerGroup().addTo(map);
    const wellsL = L.layerGroup().addTo(map);
    const labels = L.layerGroup().addTo(map);
    layers.current = { traj, wells: wellsL, overlay, labels };
    map.on("zoomend", () => setZoom(map.getZoom()));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layers.current = null;
    };
  }, []);

  // ---------------------------------------------------------------- basemap
  useEffect(() => {
    const map = mapRef.current;
    const l = layers.current;
    if (!map || !l) return;
    l.base?.remove();
    const base = L.tileLayer(basemap === "dark" ? TILE_DARK : TILE_SAT, {
      maxZoom: 19,
      maxNativeZoom: basemap === "dark" ? 16 : 18,
      attribution: basemap === "dark" ? "Tiles &copy; Esri — Esri, HERE, Garmin" : "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    });
    let errors = 0;
    base.on("tileerror", () => {
      errors += 1;
      if (errors > 3) setOffline(true);
    });
    base.on("tileload", () => setOffline(false));
    base.addTo(map);
    base.bringToBack();
    l.base = base;
  }, [basemap]);

  // ---------------------------------------------------------------- vector layers
  useEffect(() => {
    const l = layers.current;
    if (!l || !active) return;
    l.traj.clearLayers();
    l.wells.clearLayers();
    l.overlay.clearLayers();
    l.labels.clearLayers();
    const center: L.LatLngExpression = [active.latitude, active.longitude];

    // radius + range rings
    L.circle(center, { radius: radiusKm * 1000, color: "#22d3ee", weight: 1.2, dashArray: "6 6", fillColor: "#22d3ee", fillOpacity: 0.025, interactive: false }).addTo(l.overlay);
    for (const km of [1, 2]) {
      L.circle(center, { radius: km * 1000, color: "#1e3a5f", weight: 1, dashArray: "2 5", fill: false, interactive: false }).addTo(l.overlay);
      L.marker([active.latitude + km / 111.32, active.longitude], {
        icon: L.divIcon({ className: "", html: `<span style="font:600 9px var(--font-mono);color:#475569">${km} km</span>`, iconSize: [30, 10] }),
        interactive: false,
      }).addTo(l.overlay);
    }

    const filtered = new Set(familyFilter);
    for (const w of wells) {
      const t = trajectories[w.id];
      if (t?.length) {
        const hl = highlight.get(w.id);
        if (w.role === "active") {
          const drilled = t.filter((p) => !p.planned).map((p) => [p.lat, p.lon] as [number, number]);
          const planned = t.filter((p, i) => p.planned || (i > 0 && t[i - 1] && !t[i - 1].planned && p.planned)).map((p) => [p.lat, p.lon] as [number, number]);
          if (drilled.length) planned.unshift(drilled[drilled.length - 1]);
          L.polyline(drilled, { color: "#22d3ee", weight: 3, opacity: 0.95 }).addTo(l.traj);
          L.polyline(planned, { color: "#22d3ee", weight: 2, opacity: 0.6, dashArray: "4 6" }).addTo(l.traj);
          const bit = pointAtMd(t, depth);
          if (bit) {
            L.marker(bit, {
              icon: L.divIcon({
                className: "",
                html: `<div title="Bit position ${Math.round(depth)} m MD" style="width:12px;height:12px;transform:rotate(45deg);background:#0a0e17;border:2px solid #67e8f9;box-shadow:0 0 12px #22d3ee"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              }),
              zIndexOffset: 900,
            })
              .bindTooltip(`Bit @ ${fmtDepth(depth)} MD (surface projection)`, { className: "nwis-tip", direction: "top" })
              .addTo(l.overlay);
          }
        } else {
          const dim = filtered.size > 0 && !w.risk_families.some((f) => filtered.has(f));
          L.polyline(t.map((p) => [p.lat, p.lon] as [number, number]), {
            color: hl ?? "#64748b",
            weight: hl ? 2.2 : 1.4,
            opacity: dim ? 0.15 : hl ? 0.9 : 0.55,
          }).addTo(l.traj);
        }
      }
    }

    // Subsurface location of offset events near the current bit depth.
    const near = events.filter(
      (e) => e.well_id !== active.id && Math.abs((e.depth_start + e.depth_end) / 2 - depth) <= 150 &&
        (wells.find((w) => w.id === e.well_id)?.distance_km ?? 99) <= radiusKm,
    );
    for (const e of near) {
      const p = pointAtMd(trajectories[e.well_id], (e.depth_start + e.depth_end) / 2);
      if (!p) continue;
      const c = FAMILY_META[familyOf(e.event_type)].color;
      L.marker(p, {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:10px;height:10px;transform:rotate(45deg);background:${c};border:1.5px solid #0a0e17;box-shadow:0 0 10px ${c}"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
        zIndexOffset: 800,
      })
        .bindTooltip(
          `<b>${e.well_name}</b> · ${EVENT_LABELS[e.event_type] ?? e.event_type}<br/>${fmtDepth(e.depth_start)}–${fmtDepth(e.depth_end)} · ${e.formation}<br/><span style="color:#94a3b8">${e.severity.toUpperCase()} · subsurface location at event depth</span>`,
          { className: "nwis-tip", direction: "top" },
        )
        .on("click", () => openWell(e.well_id))
        .addTo(l.overlay);
    }

    // Surface well markers.
    for (const w of wells) {
      const dim = w.role === "offset" && ((familyFilter.length > 0 && !w.risk_families.some((f) => filtered.has(f))) || w.distance_km > radiusKm);
      const m = L.marker([w.latitude, w.longitude], {
        icon: L.divIcon({
          className: "",
          html: markerHtml(w, { highlight: highlight.get(w.id), dim, selected: selectedWellId === w.id, hover: hoverWellId === w.id }),
          iconSize: w.role === "active" ? [16, 16] : [14, 14],
          iconAnchor: w.role === "active" ? [8, 8] : [7, 7],
        }),
        zIndexOffset: w.role === "active" ? 1000 : highlight.has(w.id) ? 500 : 0,
      });
      const fams = w.risk_families.map((f) => `<span style="color:${FAMILY_META[f].color}">${FAMILY_META[f].short}</span>`).join(" ");
      m.bindTooltip(
        `<div style="font-weight:600;color:#f8fafc">${w.name} <span style="color:#64748b;font-weight:400">${w.id}</span></div>
         <div style="color:#94a3b8">${w.role === "active" ? "ACTIVE · drilling" : w.status} · TD ${fmtDepth(w.total_depth_md)}</div>
         ${w.role === "offset" ? `<div style="color:#94a3b8">${w.distance_km.toFixed(2)} km ${w.direction} · similarity ${Math.round((w.similarity ?? 0) * 100)}%</div><div>${w.event_count} events ${fams}</div>` : ""}`,
        { className: "nwis-tip", direction: "top", offset: [0, -8] },
      );
      m.on("click", () => openWell(w.id));
      m.on("mouseover", () => setHover(w.id));
      m.on("mouseout", () => setHover(null));
      m.addTo(l.wells);
      if (zoom >= 13.5 || w.role === "active") {
        L.marker([w.latitude, w.longitude], { interactive: false, icon: L.divIcon({ className: "", html: "", iconSize: [0, 0] }) })
          .bindTooltip(w.name, { permanent: true, direction: "right", offset: [9, 0], className: "nwis-label" })
          .addTo(l.labels);
      }
    }
  }, [wells, trajectories, radiusKm, depth, events, highlight, selectedWellId, hoverWellId, familyFilter, zoom, active, openWell, setHover]);

  const fit = (what: "field" | "radius") => {
    const map = mapRef.current;
    if (!map || !active) return;
    if (what === "radius") {
      map.fitBounds(L.latLng(active.latitude, active.longitude).toBounds(radiusKm * 2000 * 1.05), { padding: [20, 20] });
    } else {
      const core = wells.filter((w) => w.distance_km <= 5);
      map.fitBounds(L.latLngBounds(core.map((w) => [w.latitude, w.longitude] as [number, number])).pad(0.25));
    }
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}>
      <div ref={elRef} className="nwis-map-grid absolute inset-0" />
      {showControls && (
        <div className="absolute left-2 top-2 z-[500] flex flex-col gap-1.5">
          <div className="glass flex overflow-hidden rounded-md text-[10px] font-semibold uppercase tracking-wider">
            <button onClick={() => fit("field")} className="flex items-center gap-1 px-2 py-1.5 text-slate-300 hover:bg-white/5 hover:text-cyan-200" title="Zoom to the core field">
              <Focus size={12} /> Field
            </button>
            <button onClick={() => fit("radius")} className="flex items-center gap-1 border-l border-cockpit-line px-2 py-1.5 text-slate-300 hover:bg-white/5 hover:text-cyan-200" title="Zoom to the search radius">
              <Globe2 size={12} /> {radiusKm} km
            </button>
            <button
              onClick={() => setBasemap(basemap === "dark" ? "sat" : "dark")}
              className="flex items-center gap-1 border-l border-cockpit-line px-2 py-1.5 text-slate-300 hover:bg-white/5 hover:text-cyan-200"
              title="Toggle basemap"
            >
              <Layers size={12} /> {basemap === "dark" ? "Dark" : "Imagery"}
            </button>
          </div>
          {offline && (
            <div className="glass flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-amber-200">
              <WifiOff size={11} /> Basemap offline — well layers unaffected
            </div>
          )}
        </div>
      )}
      <MapLegend />
    </div>
  );
}
