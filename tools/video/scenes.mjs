// Renders the motion-graphics scenes and transparent overlays of scenes.html, frame by frame (deterministic, 30 fps).
//   node scenes.mjs [name ...]      (default: all)
// Scene timing is derived from the voice durations, so a human re-record re-times everything automatically.
// Output: $NWIS_VIDEO_BUILD/scenes/<name>/f######.(jpg|png) + timing.json {duration, fps, vo, transparent, clip}.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = process.env.NWIS_VIDEO_BUILD ?? path.join(os.tmpdir(), "nwis-video");
const DUR = JSON.parse(fs.readFileSync(path.join(BUILD, "vo", "durations.json"), "utf8"));
const WORDS = JSON.parse(fs.readFileSync(path.join(BUILD, "vo", "words.json"), "utf8"));
const SCRIPT = JSON.parse(fs.readFileSync(path.join(HERE, "script.json"), "utf8"));
const FPS = 30;

/** Voice-driven scene: lines back to back with gaps; returns {duration, vo}. */
function layout(lines, lead, gaps, tail) {
  let t = lead;
  const vo = {};
  lines.forEach((id, i) => {
    vo[id] = +t.toFixed(3);
    t += DUR[id] + (i < lines.length - 1 ? (Array.isArray(gaps) ? gaps[i] : gaps) : 0);
  });
  return { duration: +(t + tail).toFixed(3), vo };
}

const LT = { clip: { x: 0, y: 760, width: 1120, height: 320 }, duration: 4.4 };
export const SPECS = {
  intro: { scene: "title", ...layout(["T1"], 0.45, 0, 0.75), P: { team: SCRIPT.team ?? "" } },
  problem: { scene: "problem", ...layout(["P1", "P2", "P3"], 0.6, 0.35, 0.9) },
  explain: { scene: "explain", ...layout(["I3"], 0.3, 0, 0.8) },
  impact: { scene: "impact", ...layout(["V1", "V2", "V3"], 0.4, [0.35, 0.4], 2.6), P: { team: SCRIPT.team ?? "" } },
  ch02: { scene: "chapter", duration: 1.5, vo: {}, P: { n: "02", title: "The solution" } },
  ch03: { scene: "chapter", duration: 1.5, vo: {}, P: { n: "03", title: "Core innovation" } },
  ch04: { scene: "chapter", duration: 1.5, vo: {}, P: { n: "04", title: "Live demo", sub: "Screen recording of the working prototype" } },
  ch05: { scene: "chapter", duration: 1.5, vo: {}, P: { n: "05", title: "Impact" } },
  statement: { scene: "statement", transparent: true, duration: +(DUR.G3 + 0.75).toFixed(3), vo: { G3: 0.15 } },
  // lower-thirds name the feature and add what the voice doesn't say
  lt_cc: { scene: "lowerThird", transparent: true, ...LT, duration: 5.2, vo: {}, P: { kicker: "Live prototype", title: "Command Center, well OIL-AX-102", sub: "Demo field based on Upper Assam geology. Wells are illustrative, not Oil India records." } },
  lt_innov: { scene: "lowerThird", transparent: true, ...LT, vo: {}, P: { kicker: "Core innovation", title: "The depth-aware link", sub: "Built for OIL-AX-102 from 10 offset wells within 25 km" } },
  lt_alert: { scene: "lowerThird", transparent: true, ...LT, vo: {}, P: { kicker: "Alert", title: "Mud-loss risk flagged at 3,150 m", sub: "Seen in 2 offset wells, confidence 85%" } },
  lt_sub: { scene: "lowerThird", transparent: true, ...LT, vo: {}, P: { kicker: "Subsurface 3D", title: "Strata from offset formation tops", sub: "True well paths, with past incidents at their depth" } },
  lt_well: { scene: "lowerThird", transparent: true, ...LT, duration: 4.0, vo: {}, P: { kicker: "Well intelligence", title: "One offset, depth for depth", sub: "OIL-AX-99 against OIL-AX-102, in the night-shift theme" } },
  lt_compare: { scene: "lowerThird", transparent: true, ...LT, duration: 4.0, vo: {}, P: { kicker: "Correlate and compare", title: "Formation tops across the offsets", sub: "Casing shoes, mud weights and events on one section" } },
  lt_ask: { scene: "lowerThird", transparent: true, ...LT, vo: {}, P: { kicker: "Evidence search", title: "Every answer cites its source", sub: "Keyword and semantic search across every report" } },
  lt_brief: { scene: "lowerThird", transparent: true, ...LT, vo: {}, P: { kicker: "Look-ahead brief", title: "The next 300 m on one page", sub: "Print it, copy it, or have it read aloud" } },
  lt_docs: { scene: "lowerThird", transparent: true, ...LT, vo: {}, P: { kicker: "Document intake", title: "Scanned reports, read with OCR", sub: "Events are extracted with their depth and formation" } },
  lt_real: { scene: "lowerThird", transparent: true, ...LT, vo: {}, P: { kicker: "Public data test", title: "1,970 real well histories", sub: "Norwegian Offshore Directorate FactPages, NLOD 2.0 licence" } },
};

async function render(name, spec, browser) {
  const dir = path.join(BUILD, "scenes", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const W = Object.fromEntries(Object.keys(spec.vo).map((id) => [id, WORDS[id] ?? []]));
  await page.addInitScript((cfg) => (window.CONFIG = cfg), { scene: spec.scene, V: spec.vo, W, D: spec.duration, P: spec.P ?? {} });
  await page.goto(pathToFileURL(path.join(HERE, "scenes.html")).href);
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(250);
  const n = Math.round(spec.duration * FPS);
  const ext = spec.transparent ? "png" : "jpg";
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({
      path: path.join(dir, `f${String(i).padStart(6, "0")}.${ext}`),
      type: spec.transparent ? "png" : "jpeg",
      ...(spec.transparent ? { omitBackground: true } : { quality: 93 }),
      ...(spec.clip ? { clip: spec.clip } : {}),
    });
  }
  fs.writeFileSync(path.join(dir, "timing.json"), JSON.stringify({ name, duration: spec.duration, fps: FPS, frames: n, vo: spec.vo, transparent: !!spec.transparent, clip: spec.clip ?? null, ext }, null, 1));
  await page.close();
  console.log(`${name}: ${n} frames (${spec.duration}s)`);
}

/** Dev: half-size stills of one scene at the given times → $NWIS_VIDEO_BUILD/peek/<name>_<t>.png. */
async function peek(name, times, browser) {
  const spec = SPECS[name];
  const dir = path.join(BUILD, "peek");
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 0.5 });
  const W = Object.fromEntries(Object.keys(spec.vo).map((id) => [id, WORDS[id] ?? []]));
  await page.addInitScript((cfg) => (window.CONFIG = cfg), { scene: spec.scene, V: spec.vo, W, D: spec.duration, P: spec.P ?? {} });
  await page.goto(pathToFileURL(path.join(HERE, "scenes.html")).href);
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(250);
  for (const t of times) {
    await page.evaluate((x) => window.render(x), t);
    const f = path.join(dir, `${name}_${t}.png`);
    await page.screenshot({ path: f, omitBackground: !!spec.transparent });
    console.log(f);
  }
  await page.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu"] });
  if (args[0] === "--peek") await peek(args[1], args.slice(2).map(Number), browser); // node scenes.mjs --peek problem 2 9.5
  else for (const [name, spec] of Object.entries(SPECS)) if (!args.length || args.includes(name)) await render(name, spec, browser);
  await browser.close();
}
