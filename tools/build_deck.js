// NWIS pitch deck — pptxgenjs, 16:9 wide (13.333" x 7.5").
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const path = require("path");
const lu = require("react-icons/lu");

const ROOT = path.resolve(__dirname, "..");
const SHOT = (n) => path.join(ROOT, "docs/screenshots", n);
const OUT = path.join(ROOT, "docs/NWIS_Pitch_Deck.pptx");

// Mirrors the app's night-shift tokens (frontend/app/globals.css); `cyan` is the brand accent slot (indigo).
const C = {
  bg: "09090E", surface: "121219", elevated: "1F1F29", border: "32323E", line: "25252F",
  text: "F5F5F8", muted: "C4C6D2", dim: "8C8FA1", cyan: "A79DFF", cyanDeep: "5B4BFF",
  amber: "F2A60C", orange: "F76B15", red: "E5383B", green: "12A679", violet: "D946EF", sky: "0EA5E9",
};
const FONT = "Calibri";
const MONO = "Consolas";

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const WHY_CROP = path.join(__dirname, ".why-crop.png");

(async () => {
  // Learned-model headline numbers straight from the running API (fallback: last recorded run).
  let ML = { wells: 12, auc_model: "0.86", auc_rule: "0.76" };
  try {
    const m = await (await fetch("http://127.0.0.1:8000/api/risk/model")).json();
    if (m.learned?.status === "ready") ML = { wells: m.learned.wells, auc_model: m.learned.auc_model.toFixed(2), auc_rule: m.learned.auc_rule.toFixed(2) };
  } catch {
    /* backend not running — keep the fallback */
  }
  // The Why? screenshot is cropped to the dialog so it reads at slide size.
  await sharp(SHOT("04-why-explainer.png")).extract({ left: 240, top: 45, width: 1120, height: 810 }).toFile(WHY_CROP);
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "NWIS team — SIH26121";
  pres.title = "NWIS — Nearby Wells Intelligence System";

  const W = 13.333, H = 7.5;
  const ic = {};
  for (const [k, comp, col] of [
    ["file", lu.LuFileText, C.cyan], ["users", lu.LuUsers, C.amber], ["clock", lu.LuClock, C.red],
    ["map", lu.LuMapPinned, C.cyan], ["shield", lu.LuShieldAlert, C.red], ["search", lu.LuFileSearch, C.cyan],
    ["scan", lu.LuScanText, C.cyan], ["db", lu.LuDatabase, C.cyan], ["radio", lu.LuRadio, C.green],
    ["git", lu.LuGitCompare, C.cyan], ["check", lu.LuCircleCheck, C.green], ["brain", lu.LuBrainCircuit, C.violet],
    ["gauge", lu.LuGauge, C.amber], ["book", lu.LuBookOpenCheck, C.green], ["link", lu.LuLink, C.bg],
    ["target", lu.LuCrosshair, C.cyan], ["layers", lu.LuLayers, C.sky], ["user", lu.LuUserCheck, C.cyan],
  ]) ic[k] = await icon(comp, col);

  // ---------- helpers (fresh option objects every call) ----------
  const bg = (s) => { s.background = { color: C.bg }; };
  const text = (s, t, o) => s.addText(t, { isTextBox: true, fontFace: FONT, color: C.text, margin: 0, valign: "top", ...o });
  const card = (s, x, y, w, h, fill = C.surface) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.03, fill: { color: fill }, line: { color: C.border, width: 1 } });
  const badge = (s, key, x, y, d = 0.62, ring = C.border) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.elevated }, line: { color: ring, width: 1.25 } });
    s.addImage({ data: ic[key], x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56 });
  };
  const header = (s, kicker, title) => {
    text(s, kicker.toUpperCase(), { x: 0.6, y: 0.42, w: 9, h: 0.3, fontSize: 12, bold: true, color: C.cyan, charSpacing: 3 });
    text(s, title, { x: 0.6, y: 0.72, w: 12.1, h: 0.8, fontSize: 32, bold: true, color: C.text });
  };
  const footer = (s, n) => {
    text(s, "NWIS · SIH26121", { x: 0.6, y: H - 0.42, w: 6, h: 0.25, fontSize: 9, color: C.dim });
    text(s, String(n), { x: W - 1.1, y: H - 0.42, w: 0.5, h: 0.25, fontSize: 9, color: C.dim, align: "right" });
  };
  const shot = (s, file, x, y, w, frame = true) => {
    const h = w * 900 / 1600;
    if (frame) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.03, fill: { color: C.surface }, line: { color: C.border, width: 1 } });
    s.addImage({ path: SHOT(file), x, y, w, h });
    return h;
  };

  // =====================================================================================
  // 1 — Title
  {
    const s = pres.addSlide(); bg(s);
    s.addImage({ path: SHOT("03-scenario-complete.png"), x: 5.9, y: 0, w: 13.333 - 5.9 + 3.2, h: (13.333 - 5.9 + 3.2) * 900 / 1600, transparency: 55 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 6.6, h: H, fill: { color: C.bg } });
    s.addImage({ path: path.join(ROOT, "docs/nwis-logo.png"), x: 0.8, y: 1.3, w: 1.0, h: 1.0 });
    text(s, "NWIS", { x: 0.8, y: 2.45, w: 5.6, h: 1.2, fontSize: 72, bold: true, color: C.text, charSpacing: 8 });
    text(s, "Nearby Wells Intelligence System", { x: 0.8, y: 3.65, w: 5.6, h: 0.55, fontSize: 26, bold: true });
    text(s, "Institutional memory beside the active well — what nearby wells experienced at this depth, why, and what to check next.",
      { x: 0.8, y: 4.35, w: 5.4, h: 1.0, fontSize: 15, color: C.muted });
    text(s, "SIH 2026  ·  Problem statement SIH26121  ·  Oil India Limited", { x: 0.8, y: 6.2, w: 5.6, h: 0.3, fontSize: 12, color: C.dim });
    text(s, "Working prototype · realistic synthetic data on real Upper Assam stratigraphy (not OIL records)", { x: 0.8, y: 6.5, w: 5.6, h: 0.3, fontSize: 10, color: C.amber });
    s.addNotes("Open with the operational problem, not technology. NWIS gives every drilling engineer institutional memory — connecting the active well's current depth to what nearby and historical wells experienced, why it happened, and what to check next.");
  }

  // =====================================================================================
  // 2 — Problem
  {
    const s = pres.addSlide(); bg(s); header(s, "The problem", "Drilling knowledge is scattered — so risks repeat");
    const items = [
      ["file", "Buried in reports", "Daily drilling reports, completion reports and mud logs sit as PDFs — searched by hand, if at all."],
      ["users", "Held by people", "The engineer who cured the losses on the last well may be on another rig — or retired."],
      ["clock", "Needed right now", "Decisions happen at the bit, in minutes. Manual offset review happens before spud, once."],
    ];
    items.forEach(([k, t, d], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.95, 3.8, 2.75);
      badge(s, k, x + 0.3, 2.25);
      text(s, t, { x: x + 0.3, y: 3.05, w: 3.2, h: 0.45, fontSize: 20, bold: true });
      text(s, d, { x: x + 0.3, y: 3.55, w: 3.25, h: 1.05, fontSize: 14, color: C.muted });
    });
    card(s, 0.6, 5.0, 12.1, 1.55, C.elevated);
    text(s, "110 h", { x: 0.95, y: 5.18, w: 2.4, h: 1.0, fontSize: 54, bold: true, color: C.amber, fontFace: MONO });
    text(s, "of NPT in 8 offset events inside the three windows our active well is about to drill — Barail losses, Kopili stuck pipe, Sylhet kick.",
      { x: 3.45, y: 5.28, w: 8.9, h: 0.75, fontSize: 17 });
    text(s, "Demo field — the pattern NWIS is built to break.", { x: 3.45, y: 6.05, w: 8.9, h: 0.3, fontSize: 11, color: C.dim });
    footer(s, 2);
    s.addNotes("Critical knowledge is distributed across completion reports, daily reports, databases and individual experience. In our synthetic demo field, the next 500 m of the active well cross three windows where offsets lost 110 hours of NPT.");
  }

  // =====================================================================================
  // 3 — Insight
  {
    const s = pres.addSlide(); bg(s); header(s, "The insight", "Engineers don't lack data — they lack the link");
    card(s, 0.6, 1.95, 5.5, 3.35);
    badge(s, "radio", 0.95, 2.3, 0.75, C.green);
    text(s, "This depth, right now", { x: 0.95, y: 3.25, w: 4.9, h: 0.5, fontSize: 22, bold: true });
    text(s, "eRTMAC: 3,150 m · Barail Group · ECD 1.48 sg and climbing · torque steady", { x: 0.95, y: 3.8, w: 4.8, h: 0.9, fontSize: 15, color: C.muted });
    card(s, 7.2, 1.95, 5.5, 3.35);
    badge(s, "book", 7.55, 2.3, 0.75, C.green);
    text(s, "What happened here before", { x: 7.55, y: 3.25, w: 4.9, h: 0.5, fontSize: 22, bold: true });
    text(s, "OIL-AX-99 lost 45 m³ at 3,150 m when ECD hit 1.52 sg; cured with LCM + MW 1.38 sg (DDR Day 42, p.3).", { x: 7.55, y: 3.8, w: 4.8, h: 1.1, fontSize: 15, color: C.muted });
    s.addShape(pres.shapes.OVAL, { x: 6.2, y: 3.18, w: 0.9, h: 0.9, fill: { color: C.cyan }, line: { color: C.cyan, width: 1 } });
    s.addImage({ data: ic.link, x: 6.42, y: 3.4, w: 0.46, h: 0.46 });
    text(s, "NWIS is that link — depth-aware, evidence-backed, explainable.", { x: 0.6, y: 5.75, w: 12.1, h: 0.5, fontSize: 20, bold: true, color: C.cyan, align: "center" });
    footer(s, 3);
    s.addNotes("This is the idea everything is built on: join the live depth to the history at that depth.");
  }

  // =====================================================================================
  // 4 — Solution workflow
  {
    const s = pres.addSlide(); bg(s); header(s, "The solution", "One workflow from the bit to the decision");
    const steps = ["Active well", "Current depth", "Nearby wells", "Historical events", "Depth / formation correlation", "Evidence", "Risk signal", "Proactive alert", "Recommended checks"];
    steps.forEach((t, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 0.6 + col * 2.46 + (row ? 1.23 : 0), y = 2.05 + row * 1.35;
      card(s, x, y, 2.2, 1.0, i >= 6 ? C.elevated : C.surface);
      text(s, String(i + 1).padStart(2, "0"), { x: x + 0.18, y: y + 0.14, w: 0.6, h: 0.3, fontSize: 12, bold: true, color: i >= 6 ? C.amber : C.cyan, fontFace: MONO });
      text(s, t, { x: x + 0.18, y: y + 0.42, w: 1.9, h: 0.5, fontSize: 14, bold: true });
    });
    const feats = [
      ["map", "GIS map", "Offsets in a user radius, well paths, bit position"],
      ["git", "Correlation", "Formation tops & parameters on one depth axis"],
      ["search", "Evidence search", "Cited answers from reports & events"],
      ["shield", "Explainable alerts", "Why? — factors, wells, pages, checks"],
    ];
    feats.forEach(([k, t, d], i) => {
      const x = 0.6 + i * 3.08;
      badge(s, k, x, 5.05, 0.55);
      text(s, t, { x: x + 0.7, y: 5.05, w: 2.3, h: 0.3, fontSize: 15, bold: true });
      text(s, d, { x: x + 0.7, y: 5.38, w: 2.3, h: 0.7, fontSize: 12, color: C.muted });
    });
    text(s, "A standalone intelligence layer beside eRTMAC — it informs the engineer; it does not control the rig.", { x: 0.6, y: 6.35, w: 12.1, h: 0.35, fontSize: 13, color: C.dim });
    footer(s, 4);
    s.addNotes("Active well → current depth → nearby wells → historical events → correlation → evidence → risk signal → proactive alert → recommended checks → engineer decision.");
  }

  // =====================================================================================
  // 5 — Live demo
  {
    const s = pres.addSlide(); bg(s); header(s, "Live demo", "Drill 3,100 → 3,600 m and watch history speak up");
    shot(s, "02-mud-loss-alert.png", 0.66, 1.75, 8.1);
    const alerts = [
      ["3,150 m", "Mud loss — HIGH → critical", "OIL-AX-99 & 55 lost returns here; ECD rising above programme", C.orange],
      ["3,380 m", "Stuck pipe — HIGH → critical", "OIL-AX-88, 66, 11 stuck in the Kopili; torque 1.3× baseline", C.orange],
      ["3,580 m", "Kick / overpressure — CRITICAL", "OIL-AX-33 kicked at the Sylhet top; MW 1.44 < 1.52 sg", C.red],
    ];
    alerts.forEach(([d, t, why, col], i) => {
      const y = 1.72 + i * 1.5;
      card(s, 9.1, y, 3.6, 1.32);
      text(s, d, { x: 9.35, y: y + 0.14, w: 1.6, h: 0.35, fontSize: 18, bold: true, color: col, fontFace: MONO });
      text(s, t, { x: 9.35, y: y + 0.5, w: 3.2, h: 0.3, fontSize: 13, bold: true });
      text(s, why, { x: 9.35, y: y + 0.8, w: 3.2, h: 0.45, fontSize: 10.5, color: C.muted });
    });
    text(s, "Torque window at 3,500 m stays a watch card: medium history and no live confirmation → no alarm fatigue.", { x: 0.66, y: 6.55, w: 11.9, h: 0.3, fontSize: 12, color: C.dim });
    footer(s, 5);
    s.addNotes("Click Run historical risk scenario. At 3,150 m the mud-loss alert fires and OIL-AX-99 and OIL-AX-55 glow on the map; at 3,380 m stuck pipe; at 3,580 m a critical kick warning. Then click Why?.");
  }

  // =====================================================================================
  // 6 — Explainable risk
  {
    const s = pres.addSlide(); bg(s); header(s, "Explainable risk", "Every alert shows its working");
    card(s, 0.6, 1.8, 5.2, 4.85);
    text(s, "Risk score = Σ weight × factor", { x: 0.9, y: 2.0, w: 4.7, h: 0.4, fontSize: 17, bold: true });
    s.addChart(pres.charts.BAR, [{ name: "Weight", labels: ["Depth proximity", "Live parameter anomaly", "Offset event frequency", "Well similarity", "Formation match", "Trajectory match"], values: [0.30, 0.25, 0.20, 0.10, 0.10, 0.05] }], {
      x: 0.8, y: 2.45, w: 4.85, h: 2.75, barDir: "bar", chartColors: [C.sky], showValue: true, dataLabelPosition: "outEnd",
      dataLabelColor: C.text, dataLabelFontSize: 10, dataLabelFormatCode: "0.00", catAxisLabelColor: C.muted, catAxisLabelFontSize: 10,
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, catAxisOrientation: "maxMin",
      barGapWidthPct: 60, valAxisMaxVal: 0.36, catAxisLineShow: false,
    });
    text(s, [
      { text: "Thresholds 0.35 · 0.55 · 0.75 (medium · high · critical)", options: { bullet: true, breakLine: true } },
      { text: "Medium-history zones need live confirmation to alert", options: { bullet: true, breakLine: true } },
      { text: "Confidence from supporting wells, sources and similarity", options: { bullet: true, breakLine: true } },
      { text: `Learned cross-check: logistic model backtested on ${ML.wells} offset wells — AUC ${ML.auc_model} vs ${ML.auc_rule} hand-set`, options: { bullet: true } },
    ], { x: 0.9, y: 5.25, w: 4.75, h: 1.35, fontSize: 11.5, color: C.muted, paraSpaceAfter: 3 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.94, y: 1.74, w: 5.72, h: 4.44, rectRadius: 0.03, fill: { color: C.surface }, line: { color: C.border, width: 1 } });
    s.addImage({ path: WHY_CROP, x: 7.0, y: 1.8, w: 5.6, h: 5.6 * 810 / 1120 });
    text(s, "WHAT · WHERE · WHEN · WHY · WHICH wells · WHAT evidence · WHAT to check · HOW confident", { x: 6.94, y: 6.3, w: 5.8, h: 0.5, fontSize: 11.5, bold: true, color: C.cyan });
    footer(s, 6);
    s.addNotes("Never a mysterious 'AI says high risk'. The Why? view lists numbered reasons, the weighted factor breakdown, live signals versus baseline, the supporting offset wells with quotes and page citations, recommended checks, and the audit trail. Scores rank risk; they are not calibrated probabilities. A logistic model on the same six factors, backtested leave-one-well-out on the offset wells, cross-checks every score (the ML chip) — and learned that live parameter anomalies matter more than our hand-set weights assumed.");
  }

  // =====================================================================================
  // 7 — Evidence-first AI
  {
    const s = pres.addSlide(); bg(s); header(s, "Evidence-first AI", "No answer without a source page");
    shot(s, "08-evidence-search.png", 0.66, 1.8, 7.4);
    const pts = [
      ["search", "Hybrid retrieval", "Keyword 0.40 + semantic 0.35 + metadata 0.25 (depth, formation, risk family, well)"],
      ["brain", "Understands drilling queries", "“near 3400 m”, “this formation”, “lost returns” ≈ mud loss, “current risk”"],
      ["check", "Cited, or it says so", "Every sentence carries [n] citations; below threshold → “Insufficient evidence”"],
    ];
    pts.forEach(([k, t, d], i) => {
      const y = 1.85 + i * 1.45;
      badge(s, k, 8.45, y, 0.6);
      text(s, t, { x: 9.2, y, w: 3.5, h: 0.35, fontSize: 16, bold: true });
      text(s, d, { x: 9.2, y: y + 0.38, w: 3.5, h: 0.9, fontSize: 12, color: C.muted });
    });
    text(s, "Offline and deterministic for the demo; an optional Claude adapter writes the answer over the same cited evidence and is discarded if it cites nothing.", { x: 0.66, y: 6.2, w: 12, h: 0.5, fontSize: 12, color: C.dim });
    footer(s, 7);
    s.addNotes("Ask: What mitigations were used for stuck pipe in Kopili Shale? The answer names OIL-AX-88, 66 and 11 with what worked, each sentence cited to a report page. Click a citation to open the page.");
  }

  // =====================================================================================
  // 8 — Document intelligence
  {
    const s = pres.addSlide(); bg(s); header(s, "Document intelligence", "Reports become structured, reviewed knowledge");
    const stages = ["Upload", "Text / OCR", "Chunk & tag", "Extract events", "Dedupe & provenance", "Human review", "Knowledge base"];
    stages.forEach((t, i) => {
      const x = 0.6 + i * 1.75;
      s.addShape(pres.shapes.OVAL, { x: x + 0.55, y: 1.85, w: 0.5, h: 0.5, fill: { color: i === 5 ? C.amber : C.elevated }, line: { color: i === 5 ? C.amber : C.cyan, width: 1.25 } });
      text(s, String(i + 1), { x: x + 0.55, y: 1.85, w: 0.5, h: 0.5, fontSize: 13, bold: true, align: "center", valign: "middle", color: i === 5 ? C.bg : C.cyan });
      text(s, t, { x, y: 2.45, w: 1.6, h: 0.5, fontSize: 12, bold: true, align: "center" });
      if (i < stages.length - 1) s.addShape(pres.shapes.LINE, { x: x + 1.12, y: 2.1, w: 1.2, h: 0, line: { color: C.border, width: 1.5 } });
    });
    shot(s, "11-document-review.png", 0.66, 3.2, 6.1);
    text(s, [
      { text: "Text-layer PDFs, plus scanned PDFs and images read by Tesseract OCR (per-page word confidence)", options: { bullet: true, breakLine: true } },
      { text: "Rule-based NLP finds losses, sticking, kicks, torque, cementing, NPT with depth, formation, cause, mitigation", options: { bullet: true, breakLine: true } },
      { text: "Confidence scoring; < 75% flagged for human review", options: { bullet: true, breakLine: true } },
      { text: "Duplicate check against the knowledge base — the sample report's torque rise matches an existing record", options: { bullet: true, breakLine: true } },
      { text: "Nothing is saved until an engineer approves it — then it is searchable and used by the risk engine", options: { bullet: true } },
    ], { x: 7.2, y: 3.25, w: 5.45, h: 3.2, fontSize: 13.5, paraSpaceAfter: 6 });
    footer(s, 8);
    s.addNotes("Process the sample daily drilling report for OIL-AX-22: three candidate events, one flagged as a possible duplicate, entities extracted, provenance kept. Save, then search for it. Then process the scanned OIL-AX-44 report: no text layer at all — Tesseract reads it at ~93% word confidence and the same extraction finds the differential sticking at 2,655 m.");
  }

  // =====================================================================================
  // 9 — Architecture & integration
  {
    const s = pres.addSlide(); bg(s); header(s, "Architecture & integration", "Built to plug into OIL's systems");
    const cols = [
      ["Sources", ["DDR · WCR · mud logs", "eRTMAC parameter stream", "Surveys · formation tops", "Casing & mud programmes"], C.surface],
      ["NWIS services (FastAPI)", ["Document pipeline", "Knowledge base (SQL)", "Hybrid evidence search", "Explainable risk engine", "Well similarity"], C.elevated],
      ["Cockpit (Next.js)", ["Command Center", "Well Intelligence & Compare", "Evidence Search", "Risk Explorer", "Document Intelligence"], C.surface],
    ];
    cols.forEach(([t, rows, fill], i) => {
      const x = 0.6 + i * 3.1;
      card(s, x, 1.85, 2.75, 3.6, fill);
      text(s, t, { x: x + 0.25, y: 2.05, w: 2.3, h: 0.4, fontSize: 15, bold: true, color: C.cyan });
      text(s, rows.map((r, j) => ({ text: r, options: { bullet: true, breakLine: j < rows.length - 1 } })), { x: x + 0.25, y: 2.6, w: 2.35, h: 3.2, fontSize: 12.5, paraSpaceAfter: 8 });
      if (i < 2) text(s, "→", { x: x + 2.76, y: 3.3, w: 0.34, h: 0.5, fontSize: 24, bold: true, color: C.cyan, align: "center" });
    });
    card(s, 9.95, 1.85, 2.75, 3.6, C.elevated);
    text(s, "Production swap-ins", { x: 10.2, y: 2.05, w: 2.3, h: 0.4, fontSize: 15, bold: true, color: C.amber });
    text(s, [
      "eRTMAC / WITSML → same parameter schema", "OIL report archive → batch ingest", "PostgreSQL + pgvector", "Sentence-embedding model", "Grounded LLM answers", "SSO + role views",
    ].map((r, j, a) => ({ text: r, options: { bullet: true, breakLine: j < a.length - 1 } })), { x: 10.2, y: 2.6, w: 2.35, h: 3.2, fontSize: 12, paraSpaceAfter: 6 });
    text(s, "Runs offline on a laptop · deterministic demo mode · REST API with OpenAPI docs · 10 end-to-end tests", { x: 0.6, y: 5.8, w: 12.1, h: 0.35, fontSize: 13, color: C.muted });
    footer(s, 9);
    s.addNotes("A standalone layer beside eRTMAC. Every demo component has a named production replacement; the data model already carries provenance so authorised OIL data can replace the synthetic set.");
  }

  // =====================================================================================
  // 10 — Impact & next steps
  {
    const s = pres.addSlide(); bg(s); header(s, "Impact & next steps", "Less time between a signal and the evidence");
    const impact = [
      ["gauge", "Earlier warnings", "Alerts before the bit reaches historically difficult windows — with lead distance and confidence."],
      ["book", "Lessons reused", "What worked on offsets is shown with every alert and answer — not rediscovered."],
      ["user", "Faster ramp-up", "New engineers get the field's history at the depth they are drilling, with sources."],
    ];
    impact.forEach(([k, t, d], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.85, 3.8, 2.3);
      badge(s, k, x + 0.3, 2.1, 0.6);
      text(s, t, { x: x + 1.05, y: 2.18, w: 2.6, h: 0.4, fontSize: 18, bold: true });
      text(s, d, { x: x + 0.3, y: 2.85, w: 3.25, h: 1.2, fontSize: 13.5, color: C.muted });
    });
    text(s, "NEXT", { x: 0.6, y: 4.45, w: 2, h: 0.3, fontSize: 12, bold: true, color: C.amber, charSpacing: 3 });
    const next = ["Connect eRTMAC and the OIL report archive", "Calibrate weights on labelled NPT history", "Close the loop: outcomes become lessons"];
    next.forEach((t, i) => {
      const x = 0.6 + i * 4.1;
      text(s, String(i + 1), { x, y: 4.85, w: 0.5, h: 0.6, fontSize: 30, bold: true, color: C.cyan, fontFace: MONO });
      text(s, t, { x: x + 0.55, y: 4.95, w: 3.2, h: 0.7, fontSize: 15, bold: true });
    });
    card(s, 0.6, 5.95, 12.1, 0.8, C.elevated);
    text(s, "NWIS doesn’t replace the drilling engineer — it shortens the path from a signal to the evidence.",
      { x: 0.9, y: 6.1, w: 11.6, h: 0.5, fontSize: 16, bold: true, color: C.cyan, valign: "middle" });
    footer(s, 10);
    s.addNotes("Close: decision support — the engineer decides. Be explicit that the data is realistic synthetic data on real Assam stratigraphy, and that the hand-set weights drive alerts while a learned model cross-checks them.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
