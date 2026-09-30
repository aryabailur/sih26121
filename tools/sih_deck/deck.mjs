// NWIS — SIH 2026 idea deck. Six slides as HTML/SVG on a replica of the official template chrome, rendered by
// Playwright into a vector PDF (+ QA PNGs + transparent overlays that build.py lays onto the real .pptx template).
//   node deck.mjs            (build.py writes .render/config.json first and runs this)
// Canvas: 1280 × 720 CSS px = 13.333 × 7.5 in (96 px = 1 in, 1 pt = 1.333 px). Numbers come from facts.json.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NM = path.resolve(HERE, "..", "node_modules") + "/";
const React = require(NM + "react");
const { renderToStaticMarkup } = require(NM + "react-dom/server");
const LIB = { si: require(NM + "react-icons/si"), lu: require(NM + "react-icons/lu") };
const RENDER = path.join(HERE, ".render");
const CFG = JSON.parse(fs.readFileSync(path.join(RENDER, "config.json"), "utf8"));
const F = JSON.parse(fs.readFileSync(path.join(HERE, "facts.json"), "utf8"));

// Verified by the test run that produced facts.json (pytest -q, tests.requirements_check) — re-check if they change.
const TESTS = 22;
const REQS = 20;

// ------------------------------------------------------------------------------------------------ helpers
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ic = (lib, name, color = "#1B1A17", size = 16) =>
  renderToStaticMarkup(React.createElement(LIB[lib][name], { color, size: String(size), style: { flex: "none", display: "block" } }));
const num = (v, d = 0) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const TEAM = CFG.team_name || "Team name";
const od = F.opendata.shelf;
const spot = F.opendata.area.spotcheck;
const learned = F.model.learned;
const FA = F.first_alerts;
const at3100 = F.at_3100.mud_loss;
const brief = F.brief;
const byHaz = Object.fromEntries(brief.hazards.map((h) => [h.risk_type, h]));
const lakh = (hours, rate = 30) => (hours / 24) * rate; // ₹ lakh at the assumed spread rate
const pct = (v) => `${Math.round(v * 100)} %`;

const C = {
  ink: "#1B1A17", ink2: "#46423B", ink3: "#6B665C", rule: "#D5CCBB", hair: "#E7E0D2", sand: "#F6F1E7",
  navy: "#1F3A5F", marker: "#FFD54A", yellow: "#F2B705", red: "#B42318", green: "#2E7D32", amber: "#B45309",
  mud: "#2F6FA8", stuck: "#B7791F", kick: "#B42318", grey: "#CFC8BA",
};

const YES = `<svg class="mk" width="17" height="17" viewBox="0 0 17 17"><rect x=".75" y=".75" width="15.5" height="15.5" fill="#E5F1E4" stroke="#2E7D32" stroke-width="1.5"/><path d="M4.2 8.8l2.9 2.9 5.8-6.3" fill="none" stroke="#2E7D32" stroke-width="2.3"/></svg>`;
const NO = `<svg class="mk" width="17" height="17" viewBox="0 0 17 17"><rect x=".75" y=".75" width="15.5" height="15.5" fill="#fff" stroke="#8C8578" stroke-width="1.3"/><path d="M5.3 5.3l6.4 6.4M11.7 5.3l-6.4 6.4" stroke="#7A7468" stroke-width="1.8"/></svg>`;
const PART = `<svg class="mk" width="17" height="17" viewBox="0 0 17 17"><rect x=".75" y=".75" width="15.5" height="15.5" fill="#FDF0DA" stroke="#B45309" stroke-width="1.5"/><path d="M4.5 8.5h8" stroke="#B45309" stroke-width="2.3"/></svg>`;
const TICK = (c = C.green, s = 13) => `<svg class="tk" width="${s}" height="${s}" viewBox="0 0 13 13"><path d="M2 6.8l2.9 2.9L11 3.3" fill="none" stroke="${c}" stroke-width="2.2"/></svg>`;
const badge = (n) => `<span class="badge">${n}</span>`;

function chrome(n, title, { size = 48, cx = 640 } = {}) {
  return `<div class="chrome">
    <img class="sihlogo" src="assets/sih-logo.png" alt="">
    <svg class="oval" width="138" height="92" viewBox="0 0 138 92"><ellipse cx="69" cy="46" rx="66.8" ry="43.3" fill="#fff" stroke="#8064A2" stroke-width="2.6"/></svg>
    <div class="ovaltext">${esc(TEAM)}</div>
    <div class="ttl" style="font-size:${size}px;left:${cx - 520}px">${title}</div>
    <div class="foot"><span class="ft">@SIH Idea submission- Template</span><span class="fn">${n}</span></div>
  </div>`;
}
const H = (text, aside = "") => `<div class="h"><span>${text}</span>${aside ? `<span class="aside">${aside}</span>` : ""}</div>`;
const blk = (x, y, w, h, inner, cls = "") =>
  `<div class="blk ${cls}" style="left:${x}px;top:${y}px;width:${w}px;${h ? `height:${h}px;` : ""}">${inner}</div>`;
const short = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

// ------------------------------------------------------------------------------------------------ CSS
const FONT = (f) => `url("../fonts/${f}")`;
const CSS = `
@font-face{font-family:"Archivo";src:${FONT("static/Archivo-Regular.ttf")};font-weight:400}
@font-face{font-family:"Archivo";src:${FONT("static/Archivo-Medium.ttf")};font-weight:500}
@font-face{font-family:"Archivo";src:${FONT("static/Archivo-SemiBold.ttf")};font-weight:600}
@font-face{font-family:"Archivo";src:${FONT("static/Archivo-Bold.ttf")};font-weight:700}
@font-face{font-family:"Archivo";src:${FONT("static/Archivo-ExtraBold.ttf")};font-weight:800}
@font-face{font-family:"Archivo SC";src:${FONT("static/ArchivoSC-SemiBold.ttf")};font-weight:600}
@font-face{font-family:"Archivo SC";src:${FONT("static/ArchivoSC-Bold.ttf")};font-weight:700}
@font-face{font-family:"Archivo SC";src:${FONT("static/ArchivoSC-ExtraBold.ttf")};font-weight:800}
@font-face{font-family:"Archivo SC";src:${FONT("static/ArchivoSC-Black.ttf")};font-weight:900}
@font-face{font-family:"Plex Mono";src:${FONT("IBMPlexMono-Medium.ttf")};font-weight:500}
@font-face{font-family:"Plex Mono";src:${FONT("IBMPlexMono-SemiBold.ttf")};font-weight:600}
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Archivo",sans-serif;font-weight:500;color:${C.ink};-webkit-font-smoothing:antialiased;font-kerning:normal;
  font-variant-ligatures:common-ligatures}
html.bare,html.bare body,html.bare .slide{background:transparent!important}
html.bare .chrome{display:none!important}
.slide{position:relative;width:1280px;height:720px;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
a{color:inherit;text-decoration:none}
b,strong{font-weight:700;color:${C.ink}}
.mono{font-family:"Plex Mono",monospace;font-weight:500;letter-spacing:-.1px}
mark{background:linear-gradient(180deg,transparent 10%,${C.marker} 10%,${C.marker} 92%,transparent 92%);color:inherit;
  padding:0 2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}

/* template chrome (measured from PowerPoint's render of the official template) */
.sihlogo{position:absolute;left:1027px;top:0;width:236px;height:111px}
.oval{position:absolute;left:32px;top:23px}
.ovaltext{position:absolute;left:36px;top:27px;width:130px;height:84px;display:flex;align-items:center;justify-content:center;
  text-align:center;font:400 22px/1.12 Calibri,Carlito,sans-serif;color:#000;padding:0 14px}
.ttl{position:absolute;top:31px;width:1040px;text-align:center;font-family:"Times New Roman",Times,serif;font-weight:700;
  line-height:1;color:#000;white-space:nowrap}
.foot{position:absolute;left:0;top:667px;width:1280px;height:53px;background:#0070C0}
.foot .ft{position:absolute;left:488px;width:336px;top:14px;text-align:center;font:400 14.67px/1 Calibri,sans-serif;color:#fff}
.foot .fn{position:absolute;right:75px;top:14px;font:700 14.67px/1 Calibri,sans-serif;color:#fff}

/* layout + type */
.blk{position:absolute}
.h{display:flex;align-items:baseline;gap:12px;font:800 16.5px/1.15 "Archivo SC";color:${C.ink};padding-bottom:5px;
  border-bottom:2px solid ${C.ink};white-space:nowrap}
.h .aside{margin-left:auto;font:500 11.5px/1.15 "Archivo";color:${C.ink2};white-space:nowrap}
.h2{font:700 13.5px/1.2 "Archivo SC";color:${C.ink};margin-bottom:6px}
.lead{position:absolute;font:600 17px/1.3 "Archivo";color:${C.ink}}
.lead b{font-weight:800}
.p{font:500 13px/1.32 "Archivo"}
.s{font:500 11.5px/1.3 "Archivo";color:${C.ink2}}
.note{font:500 12px/1.3 "Archivo";color:${C.ink};display:flex;align-items:center;gap:6px}
.tk{flex:none}
.badge{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;background:${C.yellow};
  border:1.4px solid ${C.ink};font:800 11.5px/1 "Archivo";color:${C.ink};flex:none}
.miss{color:#C00000}
.chip{display:inline-block;font:700 11px/1 "Archivo SC";padding:4px 6px 3px;border-radius:2px;white-space:nowrap}
.chip.hi{background:${C.red};color:#fff}.chip.md{background:${C.amber};color:#fff}.chip.lo{background:${C.green};color:#fff}
.chip.built{background:#E5F1E4;color:#1D5E22;box-shadow:inset 0 0 0 1px #9CC79E}
.chip.plan{background:#FDF0DA;color:#7A3E06;box-shadow:inset 0 0 0 1px #E6B777}

/* tables */
table.t{width:100%;border-collapse:collapse;table-layout:fixed}
.t th{background:${C.navy};color:#fff;font:700 12px/1.15 "Archivo SC";text-align:left;padding:6px 8px 5px;vertical-align:bottom}
.t td{font:500 12.5px/1.28 "Archivo";padding:5px 8px;border-bottom:1px solid ${C.hair};vertical-align:top;color:${C.ink}}
.t tbody tr:nth-child(odd) td{background:#FBF8F2}
.t td.k{font-weight:700}
.t td.c,.t th.c{text-align:center}
.t .mk{display:inline-block;vertical-align:middle}

/* diagrams */
.box{position:absolute;border:1.3px solid ${C.ink};background:#fff;padding:6px 8px;overflow:hidden}
.box .bt{font:700 12.5px/1.15 "Archivo";color:${C.ink};display:flex;align-items:center;gap:6px}
.box .bd{font:500 11.5px/1.27 "Archivo";color:${C.ink2};margin-top:3px}
.box.ext{border-style:dashed;border-color:#6B665C}
.zh{position:absolute;font:800 12.5px/1.1 "Archivo SC";color:${C.ink};display:flex;align-items:center;gap:6px;white-space:nowrap}
.zh .zs{font:500 11px/1 "Archivo";color:${C.ink2}}
.shadow{box-shadow:4px 4px 0 ${C.ink}}
svg text{font-family:"Archivo"}
`;

