// Capture the full demo flow into docs/screenshots (one session so store state carries over).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OUT = path.join(ROOT, "docs/screenshots");
const BASE = "http://localhost:3000";
await fetch("http://127.0.0.1:8000/api/simulation/reset", { method: "POST" });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
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

await fetch("http://127.0.0.1:8000/api/simulation/reset", { method: "POST" });
if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
await browser.close();
