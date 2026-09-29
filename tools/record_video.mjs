// Record a backup walkthrough video of the core demo flow (webm).
import { chromium } from "playwright";
import { renameSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DIR = path.join(ROOT, "tools/.video-tmp");
mkdirSync(DIR, { recursive: true });
await fetch("http://127.0.0.1:8000/api/simulation/reset", { method: "POST" });

// Hardware GL (ANGLE/D3D11): the 3D map is far too slow on the software rasteriser (~3 fps).
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, recordVideo: { dir: DIR, size: { width: 1440, height: 810 } } });
const page = await ctx.newPage();
const w = (ms) => page.waitForTimeout(ms);

await page.addInitScript(() => {
  try {
    localStorage.setItem("nwis-theme", "light");
  } catch {}
});
// welcome: spinning globe → choose the field role → dive into the command center
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await w(5000);
await page.click("button:has-text('Enter as')");
await w(8000);
// map filter
await page.click("button[aria-pressed]:has-text('Losses')");
await w(900);
await page.click("button[aria-pressed]:has-text('Stuck pipe')");
await w(2200);
await page.click("button:has-text('Clear')");
await w(800);

// nearby wells → OIL-AX-99 profile → source page
await page.click('a[href="/dashboard/nearby"]');
await w(3500);
await page.locator("td >> text=OIL-AX-99").first().click();
await w(3500);
await page.locator("button:has-text('DDR OIL-AX-99 Day 42')").first().click();
await w(3500);
await page.keyboard.press("Escape");
await w(600);
await page.keyboard.press("Escape");
await w(600);

// evidence search
await page.click('a[href="/dashboard/search"]');
await w(2000);
await page.fill('input[aria-label="Evidence query"]', "What mitigations were used for stuck pipe in Kopili Shale?");
await w(600);
await page.keyboard.press("Enter");
await w(4000);
await page.locator('button[aria-label="Evidence 2"]').first().click();
await w(2500);

// scenario on the command center
await page.click('a[href="/dashboard"]');
await w(2500);
await page.click("button:has-text('Run scenario'), button:has-text('Run historical risk scenario')");
await w(34000);

// explain + acknowledge
await page.locator("text=Why?").nth(1).click();
await w(5000);
await page.fill('input[placeholder^="Engineer note"]', "KCl verified at 7%, ream every stand");
await w(800);
await page.click("button:has-text('Acknowledge') >> nth=-1");
await w(2500);
await page.keyboard.press("Escape");
await w(2000);

await ctx.close();
await browser.close();
const f = readdirSync(DIR).filter((x) => x.endsWith(".webm")).sort().pop();
renameSync(`${DIR}/${f}`, path.join(ROOT, "docs/nwis-demo-walkthrough.webm"));
await fetch("http://127.0.0.1:8000/api/simulation/reset", { method: "POST" });
console.log("video saved");
