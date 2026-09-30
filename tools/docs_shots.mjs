// Capture the full demo flow into docs/screenshots (one session so store state carries over).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OUT = path.join(ROOT, "docs/screenshots");
const BASE = "http://localhost:3000";
await fetch("http://127.0.0.1:8000/api/simulation/reset", { method: "POST" });

// Hardware GL (ANGLE/D3D11): the 3D map is far too slow on the software rasteriser (~3 fps).
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
// Daylight theme; the orbit fly-in is captured separately (00-welcome), so skip it on the dashboard.
await page.addInitScript(() => {
  try {
    localStorage.setItem("nwis-theme", "light");
    sessionStorage.setItem("nwis-intro", "1");
  } catch {}
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name) => {
  await page.mouse.move(1500, 880);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("saved", name);
};
const nav = async (href, wait = 3500) => {
  await page.click(`a[href="${href}"]`);
  await page.waitForTimeout(wait);
};

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
await shot("00-welcome");

await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
await shot("01-command-center");

await page.click("text=Run historical risk scenario");
await page.waitForTimeout(8600);
await shot("02-mud-loss-alert");
await page.waitForTimeout(27000);
await shot("03-scenario-complete");

await page.locator("text=Why?").nth(1).click();
await page.waitForTimeout(1500);
await shot("04-why-explainer");
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

await nav("/dashboard/nearby", 4500);
await shot("05-nearby-wells");

await page.goto(BASE + "/dashboard/well/W002", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
await shot("06-well-intelligence");

await nav("/dashboard/compare", 5000);
await shot("07-correlate-compare");

await page.goto(BASE + "/dashboard/search?q=" + encodeURIComponent("What caused mud loss in the Barail Group near 3150m?"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
await shot("08-evidence-search");

await page.locator("text=Open source page").first().click();
await page.waitForTimeout(1800);
await shot("09-source-viewer");
await page.keyboard.press("Escape");

await nav("/dashboard/risk", 4000);
await shot("10-risk-explorer");

await nav("/dashboard/documents", 3000);
await page.click("text=Process sample report");
await page.waitForTimeout(7000);
await shot("11-document-review");
await page.click("text=Save to knowledge base");
await page.waitForTimeout(2500);
await shot("12-document-saved");

// Scanned (image-only) report: every word comes from Tesseract OCR.
await page.click("button:has-text('Process scanned report')");
await page.waitForTimeout(9000);
await page.click("[role=tab]:has-text('Text')");
await page.waitForTimeout(1200);
await shot("15-scanned-report-ocr");

// Learned cross-check on the Risk explorer.
await nav("/dashboard/risk", 5000);
await page.evaluate(() =>
  [...document.querySelectorAll("div")].find((d) => d.textContent.trim().startsWith("Learned from offset-well history") && d.children.length < 4)?.scrollIntoView({ block: "center" }),
);
await page.waitForTimeout(1200);
await shot("16-learned-model");

// Move the bit with the command palette (alerts were already raised by the scenario, so no new toasts).
const jump = async (depth) => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await page.fill("input[placeholder^='Jump']", String(depth));
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
};

// Look-ahead brief from 3,100 m — the numbers the deck quotes (mud loss + stuck pipe ahead).
await nav("/dashboard/brief", 1500);
await jump(3100);
await page.waitForTimeout(4000);
await shot("18-look-ahead-brief");
await page.evaluate(() => document.querySelector("main .overflow-y-auto")?.scrollTo(0, 820));
await page.waitForTimeout(1200);
await shot("19-brief-hazard");

// Subsurface 3D with the bit inside the Kopili stuck-pipe window.
await nav("/dashboard/subsurface", 6500);
await jump(3395);
await page.waitForTimeout(6000);
await shot("17-subsurface-3d");

// Command palette.
await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
await page.fill("input[placeholder^='Jump']", "kick");
await page.waitForTimeout(700);
await shot("20-command-palette");
await page.keyboard.press("Escape");

// Real-data proof: the pipeline on public Norwegian operator records.
await nav("/dashboard/opendata", 9000);
await shot("21-real-data-proof");
await page.evaluate(() => document.querySelector("main .overflow-y-auto")?.scrollTo(0, 690));
await page.waitForTimeout(2500);
await shot("22-real-data-offsets");

// Night-shift theme on the command center.
await page.evaluate(() => localStorage.setItem("nwis-theme", "dark"));
await page.addInitScript(() => {
  try {
    localStorage.setItem("nwis-theme", "dark");
  } catch {}
});
await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
await shot("14-night-shift-theme");

await fetch("http://127.0.0.1:8000/api/simulation/reset", { method: "POST" });
if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
await browser.close();
