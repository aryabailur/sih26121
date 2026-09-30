# NWIS — project handoff (read this first)

> Snapshot for a new Claude session. Last updated **2026-09-29 (session 3)**.
> Repo: **https://github.com/aryabailur/sih26121** (branch `main`). `CLAUDE.md` = short technical gotchas;
> this file = the full picture. Session 2 is pushed (`2a61a13`); the session-3 features (§3) are **uncommitted** — see §2.

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

- Session 2 was **committed and pushed** as `2a61a13` (session 3, at the user's request) after re-running every check.
- **Uncommitted:** the session-3 features (Subsurface 3D, Look-ahead brief, command palette, spoken alerts, Real-data
  proof — §3). All checks in §4 pass: pytest 22/22, scenario sweep = §6, requirements 20/20, tsc/eslint/build clean, E2E verify.
  Ask before committing. Push with `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`
  (plain `git push` → 403: cached creds belong to another account). Commit messages end with the co-author trailer.
- **Demo film done (session 3):** `docs/video/NWIS_SIH26121_demo.mp4` (3:01, 1080p30, Team Huzzards' cloned narrator voice via `clone.py` + original score +
  captions) built by `tools/video/` (see its README). Script for a human narrator: `docs/VIDEO_SCRIPT.md`. The old
  `docs/nwis-demo-walkthrough.webm` is superseded. The MP4/WAV renders are git-ignored (> GitHub's 100 MB limit);
  only the `.srt` and `timeline.json` are committed — share the film via a release asset / YouTube.
- Everything else is verified (§4); docs, screenshots (`docs/screenshots/00…22`) and the 13-slide deck are regenerated.

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
Then *"make the UI/UX better, crazy animation, SIH-winning stuff, think of something that is needed"* →
1. **Subsurface 3D** (`components/subsurface/`, three.js 0.186): cut-away block of the wells ≤ 5 km — strata walls
   + wireframe formation surfaces IDW-interpolated from every offset's tops, true well paths (TVD, added to
   `/wells/trajectories`), event gems at depth (halo when near the bit), hazard sleeves on the active plan, amber bit +
   depth plane that follows it, particle "evidence links" from context events to the bit, Esri imagery on an x-ray
   ground plane. Intro: strata extrude, wells drill in, events pop. A newer toast flashes the plane and flies the
   camera to the evidence. Own page `/dashboard/subsurface` (bit slider, events near the bit → fly-to, hazards,
   strata) **and** a Surface / Subsurface switch on the Command Center map panel (`components/map/ViewSwitch.tsx`).
2. **Look-ahead brief** (the "something needed" idea — rigs hand over every 12 h and run DWOP sessions):
   `services/briefing.py` + `GET /api/risk/brief` + `/dashboard/brief` — hazards in the next 150/300/500 m or to TD,
   projected severity from history only, offsets hit / reached, expected & worst NPT (₹ at an editable 30 lakh/day),
   what worked ranked by NPT, offset numbers, mud-weight gauge + programme breaches, checklist + sign-off (per-viewer
   localStorage), Print/PDF (print CSS, forces light theme), Copy text (WhatsApp), Read aloud. `tests/test_brief.py`.
3. **Ctrl K command palette** (`components/layout/CommandPalette.tsx`): screens, wells, depth jump (≥ 100 m), hazard
   windows, actions, "Ask: …" → search. **Spoken alerts** (`lib/voice.ts`, `components/risk/VoiceCallouts.tsx`),
   off by default, speaker toggle in the top bar.
4. Deck → 12 slides (new 6 "See below the surface", 7 "Look-ahead brief"; ₹ number on Impact); screenshots 17–20;
   README / DEMO_SCRIPT / PITCH / ARCHITECTURE / ASSUMPTIONS updated; requirements check cites the new features.

Then *"remove the word synthetic or keep it? add more data?"* → advised: keep the disclosure but reword; prove the
pipeline on real public data; ask OIL for pages. Built:
5. **Wording**: "Demo field modelled on real Upper Assam geology — illustrative wells, not Oil India records" +
   "Proven on 1,970 real well histories →" link (welcome); rail chip "DEMO FIELD"; API `DATA_DISCLAIMER`; deck title.
6. **Real-data proof** (`backend/opendata/sodir.py` importer, `services/opendata.py`, `routers/opendata.py`,
   `/dashboard/opendata` "Real data"): Norwegian Offshore Directorate FactPages (NLOD 2.0, retrieved 2026-09-30) —
   1,970 exploration-wellbore histories run through the same extractor → 611 drilling problems in ~2–4 s; study area
   quadrants 15–16 (241 wells: tops, mud weights, casing/LOT) with offset analysis around the Volve discovery well
   15/9-19 SR (shelf map, real-group depth chart, real mud-weight window, events table with FactPages links).
7. **Extractor improved from real text** (`document_processor.py`): kick-off ≠ kick (all modes), negation (all
   modes), new loss/flow phrasings, and `narrative=True` prose mode (trigger-sentence depth nearest the trigger,
   same-family grouping, planning/tool/pressure-survey guards, depth-less back-reference dedupe). Upload mode and the
   tuned scenario are unaffected (pytest, sweep, requirements all unchanged).
8. **Held-out accuracy**: rules tuned on quadrants 15–16 then frozen; 50 extractions from other wells hand-checked →
   **94 % precision (47/50), 94 % depth (29/31)**; labels `backend/opendata/spotcheck.json`; `tests/test_opendata.py`
   (4 tests) guards label drift. Deck → **13 slides** (new 11 "Proven on real records"); screenshots 21–22.
9. `docs/OIL_DATA_REQUEST.md` — the e-mail for the OIL SPOC asking for 2–3 anonymised DDR/WCR pages (user sends it).

**Advice already given to the user** (don't repeat unprompted): keep the demo-field disclosure (done, reworded);
real public data = Sodir FactPages (done) / Equinor **Volve** DDRs (needs sign-up — not built);
ask OIL mentors for 2–3 anonymised DDR/WCR pages to ingest live (draft in docs/); to win: official SIH PPT template + team names,
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
.venv\Scripts\python.exe -m pytest -q                  # 22 tests (resets live DB state)
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
  services/briefing.py         look-ahead brief (hazards ahead, what worked, mud window, expected NPT) — read-only
  services/risk_model.py       learned cross-check (pure-Python logistic regression, backtest, LOWO AUC)
  services/search_engine.py    BM25 + concept embedding + metadata retrieval; extractive cited answers
  services/document_processor.py  upload → text layer / Tesseract OCR → chunk → extract → review → commit
  services/pressure.py · similarity.py · nlp.py · taxonomy.py · ingest.py · pdf_writer.py · geo.py · llm.py
  routers/             wells · events · formations (correlate incl. casing + mud_program) · risk · search · documents · simulation · opendata
  opendata/sodir.py    Sodir FactPages importer → data/opendata/sodir_shelf.json.gz + sodir_area.json (committed); spotcheck.json
  services/opendata.py real-data proof: shelf scan, area extraction, offsets, held-out spot-check
  tests/               test_api · test_intelligence · test_pressure · test_brief · scenario_sweep · requirements_check
frontend/              Next.js 16 · React 19 · Tailwind 4 · MapLibre GL 6 · Motion · Recharts 3 · Zustand
  app/page.tsx         welcome (globe + role select) · app/globals.css = theme tokens + radius/type scale
  app/icon.svg · favicon.ico   logo
  app/dashboard/       page (Command Center) · subsurface · brief · nearby · well/[wellId] · compare · search · risk · documents
  components/map/      FieldMap (MapLibre, portal markers) · WellPin · mapStyle · MapLegend · ViewSwitch · landing/GlobeHero
  components/subsurface/  Subsurface3D (three.js scene) · geometry (paths, IDW, textures, Esri mosaic) · focus · index (dynamic)
  components/brief/    IntervalStrip · HazardSection (+ MudWindowGauge)
  components/dashboard/  WellboreNavigator · KPIStrip · StatusHero · RiskWatch · LiveFeed
  components/risk/     RiskCard · WhyExplainer · LearnedOpinion · AlertToaster · RiskProfileChart · PressureWindowChart
  components/…         search/(EvidenceCard, SourceViewer) · well/(EventTimeline, ParameterChart, WellProfileDrawer)
                       documents/(UploadZone, ProcessingStepper, ExtractedEvents) · shared/(DepthScrubber, FamilyIcon, …)
                       layout/(CommandCenter + ScenarioDock, Sidebar, TopNav, CommandPalette, Logo) · risk/VoiceCallouts · ui/(primitives, animated)
  lib/                 store.ts (state + scenario runner) · api.ts · types.ts · utils.ts (palettes, SEVERITY_STYLE,
                       FAMILY_META, FORMATION_COLORS) · prefs.ts (theme/role/intro) · voice.ts · brief.ts (₹, text) · hooks.ts
  scripts/copy-maplibre-worker.mjs
tools/                 shot.mjs · docs_shots.mjs · pw_shot.mjs · record_video.mjs · verify_scenario.mjs ·
                       audit_text.mjs · build_deck.js · render_pptx.ps1 · sih_deck/ (SIH idea deck) (see tools/README.md)
docs/                  ARCHITECTURE · DEMO_SCRIPT · PITCH (incl. judge Q&A) · ASSUMPTIONS · BUILD_GUIDANCE ·
                       screenshots/00–22 · NWIS_Pitch_Deck.pptx (13 slides) · video/ (demo film) · VIDEO_SCRIPT.md · nwis-logo.png
                       SIH2026-IDEA-Presentation-Format.pptx (official template) → NWIS_SIH2026_Idea_Presentation.pptx/.pdf (6 slides)
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

wells: `/wells`, `/wells/active`, `/wells/nearby`, `/wells/trajectories` (MD, TVD, lat/lon), `/wells/{id}` (incl. casing),
`/wells/{id}/similarity`, `/wells/{id}/pressure-window`, `/wells/{id}/parameters` · events: `/events`,
`/events/at-depth`, `/events/timeline`, `/events/{id}` · formations: `/formations`, `/formations/correlate`
(+ `casing`, `mud_program`) · risk: `POST /risk/evaluate` (assessments carry `ml`), `/risk/zones`, `/risk/alerts`,
`POST /risk/acknowledge`, `POST /risk/alerts/clear`, `/risk/alerts/{id}/audit`, `/risk/profile`, `/risk/clusters`,
`/risk/model` (+ `learned`), `/risk/brief?depth=&horizon_m=` (look-ahead brief, read-only) · search: `POST /search/evidence`, `/search/suggestions` · documents: list, samples,
`POST /documents/upload`, `POST /documents/upload-sample?name=`, status, extracted (pages carry `ocr_confidence`),
commit, delete, file · opendata: `/opendata/summary`, `/opendata/shelf?fresh=`, `/opendata/wells`, `/opendata/well?name=`,
`/opendata/offsets?name=&radius_km=`, `/opendata/spotcheck` · simulation: `/simulation/ertmac`, `POST /simulation/demo-scenario`, `POST /simulation/reset`
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
- `Subsurface3D` builds its scene once per data change and reads the store in its frame loop (no React re-render
  per frame); `focusSubsurfaceEvent(id)` (window event) flies the camera from side panels. Command Center keeps the
  MapLibre map as the default view (E2E + `window.__nwisMap` rely on it).
- Overlays + palette sit in a `print:hidden` wrapper; Sidebar/TopNav are `print:hidden`; the Brief prints alone.

## 10. User preferences learned

- Wants bold, vibrant, product-grade UI that does **not** look AI-generated: no pill shapes, big radii, purple
  gradients, glows or blurred blobs. Readable text matters (they flagged light/small text).
- Minimal "synthetic" labelling; never in the documents themselves; honest disclosure stays on welcome + rail.
- Asks follow-up questions about winning SIH; appreciates concrete checks with evidence (e.g. requirements table).
- Video work is on hold until they ask.

## 11. Open items / next steps

1. ~~Commit and push session 2~~ — done. **Commit and push the session-3 features** (ask first).
2. ~~Re-record the video~~ — done: `tools/video/` pipeline → `docs/video/`. Re-run it after visible UI changes (the
   takes follow the live UI; takes whose selectors changed need a tweak in record.mjs).
3. **Offline map fallback** for the venue (cache Esri/terrain tiles for the field area) — offered, not built.
4. **Real-data proof**: Volve importer once the user downloads the data; or ingest OIL sample pages if obtained.
5. ~~Deck on the official SIH template~~ — done (session 4): `docs/NWIS_SIH2026_Idea_Presentation.pptx/.pdf`, 6 slides,
   built by `tools/sih_deck/build.py` (industry NPT stats, OIL 70 wells/yr, ₹21 crore/yr illustration, 16 cited refs).
   **Team still fills in:** team name, team ID, theme (as on the SIH portal), verify the official PS title, deployed
   prototype URL and demo-video URL — pass them as flags and rebuild with `--pdf`.
6. Nice-to-haves: evidence graph view (Well → Report → Event → Formation → Risk → Mitigation), well-log track,
   mobile layout (< 1280 px stacks but isn't tuned), cloud deployment, Hindi/Assamese voice + brief.

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
