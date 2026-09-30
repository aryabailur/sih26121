// E2E: explore first (pre-raise an alert), run scenario, pause, resume → expect a fresh toast and 3 alerts.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const API = "http://127.0.0.1:8000";
await fetch(`${API}/api/simulation/reset`, { method: "POST" });
// Pre-raise the mud-loss alert as a presenter exploring would.
await fetch(`${API}/api/risk/evaluate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ well_id: "W001", current_depth: 3160, radius_km: 50 }) });

// Hardware GL: the 3D map (MapLibre + terrain) is far too slow on the software rasteriser.
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
// Change radius to 50 km first (the scenario must restore 25 km).
await page.click('a[href="/dashboard/nearby"]');
await page.waitForTimeout(2500);
await page.locator('input[aria-label="Search radius"]').fill("10"); // index 10 → 50 km
await page.waitForTimeout(1200);
await page.click('a[href="/dashboard"]');
await page.waitForTimeout(2500);

await page.click("button:has-text('Run historical risk scenario')");
let sawToast = false;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(500);
  if (await page.locator("text=Proactive alert").count()) { sawToast = true; break; }
}
await page.click("button:has-text('Pause scenario')");
await page.waitForTimeout(600);
const resumeVisible = await page.locator("button:has-text('Resume')").count();
await page.click("button:has-text('Resume')");
await page.waitForTimeout(700);
await page.click("button:has-text('Pause scenario')"); // quick pause/resume again — must not double-run
await page.click("button:has-text('Resume')");
await page.waitForTimeout(36000);
const alerts = await (await fetch(`${API}/api/risk/alerts`)).json();
const depthText = await page.locator("header >> text=/\\d,\\d{3} m/").first().textContent();
console.log(JSON.stringify({
  sawToastAt3150: sawToast, resumeVisible: resumeVisible > 0, finalDepth: depthText,
  alerts: alerts.alerts.map((a) => `${a.risk_type}@${a.triggered_at_depth}:${a.severity}`),
  radiusChip: await page.locator("text=/\\d+ offsets · \\d+ km/").first().textContent(),
  errors,
}, null, 1));
await browser.close();
await fetch(`${API}/api/simulation/reset`, { method: "POST" });
