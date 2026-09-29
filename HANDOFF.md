# NWIS — project handoff (read this first)

> Snapshot for a new Claude session. Last updated **2026-09-29 (session 3)**.
> Repo: **https://github.com/aryabailur/sih26121** (branch `main`). `CLAUDE.md` = short technical gotchas;
> this file = the full picture. Session 2's work is **committed and pushed** — see §2.

## 1. What this is

Smart India Hackathon 2026 entry for problem statement **SIH26121 (Oil India Limited)** — **NWIS, Nearby Wells
Intelligence System**: a drilling decision-support cockpit beside the real-time monitor (eRTMAC) that connects the
active well's *current depth* to what *nearby wells* experienced there (events, causes, mitigations, source report
pages) and raises explainable risk alerts.

- Build spec: `SIH26121_MASTER_BUILD.md`; companion PDFs summarised in `docs/BUILD_GUIDANCE.md`; every deliberate
  deviation is in `docs/ASSUMPTIONS.md` (keep it current).
- Official SIH text: the user pasted it in session 2 — problem points i–iv, solution points i–vii, data sources i–ix.
  It names **no dataset**; it only lists data that exists *inside* OIL. `python -m tests.requirements_check` verifies
  all 20 items through the API (currently **20/20 PASS**).
- The user owns the repo (GitHub `aryabailur`), is on the SIH team, wants autonomous complete work and wants to win.

## 2. Current state (important)