// ======================================================================================= 1 · TITLE PAGE
function slide1() {
  const miss = (v, hint) => (v ? esc(v) : `<span class="miss">${hint}</span>`);
  return `<section class="slide s1" data-n="1">
  <div class="chrome">
    <img src="assets/title-art.png" alt="" style="position:absolute;left:0;top:0;width:1280px;height:720px">
    <div style="position:absolute;left:35px;width:1088px;top:25px;text-align:center;font:700 53.3px/1 Garamond,serif;color:#1F497D;letter-spacing:.2px">SMART INDIA HACKATHON 2026</div>
    <div style="position:absolute;left:131px;width:896px;top:141px;text-align:center;font:700 42.7px/1 'Times New Roman',serif;color:#000">TITLE PAGE</div>
    <ul class="fields">
      <li><b>Problem Statement ID –</b> ${esc(CFG.ps_id)}</li>
      <li><b>Problem Statement Title –</b> ${esc(CFG.ps_title)}</li>
      <li><b>Theme –</b> ${miss(CFG.theme, "‹as listed on the SIH portal›")}</li>
      <li><b>PS Category –</b> ${esc(CFG.category)}</li>
      <li><b>Team ID –</b> ${miss(CFG.team_id, "‹Team ID›")}</li>
      <li><b>Team Name –</b> ${miss(CFG.team_name, "‹Team name›")}</li>
    </ul>
  </div>
  <div class="lockup">
    <img src="assets/nwis-logo.svg" alt="" style="width:46px;height:46px">
    <div>
      <div style="font:800 21px/1.05 'Archivo SC'">NWIS <span style="font-weight:600">· Nearby Wells Intelligence System</span></div>
      <div style="font:500 13px/1.3 Archivo;color:${C.ink2};margin-top:3px">Know what’s below before you drill it — drilling decision support beside eRTMAC</div>
    </div>
  </div>
  <style>
    .fields{position:absolute;left:47px;top:258px;width:610px;list-style:none;font:400 27px/1.2 Arial,sans-serif;color:#000}
    .fields li{position:relative;padding-left:28px;margin-bottom:29px}
    .fields li::before{content:"•";position:absolute;left:0;top:0;font-weight:700}
    .fields li b{font:700 29px/1.2 Arial,sans-serif}
    .lockup{position:absolute;left:640px;top:646px;display:flex;gap:12px;align-items:center}
  </style>
</section>`;
}

