// Dev helper: print the frame file shown at given times.   node peek.mjs <take> <spec...>
// spec = seconds after record start ("12.5") or after a voice line / mark ("W4+2", "stuckAlert+1.5").
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BUILD = process.env.NWIS_VIDEO_BUILD ?? path.join(os.tmpdir(), "nwis-video");
const [take, ...specs] = process.argv.slice(2);
const dir = path.join(BUILD, "takes", take);
const frames = JSON.parse(fs.readFileSync(path.join(dir, "frames.json"), "utf8"));
const m = JSON.parse(fs.readFileSync(path.join(dir, "markers.json"), "utf8"));
for (const s of specs) {
  const [, key, off] = s.match(/^([A-Za-z]\w*)?([+-]?[\d.]*)$/) ?? [];
  const base = key ? (m.vo[key] ?? m.marks[key]) : m.marks.in;
  const t = base + Number(off || 0);
  let best = frames[0];
  for (const f of frames) if (f.t <= t) best = f;
  console.log(s, path.join(dir, "frames", best.f));
}
