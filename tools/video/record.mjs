// Records the live app (and the motion-graphics scenes) for the NWIS video — voice-synced.
//   node record.mjs [take ...]        (default: every take)   — needs the API (:8000) and UI (:3000) running
// Each take is captured natively at 1920×1080 with Chrome's screencast (JPEG q92, ~30 fps) into
// $NWIS_VIDEO_BUILD/takes/<name>/frames + frames.json; markers.json records when every voice line starts.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Outside OneDrive: frames are gigabytes.
const BUILD = process.env.NWIS_VIDEO_BUILD ?? path.join(os.tmpdir(), "nwis-video");
const DUR = JSON.parse(fs.readFileSync(path.join(BUILD, "vo", "durations.json"), "utf8"));
const API = "http://127.0.0.1:8000";
const BASE = "http://localhost:3000";
const GAP = 0.32; // pause after each voice line (s)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GL = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"];

async function openTake(name, { intro = false, theme = "light" } = {}) {
  const dir = path.join(BUILD, "takes", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const browser = await chromium.launch({ args: GL });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await context.addInitScript({ path: path.join(HERE, "overlay.js") });
  await context.addInitScript(
    ([t, i]) => {
      try {
        localStorage.setItem("nwis-theme", t);
        if (!i) sessionStorage.setItem("nwis-intro", "1");
      } catch {}
    },
    [theme, intro],
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  const frames = [];
  const writes = [];
  let n = 0;
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const f = `f${String(n++).padStart(6, "0")}.jpg`;
    frames.push({ f, t: metadata.timestamp });
    writes.push(fs.promises.writeFile(path.join(dir, "frames", f), Buffer.from(data, "base64")));
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const markers = { vo: {}, marks: {} };
  const now = () => Date.now() / 1000;
  const T = {
    page,
    async rec() {
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 2 });
      await sleep(250);
      markers.marks.in = now();
    },
    mark(k) {
      markers.marks[k] = now();
    },
    /** Speak line `id` (its duration elapses) while `fn` runs; resolves when both are done. */
    async say(id, fn) {
      if (!(id in DUR)) throw new Error(`no voice line ${id}`);
      markers.vo[id] = now();
      await Promise.all([fn ? fn() : null, sleep(DUR[id] * 1000)]);
      await sleep(GAP * 1000);
    },
    async hold(ms) {
      await sleep(ms);
    },
    async stop() {
      markers.marks.out = now();
      await sleep(300);
      await cdp.send("Page.stopScreencast").catch(() => {});
      await Promise.all(writes);
      fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify(frames));
      fs.writeFileSync(path.join(dir, "markers.json"), JSON.stringify(markers, null, 1));
      await browser.close();
      console.log(`${name}: ${frames.length} frames, ${(markers.marks.out - markers.marks.in).toFixed(1)} s`, errors.length ? `ERRORS ${errors.slice(0, 3).join(" | ")}` : "");
    },
    // --- presenter helpers -------------------------------------------------------------------------------------
    async point(target, ms = 750) {
      const [x, y] = await xy(page, target);
      await page.evaluate(([a, b, m]) => window.__v.move(a, b, m), [x, y, ms]);
      return [x, y];
    },
    async tap(target, { ms = 750, pre = 140 } = {}) {
      const [x, y] = await T.point(target, ms);
      await sleep(pre);
      await page.evaluate(() => window.__v.press());
      await page.mouse.click(x, y);
    },
    park(x, y) {
      return page.evaluate(([a, b]) => window.__v.park(a, b), [x, y]);
    },
    zoom(scale, target = null, ms = 1400) {
      return (async () => {
        const [x, y] = target ? await xy(page, target) : [960, 540];
        await page.evaluate(([s, a, b, m]) => window.__v.zoom(s, a, b, m), [scale, x, y, ms]);
      })();
    },
    async wheel(target, dy, steps = 12, stepMs = 45) {
      const [x, y] = await T.point(target, 500);
      await page.mouse.move(x, y);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await sleep(stepMs);
      }
    },
  };
  return T;
}

/** Centre of a locator / selector / [x, y]. */
async function xy(page, target) {
  if (Array.isArray(target)) return target;
  const loc = typeof target === "string" ? page.locator(target).first() : target;
  await loc.waitFor({ state: "visible", timeout: 20000 });
  const b = await loc.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}

const reset = () => fetch(`${API}/api/simulation/reset`, { method: "POST" });