// ======================================================================================= 2 · IDEA
function hero() {
  const W = 1208, Hh = 238, X0 = 56, X1 = 722, SURF = 34, TOP = 50, BOT = 232;
  const y = (d) => TOP + ((d - 3000) * (BOT - TOP)) / 700;
  const XS = [X0, 200, 330, 470, 640, X1];
  const AX = 470; // active well
  const curve = (ds) => {
    const pts = XS.map((x, i) => [x, y(ds[i])]);
    let p = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (x0 + x1) / 2;
      p += ` C${m},${y0.toFixed(1)} ${m},${y1.toFixed(1)} ${x1},${y1.toFixed(1)}`;
    }
    return p;
  };
  const below = (ds) => `${curve(ds)} L${X1},${BOT} L${X0},${BOT} Z`;
  const kop = [3302, 3300, 3310, 3290, 3292, 3296], syl = [3598, 3595, 3605, 3575, 3578, 3585], coal = [3082, 3076, 3086, 3072, 3078, 3084];
  const offsets = [
    { x: 200, name: "OIL-AX-99" }, { x: 330, name: "OIL-AX-88" }, { x: 640, name: "OIL-AX-33" },
  ];
  const ev = [
    { x: 200, d0: 3150, d1: 3220, c: C.mud, dir: -1 },
    { x: 330, d0: 3380, d1: 3420, c: C.stuck, dir: -1 },
    { x: 640, d0: 3580, d1: 3610, c: C.kick, dir: 1 },
  ];
  const haz = [[3150, 3220], [3380, 3430], [3580, 3610]];
  const derrick = (x, active) =>
    `<path d="M${x - 7},${SURF} L${x},${SURF - 16} L${x + 7},${SURF} Z" fill="${active ? C.yellow : "#fff"}" stroke="${C.ink}" stroke-width="1.4"/>
     <path d="M${x - 4.6},${SURF - 5.5} H${x + 4.6} M${x - 2.4},${SURF - 10.5} H${x + 2.4}" stroke="${C.ink}" stroke-width="1.1"/>`;
  const tag = (x, yy, w, lines, c) => {
    const h = 8 + lines.length * 13;
    return `<g><rect x="${x}" y="${yy}" width="${w}" height="${h}" fill="#fff" stroke="${C.ink}" stroke-width="1"/>
      <rect x="${x}" y="${yy}" width="4.5" height="${h}" fill="${c}"/>
      ${lines.map((l, i) => `<text x="${x + 10}" y="${yy + 15 + i * 13}" style="font:${i === 0 ? "700 11.5px Archivo" : i === 2 ? "500 10px 'Plex Mono'" : "500 11px Archivo"}" fill="${i ? C.ink2 : C.ink}">${l}</text>`).join("")}</g>`;
  };
  const fmLabel = (x, yy, t) => `<text x="${x}" y="${yy}" style="font:700 11px 'Archivo SC'" fill="${C.ink}" paint-order="stroke" stroke="#FFFDF7" stroke-width="3.2">${t}</text>`;
  const svg = `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="position:absolute;left:0;top:0;overflow:visible">
  <defs>
    <pattern id="pSand" width="12" height="10" patternUnits="userSpaceOnUse"><rect width="12" height="10" fill="#ECD9A2"/><circle cx="3" cy="3" r=".95" fill="#8A7440" opacity=".55"/><circle cx="9" cy="8" r=".95" fill="#8A7440" opacity=".55"/></pattern>
    <pattern id="pShale" width="18" height="8" patternUnits="userSpaceOnUse"><rect width="18" height="8" fill="#BAC2AC"/><path d="M2 2.5h7M11 6.5h6" stroke="#57614D" stroke-width="1" opacity=".6"/></pattern>
    <pattern id="pLime" width="22" height="11" patternUnits="userSpaceOnUse"><rect width="22" height="11" fill="#C5D5E0"/><path d="M0 .5H22M0 6H22M6 .5V6M17 6V11" stroke="#5E7282" stroke-width=".9" opacity=".6"/></pattern>
    <pattern id="pHaz" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${C.yellow}"/><rect width="3.2" height="7" fill="${C.ink}"/></pattern>
    <pattern id="pGap" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#F1ECE2"/><rect width="1" height="10" fill="#D8CFBE"/></pattern>
    ${ev.map((e, i) => `<marker id="ar${i}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" fill="${e.c}"/></marker>`).join("")}
  </defs>
  <!-- strata -->
  <rect x="${X0}" y="${TOP}" width="${X1 - X0}" height="${BOT - TOP}" fill="url(#pSand)"/>
  <path d="${curve(coal)}" fill="none" stroke="#3A3833" stroke-width="3" opacity=".8"/>
  <path d="${below(kop)}" fill="url(#pShale)"/>
  <path d="${below(syl)}" fill="url(#pLime)"/>
  <path d="${curve(kop)}" fill="none" stroke="${C.ink}" stroke-width="1.1" opacity=".75"/>
  <path d="${curve(syl)}" fill="none" stroke="${C.ink}" stroke-width="1.1" opacity=".75"/>
  <rect x="${X0}" y="${SURF}" width="${X1 - X0}" height="${TOP - SURF}" fill="url(#pGap)"/>
  <path d="M${X0},${TOP} H${X1}" stroke="${C.ink}" stroke-width=".8" stroke-dasharray="3 3" opacity=".6"/>
  <rect x="${X0}" y="${SURF}" width="${X1 - X0}" height="${BOT - SURF}" fill="none" stroke="${C.ink}" stroke-width="1.2"/>
  <path d="M${X0 - 8},${SURF} H${X1 + 8}" stroke="${C.ink}" stroke-width="1.6"/>
  ${fmLabel(X0 + 7, y(3024), "Barail Group — sandstone, shale, coal")}
  ${fmLabel(X0 + 7, y(3338), "Kopili Shale")}
  ${fmLabel(X0 + 7, y(3668), "Sylhet Limestone")}
  <!-- depth axis -->
  <text x="${X0 - 6}" y="${SURF + 11}" text-anchor="end" style="font:500 10px 'Plex Mono'" fill="${C.ink2}">0–3,000</text>
  ${[3100, 3200, 3300, 3400, 3500, 3600, 3700].map((d) => `<path d="M${X0 - 4},${y(d)} H${X0}" stroke="${C.ink}" stroke-width="1"/><text x="${X0 - 6}" y="${y(d) + 3.5}" text-anchor="end" style="font:500 10.5px 'Plex Mono'" fill="${C.ink2}">${num(d)}</text>`).join("")}
  <text x="0" y="13" style="font:600 10.5px 'Archivo'" fill="${C.ink2}">MD, m</text>
  <!-- offset wells + events -->
  ${offsets.map((w) => `${derrick(w.x)}<path d="M${w.x},${SURF} V${BOT}" stroke="#3F3B35" stroke-width="2"/>
     <text x="${w.x}" y="13" text-anchor="middle" style="font:600 11px 'Plex Mono'" fill="${C.ink}">${w.name}</text>`).join("")}
  ${ev.map((e) => `<rect x="${e.x - 4}" y="${y(e.d0)}" width="8" height="${y(e.d1) - y(e.d0)}" fill="${e.c}" stroke="${C.ink}" stroke-width=".8"/>`).join("")}
  <!-- active well -->
  ${derrick(AX, true)}
  <rect x="${AX - 49}" y="1" width="98" height="17" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.1"/>
  <text x="${AX}" y="13.5" text-anchor="middle" style="font:600 11px 'Plex Mono'" fill="${C.ink}">OIL-AX-102</text>
  <path d="M${AX},${SURF} V${y(3100)}" stroke="${C.ink}" stroke-width="5"/>
  <path d="M${AX},${y(3100)} V${BOT}" stroke="${C.ink}" stroke-width="2.4" stroke-dasharray="6 4"/>
  ${haz.map(([a, b]) => `<rect x="${AX - 7}" y="${y(a)}" width="14" height="${y(b) - y(a)}" fill="url(#pHaz)" stroke="${C.ink}" stroke-width="1"/>`).join("")}
  <!-- links: offset event → same depth on the active well -->
  ${ev.map((e, i) => {
    const yy = y((e.d0 + e.d1) / 2);
    const xa = e.dir < 0 ? e.x + 5 : e.x - 5, xb = e.dir < 0 ? AX - 9 : AX + 9;
    return `<path d="M${xa},${yy} H${xb}" stroke="${e.c}" stroke-width="1.8" stroke-dasharray="5 3" marker-end="url(#ar${i})"/>`;
  }).join("")}
  <!-- leader to the alert card -->
  <path d="M${AX + 9},${y(3185)} H752" stroke="${C.ink}" stroke-width="1.3"/>
  <!-- bit -->
  <polygon points="${AX},${y(3100) - 9} ${AX + 9},${y(3100)} ${AX},${y(3100) + 9} ${AX - 9},${y(3100)}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.6"/>
  <rect x="${AX - 84}" y="${y(3100) - 8}" width="66" height="16" fill="${C.ink}"/>
  <text x="${AX - 51}" y="${y(3100) + 4}" text-anchor="middle" style="font:700 11px Archivo" fill="#fff">Bit 3,100 m</text>
  <path d="M${AX + 12},${y(3100)} h5 V${y(3150)} h-5" fill="none" stroke="${C.ink}" stroke-width="1.2"/>
  <text x="${AX + 21}" y="${y(3125) + 4}" style="font:700 11px Archivo" fill="${C.ink}">50 m ahead</text>
  <!-- event tags -->
  ${tag(60, y(3150) - 7, 132, ["Mud loss · 3,150 m", "45 m³ lost · 18 h NPT", "DDR OIL-AX-99 p.3"], C.mud)}
  ${tag(209, y(3380) - 6, 113, ["Stuck pipe · 3,380 m", "36 h NPT · 80 kN pull"], C.stuck)}
  ${tag(648, y(3580) - 7, 140, ["Kick · 3,580 m", "3.2 m³ gain · 12 h NPT"], C.kick)}
  <!-- step badges -->
  <g transform="translate(60,${y(3150) - 7})"><circle r="9" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.4"/><text y="4" text-anchor="middle" style="font:800 11px Archivo">1</text></g>
  <g transform="translate(404,${y(3185)})"><circle r="9" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.4"/><text y="4" text-anchor="middle" style="font:800 11px Archivo">2</text></g>
  <g transform="translate(${AX + 22},${y(3185) + 18})"><circle r="9" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.4"/><text y="4" text-anchor="middle" style="font:800 11px Archivo">3</text></g>
  <text x="${AX + 36}" y="${y(3185) + 22}" style="font:700 11px Archivo" fill="${C.ink}">risk ${at3100.score.toFixed(2)} → ${FA.mud_loss.score.toFixed(2)}</text>
</svg>`;
  const card = `<div class="acard shadow qa" style="left:752px;top:36px;width:266px">
    <div class="ach">${ic("lu", "LuTriangleAlert", "#fff", 15)}<span>Mud loss ahead — 50 m</span><span class="acs">watch now · alert at ${num(FA.mud_loss.depth)} m</span></div>
    <div class="acb">
      <div><b>${byHaz.mud_loss.offsets_hit} of ${byHaz.mud_loss.offsets_reached} offsets</b> lost returns in this window</div>
      <div>OIL-AX-99: 45 m³ at ECD 1.52 sg · 18 h NPT</div>
      <div class="ok">${TICK()}<span><b>Keep ECD ≤ 1.48 sg</b>; LCM by 3,140 m</span></div>
    </div>
    <div class="acf"><span class="mono">DDR OIL-AX-99 · page 3</span><span class="why">Why?</span></div>
    <span class="badge" style="position:absolute;left:-10px;top:-10px">4</span>
  </div>`;
  const legend = `<div style="position:absolute;left:800px;top:${BOT - 34}px;width:218px" class="s qa">
     <div style="display:flex;align-items:center;gap:7px"><svg width="22" height="10"><rect width="22" height="10" fill="url(#pHaz)" stroke="${C.ink}" stroke-width="1"/></svg>hazard window on the plan</div>
     <div style="display:flex;align-items:center;gap:7px;margin-top:6px"><svg width="22" height="10"><path d="M0 5H17" stroke="${C.ink2}" stroke-width="1.8" stroke-dasharray="5 3"/><path d="M16 1l6 4-6 4z" fill="${C.ink2}"/></svg>offset event, same depth</div>
   </div>`;
  const steps = [
    ["Read", "Reports, even scans → events with depth and page."],
    ["Link", "Offset events matched by depth and formation."],
    ["Score", "Six factors rank each window ahead."],
    ["Warn", "50 m ahead, with the fix and its source."],
  ];
  const stepsHtml = `<div class="steps qa">${steps.map(([t, d], i) => `<div class="st">${badge(i + 1)}<div><b>${t}.</b> ${d}</div></div>`).join("")}</div>`;
  return `<div style="position:relative;width:${W}px;height:${Hh}px">${svg}${card}${legend}${stepsHtml}</div>
  <style>
    .acard{position:absolute;background:#fff;border:2px solid ${C.ink}}
    .ach{display:flex;align-items:center;gap:7px;background:${C.red};color:#fff;font:700 13px/1 Archivo;padding:7px 9px 6px;flex-wrap:wrap}
    .ach .acs{flex-basis:100%;font:500 11px/1 Archivo;color:#FFE3DE;padding-left:22px;margin-top:2px}
    .acb{padding:7px 9px 4px;font:500 12px/1.3 Archivo;display:flex;flex-direction:column;gap:3px}
    .acb .ok{display:flex;gap:6px;align-items:flex-start}.acb .ok .tk{margin-top:2px}
    .acf{display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${C.hair};padding:5px 9px 6px;font-size:10.5px;color:${C.ink2}}
    .acf .why{font:700 11px/1 Archivo;background:${C.ink};color:#fff;padding:4px 8px}
    .steps{position:absolute;left:1036px;top:30px;width:172px;display:flex;flex-direction:column;gap:9px}
    .st{display:flex;gap:8px;align-items:flex-start;font:500 11.5px/1.3 Archivo;color:${C.ink2}}
    .st b{color:${C.ink}}
  </style>`;
}

function slide2() {
  const L = (href, icon, label, value) => {
    const inner = `<div class="lk">${icon}<div><div class="lkt">${label}</div><div class="lkv${href ? "" : " miss"}">${value}</div></div></div>`;
    return href ? `<a href="${esc(href)}">${inner}</a>` : inner;
  };
  const qr = (k) => CFG.qr[k] ? fs.readFileSync(path.join(RENDER, "assets", CFG.qr[k]), "utf8").replace(/<\?xml[^>]*>/, "")
    .replace("<svg ", '<svg class="qr" ') : null;
  const repoQR = qr("repo_url");
  const links = [
    L(CFG.prototype_url, qr("prototype_url") || ic("lu", "LuMonitorPlay", C.ink, 22), "Prototype", CFG.prototype_url ? short(CFG.prototype_url) : "‹add link›"),
    L(CFG.video_url, qr("video_url") || ic("lu", "LuCirclePlay", C.ink, 22), "Video", CFG.video_url ? short(CFG.video_url) : "‹add link›"),
    L(CFG.repo_url, repoQR || ic("lu", "LuGithub", C.ink, 22), "Source code", short(CFG.repo_url).replace("github.com/", "github/")),
  ];
  return `<section class="slide" data-n="2">${chrome(2, "NWIS — Nearby Wells Intelligence System", { size: 38, cx: 596 })}
  <div class="lead" style="left:36px;top:124px;width:1208px"><b>Proposed solution.</b> NWIS sits beside eRTMAC, links the bit depth to what nearby wells hit at that depth, and <mark>warns before the bit gets there</mark>.</div>
  ${blk(36, 158, 1208, 0, H("Detailed explanation of the proposed solution", "Demo field on real Upper Assam stratigraphy — illustrative wells, not Oil India records"))}
  ${blk(36, 188, 1208, 238, hero())}
  ${blk(36, 438, 388, 220, `${H("How it addresses the problem", `<span class="note">${TICK()}<span><b>${REQS} / ${REQS}</b> official lines pass</span></span>`)}
    <table class="t addr" style="margin-top:7px"><thead><tr><th style="width:47%">The problem today</th><th>How NWIS addresses it</th></tr></thead><tbody>
      <tr><td class="k">History sits in WCRs, DDRs, PDFs and people’s memory</td><td>one depth-indexed base; every event cited</td></tr>
      <tr><td class="k">Offset review is manual and slow</td><td>offset history at the bit depth, on a 3D map</td></tr>
      <tr><td class="k">Parameters, tops, casing and mud are seen apart</td><td>correlated across wells on one depth axis</td></tr>
      <tr><td class="k">The same losses, stuck pipe and kicks repeat</td><td>alert 50 m ahead, with the fix that worked</td></tr>
    </tbody></table>`)}
  ${blk(444, 438, 388, 220, `${H("Innovation and uniqueness of the solution")}
    <ol class="inno">
      <li><b>Depth is the key.</b> One bit depth drives the map, 3D view, risk, search and brief.</li>
      <li><b>Evidence first.</b> No answer without the report, page and depth behind it.</li>
      <li><b>Explainable, then learned.</b> A six-factor score, cross-checked by ML (AUC ${learned.auc_model.toFixed(2)} vs ${learned.auc_rule.toFixed(2)}).</li>
      <li><b>Built for rig routines.</b> Look-ahead brief for the 12-hour handover and DWOP; spoken alerts.</li>
      <li><b>Proven on real records.</b> ${num(od.histories)} public well histories → ${num(od.events)} problems, ${pct(spot.precision)} precision.</li>
    </ol>`)}
  ${blk(852, 438, 392, 220, `${H("Working prototype")}
    <div class="shots">
      <figure><img src="assets/shot-alert.jpg" alt=""><figcaption>Alert with its evidence</figcaption></figure>
      <figure><img src="assets/shot-subsurface.jpg" alt=""><figcaption>Subsurface 3D at the bit</figcaption></figure>
    </div>
    <div class="links">${links.join("")}</div>`)}
  <style>
    .addr td{font-size:12px;line-height:1.22;padding-top:4px;padding-bottom:4px}
    .h .aside .note{font-size:11.5px}
    .inno{list-style:none;margin-top:8px;display:flex;flex-direction:column;gap:5px;counter-reset:i}
    .inno li{counter-increment:i;position:relative;padding-left:26px;font:500 12.5px/1.3 Archivo;color:${C.ink2}}
    .inno li::before{content:counter(i,decimal-leading-zero);position:absolute;left:0;top:1px;font:700 11px/1.3 'Plex Mono';color:${C.ink}}
    .shots{display:flex;gap:12px;margin-top:8px}
    .shots figure{width:190px}
    .shots img{display:block;width:190px;height:107px;object-fit:cover;object-position:left top;border:1.3px solid ${C.ink};box-shadow:3px 3px 0 ${C.ink}}
    .shots figcaption{font:600 11px/1.2 Archivo;color:${C.ink2};margin-top:6px}
    .links{display:flex;gap:8px;margin-top:6px}
    .links > a,.links > .lk{flex:1}
    .lk{display:flex;gap:7px;align-items:center;border:1.3px solid ${C.ink};padding:5px 6px;height:44px;background:#fff}
    .lk .qr{width:32px;height:32px;flex:none}
    .lkt{font:700 11.5px/1.1 Archivo;color:${C.ink}}
    .lkv{font:500 10.5px/1.15 Archivo;color:${C.ink2};margin-top:2px}
    .lkv.miss{color:#C00000}
  </style>
</section>`;
}

