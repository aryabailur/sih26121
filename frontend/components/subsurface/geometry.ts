import * as THREE from "three";
import type { Trajectory } from "@/lib/types";

/** Scene units are kilometres. Depth is drawn at VEX × true scale so the field reads as a slab, not a tower. */
export const VEX = 0.6;
const KM = 1 / 1000;
const M_PER_DEG_LAT = 110574;

export interface Origin {
  lat: number;
  lon: number;
}

export interface PathPoint {
  md: number;
  tvd: number;
  x: number;
  y: number;
  z: number;
}

export interface WellPath {
  points: PathPoint[];
  /** Cumulative scene arc length at each point — maps MD onto a tube's arc-length parameter. */
  arc: number[];
}

/** Local east (x) / south (z) kilometres from the origin; north is −z. */
export function toLocal(o: Origin, lat: number, lon: number): [number, number] {
  const x = ((lon - o.lon) * 111320 * Math.cos((o.lat * Math.PI) / 180)) * KM;
  const z = -(lat - o.lat) * M_PER_DEG_LAT * KM;
  return [x, z];
}

export function toLatLon(o: Origin, x: number, z: number): [number, number] {
  const lat = o.lat - (z / KM) / M_PER_DEG_LAT;
  const lon = o.lon + (x / KM) / (111320 * Math.cos((o.lat * Math.PI) / 180));
  return [lat, lon];
}

export const depthY = (tvd: number) => -tvd * KM * VEX;

export function buildPath(o: Origin, traj: Trajectory[]): WellPath {
  const points = traj.map((p) => {
    const [x, z] = toLocal(o, p.lat, p.lon);
    const tvd = p.tvd ?? p.md;
    return { md: p.md, tvd, x, y: depthY(tvd), z };
  });
  const arc = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    arc.push(arc[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return { points, arc };
}

/** Point on the path at a measured depth (linear between survey stations; clamps at the ends). */
export function atMd(path: WellPath, md: number): PathPoint {
  const p = path.points;
  if (!p.length) return { md, tvd: md, x: 0, y: depthY(md), z: 0 };
  if (md <= p[0].md) return p[0];
  for (let i = 1; i < p.length; i++) {
    if (p[i].md >= md) {
      const a = p[i - 1];
      const b = p[i];
      const t = (md - a.md) / (b.md - a.md || 1);
      const lerp = (u: number, v: number) => u + (v - u) * t;
      return { md, tvd: lerp(a.tvd, b.tvd), x: lerp(a.x, b.x), y: lerp(a.y, b.y), z: lerp(a.z, b.z) };
    }
  }
  return p[p.length - 1];
}

/** Fraction of the path's arc length reached at `md` (for tube draw-range reveals). */
export function arcFraction(path: WellPath, md: number): number {
  const p = path.points;
  const total = path.arc[path.arc.length - 1] || 1;
  if (!p.length || md <= p[0].md) return 0;
  for (let i = 1; i < p.length; i++) {
    if (p[i].md >= md) {
      const t = (md - p[i - 1].md) / (p[i].md - p[i - 1].md || 1);
      return (path.arc[i - 1] + (path.arc[i] - path.arc[i - 1]) * t) / total;
    }
  }
  return 1;
}

/** Sub-path between two MDs as a smooth curve (null when shorter than ~2 survey metres). */
export function segmentCurve(path: WellPath, from: number, to: number): THREE.CatmullRomCurve3 | null {
  if (to - from < 2) return null;
  const pts = [atMd(path, from), ...path.points.filter((p) => p.md > from && p.md < to), atMd(path, to)];
  return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)), false, "centripetal");
}

export function pathCurve(path: WellPath): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)), false, "centripetal");
}

/** Inverse-distance-weighted value at (x, z) from scattered control points. */
export function idw(pts: { x: number; z: number; v: number }[], x: number, z: number): number {
  let num = 0;
  let den = 0;
  for (const p of pts) {
    const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d2 < 1e-8) return p.v;
    const w = 1 / d2;
    num += w * p.v;
    den += w;
  }
  return den ? num / den : 0;
}

/** Faint horizontal lamination, multiplied over the strata colours on the block walls. */
export function laminationTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const y = rand() * c.height;
    g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.16})`;
    g.fillRect(0, y, c.width, 0.6 + rand() * 2.4);
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${rand() * 0.35})`;
    g.fillRect(rand() * c.width, rand() * c.height, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft ring used for halos around events at the bit's depth. */
export function ringTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ satellite mosaic for the ground plane
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const lon2tile = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const lat2tile = (lat: number, z: number) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const tile2lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * Stitch Esri World Imagery tiles covering [south, west, north, east] into one texture, and return the UV
 * rectangle of the requested box inside the mosaic. Resolves null when offline (the ground stays a flat colour).
 */
export async function satelliteMosaic(
  south: number,
  west: number,
  north: number,
  east: number,
  zoom = 15,
): Promise<{ texture: THREE.CanvasTexture; uv: { u0: number; u1: number; v0: number; v1: number } } | null> {
  const x0 = Math.floor(lon2tile(west, zoom));
  const x1 = Math.floor(lon2tile(east, zoom));
  const y0 = Math.floor(lat2tile(north, zoom));
  const y1 = Math.floor(lat2tile(south, zoom));
  const nx = x1 - x0 + 1;
  const ny = y1 - y0 + 1;
  if (nx * ny > 49) return null;
  const canvas = document.createElement("canvas");
  canvas.width = nx * 256;
  canvas.height = ny * 256;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const jobs: Promise<boolean>[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      jobs.push(
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            g.drawImage(img, (x - x0) * 256, (y - y0) * 256);
            resolve(true);
          };
          img.onerror = () => resolve(false);
          img.src = `${ESRI}/${zoom}/${y}/${x}`;
        }),
      );
    }
  }
  const ok = await Promise.all(jobs);
  if (ok.filter(Boolean).length < ok.length / 2) return null;
  const mw = tile2lon(x0, zoom);
  const me = tile2lon(x1 + 1, zoom);
  const mn = tile2lat(y0, zoom);
  const ms = tile2lat(y1 + 1, zoom);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const u = (lon: number) => (lon - mw) / (me - mw);
  const v = (lat: number) => (mercY(lat) - mercY(ms)) / (mercY(mn) - mercY(ms));
  return { texture, uv: { u0: u(west), u1: u(east), v0: v(south), v1: v(north) } };
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}