// =====================================================================================================================
const TAKES = {
  // 02 — game-changer: the welcome globe, then the dive into the field (globe fly-in on the map).
  async welcome() {
    await reset();
    const T = await openTake("welcome", { intro: true });
    await T.page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await T.page.waitForTimeout(3500);
    await T.park(1400, 900);
    await T.rec();
    await T.hold(600);
    await T.say("G1");
    await T.say("G2", async () => {
      await T.tap("text=Enter as drilling engineer", { ms: 900 });
      await T.page.evaluate(() => window.__v.hide());
    });
    await T.say("G3", () => T.zoom(1.05, [900, 560], 6500));
    await T.hold(400);
    await T.stop();
  },

  // 03 — innovation: the subsurface block, bit stepping down into the Barail loss window, evidence links.
  async innovation() {
    await reset();
    const T = await openTake("innovation");
    await T.page.goto(BASE + "/dashboard/subsurface", { waitUntil: "domcontentloaded" });
    await T.page.waitForTimeout(2500);
    await T.park(1650, 820);
    await T.rec();
    await T.hold(3400); // strata extrude, wells drill in, events pop
    await T.say("I2", async () => {
      for (let i = 0; i < 5; i++) await T.tap('button[aria-label="Down 10 m"]', { ms: i ? 250 : 800, pre: 60 }).then(() => T.hold(650));
    });
    await T.hold(700);
    await T.stop();
  },

  // 04 — the walkthrough: command center → run → mud-loss alert → subsurface → stuck-pipe alert → Why?
  async command() {
    await reset();
    const T = await openTake("command");
    const p = T.page;
    await p.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(9000);
    await T.park(1060, 640);
    await T.rec();
    await T.hold(500);
    // the "Live prototype" lower-third (with the demo-field disclosure) is composited by edit.py
    await T.say("W1", () => T.zoom(1.06, ".maplibregl-canvas", 6500));
    await T.say("W2", async () => {
      await T.zoom(1, null, 900);
      await T.point(p.locator("text=Bit depth · MD").first(), 650);
      await T.hold(700);
      await T.point(p.locator("text=Torque").first(), 650);
      await T.hold(600);
      await T.point(".maplibregl-canvas", 650);
      await T.hold(500);
      await T.point(p.locator("text=Risk radar").first(), 650);
    });
    await T.say("W3", () => T.tap("text=Run historical risk scenario", { ms: 700 }));
    // Not just [role=alert]: Next.js's hidden route announcer has that role too.
    const mudToast = p.locator('[role="alert"]').filter({ hasText: "Mud loss risk" }).first();
    await mudToast.waitFor({ timeout: 20000 });
    T.mark("mudAlert");
    await T.hold(250);
    await T.say("W4", async () => {
      await T.zoom(1.3, mudToast, 1100);
      await T.hold(2600);
      await T.zoom(1, null, 1000);
    });
    await T.say("W5", async () => {
      await T.tap("text=Pause scenario", { ms: 700 });
      await T.point(p.locator("text=ECD").first(), 700);
    });
    let resumeAt = 0;
    await T.say("W6", async () => {
      await T.tap('[role="tab"]:has-text("Subsurface")', { ms: 750 });
      resumeAt = Date.now();
      await T.hold(Math.max(600, (DUR.W6 - 5.4) * 1000 - 700));
      await T.tap("button:has-text('Resume')", { ms: 650 });
      await T.page.evaluate(() => window.__v.move(1860, 1030, 700));
    });
    await p.locator('[role="alert"]').filter({ hasText: "Stuck pipe risk" }).first().waitFor({ timeout: 30000 });
    T.mark("stuckAlert");
    await T.say("W7", async () => {
      await T.hold(Math.max(0, DUR.W7 * 1000 - 1600));
      await T.tap("text=Pause scenario", { ms: 650 });
    });
    await T.say("W8", async () => {
      const why = p.locator('[role="alert"]').filter({ hasText: /Stuck pipe/i }).locator("text=Why? See the evidence");
      await T.tap(why, { ms: 800 });
      await T.hold(900);
      await T.wheel('[role="dialog"] .overflow-y-auto', 900, 18, 70);
      await T.hold(500);
      await T.wheel('[role="dialog"] .overflow-y-auto', 900, 18, 70);
    });
    await T.hold(900);
    void resumeAt;
    await T.stop();
  },

  // Well intelligence and Compare are chart-heavy: filmed in the night-shift theme, where the traces read best.
  async wellintel() {
    const T = await openTake("wellintel", { theme: "dark" });
    const p = T.page;
    await p.goto(BASE + "/dashboard/well/W002", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(7000);
    await T.park(700, 300);
    await T.rec();
    await T.hold(300);
    await T.say("W9", async () => {
      const push = T.zoom(1.08, [860, 640], Math.max(3000, DUR.W9 * 1000 - 600));
      await T.point(p.locator("text=Drilling parameters vs depth").first(), 650);
      await T.hold(450);
      await T.point([1090, 700], 700); // the ECD trace through the loss band
      await T.hold(Math.max(300, DUR.W9 * 1000 - 4300));
      await T.tap('[role="tab"]:has-text("Lessons")', { ms: 700 });
      T.mark("done");
      await push;
    });
    await T.hold(700);
    await T.stop();
  },

  async compare() {
    const T = await openTake("compare", { theme: "dark" });
    const p = T.page;
    await p.goto(BASE + "/dashboard/compare", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(7000);
    await T.park(1300, 300);
    await T.rec();
    await T.hold(300);
    await T.say("W10", async () => {
      const push = T.zoom(1.06, [760, 500], Math.max(3000, DUR.W10 * 1000 - 500));
      await T.point([600, 520], 700); // across the correlated formation tops
      await T.hold(500);
      await T.point([960, 470], 800);
      await T.hold(Math.max(200, DUR.W10 * 1000 - 4600));
      await T.tap('[role="tab"]:has-text("ECD")', { ms: 700 });
      await T.point([1500, 640], 700);
      T.mark("done");
      await push;
    });
    await T.hold(700);
    await T.stop();
  },

  async ask() {
    const T = await openTake("ask");
    const p = T.page;
    await p.goto(BASE + "/dashboard/search", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(6000);
    await T.park(1100, 380);
    await T.rec();
    await T.hold(300);
    await T.say("W11", async () => {
      await T.tap('input[aria-label="Evidence query"]', { ms: 600 });
      await p.locator('input[aria-label="Evidence query"]').pressSequentially("What mitigations were used for stuck pipe in the Kopili Shale?", { delay: 18 });
      await p.keyboard.press("Enter");
      await p.locator('button[aria-label="Evidence 1"]').first().waitFor({ timeout: 15000 });
      await T.hold(1000);
      await T.tap('button[aria-label="Evidence 2"]', { ms: 600 });
      await T.hold(550);
      await T.tap(p.locator("text=Open source page").nth(1), { ms: 650 });
      T.mark("done"); // the actions can outlast the line: edit.py cuts after whichever ends later
    });
    await T.hold(2200);
    await T.stop();
  },

  async brief() {
    const T = await openTake("brief");
    const p = T.page;
    await p.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(8000);
    await T.park(1200, 480);
    await T.rec();
    await T.hold(300);
    await T.say("W12", async () => {
      await T.tap("button[aria-label='Open the command palette']", { ms: 650 });
      await T.hold(300);
      await p.locator("input[placeholder^='Jump']").pressSequentially("brief", { delay: 70 });
      await T.hold(450);
      await p.keyboard.press("Enter");
      await T.page.evaluate(() => window.__v.move(1560, 840, 600));
    });
    await T.say("W13", async () => {
      await T.zoom(1.28, p.locator("text=Expected NPT").first(), 1100);
      await T.hold(2400);
      await T.zoom(1, null, 900);
      await T.wheel("main .overflow-y-auto", 760, 16, 55);
      T.mark("done");
    });
    await T.hold(1200);
    await T.stop();
  },

  async docs() {
    const T = await openTake("docs");
    const p = T.page;
    await p.goto(BASE + "/dashboard/documents", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(6000);
    await T.park(960, 720);
    await T.rec();
    await T.hold(300);
    await T.say("W14", async () => {
      await T.tap("button:has-text('Process scanned report')", { ms: 800 });
    });
    await p.locator("[role=tab]:has-text('Text')").first().waitFor({ timeout: 30000 });
    await T.hold(1200);
    await T.tap("[role=tab]:has-text('Text')", { ms: 650 });
    await T.hold(2200);
    await T.stop();
    await reset(); // uploads live on the shared backend
  },

  async realdata() {
    const T = await openTake("realdata");
    const p = T.page;
    await p.goto(BASE + "/dashboard/opendata", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    await T.park(1560, 840);
    await T.rec();
    await T.say("W15", async () => {
      await T.hold(1800);
      await T.point(p.locator("text=Problems found").first(), 800);
    });
    await T.say("W16", async () => {
      await T.tap("text=Run the scan again", { ms: 700 });
      await T.hold(2600);
      // Wheel over the side panel — over the map it would zoom the map instead of scrolling the page.
      await T.wheel(p.locator("text=Offset analysis on real wells").first(), 700, 14, 55);
    });
    await T.hold(400);
    await T.tap(p.locator('svg rect[transform^="rotate(45"]').nth(3), { ms: 700 });
    await T.hold(2000);
    await T.stop();
  },
};

const want = process.argv.slice(2);
for (const [name, fn] of Object.entries(TAKES)) {
  if (want.length && !want.includes(name)) continue;
  await fn();
}
await reset();
void pathToFileURL;
