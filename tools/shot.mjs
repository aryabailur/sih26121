// Screenshot helper with WebGL enabled (MapLibre needs it in headless Chromium).
// usage: [W=1600 H=900 THEME=dark INTRO=1] node snap.mjs <path> <out.png> [waitMs] [actions-json]
// actions: [{"click":"text=Run scenario"},{"wait":2000},{"key":"ArrowDown"},{"eval":"..."},{"fill":["sel","v"]},{"hover":"sel"},{"shot":"x.png"}]
import { chromium } from "playwright";

const [, , route = "/dashboard", out = "shot.png", waitMs = "6000", actionsJson = "[]"] = process.argv;
// Hardware GL (ANGLE/D3D11) — the software fallback renders the 3D map at ~3 fps and starves animations.
const GL = process.env.SOFTWARE_GL ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ args: GL });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1600), height: Number(process.env.H || 900) }, deviceScaleFactor: 1 });
const theme = process.env.THEME || "light";
const intro = process.env.INTRO === "1";
await page.addInitScript(
  ([t, i]) => {
    try {
      localStorage.setItem("nwis-theme", t);
      if (!i) sessionStorage.setItem("nwis-intro", "1");
    } catch {}
  },
  [theme, intro],
);
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
await page.goto("http://localhost:3000" + route, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(Number(waitMs));
for (const a of JSON.parse(actionsJson)) {
  if (a.click) await page.click(a.click, { timeout: 15000 });
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.key) await page.keyboard.press(a.key);
  if (a.eval) await page.evaluate(a.eval);
  if (a.fill) await page.fill(a.fill[0], a.fill[1]);
  if (a.hover) await page.hover(a.hover);
  if (a.mouse) await page.mouse.move(a.mouse[0], a.mouse[1]);
  if (a.shot) await page.screenshot({ path: a.shot });
}
await page.screenshot({ path: out, fullPage: false });
console.log("saved", out);
if (errors.length) console.log("CONSOLE ERRORS:\n" + [...new Set(errors)].slice(0, 15).join("\n"));
await browser.close();
