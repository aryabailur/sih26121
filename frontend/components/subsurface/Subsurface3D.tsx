"use client";

import { Crosshair, Eye, Focus, Gem, Layers, Link2, Orbit, ScanLine, Shield } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { api } from "@/lib/api";
import { useNWIS } from "@/lib/store";
import type { DrillingEvent, FormationCorrelation, Severity } from "@/lib/types";
import { cn, EVENT_LABELS, FAMILY_META, familyOf, fmtDepth, fmtRange, formationColor, FORMATION_ORDER, SEVERITY_STYLE } from "@/lib/utils";
import {
  arcFraction,
  atMd,
  buildPath,
  depthY,
  disposeTree,
  idw,
  laminationTexture,
  pathCurve,
  ringTexture,
  satelliteMosaic,
  segmentCurve,
  toLatLon,
  VEX,
  type Origin,
  type WellPath,
} from "./geometry";
import { SUBSURFACE_FOCUS } from "./focus";

const BRAND = "#6d5cff";
const BIT = "#ffb020";
const GRID_N = 32;
const CORE_KM = 5;
const EVENT_SIZE: Record<Severity, number> = { low: 0.044, medium: 0.054, high: 0.066, critical: 0.08 };

export interface Toggles {
  strata: boolean;
  surfaces: boolean;
  xray: 0 | 1 | 2;
  events: boolean;
  hazards: boolean;
  links: boolean;
}
const XRAY_OPACITY = [0.9, 0.42, 0.08];
const XRAY_LABEL = ["Ground solid", "Ground translucent", "Full x-ray"];