// ======================================================================================= 3 · TECHNICAL APPROACH
function techStrip() {
  const G = [
    ["Frontend", 4, [["si", "SiNextdotjs", "#000000", "Next.js 16"], ["si", "SiReact", "#087EA4", "React 19"], ["si", "SiTypescript", "#3178C6", "TypeScript"],
      ["si", "SiTailwindcss", "#0E7490", "Tailwind CSS"], ["si", "SiMaplibre", "#396CB2", "MapLibre GL"], ["si", "SiThreedotjs", "#000000", "three.js"], ["lu", "LuChartLine", C.ink, "Recharts"]]],
    ["Backend", 2, [["si", "SiPython", "#3776AB", "Python 3"], ["si", "SiFastapi", "#009688", "FastAPI"], ["si", "SiPydantic", "#E92063", "Pydantic"], ["si", "SiSqlalchemy", "#D71F00", "SQLAlchemy"]]],
    ["AI · NLP · OCR", 3, [["lu", "LuScanText", C.ink, "Tesseract OCR"], ["lu", "LuTextSearch", C.ink, "Drilling NLP"], ["lu", "LuSearch", C.ink, "BM25 + vectors"],
      ["lu", "LuSigma", C.ink, "Logistic regr."], ["si", "SiClaude", "#C15F3C", "Claude (opt.)"]]],
    ["Data & integration", 2, [["si", "SiPostgresql", "#4169E1", "PostgreSQL"], ["lu", "LuDatabaseZap", C.ink, "pgvector"], ["si", "SiSqlite", "#003B57", "SQLite"], ["lu", "LuRadioTower", C.ink, "WITSML"]]],
    ["Quality", 1, [["si", "SiPytest", "#0A9EDC", "pytest"], ["lu", "LuTheater", C.ink, "Playwright"]]],
  ];
  return `<div class="tech">${G.map(([g, cols, items]) => `<div class="tg"><div class="tgl">${g}</div>
    <div class="tgg" style="grid-template-columns:repeat(${cols},auto)">${items.map(([l, n, c, t]) => `<div class="ti">${ic(l, n, c, 16)}<span>${t}</span></div>`).join("")}</div></div>`).join("")}</div>
  <style>
    .tech{display:flex;justify-content:space-between;margin-top:6px}
    .tgl{font:700 11.5px/1 'Archivo SC';color:${C.ink2};margin-bottom:4px}
    .tgg{display:grid;gap:3px 4px}
    .ti{display:flex;align-items:center;gap:6px;border:1px solid ${C.rule};background:#fff;padding:2px 7px 2px 5px;height:21px;
      font:600 11.5px/1 Archivo;color:${C.ink};white-space:nowrap}
  </style>`;
}

