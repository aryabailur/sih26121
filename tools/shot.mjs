// usage: [W=1600 H=900] node shot.mjs <path> <out.png> [waitMs] [actions-json]   (Git Bash: export MSYS_NO_PATHCONV=1)
// actions: [{"click":"text=Run historical risk scenario"},{"wait":2000},{"key":"ArrowRight"},{"eval":"..."}]
import { chromium } from "playwright";

const [, , path = "/dashboard", out = "shot.png", waitMs = "3500", actionsJson = "[]"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(process.env.W||1600), height: Number(process.env.H||900) }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(Number(waitMs));
for (const a of JSON.parse(actionsJson)) {
  if (a.click) await page.click(a.click, { timeout: 15000 });
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.key) await page.keyboard.press(a.key);
  if (a.eval) await page.evaluate(a.eval);
  if (a.fill) await page.fill(a.fill[0], a.fill[1]);
}
await page.screenshot({ path: out, fullPage: false });
console.log("saved", out);
if (errors.length) console.log("CONSOLE ERRORS:\n" + errors.slice(0, 12).join("\n"));
await browser.close();