interface HoverInfo {
  x: number;
  y: number;
  title: string;
  sub: string;
  color: string;
  hint: string;
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const backOut = (k: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

function labelEl(className: string, parts: { text: string; className?: string; style?: Partial<CSSStyleDeclaration> }[]) {
  const outer = document.createElement("div");
  outer.className = "pointer-events-none select-none";
  const inner = document.createElement("div");
  inner.className = className;
  for (const p of parts) {
    const s = document.createElement("span");
    s.textContent = p.text;
    if (p.className) s.className = p.className;
    if (p.style) Object.assign(s.style, p.style);
    inner.appendChild(s);
  }
  outer.appendChild(inner);
  return { outer, inner };
}

/**
 * Subsurface digital twin: a cut-away block of the field — strata walls and formation surfaces interpolated from
 * every offset's tops, true well paths (TVD), offset events at their depth, hazard sleeves along the active plan,
 * and a depth plane that follows the bit and links it to what offsets saw at this depth.
 */
export default function Subsurface3D({
  compact = false,
  className,
  modeSwitch,
  overlay,
}: {
  compact?: boolean;
  className?: string;
  modeSwitch?: ReactNode;
  overlay?: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [corr, setCorr] = useState<FormationCorrelation[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Toggles>({ strata: true, surfaces: true, xray: 1, events: true, hazards: true, links: true });
  const [orbit, setOrbit] = useState(true);
  const [follow, setFollow] = useState(true);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [legend, setLegend] = useState(false);
  const [satellite, setSatellite] = useState<"loading" | "ok" | "offline">("loading");
  const togglesRef = useRef(toggles);
  const orbitRef = useRef(orbit);
  const followRef = useRef(follow);
  const viewRef = useRef<{ reset: () => void } | null>(null);

  useEffect(() => {
    togglesRef.current = toggles;
  }, [toggles]);
  useEffect(() => {
    orbitRef.current = orbit;
  }, [orbit]);
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  const wells = useNWIS((s) => s.wells);
  const trajectories = useNWIS((s) => s.trajectories);
  const events = useNWIS((s) => s.events);
  const zones = useNWIS((s) => s.zones);
  const core = useMemo(() => wells.filter((w) => w.distance_km <= CORE_KM && trajectories[w.id]?.length), [wells, trajectories]);
  const coreKey = core.map((w) => w.id).join(",");

  useEffect(() => {
    if (!coreKey) return;
    let alive = true;
    api
      .correlate(coreKey.split(","))
      .then((r) => alive && setCorr(r.correlation))
      .catch((e) => alive && setFailed(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [coreKey]);

  // ------------------------------------------------------------------ scene
  useEffect(() => {
    const host = hostRef.current;
    const active = core.find((w) => w.role === "active");
    if (!host || !corr || !active) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      void Promise.resolve().then(() => setFailed("WebGL is not available in this browser."));
      return;
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
    host.prepend(renderer.domElement);
    const labels = new CSS2DRenderer();
    Object.assign(labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    host.insertBefore(labels.domElement, renderer.domElement.nextSibling);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0d16, 12, 26);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.64;
    controls.autoRotateSpeed = 0.55;
    controls.addEventListener("start", () => {
      if (orbitRef.current) setOrbit(false);
      fly = null;
    });

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4256, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(3, 6, 2);
    scene.add(sun);

    // ---------------------------------------------------------------- geometry of the field
    const origin: Origin = { lat: active.latitude, lon: active.longitude };
    const paths = new Map<string, WellPath>();
    for (const w of core) paths.set(w.id, buildPath(origin, trajectories[w.id]));
    const activePath = paths.get(active.id)!;
    let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity, ymin = 0;
    for (const p of paths.values())
      for (const q of p.points) {
        xmin = Math.min(xmin, q.x);
        xmax = Math.max(xmax, q.x);
        zmin = Math.min(zmin, q.z);
        zmax = Math.max(zmax, q.z);
        ymin = Math.min(ymin, q.y);
      }
    const cx = (xmin + xmax) / 2;
    const cz = (zmin + zmax) / 2;
    const half = Math.max(xmax - xmin, zmax - zmin) / 2 + 0.45;
    const W = half * 2;
    const x0 = cx - half, x1 = cx + half, z0 = cz - half, z1 = cz + half;
    const vxz = (vi: number): [number, number] => {
      const i = vi % (GRID_N + 1);
      const j = Math.floor(vi / (GRID_N + 1));
      return [x0 + (W * i) / GRID_N, z0 + (W * j) / GRID_N];
    };

    // Formation tops → interpolated surfaces (IDW over every well that penetrated the top).
    const layerNames = FORMATION_ORDER.filter((n) => corr.some((c) => c.formation === n));
    const grids: Float32Array[] = layerNames.map((name, k) => {
      const g = new Float32Array((GRID_N + 1) ** 2);
      if (k === 0) return g; // uppermost formation crops out at surface
      const c = corr.find((x) => x.formation === name)!;
      const pts = c.wells
        .filter((w) => paths.has(w.well_id))
        .map((w) => {
          const p = atMd(paths.get(w.well_id)!, w.top_md);
          return { x: p.x, z: p.z, v: p.y };
        });
      for (let vi = 0; vi < g.length; vi++) {
        const [x, z] = vxz(vi);
        g[vi] = idw(pts, x, z);
      }
      return g;
    });
    for (let k = 1; k < grids.length; k++) for (let vi = 0; vi < grids[k].length; vi++) grids[k][vi] = Math.min(grids[k][vi], grids[k - 1][vi] - 0.006);
    let lowest = ymin;
    for (const g of grids) for (const v of g) lowest = Math.min(lowest, v);
    const yBottom = lowest - 0.07;
    const layerColors = layerNames.map((n) => new THREE.Color(formationColor(n)));

    // ---------------------------------------------------------------- strata walls (cut-away "tank")
    const strata = new THREE.Group();
    scene.add(strata);
    const lam = laminationTexture();
    const wallMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: lam, side: THREE.BackSide });
    const border = {
      north: { idx: Array.from({ length: GRID_N + 1 }, (_, i) => i), out: new THREE.Vector3(0, 0, -1) },
      south: { idx: Array.from({ length: GRID_N + 1 }, (_, i) => GRID_N * (GRID_N + 1) + i), out: new THREE.Vector3(0, 0, 1) },
      west: { idx: Array.from({ length: GRID_N + 1 }, (_, j) => j * (GRID_N + 1)), out: new THREE.Vector3(-1, 0, 0) },
      east: { idx: Array.from({ length: GRID_N + 1 }, (_, j) => j * (GRID_N + 1) + GRID_N), out: new THREE.Vector3(1, 0, 0) },
    };
    for (const side of Object.values(border)) {
      const pos: number[] = [];
      const col: number[] = [];
      const uv: number[] = [];
      const index: number[] = [];
      let base = 0;
      layerNames.forEach((_, k) => {
        const c = layerColors[k];
        let dist = 0;
        side.idx.forEach((vi, s) => {
          const [x, z] = vxz(vi);
          if (s > 0) {
            const [px, pz] = vxz(side.idx[s - 1]);
            dist += Math.hypot(x - px, z - pz);
          }
          const yt = grids[k][vi];
          const yb = k + 1 < grids.length ? grids[k + 1][vi] : yBottom;
          pos.push(x, yt, z, x, yb, z);
          col.push(c.r, c.g, c.b, c.r * 0.7, c.g * 0.7, c.b * 0.7);
          uv.push(dist * 1.4, yt * 2.2, dist * 1.4, yb * 2.2);
        });
        for (let s = 0; s < side.idx.length - 1; s++) {
          const a = base + s * 2;
          index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        }
        base += side.idx.length * 2;
      });
      // Outward-facing winding so BackSide shows only the far walls from any orbit angle.
      const A = new THREE.Vector3(pos[0], pos[1], pos[2]);
      const B = new THREE.Vector3(pos[3], pos[4], pos[5]);
      const C = new THREE.Vector3(pos[6], pos[7], pos[8]);
      const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
      if (n.dot(side.out) < 0) for (let t = 0; t < index.length; t += 3) [index[t + 1], index[t + 2]] = [index[t + 2], index[t + 1]];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(index);
      strata.add(new THREE.Mesh(geo, wallMat));
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, W).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x10131c }));
    floor.position.set(cx, yBottom, cz);
    strata.add(floor);
    const floorGrid = new THREE.GridHelper(W, 12, 0x3a4260, 0x262c40);
    floorGrid.position.set(cx, yBottom + 0.002, cz);
    strata.add(floorGrid);

    // Formation surfaces: translucent sheets + a fine wireframe, the digital-twin look.
    const surfaces = new THREE.Group();
    scene.add(surfaces);
    const surfaceMats: THREE.MeshBasicMaterial[] = [];
    const cellIndex: number[] = [];
    for (let j = 0; j < GRID_N; j++)
      for (let i = 0; i < GRID_N; i++) {
        const a = j * (GRID_N + 1) + i;
        cellIndex.push(a, a + GRID_N + 1, a + 1, a + 1, a + GRID_N + 1, a + GRID_N + 2);
      }
    for (let k = 1; k < grids.length; k++) {
      const pos = new Float32Array(grids[k].length * 3);
      for (let vi = 0; vi < grids[k].length; vi++) {
        const [x, z] = vxz(vi);
        pos.set([x, grids[k][vi], z], vi * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setIndex(cellIndex);
      const fill = new THREE.MeshBasicMaterial({ color: layerColors[k], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      const wire = new THREE.MeshBasicMaterial({ color: layerColors[k], wireframe: true, transparent: true, opacity: 0 });
      surfaceMats.push(fill, wire);
      const m1 = new THREE.Mesh(geo, fill);
      const m2 = new THREE.Mesh(geo, wire);
      m1.renderOrder = m2.renderOrder = 1;
      surfaces.add(m1, m2);
    }

    // Ground: satellite imagery when reachable; translucent so the subsurface shows through ("x-ray").
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x33412f, transparent: true, opacity: XRAY_OPACITY[1], depthWrite: false });
    const groundGeo = new THREE.PlaneGeometry(W, W).rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(cx, 0.001, cz);
    ground.renderOrder = 6;
    scene.add(ground);
    const [south, west] = toLatLon(origin, x0, z1);
    const [north, east] = toLatLon(origin, x1, z0);
    void satelliteMosaic(south, west, north, east).then((res) => {
      if (disposed) {
        res?.texture.dispose();
        return;
      }
      if (!res) {
        setSatellite("offline");
        return;
      }
      const uvAttr = groundGeo.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uvAttr.count; i++) {
        uvAttr.setXY(i, res.uv.u0 + uvAttr.getX(i) * (res.uv.u1 - res.uv.u0), res.uv.v0 + uvAttr.getY(i) * (res.uv.v1 - res.uv.v0));
      }
      uvAttr.needsUpdate = true;
      groundMat.map = res.texture;
      groundMat.color.set(0xffffff);
      groundMat.needsUpdate = true;
      setSatellite("ok");
    });

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(W, -yBottom, W)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }),
    );
    frame.position.set(cx, yBottom / 2, cz);
    scene.add(frame);

    // Depth ticks on the front-left edge (TVD).
    const tickPts: number[] = [];
    for (let d = 500; depthY(d) > yBottom + 0.02; d += 500) {
      const y = depthY(d);
      tickPts.push(x0, y, z1, x0 + 0.09, y, z1);
      const { outer } = labelEl("font-mono text-[11px] font-semibold text-white/85 [transform:translateX(calc(-50%_-_10px))]", [{ text: `${d.toLocaleString("en-IN")} m` }]);
      const o = new CSS2DObject(outer);
      o.position.set(x0, y, z1);
      scene.add(o);
    }
    const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(tickPts, 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    scene.add(ticks);

    // ---------------------------------------------------------------- wells
    const pickables: THREE.Object3D[] = [];
    const wellRecs: { id: string; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; segs: number; radial: number; path: WellPath; active: boolean; delay: number; label: HTMLElement }[] = [];
    const wellGroup = new THREE.Group();
    scene.add(wellGroup);
    const sortedCore = [...core].sort((a, b) => a.distance_km - b.distance_km);
    sortedCore.forEach((w, n) => {
      const path = paths.get(w.id)!;
      const isActive = w.role === "active";
      const segs = 240;
      const radial = 8;
      const color = isActive ? BRAND : w.history_severity ? SEVERITY_STYLE[w.history_severity].hex : "#d6dbe6";
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isActive ? 0.6 : 0.3, roughness: 0.45, metalness: 0.05, transparent: true });
      const geo = new THREE.TubeGeometry(pathCurve(path), segs, isActive ? 0.026 : 0.011, radial, false);
      geo.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { kind: "well", id: w.id };
      wellGroup.add(mesh);
      pickables.push(mesh);
      if (isActive) {
        const ghost = new THREE.Mesh(
          new THREE.TubeGeometry(pathCurve(path), segs, 0.016, radial, false),
          new THREE.MeshBasicMaterial({ color: 0xb9b1ff, transparent: true, opacity: 0.4, depthWrite: false }),
        );
        ghost.renderOrder = 2;
        wellGroup.add(ghost);
      }
      const head = path.points[0];
      const derrick = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.ConeGeometry(isActive ? 0.05 : 0.035, isActive ? 0.2 : 0.13, 4, 1, true)),
        new THREE.LineBasicMaterial({ color: isActive ? 0xc9c2ff : 0xffffff, transparent: true, opacity: 0.95 }),
      );
      derrick.position.set(head.x, (isActive ? 0.2 : 0.13) / 2, head.z);
      wellGroup.add(derrick);
      const { outer, inner } = labelEl(
        cn(
          "flex items-center gap-1 whitespace-nowrap rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white ring-1 transition-all duration-300 [transform:translateY(-16px)]",
          isActive ? "bg-[#5b4bff] ring-white/40" : "bg-[#0b0f19]/80 ring-white/15",
        ),
        [{ text: w.name }],
      );
      if (compact && !isActive) inner.style.opacity = "0";
      const lab = new CSS2DObject(outer);
      lab.position.set(head.x, isActive ? 0.24 : 0.16, head.z);
      scene.add(lab);
      wellRecs.push({ id: w.id, mesh, mat, segs, radial, path, active: isActive, delay: n * 0.09, label: inner });
    });

    // Formation tops along the active well.
    const activeForms = corr
      .map((c) => ({ name: c.formation, top: c.wells.find((w) => w.well_id === active.id)?.top_md }))
      .filter((f): f is { name: string; top: number } => typeof f.top === "number" && f.top > 0);
    const formLabels: { el: HTMLElement; md: number }[] = [];
    activeForms.forEach((f, n) => {
      const p = atMd(activePath, f.top);
      // Alternate sides so closely spaced tops (Kopili / Sylhet) don't collide.
      const { outer, inner } = labelEl(
        cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-[2px] bg-[#0b0f19]/78 py-0.5 pl-1 pr-1.5 text-[11px] font-semibold text-white ring-1 ring-white/10 transition-opacity duration-300",
          n % 2 ? "[transform:translateX(calc(-50%_-_26px))]" : "[transform:translateX(calc(50%_+_26px))]",
        ),
        [
          { text: "", className: "inline-block h-3 w-1.5 rounded-[1px]", style: { background: formationColor(f.name) } },
          { text: f.name },
          { text: fmtDepth(f.top), className: "font-mono text-white/70" },
        ],
      );
      const o = new CSS2DObject(outer);
      o.position.set(p.x, p.y, p.z);
      if (!compact) scene.add(o);
      formLabels.push({ el: inner, md: f.top });
    });

    // ---------------------------------------------------------------- events
    const ringTex = ringTexture();
    const eventRecs: { e: DrillingEvent; gem: THREE.Mesh; mat: THREE.MeshStandardMaterial; halo: THREE.Sprite; interval: THREE.Mesh | null; base: number; delay: number; pos: THREE.Vector3; fam: string }[] = [];
    const eventGroup = new THREE.Group();
    scene.add(eventGroup);
    const coreEvents = events.filter((e) => paths.has(e.well_id)).sort((a, b) => a.depth_start - b.depth_start);
    coreEvents.forEach((e, n) => {
      const path = paths.get(e.well_id)!;
      const fam = familyOf(e.event_type);
      const color = FAMILY_META[fam].color;
      const base = EVENT_SIZE[e.severity];
      const mid = atMd(path, (e.depth_start + e.depth_end) / 2);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.28, flatShading: true, transparent: true });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(base, 0), mat);
      gem.position.set(mid.x, mid.y, mid.z);
      gem.scale.setScalar(0.001);
      gem.userData = { kind: "event", id: e.id };
      eventGroup.add(gem);
      pickables.push(gem);
      const seg = segmentCurve(path, e.depth_start, e.depth_end);
      let interval: THREE.Mesh | null = null;
      if (seg) {
        interval = new THREE.Mesh(new THREE.TubeGeometry(seg, 12, 0.024, 8, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
        eventGroup.add(interval);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.copy(gem.position);
      halo.renderOrder = 4;
      eventGroup.add(halo);
      eventRecs.push({ e, gem, mat, halo, interval, base, delay: n * 0.035, pos: gem.position.clone(), fam });
    });
    const eventById = new Map(eventRecs.map((r) => [r.e.id, r]));

    // ---------------------------------------------------------------- hazard sleeves along the active plan
    const sleeveRecs: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; start: number; end: number }[] = [];
    const sleeveGroup = new THREE.Group();
    scene.add(sleeveGroup);
    for (const z of zones) {
      const seg = segmentCurve(activePath, z.depth_start, z.depth_end);
      if (!seg) continue;
      const mat = new THREE.MeshBasicMaterial({ color: FAMILY_META[z.risk_type].color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(seg, 24, 0.07, 20, false), mat);
      mesh.renderOrder = 3;
      sleeveGroup.add(mesh);
      sleeveRecs.push({ mesh, mat, start: z.depth_start, end: z.depth_end });
    }

    // ---------------------------------------------------------------- bit + depth plane
    const bit = new THREE.Group();
    const bitCone = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 18), new THREE.MeshStandardMaterial({ color: BIT, emissive: BIT, emissiveIntensity: 0.7, roughness: 0.3 }));
    bitCone.rotation.x = Math.PI;
    bitCone.position.y = 0.03;
    const pulseMat = new THREE.MeshBasicMaterial({ color: BIT, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const pulse = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.005, 8, 56).rotateX(Math.PI / 2), pulseMat);
    bit.add(bitCone, pulse);
    scene.add(bit);
    const { outer: bitOuter, inner: bitInner } = labelEl(
      "flex items-center gap-1.5 whitespace-nowrap rounded-[2px] bg-[#ffb020] px-1.5 py-0.5 text-[11.5px] font-extrabold text-[#1a1203] shadow-lg [transform:translateX(calc(50%_+_22px))]",
      [{ text: "Bit" }, { text: "", className: "font-mono" }],
    );
    const bitLabel = new CSS2DObject(bitOuter);
    bit.add(bitLabel);

    const planeGroup = new THREE.Group();
    const planeMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, W).rotateX(-Math.PI / 2), planeMat);
    plane.renderOrder = 5;
    const planeGrid = new THREE.GridHelper(W, 18, 0x8c80ff, 0x8c80ff);
    const gridMat = planeGrid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    gridMat.opacity = 0;
    gridMat.depthWrite = false;
    const outlineMat = new THREE.LineBasicMaterial({ color: 0xb3aaff, transparent: true, opacity: 0 });
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, -half), new THREE.Vector3(half, 0, half), new THREE.Vector3(-half, 0, half)]),
      outlineMat,
    );
    const shockMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96).rotateX(-Math.PI / 2), shockMat);
    shock.renderOrder = 6;
    planeGroup.add(plane, planeGrid, outline);
    planeGroup.position.set(cx, 0, cz);
    scene.add(planeGroup, shock);

    // ---------------------------------------------------------------- evidence links (rebuilt as the bit moves)
    const linkGroup = new THREE.Group();
    scene.add(linkGroup);
    const particleGeo = new THREE.SphereGeometry(0.016, 10, 10);
    let links: { curve: THREE.QuadraticBezierCurve3; dots: THREE.Mesh[] }[] = [];
    let linkKey = "";
    let linkMd = -1;
    const rebuildLinks = (from: THREE.Vector3, ids: string[]) => {
      for (const c of [...linkGroup.children]) {
        linkGroup.remove(c);
        const m = c as THREE.Mesh;
        if (m.geometry !== particleGeo) m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      links = [];
      for (const id of ids) {
        const r = eventById.get(id);
        if (!r) continue;
        const to = r.pos;
        const mid = from.clone().add(to).multiplyScalar(0.5);
        mid.y += 0.12 + from.distanceTo(to) * 0.18;
        const curve = new THREE.QuadraticBezierCurve3(to.clone(), mid, from.clone());
        const color = FAMILY_META[r.fam as keyof typeof FAMILY_META].color;
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0065, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
        tube.renderOrder = 7;
        linkGroup.add(tube);
        const dots: THREE.Mesh[] = [];
        for (let k = 0; k < 5; k++) {
          const d = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          d.renderOrder = 8;
          linkGroup.add(d);
          dots.push(d);
        }
        links.push({ curve, dots });
      }
    };

    // ---------------------------------------------------------------- camera
    // Narrow panels (the Command Center) need the camera further back to keep the whole block in frame.
    const aspect0 = (host.clientWidth || 1) / (host.clientHeight || 1);
    const back = Math.min(1.75, Math.max(1, 1.45 / aspect0));
    const homeTarget = new THREE.Vector3(cx, yBottom * 0.45, cz);
    const home = {
      target: homeTarget,
      pos: homeTarget.clone().add(new THREE.Vector3(W * 1.02, W * 0.62 - yBottom * 0.45, W * 1.42).multiplyScalar(back)),
    };
    camera.position.set(cx + 0.01, W * 2.9, cz + 0.02);
    controls.target.copy(home.target);
    let fly: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number; dur: number } | null = {
      from: camera.position.clone(),
      to: home.pos.clone(),
      tFrom: home.target.clone(),
      tTo: home.target.clone(),
      t0: performance.now() + 150,
      dur: 3300,
    };
    const flyTo = (target: THREE.Vector3, dist: number, dur = 1800) => {
      const dir = camera.position.clone().sub(controls.target).normalize();
      if (dir.y < 0.45) dir.setY(0.55).normalize();
      const to = target.clone().add(dir.multiplyScalar(dist));
      to.y = Math.max(to.y, 0.45); // stay above the ground: always look into the block from above
      fly = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo: target.clone(), t0: performance.now(), dur };
    };
    const frameEvents = (ids: string[], from: THREE.Vector3) => {
      const pts = [from, ...ids.map((id) => eventById.get(id)?.pos).filter((p): p is THREE.Vector3 => Boolean(p))];
      const c = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      const r = Math.max(...pts.map((p) => p.distanceTo(c)), 0.35);
      flyTo(c, Math.min(7.5, Math.max(2.8, r * 4.2)));
    };
    viewRef.current = { reset: () => flyTo(home.target, home.pos.distanceTo(home.target), 1500) };
    const onFocus = (ev: Event) => {
      const id = (ev as CustomEvent<{ eventId: string }>).detail?.eventId;
      if (id && eventById.has(id)) frameEvents([id], bit.position.clone());
    };
    window.addEventListener(SUBSURFACE_FOCUS, onFocus);

    // ---------------------------------------------------------------- picking
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hovered: THREE.Object3D | null = null;
    let downAt: [number, number] | null = null;
    const pick = (clientX: number, clientY: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables.filter((o) => o.visible), false)[0];
      return hit?.object ?? null;
    };
    const describe = (o: THREE.Object3D): Omit<HoverInfo, "x" | "y"> | null => {
      const st = useNWIS.getState();
      if (o.userData.kind === "well") {
        const w = st.wells.find((x) => x.id === o.userData.id);
        if (!w) return null;
        return w.role === "active"
          ? { title: `${w.name} · active well`, sub: `Bit ${fmtDepth(st.depth)} MD · planned TD ${fmtDepth(w.total_depth_md)}`, color: BRAND, hint: "Click for the well profile" }
          : {
              title: w.name,
              sub: `${w.distance_km.toFixed(2)} km ${w.direction} · ${w.event_count} events · ${w.npt_hours} h NPT`,
              color: w.history_severity ? SEVERITY_STYLE[w.history_severity].hex : "#d6dbe6",
              hint: "Click for the well profile",
            };
      }
      const r = eventById.get(o.userData.id);
      if (!r) return null;
      const e = r.e;
      return {
        title: `${EVENT_LABELS[e.event_type] ?? e.event_type} · ${e.well_name ?? e.well_id}`,
        sub: `${fmtRange(e.depth_start, e.depth_end)} · ${e.formation} · ${SEVERITY_STYLE[e.severity].label}${e.npt_hours ? ` · ${e.npt_hours} h NPT` : ""}`,
        color: FAMILY_META[familyOf(e.event_type)].color,
        hint: e.source_document_id ? "Click to open the source report page" : "Click for the well profile",
      };
    };
    const onMove = (ev: PointerEvent) => {
      const o = pick(ev.clientX, ev.clientY);
      const r = host.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      renderer.domElement.style.cursor = o ? "pointer" : "grab";
      if (o !== hovered) {
        hovered = o;
        const d = o ? describe(o) : null;
        setHover(d ? { ...d, x, y } : null);
      } else if (tipRef.current) {
        tipRef.current.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
      }
    };
    const onLeave = () => {
      hovered = null;
      setHover(null);
    };
    const onDown = (ev: PointerEvent) => {
      downAt = [ev.clientX, ev.clientY];
    };
    const onUp = (ev: PointerEvent) => {
      if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;
      downAt = null;
      const o = pick(ev.clientX, ev.clientY);
      if (!o) return;
      const st = useNWIS.getState();
      if (o.userData.kind === "well") {
        const w = st.wells.find((x) => x.id === o.userData.id);
        if (w && w.role !== "active") st.openWell(w.id);
        return;
      }
      const e = eventById.get(o.userData.id)?.e;
      if (!e) return;
      if (e.source_document_id) st.openSource({ documentId: e.source_document_id, page: e.source_page, highlights: [EVENT_LABELS[e.event_type] ?? e.event_type, String(Math.round(e.depth_start))] });
      else st.openWell(e.well_id);
    };
    const el = renderer.domElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);

    // ---------------------------------------------------------------- size
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ---------------------------------------------------------------- frame loop
    const t0 = performance.now();
    let last = t0;
    let md = useNWIS.getState().depth;
    let lastEval: unknown = null;
    let context = new Set<string>();
    let lastToastAt = useNWIS.getState().toasts.at(-1)?.at ?? 0;
    let flash: { t0: number; color: THREE.Color } | null = null;
    const brandColor = new THREE.Color(BRAND);
    let bitText = "";

    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const T = (now - t0) / 1000;
      const tg = togglesRef.current;
      const st = useNWIS.getState();
      const introDone = T > 3.6;

      // Depth follows the store with a short glide.
      md += (st.depth - md) * (1 - Math.exp(-dt * 5.5));
      const bp = atMd(activePath, md);
      const bitPos = new THREE.Vector3(bp.x, bp.y, bp.z);

      // Context (events within the backend's context window of the bit) and alerts.
      if (st.evaluation !== lastEval) {
        lastEval = st.evaluation;
        context = new Set((st.evaluation?.context.nearby_events ?? []).map((e) => e.event_id));
      }
      // Only a newer toast (raised or escalated) flashes — not an older one resurfacing after a dismissal.
      const toast = st.toasts.at(-1);
      if (toast && toast.at > lastToastAt) {
        lastToastAt = toast.at;
        if (introDone) {
          flash = { t0: now, color: new THREE.Color(SEVERITY_STYLE[toast.alert.severity].hex) };
          frameEvents(toast.alert.assessment.evidence_ids ?? [], bitPos);
        }
      }
      const famFilter = new Set<string>(st.familyFilter);

      // Intro: strata extrude, surfaces fade in, wells drill, events pop.
      const kStrata = ease(clamp01((T - 0.15) / 1.5));
      strata.visible = tg.strata;
      strata.scale.y = Math.max(0.001, kStrata);
      strata.position.y = 0;
      surfaces.visible = tg.surfaces;
      surfaceMats.forEach((m, i) => {
        const k = Math.floor(i / 2);
        const f = clamp01((T - 0.9 - k * 0.14) / 0.6);
        m.opacity = (i % 2 === 0 ? 0.07 : 0.16) * f;
      });
      groundMat.opacity += (XRAY_OPACITY[tg.xray] * clamp01((T - 0.2) / 1) - groundMat.opacity) * 0.12;
      frame.visible = tg.strata;

      for (const w of wellRecs) {
        const r = ease(clamp01((T - 1.1 - w.delay) / 1.5));
        const reach = w.active ? arcFraction(w.path, md) : 1;
        w.mesh.geometry.setDrawRange(0, Math.floor(r * reach * w.segs) * w.radial * 6);
        const hl = hovered === w.mesh || st.selectedWellId === w.id || st.hoverWellId === w.id;
        const inCtx = !w.active && [...context].some((id) => eventById.get(id)?.e.well_id === w.id);
        w.mat.emissiveIntensity = w.active ? 0.95 : hl ? 1 : inCtx ? 0.75 : 0.3;
        const lab = w.label;
        const show = !compact || w.active || hl || inCtx;
        const want = show ? "1" : "0";
        if (lab.style.opacity !== want) lab.style.opacity = want;
      }

      const pulseT = (T * 1.1) % 1;
      for (const r of eventRecs) {
        const pop = backOut(clamp01((T - 2.1 - r.delay) / 0.45));
        const inCtx = context.has(r.e.id);
        const dim = famFilter.size > 0 && !famFilter.has(r.fam);
        const hl = hovered === r.gem;
        const s = inCtx ? 1.45 + 0.22 * Math.sin(T * 5) : hl ? 1.35 : 1;
        r.gem.visible = tg.events;
        r.gem.scale.setScalar(Math.max(0.001, pop * s));
        r.gem.rotation.y = T * 0.9 + r.delay * 10;
        r.mat.opacity = dim ? 0.18 : 1;
        r.mat.emissiveIntensity = inCtx || hl ? 0.95 : 0.5;
        if (r.interval) {
          r.interval.visible = tg.events;
          (r.interval.material as THREE.MeshBasicMaterial).opacity = (dim ? 0.15 : 0.85) * clamp01((T - 2.1 - r.delay) / 0.45);
        }
        const hm = r.halo.material as THREE.SpriteMaterial;
        if (inCtx && tg.events && !dim) {
          r.halo.visible = true;
          r.halo.scale.setScalar(r.base * (3 + pulseT * 5));
          hm.opacity = 0.9 * (1 - pulseT);
        } else {
          r.halo.visible = false;
        }
      }

      for (const s of sleeveRecs) {
        const inside = md >= s.start && md <= s.end;
        const passed = md > s.end;
        const base = inside ? 0.5 + 0.2 * Math.sin(T * 4) : passed ? 0.1 : 0.32;
        s.mat.opacity = base * clamp01((T - 2.4) / 0.8);
        s.mesh.visible = tg.hazards;
      }

      // Bit, pulse ring, depth plane.
      const kBit = clamp01((T - 1.8) / 0.6);
      bit.visible = kBit > 0;
      bit.position.copy(bitPos);
      bit.scale.setScalar(Math.max(0.001, backOut(kBit)));
      const pt = (T * 0.8) % 1;
      pulse.scale.setScalar(1 + pt * 2.2);
      pulseMat.opacity = 0.85 * (1 - pt);
      // Formation-top labels step aside near the bit (the bit label takes over).
      for (const f of formLabels) {
        const want = Math.abs(f.md - md) < 220 ? "0.15" : "1";
        if (f.el.style.opacity !== want) f.el.style.opacity = want;
      }
      const label = `${Math.round(md).toLocaleString("en-IN")} m`;
      if (label !== bitText) {
        bitText = label;
        (bitInner.lastChild as HTMLElement).textContent = label;
      }
      planeGroup.position.y = bp.y;
      let fk = 0;
      if (flash) {
        fk = clamp01(1 - (now - flash.t0) / 2600);
        if (fk <= 0) flash = null;
      }
      const planeColor = flash ? brandColor.clone().lerp(flash.color, fk) : brandColor;
      planeMat.color.copy(planeColor);
      gridMat.color.copy(planeColor);
      planeMat.opacity = (0.1 + 0.25 * fk) * kBit;
      gridMat.opacity = (0.26 + 0.4 * fk) * kBit;
      outlineMat.opacity = 0.85 * kBit;
      if (flash) {
        const k = 1 - fk;
        shock.visible = true;
        shock.position.set(bp.x, bp.y + 0.002, bp.z);
        shock.scale.setScalar(0.05 + ease(k) * half * 1.3);
        shockMat.color.copy(flash.color);
        shockMat.opacity = 0.9 * fk;
      } else {
        shock.visible = false;
      }

      // Evidence links: from each context event back to the bit, particles flowing to "now".
      const ids = tg.links && introDone ? [...context].filter((id) => !famFilter.size || famFilter.has(eventById.get(id)?.fam ?? "")) : [];
      const key = ids.join(",");
      if (key !== linkKey || (ids.length && Math.abs(md - linkMd) > 1.2)) {
        linkKey = key;
        linkMd = md;
        rebuildLinks(bitPos, ids);
      }
      for (const l of links)
        l.dots.forEach((d, k) => {
          const u = (T * 0.42 + k / l.dots.length) % 1;
          d.position.copy(l.curve.getPoint(u));
          (d.material as THREE.MeshBasicMaterial).opacity = Math.sin(u * Math.PI);
        });

      // Camera: scripted flights, then follow the bit / orbit.
      if (fly) {
        const k = clamp01((now - fly.t0) / fly.dur);
        const e = ease(k);
        camera.position.lerpVectors(fly.from, fly.to, e);
        controls.target.lerpVectors(fly.tFrom, fly.tTo, e);
        if (k >= 1) fly = null;
      } else if (followRef.current && introDone) {
        const want = bp.y + 0.35;
        const dy = (want - controls.target.y) * (1 - Math.exp(-dt * 1.6));
        controls.target.y += dy;
        camera.position.y = Math.max(0.45, camera.position.y + dy);
      }
      controls.autoRotate = orbitRef.current && !fly && introDone;
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener(SUBSURFACE_FOCUS, onFocus);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      ro.disconnect();
      controls.dispose();
      particleGeo.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.domElement.remove();
      viewRef.current = null;
    };
  }, [corr, core, trajectories, events, zones, compact]);

  const flip = (k: keyof Omit<Toggles, "xray">) => setToggles((t) => ({ ...t, [k]: !t[k] }));
  const layerNames = corr ? FORMATION_ORDER.filter((n) => corr.some((c) => c.formation === n)) : [];
  const offsets = core.filter((w) => w.role === "offset").length;

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-[inherit] bg-[#0a0d16]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#1b2140_0%,#0a0d16_62%)]" />
      <div ref={hostRef} className="absolute inset-0" />

      {!corr && !failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[13px] font-semibold text-white/80">
          <span className="h-14 w-14 animate-spin rounded-full border-[3px] border-white/10 border-t-[#ffb020]" />
          Building the subsurface model from {core.length || "…"} wells
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] font-semibold text-white/85">
          Subsurface view unavailable — {failed}
        </div>
      )}

      {/* header */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3">
        <div className="glass pointer-events-auto rounded-[4px] p-1.5">
          {modeSwitch ? (
            <div className="flex items-center gap-2 pr-2">
              {modeSwitch}
              <span className="whitespace-nowrap text-[12.5px] font-bold text-ink-2">
                {offsets} offsets · {layerNames.length || 6} formations
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#ffb020]/70" />
                  <span className="relative h-2 w-2 rounded-full bg-[#ffb020]" />
                </span>
                <span className="text-[13px] font-bold text-ink">
                  Subsurface · {offsets} offsets · {layerNames.length || 6} formations
                </span>
              </div>
              <div className="px-2 pb-1 text-[12.5px] text-ink-3">True well paths (TVD) · tops interpolated between wells</div>
            </>
          )}
        </div>
        {overlay && <div className="pointer-events-auto max-w-[58%]">{overlay}</div>}
      </div>

      {/* tools */}
      <div className="glass absolute bottom-3 right-3 z-10 flex flex-col gap-1 rounded-[3px] p-1">
        <Tool onClick={() => viewRef.current?.reset()} title="Reset the view">
          <Focus size={16} />
        </Tool>
        <Tool on={follow} onClick={() => setFollow(!follow)} title="Keep the bit in view as it drills">
          <Crosshair size={16} />
        </Tool>
        <Tool on={orbit} onClick={() => setOrbit(!orbit)} title="Orbit the field (presentation mode)">
          <Orbit size={16} />
        </Tool>
        <span className="mx-1 my-0.5 h-px bg-line-2" />
        <Tool on={toggles.strata} onClick={() => flip("strata")} title="Strata walls">
          <Layers size={16} />
        </Tool>
        <Tool on={toggles.surfaces} onClick={() => flip("surfaces")} title="Formation-top surfaces">
          <ScanLine size={16} />
        </Tool>
        <Tool on={toggles.xray !== 0} onClick={() => setToggles((t) => ({ ...t, xray: ((t.xray + 1) % 3) as Toggles["xray"] }))} title={`X-ray the ground — now: ${XRAY_LABEL[toggles.xray]}`}>
          <Eye size={16} />
        </Tool>
        <Tool on={toggles.events} onClick={() => flip("events")} title="Offset events at their depth">
          <Gem size={16} />
        </Tool>
        <Tool on={toggles.hazards} onClick={() => flip("hazards")} title="Hazard windows along the active plan">
          <Shield size={16} />
        </Tool>
        <Tool on={toggles.links} onClick={() => flip("links")} title="Evidence links: offsets that saw this depth → the bit">
          <Link2 size={16} />
        </Tool>
      </div>

      {/* legend */}
      <div className="glass absolute bottom-3 left-3 z-10 max-w-[260px] rounded-[3px] text-[12px]">
        <button onClick={() => setLegend(!legend)} className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 font-bold text-ink">
          Strata &amp; symbols <span className="text-[11px] font-semibold text-ink-3">{legend ? "Hide" : "Show"}</span>
        </button>
        {legend && (
          <div className="space-y-1 border-t border-line px-2.5 pb-2 pt-1.5">
            {layerNames.map((n) => (
              <div key={n} className="flex items-center gap-2 text-ink-2">
                <span className="h-3 w-3 rounded-[2px]" style={{ background: formationColor(n) }} />
                {n}
              </div>
            ))}
            <div className="mt-1.5 flex items-center gap-2 text-ink-2">
              <span className="h-2.5 w-2.5 rotate-45 rounded-[1px] bg-[#0ea5e9]" /> Offset event (colour = type)
            </div>
            <div className="flex items-center gap-2 text-ink-2">
              <span className="h-2.5 w-4 rounded-[1px] border border-[#d946ef]/80 bg-[#d946ef]/25" /> Hazard window on the plan
            </div>
            <div className="flex items-center gap-2 text-ink-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffb020]" /> Bit + depth plane
            </div>
            <div className="pt-1 text-[11px] text-ink-3">
              Depth ×{VEX} · ground {satellite === "ok" ? "Esri imagery" : satellite === "offline" ? "offline" : "loading"}
            </div>
          </div>
        )}
      </div>

      {hover && (
        <div
          ref={tipRef}
          className="pointer-events-none absolute left-0 top-0 z-20 max-w-[300px] rounded-[3px] border border-line bg-surface px-3 py-2 shadow-lg"
          style={{ transform: `translate(${hover.x + 16}px, ${hover.y + 14}px)` }}
        >
          <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hover.color }} />
            {hover.title}
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-2">{hover.sub}</div>
          <div className="mt-1 text-[11.5px] font-semibold text-brand-ink">{hover.hint}</div>
        </div>
      )}
    </div>
  );
}

function Tool({ children, on = false, onClick, title }: { children: ReactNode; on?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
      className={cn("flex h-[34px] w-[34px] items-center justify-center rounded-[3px] transition-all", on ? "bg-brand text-white shadow-brand" : "text-ink-2 hover:bg-surface-3 hover:text-ink")}
    >
      {children}
    </button>
  );
}