function architecture() {
  // Layered left→right: OIL systems → ingestion → knowledge base → services → cockpit → users.
  // Boxes are HTML; cylinders, the on-prem boundary and the live loop are SVG *under* the boxes, arrows SVG on top.
  const c = { c1: [0, 190], c2: [214, 204], c3: [442, 168], c4: [634, 254], c5: [910, 168], c6: [1100, 108] };
  const Y0 = 48;
  const R = [[Y0, 55], [Y0 + 61, 70], [Y0 + 137, 55]]; // rows shared by c1–c3: [top, height]
  const mid = (i) => R[i][0] + R[i][1] / 2;
  const box = (col, i, title, body, cls = "") =>
    `<div class="box ${cls}" style="left:${c[col][0]}px;top:${R[i][0]}px;width:${c[col][1]}px;height:${R[i][1]}px"><div class="bt">${title}</div><div class="bd">${body}</div></div>`;
  const svcH = 36, svcG = 3.5;
  const sy = (i) => Y0 + i * (svcH + svcG);
  const svc = [
    ["Risk engine", "6 factors → score → alert policy → audit", true],
    ["Evidence search", "hybrid BM25 + vectors → cited answers"],
    ["Correlation · pressure window", "tops, casing, mud · offset-calibrated PP / FG"],
    ["Look-ahead brief", "hazards in the next 300 m · NPT in ₹"],
    ["Learned cross-check", `logistic regression · AUC ${learned.auc_model.toFixed(2)} · advisory only`],
  ];
  const [x1, w1] = c.c1, [x2, w2] = c.c2, [x3, w3] = c.c3, [x4, w4] = c.c4, [x5, w5] = c.c5, [x6] = c.c6;
  const bot = R[2][0] + R[2][1]; // 240
  const cyl = (x, y, w, h, fill) => `<path d="M${x},${y + 8} v${h - 16} a${w / 2},8 0 0 0 ${w},0 v-${h - 16}" fill="${fill}" stroke="${C.ink}" stroke-width="1.3"/>
    <ellipse cx="${x + w / 2}" cy="${y + 8}" rx="${w / 2}" ry="8" fill="${fill}" stroke="${C.ink}" stroke-width="1.3"/>`;
  const A = (xa, ya, xb, yb, mk = "ak", w = 1.5) => `<path d="M${xa},${ya} L${xb},${yb}" stroke="${C.ink}" stroke-width="${w}" marker-end="url(#${mk})"/>`;
  const kb1 = [R[0][0], R[1][0] + R[1][1] - R[0][0]]; // PostgreSQL spans rows 0–1
  const busX = x4 - 12, liveY = sy(0) + svcH / 2;
  const svgUnder = `<svg width="1208" height="258" style="position:absolute;left:0;top:0;overflow:visible">
    <rect x="${x2 - 11}" y="17" width="${x5 + w5 - x2 + 22}" height="${bot - 17 + 10}" fill="none" stroke="${C.ink}" stroke-width="1.3" stroke-dasharray="6 4"/>
    <!-- live loop (under the boxes, so it only shows between them): eRTMAC → adapter → KB → risk engine → cockpit -->
    <path d="M${x1 + w1},${mid(0)} H${x3 + 20}" stroke="${C.yellow}" stroke-width="7"/>
    <path d="M${x3 + w3 - 20},${liveY} H${x5 + 20}" stroke="${C.yellow}" stroke-width="7"/>
    ${cyl(x3, kb1[0], w3, kb1[1], "#E8EFE2")}
    ${cyl(x3, R[2][0], w3, R[2][1], "#E8EFE2")}
  </svg>`;
  const svgOver = `<svg width="1208" height="258" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none">
    <defs><marker id="ak" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${C.ink}"/></marker>
      <marker id="ay" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${C.ink}"/></marker></defs>
    ${[0, 1, 2].map((i) => A(x1 + w1, mid(i), x2 - 2, mid(i))).join("")}
    ${A(x2 + w2, mid(0), x3 - 2, mid(0))}${A(x2 + w2, mid(1), x3 - 2, mid(1))}
    <path d="M${x2 + w2},${mid(2)} H${x2 + w2 + 11} V${R[1][0] + R[1][1] - 12} H${x3 - 2}" fill="none" stroke="${C.ink}" stroke-width="1.5" marker-end="url(#ak)"/>
    <path d="M${busX},${liveY} V${sy(4) + svcH / 2}" stroke="${C.ink}" stroke-width="1.5"/>
    ${[0, 1, 2, 3, 4].map((i) => A(busX, sy(i) + svcH / 2, x4 - 2, sy(i) + svcH / 2, "ay", 1.3)).join("")}
    <path d="M${x3 + w3},${liveY} H${busX}" stroke="${C.ink}" stroke-width="1.5"/>
    <path d="M${x3 + w3},${mid(2)} H${busX}" stroke="${C.ink}" stroke-width="1.5"/>
    ${A(x4 + w4, liveY, x5 - 2, liveY)}
    ${A(x4 + w4, sy(3) + svcH / 2, x5 - 2, sy(3) + svcH / 2)}
    ${[0, 1, 2, 3].map((i) => A(x5 + w5, Y0 + 22 + i * 48, x6 - 3, Y0 + 22 + i * 48, "ay", 1.3)).join("")}
  </svg>`;
  const lock = renderToStaticMarkup(React.createElement(LIB.lu.LuLock, { color: C.ink, size: "12", style: { display: "inline", verticalAlign: "-1px", marginRight: "5px" } }));
  const boundary = `<div style="position:absolute;left:${x2 - 11}px;width:${x5 + w5 - x2 + 22}px;top:${bot + 4}px;text-align:center;line-height:12px">
    <span style="background:#fff;padding:0 8px;font:600 11.5px/12px Archivo;color:${C.ink}">${lock}On-prem inside OIL’s network · no cloud dependency · LLM optional, off by default · SSO + audit trail</span></div>`;
  const zh = (col, t, sub = "", logo = "") => `<div class="zh" style="left:${c[col][0]}px;top:25px;width:${c[col][1]}px">${logo}<span>${t}</span>${sub ? `<span class="zs">${sub}</span>` : ""}</div>`;
  const users = [["LuHardHat", "Rig engineer & driller"], ["LuActivity", "eRTMAC analyst"], ["LuClipboardList", "Planner · DWOP"], ["LuBriefcase", "Manager · HSE"]];
  return `<div style="position:relative;width:1208px;height:258px">
    ${svgUnder}
    ${zh("c1", "OIL systems", "existing")}
    ${zh("c2", "Ingestion")}
    ${zh("c3", "Knowledge base", "", ic("si", "SiPostgresql", "#4169E1", 14))}
    ${zh("c4", "Intelligence services", "FastAPI · REST", ic("si", "SiFastapi", "#009688", 14))}
    ${zh("c5", "Cockpit", "Next.js", ic("si", "SiNextdotjs", "#000", 13))}
    ${zh("c6", "Users")}
    ${box("c1", 0, `${ic("lu", "LuRadioTower", C.ink, 14)}eRTMAC real-time`, "WITSML: depth, MW, ECD, torque, SPP, hook load", "ext")}
    ${box("c1", 1, `${ic("lu", "LuFileText", C.ink, 14)}Report archive`, "DDR · WCR · mud logs · cementing · NPT reports — PDF and scanned pages", "ext")}
    ${box("c1", 2, `${ic("lu", "LuFileSpreadsheet", C.ink, 14)}Well master data`, "surveys · tops · casing · mud programme", "ext")}
    ${box("c2", 0, "Stream adapter", "WITSML → depth-indexed parameters, every depth step", "clay")}
    ${box("c2", 1, "Document pipeline", "text layer or Tesseract OCR → tag depth + formation → NLP events → de-dup → <b>engineer approves</b>", "clay")}
    ${box("c2", 2, "Structured import", "surveys, tops, casing, mud → validated tables", "clay")}
    <div class="box nob" style="left:${x3}px;top:${kb1[0] + 15}px;width:${w3}px;height:${kb1[1] - 22}px"><div class="bt">PostgreSQL</div><div class="bd">wells · formations · casing · surveys · <b>events + source page</b> · reports & pages · parameters · alerts & audit</div><div class="bd" style="font-style:italic">SQLite in the demo</div></div>
    <div class="box nob" style="left:${x3}px;top:${R[2][0] + 13}px;width:${w3}px;height:${R[2][1] - 14}px"><div class="bt">Search index · models</div><div class="bd">BM25 + pgvector · weights</div></div>
    ${svc.map(([t, d, hot], i) => `<div class="box svc${hot ? " hot" : ""}" style="left:${x4}px;top:${sy(i)}px;width:${w4}px;height:${svcH}px"><div class="bt">${t}${hot ? `<span class="live">every depth step · ~${Math.round(F.latency.evaluate_ms)} ms</span>` : ""}</div><div class="bd">${d}</div></div>`).join("")}
    <div class="box" style="left:${x5}px;top:${Y0}px;width:${w5}px;height:${bot - Y0}px;padding:5px">
      <img src="assets/shot-alert.jpg" alt="" style="display:block;width:100%;height:86px;object-fit:cover;object-position:left top;border:1px solid ${C.rule}">
      <div class="bd" style="margin-top:6px;color:${C.ink}"><b>Command Center</b> · Subsurface 3D · Compare · Evidence search · Risk explorer · Look-ahead brief · Document review</div>
    </div>
    ${users.map(([i, t], k) => `<div class="usr" style="left:${x6}px;top:${Y0 + 13 + k * 48}px">${ic("lu", i, C.ink, 16)}<span>${t}</span></div>`).join("")}
    ${svgOver}
    ${boundary}
    <div class="s" style="position:absolute;left:0;top:${bot + 4}px;display:flex;align-items:center;gap:6px;color:${C.ink};font-weight:600">
      <svg width="24" height="8"><rect width="24" height="8" fill="${C.yellow}"/></svg>live loop · every depth step</div>
  </div>
  <style>
    .box{padding:3px 8px;display:flex;flex-direction:column;justify-content:center}
    .box .bd{font-size:11px;line-height:1.22;margin-top:2px}
    .box.clay{background:#F7EADB}
    .box.svc{background:#E6ECF3;padding:2px 8px}.box.svc .bt{font-size:12px}.box.svc .bd{margin-top:1px}
    .box.hot{box-shadow:inset 5px 0 0 ${C.yellow};padding-left:11px}
    .box .live{margin-left:auto;font:700 10px/1 Archivo;color:${C.ink};background:${C.yellow};padding:1px 5px}
    .box.nob{border:0;background:transparent;padding:2px 10px;justify-content:flex-start}
    .usr{position:absolute;width:108px;display:flex;gap:6px;align-items:flex-start;font:600 11.5px/1.2 Archivo;color:${C.ink}}
  </style>`;
}

function flowchart() {
  // main row y 24–78 (arrows at y 51); the "no" branch and the once-per-window rule sit below
  const b = (x, w, t, d, cls = "") => `<div class="fb ${cls}" style="left:${x}px;width:${w}px"><div class="fbt">${t}</div><div class="fbd">${d}</div></div>`;
  const Y = 51;
  return `<div style="position:relative;width:860px;height:138px">
    <div class="h2" style="position:absolute;left:0;top:0">Every depth step — how an alert is raised</div>
    ${b(0, 128, "Depth update", "eRTMAC: bit depth + live parameters")}
    ${b(145, 140, "Find offset events", "in the radius, near this depth and formation")}
    ${b(302, 126, "Score six factors", "risk 0–1 for every window ahead")}
    <svg width="860" height="138" style="position:absolute;left:0;top:0;overflow:visible">
      <defs><marker id="af" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${C.ink}"/></marker></defs>
      <polygon points="500,24 555,${Y} 500,78 445,${Y}" fill="#FFF6D6" stroke="${C.ink}" stroke-width="1.4"/>
      <text x="500" y="${Y - 3}" text-anchor="middle" style="font:700 11.5px Archivo" fill="${C.ink}">risk ≥ alert</text>
      <text x="500" y="${Y + 11}" text-anchor="middle" style="font:700 11.5px Archivo" fill="${C.ink}">level?</text>
      ${[[128, 145], [285, 302], [428, 445], [555, 581], [721, 738]].map(([a, z]) => `<path d="M${a},${Y} H${z - 1}" stroke="${C.ink}" stroke-width="1.5" marker-end="url(#af)"/>`).join("")}
      <text x="568" y="${Y - 6}" text-anchor="middle" style="font:700 10.5px Archivo" fill="${C.green}">yes</text>
      <path d="M500,78 V97" stroke="${C.ink}" stroke-width="1.5" marker-end="url(#af)"/>
      <text x="508" y="92" style="font:700 10.5px Archivo" fill="${C.ink2}">no</text>
      <path d="M651,78 V98" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="3 3"/>
    </svg>
    ${b(581, 140, "Raise one alert", "what · where · why + fix + source page", "hot")}
    ${b(738, 122, "Engineer decides", "acknowledge or dismiss · audited")}
    <div class="fb sub" style="left:418px;top:98px;width:164px"><div class="fbd"><b>Watch card</b> on the risk radar, no alarm yet</div></div>
    <div class="fb sub" style="left:600px;top:98px;width:176px"><div class="fbd"><b>Once per window</b> — escalates if severity rises, never repeats</div></div>
  </div>
  <style>
    .fb{position:absolute;top:24px;height:54px;border:1.3px solid ${C.ink};background:#fff;padding:5px 7px;display:flex;flex-direction:column;justify-content:center}
    .fb.hot{background:#FBE6E3;border-color:${C.red};box-shadow:3px 3px 0 ${C.ink}}
    .fb.sub{height:38px;border-style:dashed;border-color:#6B665C;background:${C.sand}}
    .fbt{font:700 12px/1.15 Archivo;color:${C.ink}}
    .fbd{font:500 11px/1.22 Archivo;color:${C.ink2};margin-top:2px}
    .fb.sub .fbd{margin:0}
  </style>`;
}

function weights() {
  const w = F.model.weights;
  const rows = [["Proximity to the offset event", w.proximity], ["Live parameters (eRTMAC)", w.parameter],
    ["Offsets that hit it", w.frequency], ["Well similarity", w.similarity], ["Same formation", w.formation], ["Trajectory match", w.trajectory]];
  const X = 158, Wd = 132, max = 0.3;
  return `<div style="position:relative;width:336px;height:138px">
    <div class="h2">Risk score = weighted sum of six factors</div>
    <svg width="336" height="96" style="position:absolute;left:0;top:21px">
      ${rows.map(([t, v], i) => {
        const yy = 3 + i * 15.5;
        return `<text x="0" y="${yy + 10}" style="font:500 11px Archivo" fill="${C.ink}">${t}</text>
          <rect x="${X}" y="${yy + 1.5}" width="${(Wd * v) / max}" height="10.5" fill="${C.navy}"/>
          <text x="${X + (Wd * v) / max + 5}" y="${yy + 10.5}" style="font:600 10.5px 'Plex Mono'" fill="${C.ink}">${v.toFixed(2)}</text>`;
      }).join("")}
    </svg>
    <div class="s" style="position:absolute;left:0;top:120px;width:336px;font-size:10.5px;white-space:nowrap">Alert ≥ 0.55 where offsets had high or critical events, else ≥ 0.75</div>
  </div>`;
}

