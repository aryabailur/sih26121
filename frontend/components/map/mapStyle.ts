import type { StyleSpecification } from "maplibre-gl";

/** Key-free basemaps: Esri World Imagery (+ reference labels), OpenFreeMap vector styles, AWS Terrarium DEM. */
export const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
export const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const STREETS_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
export const STREETS_DARK = "https://tiles.openfreemap.org/styles/dark";

export type Basemap = "satellite" | "streets";

export const DEM_SOURCE = "nwis-dem";

export const SKY = {
  "sky-color": "#6fb3ff",
  "horizon-color": "#dbeafe",
  "fog-color": "#e7eef9",
  "sky-horizon-blend": 0.55,
  "horizon-fog-blend": 0.6,
  "fog-ground-blend": 0.35,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 8, 0.6, 12, 0],
} as const;

export function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sources: {
      sat: {
        type: "raster",
        tiles: [ESRI_SAT],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      },
      labels: { type: "raster", tiles: [ESRI_LABELS], tileSize: 256, maxzoom: 19 },
      [DEM_SOURCE]: { type: "raster-dem", tiles: [TERRARIUM], encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: "Terrain: Mapzen / AWS Open Data" },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sky: SKY as any,
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0b1220" } },
      { id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": 0.12, "raster-contrast": 0.06, "raster-fade-duration": 250 } },
      { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.9 } },
    ],
  };
}

export function styleFor(basemap: Basemap, dark: boolean): StyleSpecification | string {
  if (basemap === "satellite") return satelliteStyle();
  return dark ? STREETS_DARK : STREETS_LIGHT;
}

/** Geodesic circle polygon ring (lon/lat) — radius in km. */
export function circleRing(lon: number, lat: number, km: number, steps = 96): [number, number][] {
  const out: [number, number][] = [];
  const d = km / 6371;
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const b = (i / steps) * 2 * Math.PI;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    out.push([(lo2 * 180) / Math.PI, (la2 * 180) / Math.PI]);
  }
  return out;
}

/** Metres per CSS pixel at a latitude and zoom (MapLibre's 512-px world). */
export const metersPerPixel = (lat: number, zoom: number) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
