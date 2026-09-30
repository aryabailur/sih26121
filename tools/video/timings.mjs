// Dev helper: voice-line windows and marks per take (seconds after record start).   node timings.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BUILD = process.env.NWIS_VIDEO_BUILD ?? path.join(os.tmpdir(), "nwis-video");
const dur = JSON.parse(fs.readFileSync(path.join(BUILD, "vo", "durations.json"), "utf8"));
for (const t of fs.readdirSync(path.join(BUILD, "takes"))) {
  const f = path.join(BUILD, "takes", t, "markers.json");
  if (!fs.existsSync(f)) continue;
  const m = JSON.parse(fs.readFileSync(f, "utf8"));
  const i = m.marks.in;
  const vo = Object.entries(m.vo).map(([k, v]) => `${k} ${(v - i).toFixed(1)}–${(v - i + dur[k]).toFixed(1)}`);
  const mk = Object.entries(m.marks).filter(([k]) => k !== "in").map(([k, v]) => `${k}@${(v - i).toFixed(1)}`);
  console.log(`${t.padEnd(11)} ${vo.join(" · ")}  |  ${mk.join(" ")}`);
}
