// Renders the deck's hero graphics (HTML/SVG → PNG at 4x) with Playwright.
//   node diagrams.mjs            → .render/gen/{hero,laptop,arch}.png
// Sizes are in CSS px at 96 px = 1 inch, so a 660 px wide graphic is 6.875" on the slide.
import { chromium } from "playwright";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const NM = path.resolve(HERE, "..", "node_modules") + "/";
const React = require(NM + "react");
const { renderToStaticMarkup } = require(NM + "react-dom/server");
const lu = require(NM + "react-icons/lu");
const si = require(NM + "react-icons/si");
const OUT = path.join(HERE, ".render", "gen");
fs.mkdirSync(OUT, { recursive: true });

const ic = (name, color = "#fff", size = 16, lib = lu) =>
  renderToStaticMarkup(React.createElement(lib[name], { color, size: String(size), style: { flex: "none" } }));
const shot = (n) => pathToFileURL(path.join(ROOT, "docs", "screenshots", n)).href;

const C = {
  ink: "#0C0E14", navy: "#0E1530", navy2: "#1A2244", navy3: "#26305A", line: "#3A4570",
  indigo: "#5B4BFF", indigoInk: "#8F84FF", amber: "#F5A70F", cyan: "#0EA5E9", mag: "#D946EF", red: "#E5383B",
  crit: "#D92D32", green: "#12A679", soft: "#C9CEE0",
  barail: "#2F9FC2", kopili: "#8D68D6", sylhet: "#1FAE86", upper: "#7B86A3",
};

const FONT_FILE = (f) => pathToFileURL(path.join(process.env.WINDIR || "C:/Windows", "Fonts", f)).href;
const BASE_CSS = `
  @font-face{font-family:'Franklin Gothic Demi Cond';src:url('${FONT_FILE("FRADMCN.TTF")}')}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:transparent;font-family:'Segoe UI',sans-serif;font-weight:600;color:#fff;-webkit-font-smoothing:antialiased}
  .disp{font-family:'Franklin Gothic Demi Cond','Segoe UI',sans-serif;font-weight:400;letter-spacing:.1px}
  .mono{font-family:Consolas,monospace;font-weight:400}
`;