- **Committed and pushed** (session 3, at the user's request) after re-running every check in §4: pytest 14/14,
  scenario sweep = §6, requirements 20/20, tsc/eslint/build clean, E2E verify (alerts 3,150 / 3,380 / 3,580).
  Ask before future commits. Push with `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`
  (plain `git push` → 403: cached creds belong to another account). Commit messages end with the co-author trailer.
- **Deferred by the user:** re-recording the demo video (“make video later”). `docs/nwis-demo-walkthrough.webm`
  is **stale** (pre-legibility pass). Re-record with `cd tools && npm run video` only when asked.
- Everything else is verified (§4) and the docs, screenshots (`docs/screenshots/00…16`) and deck are regenerated.

## 3. What was done (session log)

**Session 1** — built everything in the spec: FastAPI backend (KB, explainable risk engine, hybrid evidence search,
document pipeline, pressure window, similarity), Next.js cockpit, seed data, tests, docs, deck, silent backup video.

**Session 2** (user feedback drove each step):
1. *"Looks like AI slop — make it world class, vibrant, real maps, crazy animation"* → full frontend redesign:
   Daylight (default) + Night-shift themes on CSS tokens; Plus Jakarta Sans + JetBrains Mono; welcome screen `/`
   (spinning satellite globe, role select, dive into the field); **MapLibre GL 6 3D map** (Esri imagery + labels,
   AWS terrain, OpenFreeMap streets; globe fly-in, radar sweep, history towers, marching evidence links, camera
   framing on alerts, 2D/3D, orbit); vertical **wellbore navigator**; "Right now" status card; risk radar; alert
   toasts with screen-edge flash; animated *Why?* breakdown; geological cross-section on Compare; paper-style
   source viewer. Leaflet removed.
2. *"Check coverage vs the official SIH text"* → added: **learned risk cross-check** (`services/risk_model.py`,
   logistic regression backtested leave-one-well-out on the offsets, AUC ≈ 0.86 vs 0.76 hand-set; shown as the ML
   chip, a *Why?* section, learned-vs-hand-set weights — **never drives alerts**); **real OCR** (Tesseract 5.4
   installed via winget, auto-discovered; image-only sample `DDR_OIL-AX-44_Day38_SCANNED.pdf` OCR'd at ~93 %);
   **casing + mud programmes** correlated on Compare.
3. *"Don't show synthetic everywhere"* → disclosure reduced to: welcome-screen line, rail "Demo data" chip, deck
   title slide, API disclaimer. Later: *"remove the synthetic word in the docs"* → removed from report pages,
   report files, PDF footers and sample reports. Internal markdown docs still discuss synthetic data (by design).
4. *"Curved corners look AI-generated; change the logo"* → near-square geometry (4 px panels / 3 px controls /
   2 px tags; circles only for dots, pins, gauges), purple→pink gradient flattened to solid brand (`--aurora`
   token), no glows/blurred blobs, amber headline accent. **New logo**: an "N" drawn from wells (offset well,
   deviated path, active well with an amber bit in the Kopili band) — `components/layout/Logo.tsx`,
   `app/icon.svg`, `app/favicon.ico`, `docs/nwis-logo.png`.
5. *"Text is light and small"* → legibility pass: type scale lifted (body 12.5–13.5 px, micro labels ≥ 11 px,
   base weight 450), grey inks darkened (≥ 4.6:1 in both themes), severity gradients/solid badges deepened for
   white text, `SEVERITY_STYLE[*].deep` for coloured text on white, dark tags behind rock-layer labels, layouts
   re-fitted at 1366 px. Audit tool `tools/audit_text.mjs` (faint text 272 → ~40; remainder mostly false positives
   on gradient cards).
6. Requirements check script added (`backend/tests/requirements_check.py`) → 20/20 PASS.

**Session 3** — committed and pushed session 2. Fix: `tests.requirements_check` crashed with `UnicodeEncodeError`
when its output was piped/redirected on Windows (cp1252 can't print `✓`); it now forces UTF-8 stdout.

**Advice already given to the user** (don't repeat unprompted): keep realistic synthetic data but say so once;
real public drilling data = Equinor **Volve** (North Sea; user must register/download — then build an importer);
ask OIL mentors for 2–3 anonymised DDR/WCR pages to ingest live; to win: official SIH PPT template + team names,
one NPT-cost number, rehearse the 3-min demo (`docs/DEMO_SCRIPT.md`), stress on-prem integration beside eRTMAC,
protect the demo against venue Wi-Fi (offline map tiles not built yet).

## 4. Run & verify

```powershell
.\start.ps1            # venv + deps + reseed + API (:8000) + UI (:3000) in minimized windows; warns if Tesseract is missing
.\start.ps1 -NoSeed    # keep the current DB
./start.sh             # macOS/Linux
```

Manual: `cd backend; .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000` (no `--reload`;
restart after Python edits; stop it before `seed_data.py`) and `cd frontend; npm run dev` (`predev` copies the
MapLibre worker to `public/maplibre/`). Open `http://localhost:3000` (welcome) or `/dashboard`. The servers do not
survive a closed session — check `curl http://127.0.0.1:8000/api/health` and `http://localhost:3000/` first.

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q                  # 14 tests (resets live DB state)
.venv\Scripts\python.exe -m tests.scenario_sweep       # must match §6
.venv\Scripts\python.exe -m tests.requirements_check   # 20/20 PASS vs the official SIH text
cd ..\frontend; npx tsc --noEmit; npx eslint .; npm run build
cd ..\tools; npm run verify                            # E2E scenario (needs both servers)
node audit_text.mjs --detail                           # legibility audit (THEME=dark for night theme)
npm run shots; node pw_shot.mjs; npm run deck          # refresh docs/screenshots + deck after visible UI changes
```

Machine facts: Windows 11, NVIDIA RTX 4050 — headless Playwright must use `--use-angle=d3d11` (all tools do;
software GL runs the map at ~3 fps). Tesseract at `C:\Program Files\Tesseract-OCR\tesseract.exe`
(`NWIS_TESSERACT_CMD` overrides). Project lives in OneDrive.

## 5. Repository map

```
backend/
  main.py              FastAPI; auto-seeds an empty DB; builds search index + trains the learned model at startup
  config.py            env (NWIS_DATABASE_URL, NWIS_DEMO_MODE=1, NWIS_LLM_PROVIDER=none, NWIS_TESSERACT_CMD, …)
  models.py · schemas.py   SQLAlchemy models · Pydantic contracts (mirrored in frontend/lib/types.ts)
  seed_data.py         rebuilds the KB; writes data/synthetic_reports/*.txt then ingests them; copies samples
  seed/field.py        wells, formations (+porosity/PP/FG), casing, trajectories, 36 events, 7 risk zones
  seed/corpus.py       26 reports → 84 page chunks · seed/parameters.py deterministic eRTMAC-style parameters
  seed/sample_docs.py  text sample PDF (OIL-AX-22) + copies seed/assets/ scanned sample (OIL-AX-44)
  seed/make_scanned_sample.py  renders the image-only scanned PDF (dev tool; output committed in seed/assets/)
  services/risk_engine.py      explainable score, alert policy/persistence/escalation/audit, profile, clusters
  services/risk_model.py       learned cross-check (pure-Python logistic regression, backtest, LOWO AUC)
  services/search_engine.py    BM25 + concept embedding + metadata retrieval; extractive cited answers
  services/document_processor.py  upload → text layer / Tesseract OCR → chunk → extract → review → commit
  services/pressure.py · similarity.py · nlp.py · taxonomy.py · ingest.py · pdf_writer.py · geo.py · llm.py
  routers/             wells · events · formations (correlate incl. casing + mud_program) · risk · search · documents · simulation
  tests/               test_api.py · test_intelligence.py · test_pressure.py · scenario_sweep · requirements_check
frontend/              Next.js 16 · React 19 · Tailwind 4 · MapLibre GL 6 · Motion · Recharts 3 · Zustand
  app/page.tsx         welcome (globe + role select) · app/globals.css = theme tokens + radius/type scale
  app/icon.svg · favicon.ico   logo
  app/dashboard/       page (Command Center) · nearby · well/[wellId] · compare · search · risk · documents
  components/map/      FieldMap (MapLibre, portal markers) · WellPin · mapStyle · MapLegend · landing/GlobeHero
  components/dashboard/  WellboreNavigator · KPIStrip · StatusHero · RiskWatch · LiveFeed
  components/risk/     RiskCard · WhyExplainer · LearnedOpinion · AlertToaster · RiskProfileChart · PressureWindowChart
  components/…         search/(EvidenceCard, SourceViewer) · well/(EventTimeline, ParameterChart, WellProfileDrawer)
                       documents/(UploadZone, ProcessingStepper, ExtractedEvents) · shared/(DepthScrubber, FamilyIcon, …)
                       layout/(CommandCenter + ScenarioDock, Sidebar, TopNav, Logo) · ui/(primitives, animated)
  lib/                 store.ts (state + scenario runner) · api.ts · types.ts · utils.ts (palettes, SEVERITY_STYLE,
                       FAMILY_META, FORMATION_COLORS) · prefs.ts (theme/role/intro) · hooks.ts
  scripts/copy-maplibre-worker.mjs
tools/                 shot.mjs · docs_shots.mjs · pw_shot.mjs · record_video.mjs · verify_scenario.mjs ·
                       audit_text.mjs · build_deck.js · render_pptx.ps1 (see tools/README.md)
docs/                  ARCHITECTURE · DEMO_SCRIPT · PITCH (incl. judge Q&A) · ASSUMPTIONS · BUILD_GUIDANCE ·
                       screenshots/00–16 · NWIS_Pitch_Deck.pptx · nwis-demo-walkthrough.webm (stale) · nwis-logo.png
```

## 6. The demo scenario (tuned — protect it)

"Run historical risk scenario" drills **OIL-AX-102 (W001)** 3,100 → 3,600 m in 20 steps of 1.5 s at 25 km.
`python -m tests.scenario_sweep` must keep showing:

| Depth | Expected |
|---|---|
| 3,100 | mud loss 0.39 **medium watch**, nothing alert-eligible |
| 3,150 | **mud loss HIGH alert** (0.67); → critical 0.76 at 3,160 |
| 3,370 | stuck pipe 0.50 medium (no alert yet) |
| 3,380 | **stuck pipe HIGH alert** (0.74); → critical at 3,400 |
| 3,500 | torque 0.57 HIGH but **watch only** (medium-history zone needs ≥ 0.75) |
| 3,570 | kick 0.49 medium |
| 3,580 | **kick CRITICAL alert** (0.86) |

Score = 0.30 proximity + 0.20 frequency + 0.10 similarity + 0.10 formation + 0.25 parameter + 0.05 trajectory;
thresholds 0.35/0.55/0.75; high/critical-history zones alert at ≥ 0.55, medium/low at ≥ 0.75. Depths depend on
`seed/field.py` events, `seed/parameters.py` precursors and the weights. The learned model only annotates
(`assessment.ml`). The scanned sample's events (2,655 m / 2,690 m, Barail) sit outside every tuned window.

## 7. Data facts

- 15 wells: W001 active (27.2510, 95.3520; TD 3,800; at 3,100); W002–W011 offsets ≤ 2 km; W012–W015 regional
  28–47 km (25 km radius shows exactly 10). Real Upper Assam stratigraphy names: Girujan → Tipam → Namsang →
  Barail → Kopili → Sylhet; wells/depths/events are invented.
- Six mandated seed stories verbatim (W002 losses 3,150 · W003/W005 stuck ~3,380–3,430 · W004 torque 3,500 ·
  W008 kick 3,580 · W007 cement 2,800) + 30 more events; 26 reports (10 DDR, 9 WCR, 3 mud log, 2 cementing,
  1 NPT, 1 programme) → 84 chunks; 2 upload samples (text PDF, scanned PDF).
- Readable IDs (`W001`, `EV-W002-01`, `DOC-W002-DDR42`).

## 8. API (under `/api`; OpenAPI at `http://127.0.0.1:8000/docs`)

wells: `/wells`, `/wells/active`, `/wells/nearby`, `/wells/trajectories`, `/wells/{id}` (incl. casing),
`/wells/{id}/similarity`, `/wells/{id}/pressure-window`, `/wells/{id}/parameters` · events: `/events`,
`/events/at-depth`, `/events/timeline`, `/events/{id}` · formations: `/formations`, `/formations/correlate`
(+ `casing`, `mud_program`) · risk: `POST /risk/evaluate` (assessments carry `ml`), `/risk/zones`, `/risk/alerts`,
`POST /risk/acknowledge`, `POST /risk/alerts/clear`, `/risk/alerts/{id}/audit`, `/risk/profile`, `/risk/clusters`,
`/risk/model` (+ `learned`) · search: `POST /search/evidence`, `/search/suggestions` · documents: list, samples,
`POST /documents/upload`, `POST /documents/upload-sample?name=`, status, extracted (pages carry `ocr_confidence`),
commit, delete, file · simulation: `/simulation/ertmac`, `POST /simulation/demo-scenario`, `POST /simulation/reset`
(clears alerts **and uploads**, retrains the model if uploads existed), `/simulation/state` · `/health`.

## 9. Frontend architecture

- One Zustand store (`lib/store.ts`): depth, radius, latest evaluation, static field data, toasts, scenario state;
  `setDepth` → debounced evaluate; every panel renders from the same evaluation.
- Overlays in `components/layout/CommandCenter.tsx` (AlertToaster + edge flash, WhyExplainer, SourceViewer,
  WellProfileDrawer, ScenarioDock, live ticker), each wrapped in `<AnimatePresence>`.
- `FieldMap` (Command Center + Nearby) reacts to the store: highlighted wells → evidence links; new toast →
  `fitBounds`; selected well → ease; `window.__nwisMap` for E2E. Globe fly-in once per session.
- Themes: `<html data-theme>` set before paint; `lib/prefs.ts` stores theme/role. Design rules: radius scale
  4/3/2 px, no gradients/glows/pills, legibility floor (see CLAUDE.md), colour only for status/identity.

## 10. User preferences learned

- Wants bold, vibrant, product-grade UI that does **not** look AI-generated: no pill shapes, big radii, purple
  gradients, glows or blurred blobs. Readable text matters (they flagged light/small text).
- Minimal "synthetic" labelling; never in the documents themselves; honest disclosure stays on welcome + rail.
- Asks follow-up questions about winning SIH; appreciates concrete checks with evidence (e.g. requirements table).
- Video work is on hold until they ask.

## 11. Open items / next steps

1. ~~Commit and push session 2~~ — done in session 3.
2. **Re-record the video** when the user asks (`npm run video`; currently stale).
3. **Offline map fallback** for the venue (cache Esri/terrain tiles for the field area) — offered, not built.
4. **Real-data proof**: Volve importer once the user downloads the data; or ingest OIL sample pages if obtained.
5. Deck: official SIH template + team names (team task); impact number (NPT hours × rig day rate).
6. Nice-to-haves: evidence graph view (Well → Report → Event → Formation → Risk → Mitigation), well-log track,
   mobile layout (< 1280 px stacks but isn't tuned), cloud deployment.

## 12. Commit history (pushed)

```
(latest) Redesign cockpit, learned risk cross-check, OCR, casing/mud correlation   ← all of session 2
04ced2e Add HANDOFF.md and move dev tooling into tools/
f8fb26e One toast per risk window; demo note on shared backend state
672063d Docs: mud-weight window screenshot, test counts; deck refresh
a616406 Fix review findings: alert evidence routing, scenario runner races, clean scenario start
dbef25a Reservoir properties, casing strings and offset-calibrated mud-weight window
930756c Pitch deck (10 slides, speaker notes); active-well view and event-window fixes
8fd69f0 Backup demo video; laptop-width top bar; aligned depth column and charts
824ef60 Docs, start scripts, demo screenshots; alert snapshot depth; polish
2991fd5 Frontend: NWIS drilling-intelligence cockpit (Next.js 16, Tailwind 4, Leaflet, Recharts)
ed79152 Backend: NWIS knowledge base, explainable risk engine, hybrid evidence search, document pipeline
```
