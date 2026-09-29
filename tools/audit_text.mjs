// Legibility audit: visits each screen and reports text that is small (< MIN_PX) or low-contrast (< 4.5:1,
// WCAG AA body text) against its effective background. Usage: [THEME=dark] node audit_text.mjs [--detail]
import { chromium } from "playwright";

const MIN_PX = Number(process.env.MIN_PX || 12);
const ROUTES = ["/", "/dashboard", "/dashboard/nearby", "/dashboard/well/W002", "/dashboard/compare", "/dashboard/search?q=What%20caused%20mud%20loss%20in%20the%20Barail%20Group%20near%203150m%3F", "/dashboard/risk", "/dashboard/documents"];
const theme = process.env.THEME || "light";
const detail = process.argv.includes("--detail");

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1600), height: Number(process.env.H || 900) } });
await page.addInitScript((t) => {
  try {
    localStorage.setItem("nwis-theme", t);
    sessionStorage.setItem("nwis-intro", "1");
  } catch {}
}, theme);

const totals = { small: 0, faint: 0, checked: 0 };
for (const route of ROUTES) {
  await page.goto("http://localhost:3000" + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(route.includes("search") ? 9000 : 6500);
  const res = await page.evaluate((MIN) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      }
      // Tailwind v4 opacity modifiers compute to oklab(L a b / alpha)
      const o = c.match(/oklab\(([^)]+)\)/);
      if (o) {
        const [L, A, B, al] = o[1].split(/[ /]+/).filter(Boolean).map(Number);
        const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
        const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
        const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
        const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s];
        const g = (v) => 255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
        return { r: g(lin[0]), g: g(lin[1]), b: g(lin[2]), a: Number.isFinite(al) ? al : 1 };
      }
      return null;
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    const bgOf = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== "none" && !cs.backgroundImage.startsWith("linear-gradient(rgba(0, 0, 0, 0)")) {
          // gradients/images (status cards, map): approximate with the first colour stop
          const m = cs.backgroundImage.match(/rgba?\([^)]+\)/);
          if (n === document.body || n === document.documentElement) {
            // page wash: faint radial tints over the canvas colour — ignore the tint
          } else if (m && parse(m[0]).a >= 0.5) {
            layers.push({ ...parse(m[0]), a: 1 });
            break;
          } else if (!m) return null; // image (map, photo) — skip
        }
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a >= 1) break;
        }
      }
      let out = { r: 255, g: 255, b: 255, a: 1 };
      if (document.documentElement.dataset.theme === "dark") out = { r: 9, g: 9, b: 14, a: 1 };
      for (const l of layers.reverse()) out = blend(l, out);
      return out;
    };
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode;
      if (!t.textContent.trim()) continue;
      const el = t.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      if (el.closest(".maplibregl-canvas-container, .maplibregl-ctrl-attrib, svg")) continue;
      const fg = parse(cs.color);
      const bg = bgOf(el);
      const size = parseFloat(cs.fontSize);
      let ratio = null;
      if (fg && bg) {
        const f = blend(fg, bg);
        const [a, b] = [lum(f), lum(bg)].sort((x, y) => y - x);
        ratio = (a + 0.05) / (b + 0.05);
      }
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 18.66 || (bold && size >= 14);
      items.push({
        text: t.textContent.trim().slice(0, 40), size, ratio: ratio && Math.round(ratio * 100) / 100,
        small: size < MIN, faint: ratio !== null && ratio < (large ? 3 : 4.5), cls: (el.getAttribute("class") || "").slice(0, 90),
      });
    }
    return items;
  }, MIN_PX);
  const small = res.filter((x) => x.small);
  const faint = res.filter((x) => x.faint);
  totals.small += small.length;
  totals.faint += faint.length;
  totals.checked += res.length;
  console.log(`\n${route}  — ${res.length} text nodes · ${small.length} small · ${faint.length} faint`);
  if (detail) {
    for (const x of faint.slice(0, 25)) console.log(`   FAINT ${x.ratio}:1 ${x.size}px "${x.text}"  [${x.cls}]`);
    const bySize = {};
    for (const x of small) bySize[x.size] = (bySize[x.size] || 0) + 1;
    console.log("   small by px:", JSON.stringify(bySize));
  }
}
console.log(`\nTOTAL (${theme}): ${totals.checked} text nodes · ${totals.small} under ${MIN_PX}px · ${totals.faint} below contrast minimum`);
await browser.close();