// ------------------------------------------------------------------ 1 · hero cross-section (slide 2)
function hero() {
  const W = 748, H = 252;
  const SURF = 36, TOPB = 58;
  const y = (d) => TOPB + (d - 2900) * 0.238; // 2,900 → 58 · 3,700 → 248
  const wells = [
    { x: 182, name: "OIL-AX-99" }, { x: 282, name: "OIL-AX-88" },
    { x: 382, name: "OIL-AX-102", active: true }, { x: 500, name: "OIL-AX-33" },
  ];
  // formation boundaries pass through each well's own picked top (correlation, not flat bands)
  const curve = (tops) => {
    const pts = [[0, tops[0]], [182, tops[1]], [382, tops[2]], [500, tops[3]], [W, tops[4]]].map(([px, d]) => [px, y(d)]);
    let p = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      p += ` C ${(x0 + x1) / 2} ${y0}, ${(x0 + x1) / 2} ${y1}, ${x1} ${y1}`;
    }
    return p;
  };
  const kopiliTop = curve([3310, 3300, 3290, 3305, 3325]);
  const sylhetTop = curve([3600, 3595, 3575, 3580, 3600]);
  const band = (topPath, fill, pat) =>
    `<path d="${topPath} L ${W} ${H} L 0 ${H} Z" fill="${fill}"/><path d="${topPath} L ${W} ${H} L 0 ${H} Z" fill="url(#${pat})"/>`;
  const activeX = 382, bit = 3100, bitY = y(bit);
  const events = [
    { well: 182, d0: 3150, d1: 3220, col: C.cyan, icon: "LuDroplets", label: "Mud loss", sub: "3,150 m · 18 h NPT", side: "left" },
    { well: 282, d0: 3380, d1: 3420, col: C.mag, icon: "LuLock", label: "Stuck pipe", sub: "3,380 m · 36 h NPT", side: "left" },
    { well: 500, d0: 3580, d1: 3610, col: C.red, icon: "LuFlame", label: "Kick", sub: "3,580 m · 12 h NPT", side: "right" },
  ];
  const tagW = 142;
  const svgEvents = events.map((e) => {
    const y0 = y(e.d0), h = Math.max(9, y(e.d1) - y(e.d0)), yc = y0 + h / 2;
    const tx = e.side === "left" ? e.well - tagW - 11 : e.well + 11;
    return `<line x1="${e.well}" y1="${yc}" x2="${activeX}" y2="${yc}" stroke="${e.col}" stroke-width="2.4" stroke-dasharray="6 4"/>
      <rect x="${activeX - 8}" y="${y0}" width="16" height="${h}" fill="${e.col}" stroke="#0B1024" stroke-width="1.2"/>
      <rect x="${e.well - 6}" y="${y0}" width="12" height="${h}" fill="${e.col}" stroke="#0B1024" stroke-width="1.2"/>
      <foreignObject x="${tx}" y="${yc - 18}" width="${tagW}" height="36"><div xmlns="http://www.w3.org/1999/xhtml" class="tag" style="border-color:${e.col}">
        <span class="tagi" style="background:${e.col}">${ic(e.icon, "#fff", 14)}</span><span><b>${e.label}</b><i>${e.sub}</i></span></div></foreignObject>`;
  }).join("");
  const wellSvg = wells.map((w) => {
    const col = w.active ? C.amber : "#EEF0F6";
    const derrick = `<path d="M ${w.x - 7} ${SURF} L ${w.x} ${SURF - 15} L ${w.x + 7} ${SURF} M ${w.x - 4} ${SURF - 6} L ${w.x + 4} ${SURF - 6}" stroke="${col}" stroke-width="1.8" fill="none"/>`;
    const label = `<text x="${w.x}" y="${SURF - 19}" text-anchor="middle" class="wl" fill="${col}">${w.name}</text>`;
    if (!w.active) return `<line x1="${w.x}" y1="${SURF}" x2="${w.x}" y2="${y(3700)}" stroke="#EEF0F6" stroke-width="2.2"/>` + derrick + label;
    return `<line x1="${w.x}" y1="${SURF}" x2="${w.x}" y2="${bitY}" stroke="${C.amber}" stroke-width="5"/>
      <line x1="${w.x}" y1="${bitY}" x2="${w.x}" y2="${y(3712)}" stroke="${C.amber}" stroke-width="2.2" stroke-dasharray="3 4"/>` + derrick + label;
  }).join("");
  const fm = (yy, t) => `<text x="22" y="${yy}" class="fm">${t}</text>`;
  const cardTop = 40, mudY = y(3185);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    .wrap{width:${W}px;height:${H}px;background:${C.navy};border-radius:8px;overflow:hidden;position:relative}
    svg text.wl{font:700 12px 'Segoe UI';letter-spacing:.2px}
    svg text.fm{font:700 11px 'Segoe UI';letter-spacing:1.6px;fill:#fff}
    svg text.up{font:700 10.5px 'Segoe UI';fill:#fff;letter-spacing:.4px}
    .tag{display:flex;align-items:center;gap:6px;background:#0B1024;border:1.8px solid;border-radius:4px;height:36px;padding:0 6px 0 5px}
    .tagi{width:23px;height:23px;border-radius:3px;display:flex;align-items:center;justify-content:center;flex:none}
    .tag b{display:block;font:700 13.5px 'Segoe UI';color:#fff;line-height:1.05}
    .tag i{display:block;font:600 11.5px 'Segoe UI';font-style:normal;color:#E3E6F0;line-height:1.25;white-space:nowrap}
    .card{position:absolute;left:552px;top:${cardTop}px;width:190px;background:#fff;border-radius:6px;overflow:hidden;color:${C.ink};box-shadow:4px 4px 0 #05070F}
    .card .h{background:${C.crit};color:#fff;padding:7px 9px;display:flex;gap:6px;align-items:center;font:700 13px 'Segoe UI';white-space:nowrap}
    .card .b{padding:7px 9px 6px;font:600 11.6px/1.28 'Segoe UI'}
    .card .b p{margin-bottom:4px}
    .card .ok{color:#0B7A58;font-weight:700}
    .card .f{display:flex;justify-content:space-between;align-items:center;gap:6px;border-top:1px solid #E3E6EC;padding:6px 9px;font:600 10.5px/1.2 'Segoe UI';color:#3D4452}
    .card .why{background:${C.indigo};color:#fff;font:700 11px 'Segoe UI';padding:3px 7px;border-radius:3px;flex:none}
    .bitlbl{position:absolute;font:700 12.5px 'Segoe UI';color:${C.ink};background:${C.amber};padding:2px 7px;border-radius:3px}
  </style></head><body><div class="wrap" id="cap">
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <pattern id="sand" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#fff" opacity=".22"/><circle cx="6.5" cy="6.5" r="1" fill="#fff" opacity=".22"/></pattern>
      <pattern id="shale" width="16" height="7" patternUnits="userSpaceOnUse"><line x1="1" y1="3.5" x2="9" y2="3.5" stroke="#fff" stroke-width="1.1" opacity=".22"/></pattern>
      <pattern id="lime" width="18" height="10" patternUnits="userSpaceOnUse"><path d="M0 .5H18M0 5.5H18M5 .5V5.5M14 5.5V10" stroke="#fff" stroke-width="1" opacity=".2" fill="none"/></pattern>
    </defs>
    <rect x="0" y="${SURF}" width="${W}" height="${TOPB - SURF}" fill="${C.upper}" opacity=".6"/>
    <rect x="0" y="${TOPB}" width="${W}" height="${H - TOPB}" fill="${C.barail}"/>
    <rect x="0" y="${TOPB}" width="${W}" height="${H - TOPB}" fill="url(#sand)"/>
    ${band(kopiliTop, C.kopili, "shale")}
    ${band(sylhetTop, C.sylhet, "lime")}
    <line x1="0" y1="${SURF}" x2="${W}" y2="${SURF}" stroke="#EEF0F6" stroke-width="1.6"/>
    <path d="M 0 ${TOPB - 1} l 7 -4 l 7 4 l 7 -4 l 7 4 l 7 -4 l 7 4" stroke="#fff" stroke-width="1.4" fill="none"/>
    <text x="52" y="${TOPB - 8}" class="up">0 – 2,900 m (compressed)</text>
    ${fm(80, "BARAIL")}${fm(172, "KOPILI")}${fm(244, "SYLHET")}
    ${wellSvg}
    ${svgEvents}
    <path d="M ${activeX} ${bitY - 9} L ${activeX + 9} ${bitY} L ${activeX} ${bitY + 9} L ${activeX - 9} ${bitY} Z" fill="${C.amber}" stroke="${C.ink}" stroke-width="1.6"/>
    <path d="M ${activeX + 9} ${mudY} H 538 V 92 H 552" stroke="${C.crit}" stroke-width="2.4" fill="none"/>
  </svg>
  <div class="bitlbl" style="left:${activeX + 14}px;top:${bitY - 12}px">Bit 3,100 m</div>
  <div class="card">
    <div class="h">${ic("LuTriangleAlert", "#fff", 15)} Mud-loss risk in 50 m</div>
    <div class="b">
      <p>2 offsets lost returns here — OIL-AX-99 lost 45 m³ at ECD 1.52 sg.</p>
      <p class="ok">✓ Keep ECD &lt; 1.48 sg · LCM ready</p>
    </div>
    <div class="f"><span>DDR OIL-AX-99 · p.3</span><span class="why">Why?</span></div>
  </div>
  </div></body></html>`;
  return { html, sel: "#cap" };
}

// ------------------------------------------------------------------ 2 · laptop mockup (slide 2)
function laptop() {
  const W = 520;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    .wrap{width:${W + 40}px;padding:0 0 2px}
    .lid{width:${W}px;margin:0 auto;background:#15171D;border-radius:13px 13px 0 0;padding:14px 12px 16px;position:relative}
    .lid:before{content:"";position:absolute;top:5px;left:50%;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#3A3E4A}
    .scr{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:2px}
    .base{width:${W + 40}px;height:15px;background:#C7CBD4;border-radius:0 0 12px 12px;position:relative;border-top:2px solid #9DA2AE}
    .base:before{content:"";position:absolute;left:50%;top:0;width:90px;margin-left:-45px;height:6px;background:#A9AEB9;border-radius:0 0 6px 6px}
  </style></head><body><div class="wrap" id="cap"><div class="lid"><img class="scr" src="${shot("02-mud-loss-alert.png")}"></div><div class="base"></div></div></body></html>`;
  return { html, sel: "#cap" };
}

// ------------------------------------------------------------------ 3 · architecture (slide 3)
function arch() {
  const W = 1205, H = 392;
  const chip = (icon, text, extra = "") => `<div class="chip" ${extra}>${ic(icon, "#fff", 15)}<span>${text}</span></div>`;
  const colHead = (n, color, text) => `<div class="ch"><span class="n" style="background:${color}">${n}</span>${text}</div>`;
  const svc = (icon, t, s, color, hot) => `<div class="svc${hot ? " hot" : ""}" style="${hot ? `background:${color}` : `border-color:${color}`}">
      <span class="si" style="background:${hot ? "rgba(255,255,255,.18)" : color}">${ic(icon, "#fff", 15)}</span><span><b>${t}</b><i>${s}</i></span></div>`;
  const steps = [
    ["Bit depth + live eRTMAC data", C.amber, C.ink],
    ["Offset events near each window", C.cyan, "#fff"],
    ["Six factor scores (0–1)", C.indigo, "#fff"],
    ["Weighted score → severity", C.mag, "#fff"],
    ["Alert: what · where · why", C.crit, "#fff"],
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    .wrap{width:${W}px;height:${H}px;background:${C.navy};border-radius:8px;position:relative;overflow:hidden}
    .cols{position:absolute;left:14px;top:14px;right:14px;height:268px;display:flex;gap:30px}
    .col{flex:none;display:flex;flex-direction:column;gap:7px;position:relative}
    .ch{display:flex;align-items:center;gap:7px;font:700 15.5px 'Segoe UI';color:#fff;height:24px;margin-bottom:2px;white-space:nowrap}
    .n{width:21px;height:21px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font:700 12.5px 'Segoe UI';color:#fff}
    .chip{display:flex;align-items:center;gap:8px;background:${C.navy2};border-radius:4px;padding:0 9px;height:33px;font:600 13.6px/1.1 'Segoe UI';color:#fff}
    .chip.live{background:${C.amber};color:${C.ink};font-weight:700}
    .step{display:flex;align-items:center;gap:8px;background:${C.indigo};border-radius:4px;padding:0 9px;height:43px;font:600 13.4px/1.15 'Segoe UI';color:#fff}
    .step.ok{background:${C.green}}
    .arrow-d{height:6px;display:flex;justify-content:center;margin:-4px 0}
    .svc{display:flex;align-items:center;gap:8px;border:1.5px solid;border-radius:4px;padding:0 8px;height:37px;background:${C.navy2}}
    .svc.hot{border-color:transparent}
    .si{width:24px;height:24px;border-radius:3px;display:flex;align-items:center;justify-content:center;flex:none}
    .svc b{display:block;font:700 13.4px/1.1 'Segoe UI';color:#fff}
    .svc i{display:block;font:600 11.6px/1.15 'Segoe UI';font-style:normal;color:#D5D9E8}
    .svc.hot i{color:#fff}
    .api{background:#fff;color:${C.ink};border-radius:4px;height:26px;display:flex;align-items:center;justify-content:center;gap:7px;font:700 12.5px 'Segoe UI'}
    .kbl{font:600 13px/1.35 'Segoe UI';color:#fff;text-align:center}
    .kbt{font:400 19px 'Franklin Gothic Demi Cond';color:#fff;text-align:center;line-height:1.05}
    .note{background:${C.navy2};border-radius:4px;padding:5px 8px;font:600 12px/1.25 'Segoe UI';color:#E6E9F2;text-align:center}
    .shot{width:100%;height:118px;border-radius:4px;object-fit:cover;object-position:52% 58%;border:1.5px solid #5A6690}
    .scr{font:600 13px/1.45 'Segoe UI';color:#fff}
    .scr div{display:flex;gap:6px;align-items:center}
    .scr div:before{content:"";width:6px;height:6px;background:${C.green};flex:none}
    .users{display:flex;gap:6px;margin-top:auto}
    .u{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font:600 12.2px/1.1 'Segoe UI';color:#fff;text-align:center}
    .u span{width:34px;height:34px;border-radius:4px;background:${C.green};display:flex;align-items:center;justify-content:center}
    .flow{position:absolute;top:128px;height:0;display:flex;align-items:center}
    .bound{position:absolute;left:236px;top:6px;right:6px;height:284px;border:1.8px dashed ${C.indigoInk};border-radius:6px}
    .bl{position:absolute;right:16px;top:-1px;transform:translateY(-50%);background:${C.navy};padding:0 7px;font:700 12px 'Segoe UI';color:#C8C2FF}
    .lane{position:absolute;left:14px;right:14px;bottom:14px;height:62px;display:flex;align-items:stretch;gap:0}
    .lanel{width:130px;flex:none;font:400 17px/1.05 'Franklin Gothic Demi Cond';color:#fff;display:flex;align-items:center;padding-right:8px}
    .chev{flex:1;display:flex;align-items:center;padding:0 12px 0 26px;font:700 13px/1.15 'Segoe UI';margin-left:-10px;
          clip-path:polygon(0 0,calc(100% - 16px) 0,100% 50%,calc(100% - 16px) 100%,0 100%,16px 50%);font-size:13.6px}
    .chev:first-of-type{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 50%,calc(100% - 16px) 100%,0 100%);padding-left:12px;margin-left:0}
    .chev b{font:400 22px 'Franklin Gothic Demi Cond';margin-right:8px;opacity:.95}
  </style></head><body><div class="wrap" id="cap">
    <div class="bound"><span class="bl">NWIS · on-prem inside OIL's network · runs offline</span></div>
    <div class="cols">
      <div class="col" style="width:196px">
        ${colHead(1, "#6B7699", "OIL data sources")}
        ${chip("LuFileText", "Well completion reports")}
        ${chip("LuFileScan", "Daily drilling reports")}
        ${chip("LuActivity", "Mud logs · drilling DB")}
        ${chip("LuTableProperties", "Casing · cement · mud")}
        ${chip("LuWaypoints", "Surveys · formation tops")}
        ${chip("LuRadio", "eRTMAC live stream", 'class="chip live" style="background:#F5A70F;color:#0C0E14"').replace(/#fff" size/, '#0C0E14" size')}
      </div>
      <div class="col" style="width:200px">
        ${colHead(2, C.indigo, "AI ingestion")}
        <div class="step">${ic("LuScanText", "#fff", 18)}<span>OCR scanned pages<br>(Tesseract)</span></div>
        <div class="arrow-d">${ic("LuArrowDown", "#C8C2FF", 14)}</div>
        <div class="step">${ic("LuBrainCircuit", "#fff", 18)}<span>NLP extracts events: type, depth, cause, fix, NPT</span></div>
        <div class="arrow-d">${ic("LuArrowDown", "#C8C2FF", 14)}</div>
        <div class="step">${ic("LuFiles", "#fff", 18)}<span>De-duplicate + score confidence</span></div>
        <div class="arrow-d">${ic("LuArrowDown", "#C8C2FF", 14)}</div>
        <div class="step ok">${ic("LuUserCheck", "#fff", 18)}<span>Engineer reviews → saved to the knowledge base</span></div>
      </div>
      <div class="col" style="width:196px">
        ${colHead(3, C.barail, "Knowledge base")}
        <svg width="196" height="180" viewBox="0 0 196 180">
          <defs><clipPath id="cyl"><path d="M6 16 A92 13 0 0 0 190 16 V164 A92 13 0 0 1 6 164 Z"/></clipPath></defs>
          <g clip-path="url(#cyl)">
            <rect x="0" y="0" width="196" height="180" fill="${C.barail}"/>
            <rect x="0" y="98" width="196" height="38" fill="${C.kopili}"/>
            <rect x="0" y="136" width="196" height="44" fill="${C.sylhet}"/>
          </g>
          <path d="M6 98 A92 13 0 0 0 190 98 M6 136 A92 13 0 0 0 190 136" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/>
          <ellipse cx="98" cy="16" rx="92" ry="13" fill="#58BCDB" stroke="#fff" stroke-width="1.6"/>
          <path d="M6 16 V164 A92 13 0 0 0 190 164 V16" fill="none" stroke="#fff" stroke-width="1.6"/>
        </svg>
        <div style="position:absolute;top:66px;left:0;width:196px">
          <div class="kbt">Depth-indexed<br>well memory</div>
          <div class="kbl" style="margin-top:2px">wells · formations · casing</div>
          <div class="kbl" style="margin-top:20px">events + source page</div>
          <div class="kbl" style="margin-top:21px">eRTMAC parameters</div>
        </div>
        <div class="note">SQLite → PostgreSQL + pgvector<br>BM25 + vector search index</div>
      </div>
      <div class="col" style="width:222px">
        ${colHead(4, C.mag, "Intelligence engine")}
        <div class="api">${ic("SiFastapi", "#009688", 15, si)} FastAPI · REST / OpenAPI</div>
        ${svc("LuShieldAlert", "Explainable risk engine", "6 factors · alert policy · audit", C.crit, true)}
        ${svc("LuFileSearch", "Evidence search", "hybrid retrieval · cited answers", C.cyan)}
        ${svc("LuGitCompare", "Similarity + mud window", "offset-calibrated limits", C.barail)}
        ${svc("LuSigma", "Learned cross-check", "logistic regression · AUC 0.86", C.indigo)}
        ${svc("LuClipboardList", "Look-ahead brief", "hazards · what worked · NPT ₹", C.amber)}
      </div>
      <div class="col" style="width:231px">
        ${colHead(5, C.green, "Cockpit & users")}
        <img class="shot" src="${shot("17-subsurface-3d.png")}">
        <div class="scr"><div>3D map · Subsurface 3D · Compare</div><div>Ask (cited) · Risk · Brief · Docs</div></div>
        <div class="users">
          <div class="u"><span>${ic("LuHardHat", "#fff", 19)}</span>Rig engineer</div>
          <div class="u"><span>${ic("LuMonitor", "#fff", 19)}</span>eRTMAC analyst</div>
          <div class="u"><span>${ic("LuBriefcase", "#fff", 19)}</span>Managers</div>
        </div>
      </div>
    </div>
    ${[0, 1, 2, 3].map((i) => {
      const lefts = [14 + 196, 14 + 196 + 30 + 200, 14 + 196 + 30 + 200 + 30 + 196, 14 + 196 + 30 + 200 + 30 + 196 + 30 + 222];
      return `<svg style="position:absolute;left:${lefts[i] + 3}px;top:132px" width="26" height="20" viewBox="0 0 26 20"><path d="M0 10 H18" stroke="#fff" stroke-width="3.2"/><path d="M15 3 L24 10 L15 17 Z" fill="#fff"/></svg>`;
    }).join("")}
    <svg style="position:absolute;left:0;top:0" width="${W}" height="${H}">
      <path d="M 112 268 V 314" stroke="${C.amber}" stroke-width="3" fill="none"/>
      <path d="M 1100 300 V 294" stroke="#fff" stroke-width="0"/>
    </svg>
    <div class="lane">
      <div class="lanel">How an alert<br>is raised</div>
      ${steps.map(([t, bg, fg], i) => `<div class="chev" style="background:${bg};color:${fg}"><b>${i + 1}</b>${t}</div>`).join("")}
    </div>
  </div></body></html>`;
  return { html, sel: "#cap" };
}

const jobs = { hero, laptop, arch };
const only = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 4, viewport: { width: 1400, height: 900 } });
for (const [name, fn] of Object.entries(jobs)) {
  if (only.length && !only.includes(name)) continue;
  const { html, sel } = fn();
  const file = path.join(OUT, `${name}.html`);
  fs.writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.locator(sel).screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: true });
  console.log("rendered", name);
}
await browser.close();