function slide3() {
  return `<section class="slide" data-n="3">${chrome(3, "TECHNICAL APPROACH")}
  ${blk(36, 124, 1208, 94, `${H("Technologies to be used", "all open source · Claude only as an optional, grounded summariser")}${techStrip()}`)}
  ${blk(36, 222, 1208, 0, H("Methodology and process for implementation", "system architecture — a read-only layer beside eRTMAC"))}
  ${blk(36, 246, 1208, 264, architecture())}
  ${blk(36, 520, 860, 138, flowchart())}
  ${blk(908, 520, 336, 138, weights())}
</section>`;
}

// ======================================================================================= 4 · FEASIBILITY
function riskChart() {
  const Wc = 470, Hc = 206, L = 34, R = 10, T = 22, B = 26;
  const pw = Wc - L - R, ph = Hc - T - B;
  const d0 = 3000, d1 = 3660;
  const X = (d) => L + ((d - d0) / (d1 - d0)) * pw;
  const Y = (v) => T + (1 - v) * ph;
  const fam = [["mud_loss", "Mud loss", C.mud], ["stuck_pipe", "Stuck pipe", C.stuck], ["kick", "Kick", C.kick]];
  const line = (pts) => pts.map(([d, v], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const grid = [0, 0.35, 0.55, 0.75, 1].map((v) => `<path d="M${L},${Y(v)} H${L + pw}" stroke="${v === 0 ? "#B9B1A2" : "#E6E0D4"}" stroke-width="1"/>
    <text x="${L - 5}" y="${Y(v) + 3.5}" text-anchor="end" style="font:${v === 0.55 ? 700 : 500} 10px 'Plex Mono'" fill="${v === 0.55 ? C.ink : C.ink2}">${v.toFixed(2)}</text>`).join("");
  const xt = [3000, 3100, 3200, 3300, 3400, 3500, 3600].map((d) => `<text x="${X(d)}" y="${T + ph + 14}" text-anchor="middle" style="font:500 10px 'Plex Mono'" fill="${C.ink2}">${num(d)}</text>`).join("");
  const alerts = fam.map(([k, , c]) => {
    const a = FA[k];
    const x = X(a.depth), yy = Y(a.score);
    return `<path d="M${x},${yy - 2} V${T - 2}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 2"/>
      <polygon points="${x - 5.5},${T - 12} ${x + 5.5},${T - 12} ${x},${T - 3}" fill="${C.ink}"/>
      <text x="${x + 8}" y="${T - 4}" style="font:700 10.5px Archivo" fill="${C.ink}">${num(a.depth)} m</text>
      <circle cx="${x}" cy="${yy}" r="4.5" fill="${c}" stroke="#fff" stroke-width="2"/>`;
  }).join("");
  const lab = [["mud_loss", 3205, 0.9], ["stuck_pipe", 3435, 0.9], ["kick", 3612, 0.93]];
  return `<svg width="${Wc}" height="${Hc}" viewBox="0 0 ${Wc} ${Hc}" style="display:block;overflow:visible">
    ${grid}${xt}
    <path d="M${L},${Y(0.55)} H${L + pw}" stroke="${C.ink}" stroke-width="1.1" stroke-dasharray="4 3"/>
    ${fam.map(([k, , c]) => `<path d="${line(F.series[k])}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
    ${alerts}
    ${lab.map(([k, d, v]) => { const f = fam.find((z) => z[0] === k); return `<text x="${X(d)}" y="${Y(v) + 4}" style="font:700 10.5px Archivo" fill="${C.ink}">${f[1]}</text><path d="M${X(d) - 14},${Y(v)} h10" stroke="${f[2]}" stroke-width="2.5"/>`; }).join("")}
    <text x="${L + pw}" y="${T + ph + 25}" text-anchor="end" style="font:500 10px Archivo" fill="${C.ink2}">bit depth, m MD</text>
  </svg>`;
}

function gantt() {
  const Wg = 718, rowH = 25, L = 262, pw = Wg - L - 8;
  const X = (m) => L + (m / 12) * pw;
  const rows = [
    ["Prototype built and verified", "now", 0, 0, "done"],
    ["Ingest one OIL field (DDR / WCR archive)", "M0–3", 0, 3],
    ["Refit the weights on OIL’s NPT history", "M2–4", 2, 4],
    ["Shadow pilot at eRTMAC, 2 rigs, silent", "M3–6", 3, 6],
    ["Go live: WITSML, SSO, all Assam rigs", "M6–12", 6, 12],
  ];
  const H0 = 16;
  return `<svg width="${Wg}" height="${H0 + rows.length * rowH + 4}" style="display:block;overflow:visible">
    ${[0, 3, 6, 9, 12].map((m) => `<path d="M${X(m)},${H0 - 2} V${H0 + rows.length * rowH}" stroke="#E6E0D4" stroke-width="1"/><text x="${X(m)}" y="${H0 - 6}" text-anchor="middle" style="font:500 10px 'Plex Mono'" fill="${C.ink2}">M${m}</text>`).join("")}
    ${rows.map(([t, when, a, z, kind], i) => {
      const yy = H0 + i * rowH;
      const bar = kind === "done"
        ? `<polygon points="${X(0)},${yy + 5} ${X(0) + 7},${yy + 12} ${X(0)},${yy + 19} ${X(0) - 7},${yy + 12}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.3"/><text x="${X(0) + 12}" y="${yy + 16}" style="font:700 10.5px Archivo" fill="${C.ink}">20 / 20 requirements · real-data proof · demo film</text>`
        : `<rect x="${X(a)}" y="${yy + 5}" width="${X(z) - X(a)}" height="14" fill="${i === 4 ? C.ink : C.navy}"/><text x="${X(a) + 6}" y="${yy + 15.5}" style="font:700 10px 'Plex Mono'" fill="#fff">${when}</text>`;
      return `<text x="0" y="${yy + 16}" style="font:${i === 0 ? 700 : 500} 11.5px Archivo" fill="${C.ink}">${t}</text>${bar}`;
    }).join("")}
    <path d="M${X(0)},${H0 - 2} V${H0 + rows.length * rowH}" stroke="${C.ink}" stroke-width="1.5"/>
  </svg>`;
}

function slide4() {
  const measured = [
    ["SIH26121 requirement lines", `${REQS} / ${REQS} pass`, "API check"],
    ["Automated tests", `${TESTS} / ${TESTS} pass`, "pytest"],
    ["Risk evaluation per depth step", `~${Math.round(F.latency.evaluate_ms)} ms`, "median, in-process"],
    ["Real well histories read", `${num(od.histories)} in ${od.seconds.toFixed(1)} s`, "Sodir FactPages"],
    ["Extraction precision, held-out", `${pct(spot.precision)} (${spot.type_correct} / ${spot.n})`, "hand-checked"],
    ["Learned risk cross-check", `AUC ${learned.auc_model.toFixed(2)} vs ${learned.auc_rule.toFixed(2)}`, "leave-one-well-out"],
    ["Runs on", "one on-prem server", "no GPU, no licence"],
  ];
  const risks = [
    ["Confidential well data", "hi", "High", "On-prem inside OIL’s network, no cloud dependency; LLM optional and off by default; role-based access and an audit trail.", "built", "Built"],
    ["Old, scanned, inconsistent reports", "hi", "High", "Tesseract OCR with per-page confidence, a drilling synonym lexicon, and an engineer approves every extracted event.", "built", "Built"],
    ["Alert fatigue on the rig", "md", "Medium", "Weak windows need live confirmation; one alert per window that escalates, never repeats.", "built", "Built"],
    ["Trust in AI advice", "md", "Medium", "Every alert opens <b>Why?</b> — factors, cited evidence and confidence. The engineer decides.", "built", "Built"],
    ["Weights tuned on a demo field", "md", "Medium", "Refit on OIL’s NPT history, then a shadow pilot before any alert goes live.", "plan", "Pilot"],
    ["Plugging into eRTMAC", "lo", "Low", "Read-only WITSML adapter into the same parameter schema the prototype already uses.", "plan", "Pilot"],
  ];
  return `<section class="slide" data-n="4">${chrome(4, "FEASIBILITY AND VIABILITY")}
  ${blk(36, 124, 470, 262, `${H("Analysis of the feasibility of the idea", "built, tested, measured")}
    <table class="t meas" style="margin-top:7px"><thead><tr><th style="width:47%">Check</th><th style="width:28%">Result</th><th>Evidence</th></tr></thead><tbody>
      ${measured.map(([a, b, e]) => `<tr><td>${a}</td><td class="k">${b}</td><td class="s">${e}</td></tr>`).join("")}
    </tbody></table>`)}
  ${blk(36, 400, 470, 258, `<div class="h2">Replay of the demo well: alerts fire where the offsets struggled</div>
    <div class="s" style="margin:-3px 0 6px">OIL-AX-102, 3,000 → 3,660 m · ▼ alert raised · dashed line = alert level</div>
    ${riskChart()}`)}
  ${blk(526, 124, 718, 326, `${H("Potential challenges and risks → strategies for overcoming these challenges")}
    <table class="t" style="margin-top:7px"><thead><tr><th style="width:27%">Challenge / risk</th><th class="c" style="width:10%">Level</th><th>Strategy</th><th class="c" style="width:10%">Status</th></tr></thead><tbody>
      ${risks.map(([ch, lv, lvt, st, sk, skt]) => `<tr><td class="k">${ch}</td><td class="c"><span class="chip ${lv}">${lvt}</span></td><td>${st}</td><td class="c"><span class="chip ${sk}">${skt}</span></td></tr>`).join("")}
    </tbody></table>`)}
  ${blk(526, 462, 718, 196, `${H("Viability — from prototype to OIL’s rigs in 12 months", "no licence fee · one saved NPT day ≈ ₹30 lakh")}
    <div style="margin-top:10px">${gantt()}</div>`)}
  <style>
    .meas td{padding-top:5px;padding-bottom:5px;white-space:nowrap}
    .meas td.s{font-size:11.5px}
  </style>
</section>`;
}

// ======================================================================================= 5 · IMPACT
function nptChart() {
  // part-to-whole twice: well time → NPT share, then NPT → the share NWIS targets (emphasis: one accent + grey)
  const bw = 580, npt = 0.2, target = 0.4;
  const y1 = 18, y2 = 84, bh = 22;
  const segNPT = bw * npt;
  return `<svg width="${bw}" height="134" style="display:block;overflow:visible">
    <text x="0" y="11" style="font:700 11.5px Archivo" fill="${C.ink}">Well-construction time</text>
    <rect x="0" y="${y1}" width="${bw - segNPT - 2}" height="${bh}" fill="${C.grey}"/>
    <rect x="${bw - segNPT}" y="${y1}" width="${segNPT}" height="${bh}" fill="${C.amber}"/>
    <text x="8" y="${y1 + 15}" style="font:600 11.5px Archivo" fill="${C.ink}">productive time ≈ 80 %</text>
    <text x="${bw - segNPT + 8}" y="${y1 + 15}" style="font:700 11.5px Archivo" fill="#fff">NPT ≈ 20 % [2]</text>
    <path d="M${bw - segNPT},${y1 + bh} L0,${y2 - 18} M${bw},${y1 + bh} L${bw},${y2 - 18}" stroke="${C.ink3}" stroke-width="1" stroke-dasharray="3 2"/>
    <text x="0" y="${y2 - 5}" style="font:700 11.5px Archivo" fill="${C.ink}">Inside NPT: kicks, lost circulation and wellbore instability</text>
    <rect x="0" y="${y2}" width="${bw * target - 2}" height="${bh}" fill="${C.amber}"/>
    <rect x="${bw * target}" y="${y2}" width="${bw * (1 - target)}" height="${bh}" fill="${C.grey}"/>
    <text x="8" y="${y2 + 15}" style="font:700 11.5px Archivo" fill="#fff">up to 40 % of all NPT [3]</text>
    <text x="${bw * target + 8}" y="${y2 + 15}" style="font:600 11.5px Archivo" fill="${C.ink}">other NPT — equipment, waiting, weather</text>
    <text x="0" y="${y2 + bh + 17}" style="font:600 11.5px Archivo" fill="${C.ink}">↑ exactly the events NWIS warns about, well by well and depth by depth</text>
  </svg>`;
}

function valueBlock() {
  const wells = 70, rate = 30;
  const cr = (days) => (wells * days * rate) / 100; // ₹ crore
  const sens = [[0.5, "½ day"], [1, "1 day"], [2, "2 days"]];
  const max = cr(2), bw = 150;
  return `<div style="display:flex;gap:20px;align-items:flex-start">
    <div style="width:300px">
      <div style="font:900 42px/1 'Archivo SC';color:${C.ink};letter-spacing:-.5px">≈ ₹${num(cr(1))} crore <span style="font:800 20px/1 'Archivo SC'">a year</span></div>
      <div class="p" style="margin-top:8px"><b>${wells} wells a year</b> [4] × <b>1 NPT day saved</b> per well × <b>₹${rate} lakh</b> a rig-day*</div>
      <div class="s" style="margin-top:6px;font-size:11px">* assumed spread rate — an illustration, not a forecast; editable in the brief.</div>
    </div>
    <div style="flex:1">
      <div class="s" style="color:${C.ink};font-weight:700;margin-bottom:6px">If NWIS saves per well…</div>
      <svg width="260" height="80" style="display:block">
        ${sens.map(([d, t], i) => { const w = (bw * cr(d)) / max; const yy = i * 26; return `<text x="0" y="${yy + 13}" style="font:600 11.5px Archivo" fill="${C.ink}">${t}</text>
          <rect x="54" y="${yy + 2}" width="${w}" height="15" fill="${d === 1 ? C.navy : "#8FA3BD"}"/>
          <text x="${54 + w + 5}" y="${yy + 14}" style="font:700 11.5px 'Plex Mono'" fill="${C.ink}">₹${num(cr(d), d === 0.5 ? 1 : 0)} cr</text>`; }).join("")}
      </svg>
    </div>
  </div>`;
}

function slide5() {
  const people = [
    ["LuHardHat", "Rig engineer & driller", "reads offset reports by hand before each section", "sees what offsets hit at this depth — 50 m ahead, with the fix that worked"],
    ["LuActivity", "eRTMAC monitoring team", "live curves without the field’s history", "curves judged against offset limits, e.g. the loss-onset ECD"],
    ["LuClipboardList", "Planners & DWOP", "days of offset study per well plan", "a look-ahead brief in seconds: hazards, mud window, NPT in ₹"],
    ["LuGraduationCap", "New engineers", "expertise retires with the people", "a searchable field memory where every line is cited"],
    ["LuBriefcase", "Managers & HSE", "NPT is counted after it happens", "expected NPT per section before drilling; every alert audited"],
  ];
  const benefits = [
    ["LuIndianRupee", "Economic", "Fewer repeated losses, stuck pipe and kicks → less NPT and rig time; faster well planning."],
    ["LuShieldCheck", "Safety", "Earlier awareness of kicks and overpressure supports well control and crew safety."],
    ["LuLeaf", "Environmental", "Fewer loss events → less mud, LCM and cement lost downhole; fewer rig-days of diesel."],
    ["LuUsers", "Social & strategic", "Keeps OIL’s drilling know-how in-house; supports India’s push for more domestic oil and gas."],
  ];
  const b = brief.npt;
  return `<section class="slide" data-n="5">${chrome(5, "IMPACT AND BENEFITS")}
  ${blk(36, 124, 596, 300, `${H("Potential impact on the target audience")}
    <table class="t imp" style="margin-top:7px"><thead><tr><th style="width:30%">Who</th><th style="width:32%">Today</th><th>With NWIS</th></tr></thead><tbody>
      ${people.map(([i, who, now, next]) => `<tr><td class="k"><span class="who">${ic("lu", i, C.ink, 14)}${who}</span></td><td class="s" style="font-size:12px">${now}</td><td>${next}</td></tr>`).join("")}
    </tbody></table>`)}
  ${blk(36, 436, 596, 222, `${H("Benefits of the solution")}
    <div class="ben">${benefits.map(([i, t, d]) => `<div class="bn"><div class="bnt">${ic("lu", i, C.ink, 16)}${t}</div><div class="p" style="font-size:12.5px;color:${C.ink2}">${d}</div></div>`).join("")}</div>`)}
  ${blk(652, 124, 592, 184, `${H("Why it matters — where drilling time goes")}<div style="margin-top:10px">${nptChart()}</div>`)}
  ${blk(652, 318, 592, 158, `${H("Value at OIL’s scale")}<div style="margin-top:10px">${valueBlock()}</div>`)}
  ${blk(652, 488, 592, 170, `${H("Priced per section, before drilling", "prototype · demo well")}
    <div style="display:flex;gap:14px;margin-top:9px">
      <img src="assets/shot-brief.jpg" alt="" style="width:196px;height:110px;object-fit:cover;object-position:left top;border:1.3px solid ${C.ink};box-shadow:3px 3px 0 ${C.ink}">
      <div class="p" style="flex:1">The <b>look-ahead brief</b> for OIL-AX-102 at 3,100 m: <b>${brief.hazards.length} hazard windows</b> in the next 300 m,
        <b>${b.expected_hours} h expected NPT ≈ ₹${num(lakh(b.expected_hours))} lakh</b>, worst case ${num(b.worst_case_hours)} h ≈ ₹${num(lakh(b.worst_case_hours))} lakh —
        with what worked in the offsets, ranked by the NPT it saved. Printable for the 12-hour handover.</div>
    </div>`)}
  <style>
    .imp td{padding-top:6px;padding-bottom:6px}
    .who{display:flex;gap:6px;align-items:flex-start}.who svg{margin-top:1px}
    .ben{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin-top:10px}
    .bn{border-top:1px solid ${C.rule};padding-top:7px}
    .bnt{display:flex;gap:7px;align-items:center;font:800 14px/1 'Archivo SC';color:${C.ink};margin-bottom:5px}
  </style>
</section>`;
}

// ======================================================================================= 6 · RESEARCH
function familyBars() {
  const f = od.by_family;
  const rows = [["Stuck pipe", f.stuck_pipe], ["Mud loss", f.mud_loss], ["Kick / overpressure", f.kick], ["NPT & fishing", f.NPT],
    ["Wellbore instability", f.wellbore_instability], ["Cementing, torque", (f.cementing_failure || 0) + (f.torque_spike || 0)]];
  const max = Math.max(...rows.map((r) => r[1])), L = 132, bw = 330;
  return `<svg width="536" height="${rows.length * 22 + 4}" style="display:block">
    ${rows.map(([t, v], i) => { const yy = i * 22; const w = (bw * v) / max; return `<text x="0" y="${yy + 14}" style="font:600 11.5px Archivo" fill="${C.ink}">${t}</text>
      <rect x="${L}" y="${yy + 3}" width="${w}" height="15" fill="${C.navy}"/><text x="${L + w + 6}" y="${yy + 15}" style="font:700 11.5px 'Plex Mono'" fill="${C.ink}">${v}</text>`; }).join("")}
  </svg>`;
}

function slide6() {
  const cols = ["Manual offset review", "Real-time monitoring alone", "Generic document chatbot", "NWIS"];
  const rows = [
    ["Tied to the live bit depth", [NO, YES, NO, YES]],
    ["Reads DDR / WCR text, even scans", [YES, NO, PART, YES]],
    ["Cites report, page and depth", [PART, NO, PART, YES]],
    ["Warns before the risky depth", [NO, PART, NO, YES]],
    ["Time to the offset history", ["hours – days", "—", "seconds", "< 1 s, cited"]],
  ];
  const refs = [
    ["Problem & industry data", [
      ["1", "SIH26121 Nearby Wells Intelligence System — Oil India Limited", "SIH 2026 portal", "https://sih.gov.in"],
      ["2", "NPT is about 20 % of well-construction time", "Drilling Contractor, 2018", "https://drillingcontractor.org/maersk-looks-beyond-traditional-rig-downtime-scope-adopts-data-based-approach-to-reduce-operator-npt-47432"],
      ["3", "Kicks, losses and wellbore instability: up to 40 % of NPT", "Offshore Magazine, 2011", "https://www.offshore-mag.com/drilling-completion/article/16755153/data-visualization-real-time-monitoring-improve-drilling-efficiency"],
      ["4", "OIL spudded 70 wells in FY25 with 21 rigs", "Chairman’s speech, 66th AGM, 2025", "https://www.oil-india.com/files/investor_services_documents/Chairman_Speech_OIL_AGM_2024-25.pdf"],
    ]],
    ["Research, data & standards", [
      ["5", "Hoffimann et al. — pattern mining in drilling reports with deep NLP", "arXiv, 2017", "https://arxiv.org/abs/1712.01476"],
      ["6", "Montes, Ashok, van Oort — review of stuck-pipe prediction", "SPE Journal, 2025", "https://doi.org/10.2118/220725-PA"],
      ["7", "Norwegian Offshore Directorate well data, NLOD 2.0", "Sodir FactPages", "https://factpages.sodir.no/en/wellbore"],
      ["8", "WITSML real-time drilling data standard (eRTMAC adapter)", "Energistics", "https://energistics.org/node/202"],
    ]],
  ];
  return `<section class="slide" data-n="6">${chrome(6, "RESEARCH AND REFERENCES")}
  ${blk(36, 124, 652, 300, `${H("Research — where today’s approaches fall short")}
    <table class="t mx" style="margin-top:7px"><thead><tr><th style="width:31%">Capability</th>${cols.map((c, i) => `<th class="c${i === 3 ? " us" : ""}">${c}</th>`).join("")}</tr></thead><tbody>
      ${rows.map(([t, v]) => `<tr><td class="k">${t}</td>${v.map((m, i) => `<td class="c${i === 3 ? " us" : ""}">${m.startsWith("<svg") ? m : `<span class="txt">${m}</span>`}</td>`).join("")}</tr>`).join("")}
    </tbody></table>
    <div class="mxk">${YES}<span>yes</span>${PART}<span>partly</span>${NO}<span>no</span></div>
    <div class="p" style="margin-top:8px;width:640px">Earlier work mines report text [5] or predicts stuck pipe from drilling parameters [6] — separately. <b>NWIS joins both at the live bit depth</b> and shows the source of every warning.</div>`)}
  ${blk(708, 124, 536, 300, `${H("Validated on real public well records", "same extractor, rules frozen")}
    <div class="kpis">
      <div><div class="kv">${num(od.histories)}</div><div class="kl">well histories read, ${od.years[0]}–${od.years[1]}</div></div>
      <div><div class="kv">${num(od.events)}</div><div class="kl">drilling problems found in ${od.seconds.toFixed(1)} s</div></div>
      <div><div class="kv">${pct(spot.precision)}</div><div class="kl">precision on held-out wells (${spot.type_correct} of ${spot.n})</div></div>
    </div>
    <div class="s" style="color:${C.ink};font-weight:700;margin:10px 0 6px">Problems found, by type — Norwegian shelf [7]</div>
    ${familyBars()}`)}
  ${blk(36, 438, 1208, 220, `${H("Details / links of the reference and research work")}
    <div class="refs">${refs.map(([g, list]) => `<div><div class="rg">${g}</div>${list.map(([n, t, src, url]) => `<div class="rf"><span class="rn">[${n}]</span><span>${t} — <a href="${url}">${src} ↗</a></span></div>`).join("")}</div>`).join("")}</div>`)}
  <style>
    .mx th{font-size:11.5px;line-height:1.15}.mx th.us{background:${C.ink}}
    .mx td{vertical-align:middle;padding-top:6px;padding-bottom:6px}
    .mx td.us{background:#FFF6D6!important;box-shadow:inset 1.5px 0 0 ${C.ink},inset -1.5px 0 0 ${C.ink}}
    .mx tr:last-child td.us{box-shadow:inset 1.5px 0 0 ${C.ink},inset -1.5px 0 0 ${C.ink},inset 0 -1.5px 0 ${C.ink}}
    .mx .txt{font:600 11.5px/1.2 Archivo;color:${C.ink}}
    .mxk{display:flex;align-items:center;gap:6px;margin-top:7px;font:500 11.5px/1 Archivo;color:${C.ink2}}.mxk span{margin-right:10px}
    .kpis{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:10px}
    .kv{font:900 36px/1 'Archivo SC';color:${C.ink};letter-spacing:-.4px}
    .kl{font:500 11.5px/1.25 Archivo;color:${C.ink2};margin-top:4px}
    .refs{display:grid;grid-template-columns:1fr 1fr;gap:6px 36px;margin-top:9px}
    .rg{font:700 11.5px/1 'Archivo SC';color:${C.ink2};margin-bottom:6px}
    .rf{display:flex;gap:7px;font:500 12.5px/1.3 Archivo;color:${C.ink};margin-bottom:7px}
    .rn{font:700 12px/1.3 'Plex Mono';flex:none;width:26px}
    .rf a{color:#1D4F91;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
  </style>
</section>`;
}

// ======================================================================================= notes (PPTX speaker notes)
const NOTES = [
  "SIH26121 from Oil India Limited: a Nearby Wells Intelligence System. One line: NWIS gives every drilling engineer the field's memory at the depth it matters.",
  "The picture is the idea. The active well is at 3,100 m. Offsets hit mud loss at 3,150, stuck pipe at 3,380 and a kick at 3,580. NWIS reads their reports, links each event to the same depth on the active well, flags the window 50 m ahead and raises the alert as the bit enters it — with the fix that worked and the source page.",
  "Top: the stack, all open source. The architecture is a read-only layer beside eRTMAC, on-prem: OIL's reports go through OCR and NLP, an engineer approves what becomes knowledge, and a depth-indexed knowledge base feeds the services behind one REST API. The yellow path is the live loop. Bottom: exactly how an alert is raised, and the six weights of the score.",
  "Feasibility is shown, not claimed: it is built and measured. The chart is the replayed demo well — alerts fire at 3,150, 3,380 and 3,580 m, where the offsets struggled. Every risk has a concrete answer, most already built; the path to the rig is one field ingested, then a shadow pilot at eRTMAC.",
  "About a fifth of well time is NPT and up to 40 % of it comes from kicks, losses and instability — exactly what NWIS warns about. At OIL's scale one avoided NPT day per well is about 21 crore rupees a year, at an assumed spread rate.",
  "NWIS is the only approach tied to the live bit depth with cited evidence. We proved the extractor on 1,970 real public well histories with 94 % held-out precision. Give us three anonymised OIL DDR pages and we ingest them live.",
];

// ======================================================================================= render
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>NWIS — SIH 2026 idea presentation</title>
<style>${CSS}</style></head><body>
${[slide1(), slide2(), slide3(), slide4(), slide5(), slide6()].join("\n")}
</body></html>`;
const htmlPath = path.join(RENDER, "deck.html");
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
async function open(dsf) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  return page;
}

// QA: overflowing boxes, elements outside their slide, fonts actually used
const page = await open(1.5);
const qa = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll(".slide").forEach((s) => {
    const n = s.dataset.n, sr = s.getBoundingClientRect();
    s.querySelectorAll(".blk,.box,.fb,.lk,.acard").forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).height !== "auto" && el.style.height)
        out.push(`slide ${n}: ${el.className} overflows by ${el.scrollHeight - el.clientHeight}px: "${el.textContent.trim().slice(0, 60)}"`);
      if (el.classList.contains("box") && el.scrollHeight > el.clientHeight + 1)
        out.push(`slide ${n}: box overflows by ${el.scrollHeight - el.clientHeight}px: "${el.textContent.trim().slice(0, 50)}"`);
    });
    s.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > sr.right + 0.5 || r.bottom > sr.bottom + 0.5 || r.left < sr.left - 0.5))
        out.push(`slide ${n}: ${el.tagName.toLowerCase()}.${el.className?.baseVal ?? el.className} outside slide`);
    });
    // absolutely placed callouts (.qa) must not collide with each other or with the blocks below them
    const qa = [...s.querySelectorAll(".qa")].map((el) => [el, el.getBoundingClientRect()]);
    for (let i = 0; i < qa.length; i++)
      for (let j = i + 1; j < qa.length; j++) {
        const [a, ra] = qa[i], [b, rb] = qa[j];
        if (ra.left < rb.right && rb.left < ra.right && ra.top < rb.bottom && rb.top < ra.bottom)
          out.push(`slide ${n}: overlap ${a.className} × ${b.className}`);
      }
  });
  return [...new Set(out)];
});
console.log(qa.length ? "QA:\n  " + qa.join("\n  ") : "QA: no overflow");

