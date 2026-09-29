import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "http://127.0.0.1:8000";
await fetch(`${API}/api/simulation/reset`, { method: "POST" });
// Hardware GL (ANGLE/D3D11): the 3D map is far too slow on the software rasteriser (~3 fps).
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => {
  try {
    localStorage.setItem("nwis-theme", "light");
    sessionStorage.setItem("nwis-intro", "1");
  } catch {}
});
await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
await page.click("button:has-text('Run historical risk scenario')");
await page.waitForTimeout(10500);
await page.click("button:has-text('Pause scenario')");
await page.click('a[href="/dashboard/risk"]');
await page.waitForTimeout(4000);
await page.evaluate(() => document.querySelectorAll("main div").forEach((d) => {
  if (d.scrollHeight > d.clientHeight + 50 && d.getBoundingClientRect().left > 1000) d.scrollTop = 170;
}));
await page.mouse.move(1500, 880);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(ROOT, "docs/screenshots/13-mud-weight-window.png") });
await browser.close();
await fetch(`${API}/api/simulation/reset`, { method: "POST" });
console.log("saved");