const links = await page.evaluate(() => {
  const res = {};
  document.querySelectorAll(".slide").forEach((s) => {
    const sr = s.getBoundingClientRect();
    res[s.dataset.n] = [...s.querySelectorAll("a[href]")].map((a) => {
      const r = a.getBoundingClientRect();
      return { href: a.href, x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    });
  });
  return res;
});
fs.writeFileSync(path.join(RENDER, "meta.json"), JSON.stringify({ links, notes: NOTES }, null, 1));

const slides = page.locator(".slide");
const count = await slides.count();
for (let i = 0; i < count; i++) await slides.nth(i).screenshot({ path: path.join(RENDER, `slide-${String(i + 1).padStart(2, "0")}.png`) });
await page.pdf({ path: CFG.out_pdf, printBackground: true, preferCSSPageSize: true });
console.log("pdf ->", CFG.out_pdf);

// transparent content overlays (no template chrome) for the .pptx
const bare = await open(3);
await bare.evaluate(() => document.documentElement.classList.add("bare"));
fs.mkdirSync(path.join(RENDER, "bare"), { recursive: true });
const bs = bare.locator(".slide");
for (let i = 0; i < count; i++)
  await bs.nth(i).screenshot({ path: path.join(RENDER, "bare", `slide-${String(i + 1).padStart(2, "0")}.png`), omitBackground: true });
await browser.close();
console.log(`rendered ${count} slides`);
