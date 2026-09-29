# NWIS — project handoff (read this first)

> Status snapshot for a new Claude session picking up this repo. Last updated **2026-09-29**, commit `f8fb26e`
> + the `tools/` / handoff commit. Repo: **https://github.com/aryabailur/sih26121** (branch `main`).
> `CLAUDE.md` holds the short list of technical gotchas; this file is the full picture.

## 1. What this is

Smart India Hackathon 2026 entry for problem statement **SIH26121 (Oil India Limited)** — **NWIS, Nearby Wells
Intelligence System**: a drilling decision-support cockpit that sits beside the real-time monitor (eRTMAC) and
connects the active well's *current depth* to what *nearby wells* experienced there (events, causes,
mitigations, source report pages), with explainable risk alerts.

- Specification: `SIH26121_MASTER_BUILD.md` (the build spec the user provided). Two companion PDFs from the user
  are summarised in `docs/BUILD_GUIDANCE.md`.
- **All data is synthetic** and must stay labelled as such (UI badges, API disclaimer). Never present it as OIL data.
- The user is the SIH team member who owns the repo (GitHub `aryabailur`). They asked for autonomous, complete work.

## 2. Status

**Everything in the spec's build scope is implemented, tested and pushed.** Verified at hand-off:

- Backend: 10 pytest tests pass (Python 3.14 in `backend/.venv`; also verified on Python 3.11).
- Frontend: `npx tsc --noEmit` clean, `npx eslint .` clean, `npm run build` passes (9 routes).
- End-to-end browser check (`tools/verify_scenario.mjs`) passes; visual QA done at 1600×900 and 1366×768.

Spec final checklist (Section 13): all items done **except** (a) a *narrated* 3-minute video — only an
automated, silent backup walkthrough exists (`docs/nwis-demo-walkthrough.webm`), and (b) team names on the deck.

Deliverables present: working app · seed dataset · backend API · risk engine · evidence search · demo scenario ·
README · architecture diagram (mermaid) · pitch content + 10-slide deck · assumptions & integration points.

## 3. Run & verify

```powershell
.\start.ps1            # Windows: venv + deps + reseed + start API (:8000) and UI (:3000) in minimized windows, opens browser
.\start.ps1 -NoSeed    # keep the current DB
./start.sh             # macOS/Linux
```

Manual: `cd backend; .venv\Scripts\python.exe -m uvicorn main:app --port 8000` (no `--reload` — restart after
Python edits) and `cd frontend; npm run dev`. The UI proxies `/api/*` to the backend (`frontend/next.config.ts`).

Checks to run after changes:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q          # 10 tests (resets the live DB state — alerts/uploads)
.venv\Scripts\python.exe -m tests.scenario_sweep  # expected table in §5
cd ..\frontend; npx tsc --noEmit; npx eslint .; npm run build
cd ..\tools; npm install; npm run verify         # needs both servers running
```

Dev tools in `tools/` (screenshots, video, deck, E2E) — see `tools/README.md`.

## 4. Repository map

```
backend/
  main.py            FastAPI app; auto-seeds an empty DB; builds the search index at startup
  config.py          env settings (NWIS_DATABASE_URL, NWIS_DEMO_MODE=1, NWIS_LLM_PROVIDER=none, ...)
  models.py          SQLAlchemy: Well, SurveyPoint, Formation(+porosity/pore/frac), CasingString, Document,
                     DocumentChunk, DrillingEvent(+event_params), ParameterSample, RiskZone, Alert, AlertAudit,
                     Recommendation, WellSimilarity
  schemas.py         Pydantic contracts (mirrored in frontend/lib/types.ts)
  seed_data.py       rebuilds the whole KB (drop/create), writes data/synthetic_reports/*.txt then ingests them
  seed/field.py      wells, formation tops & properties, casing, trajectories, 36 events, 7 risk zones, recommendations
  seed/corpus.py     26 synthetic reports (DDR/WCR/mud log/cementing/NPT/programme) → 84 page chunks
  seed/parameters.py deterministic parameter generator (eRTMAC sim) incl. the active well's designed precursors
  seed/sample_docs.py sample upload PDF (DDR OIL-AX-22 Day 45) not in the KB
  services/risk_engine.py    explainable hybrid score, alert policy, alert persistence/escalation/audit, profile, clusters
  services/search_engine.py  BM25 + concept-hash embedding + metadata retrieval; extractive cited answers; intents
  services/document_processor.py  upload → pypdf/OCR adapter → chunk → rule-based event/entity extraction → review → commit
  services/pressure.py       offset-calibrated mud-weight window (pore / frac gradient) + breaches
  services/similarity.py     offset similarity (formations, coverage, trajectory, parameters, distance)
  services/nlp.py · taxonomy.py · ingest.py · pdf_writer.py · geo.py · llm.py (optional Claude adapter, off by default)
  routers/           wells · events · formations · risk · search · documents · simulation
  tests/             test_api.py, test_pressure.py (+ scenario_sweep, search_debug, answer_preview dev scripts)
frontend/            Next.js 16 App Router · React 19 · Tailwind 4 · Leaflet · Recharts 3 · Zustand
  app/dashboard/     page (Command Center) · nearby · well/[wellId] · compare · search · risk · documents
  components/        map/FieldMap · shared/DepthScrubber · dashboard/(KPIStrip, RiskWatch, DepthTimeline, LiveFeed)
                     risk/(RiskCard, WhyExplainer, AlertToaster, RiskProfileChart, PressureWindowChart)
                     search/(EvidenceCard, SourceViewer) · well/(EventTimeline, ParameterChart, WellProfileDrawer)
                     documents/(UploadZone, ProcessingStepper, ExtractedEvents) · layout/ · ui/ (hand-built primitives)
  lib/               store.ts (global state + scenario runner) · api.ts · types.ts · utils.ts · hooks.ts (useAsync)
tools/               Playwright/pptxgenjs dev scripts (see tools/README.md)
docs/                ARCHITECTURE · DEMO_SCRIPT · PITCH · ASSUMPTIONS · BUILD_GUIDANCE · screenshots/ · deck · video
start.ps1 / start.sh one-command startup
```

## 5. The demo scenario (tuned — protect it)

"Run historical risk scenario" drills the active well **OIL-AX-102 (W001)** from 3,100 → 3,600 m in 20 steps of
1.5 s at radius 25 km. `python -m tests.scenario_sweep` must keep showing:

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
thresholds 0.35/0.55/0.75; alert policy: high/critical-history zones alert at ≥ 0.55, medium/low-history at ≥ 0.75.
Depths depend on `seed/field.py` events, `seed/parameters.py` precursors (ECD ramp from 3,140; torque ramp from
3,350; overpull from 3,398; SPP drop + drilling break from 3,579) and the weights — change any of them and re-run
the sweep + tests. A fresh scenario run clears alerts (`POST /api/risk/alerts/clear`) and restores the default radius.

## 6. Data facts (synthetic)

- 15 wells: W001 active OIL-AX-102 (27.2510, 95.3520; TD 3,800; current 3,100); W002–W011 = the spec's 10 offsets
  (all ≤ 2 km); W012–W015 regional at 28–47 km (added so the radius control matters — 25 km shows exactly 10).
- Formations: Girujan → Tipam → Namsang → Barail → Kopili → Sylhet (per-well tops in `FORMATION_TOPS`).
- Six mandated seed stories reproduced verbatim: W002 losses 3,150–3,220 · W003 stuck 3,380–3,420 · W005 stuck
  3,390–3,430 · W004 torque 3,500–3,540 · W008 kick 3,580–3,610 · W007 cement 2,800–2,850 (+30 more events).
- Risk zones RZ01–RZ05 exactly as spec; RZ06 (Sylhet losses) and RZ07 (Namsang NPT) marked `derived`.
- Readable IDs (`W001`, `EV-W002-01`, `DOC-W002-DDR42`, chunk `DOC-W002-DDR42-P03`) instead of UUIDs.

## 7. API (all under `/api`, OpenAPI at `http://127.0.0.1:8000/docs`)

wells: `GET /wells`, `/wells/active`, `/wells/nearby`, `/wells/trajectories`, `/wells/{id}`, `/wells/{id}/similarity`,
`/wells/{id}/pressure-window`, `/wells/{id}/parameters` · events: `GET /events`, `/events/at-depth`,
`/events/timeline`, `/events/{id}` · formations: `GET /formations`, `/formations/correlate` · risk:
`POST /risk/evaluate` (persist=true records alerts), `GET /risk/zones`, `/risk/alerts`, `POST /risk/acknowledge`,
`POST /risk/alerts/clear`, `GET /risk/alerts/{id}/audit`, `/risk/profile`, `/risk/clusters`, `/risk/model` · search:
`POST /search/evidence`, `GET /search/suggestions` · documents: `GET /documents`, `/documents/samples/list`,
`/documents/samples/{name}`, `POST /documents/upload`, `/documents/upload-sample`, `GET /documents/{id}/status`,
`/documents/{id}/extracted`, `POST /documents/{id}/commit`, `DELETE /documents/{id}`, `GET /documents/{id}`,
`/documents/{id}/file` · simulation: `GET /simulation/ertmac`, `POST /simulation/demo-scenario`,
`POST /simulation/reset` (clears alerts **and uploaded docs**), `GET /simulation/state` · `GET /health`.

## 8. Frontend architecture

- One Zustand store (`lib/store.ts`): `depth`, `radiusKm`, `evaluation` (latest `/risk/evaluate` response), static
  field data, toasts, scenario state. `setDepth` → debounced evaluate; every panel renders from the same evaluation.
- Scenario runner: `scenarioRun` token stops superseded loops; Pause → Resume / Restart; toasts keyed per risk zone
  and announced even for superseded responses (the server reports an alert as new only once).
- Global overlays mounted in `components/layout/CommandCenter.tsx`: AlertToaster, WhyExplainer, SourceViewer,
  WellProfileDrawer, scenario narration banner, live-mode ticker.
- Alerts show their **trigger-time snapshot**; the live score appears as a "Now @ depth" line.
- Charts follow a validated dark palette (`SERIES_COLORS`, active well first); colour for status/identity only.

## 9. Gotchas (things that already bit us)

- **Git push**: plain `git push` → 403 (Git Credential Manager holds account "Learningwhim"). Use
  `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push` (gh is logged in as aryabailur).
  Don't change the user's global git config. Commit messages end with the co-author trailer used in `git log`.
- **Windows encoding**: never edit files with PowerShell `Get-Content`/`Set-Content` (re-encodes UTF-8, corrupted
  `–·≥` once). Use the editor tools or Python with `encoding="utf-8", newline="\n"`.
- **Git Bash** mangles `/dashboard` args → `export MSYS_NO_PATHCONV=1`.
- **Next.js 16** differs from older docs — check `frontend/node_modules/next/dist/docs/`. `useSearchParams` needs
  `<Suspense>`; params via `useParams()` in client pages; no `next lint`; `devIndicators: false` is set.
- **Recharts vertical layout**: numeric Y minimum is already at the top; never add `reversed` (desyncs lines vs
  reference areas).
- **React hooks lint v7**: no synchronous setState in effects, no ref writes in render — key child components on
  their target instead (pattern in `WhyExplainer`, `SourceViewer`); use `lib/hooks.ts#useAsync` for fetching.
- **Shared backend state**: alerts are global; a second tab's Run/Reset clears the first tab's alerts. Demo with one tab.
- **pytest resets the live DB** (alerts, uploads) — don't run it mid-demo.
- The project sits in **OneDrive**; `node_modules` sync is heavy.
- Map tiles: Esri Dark Gray (CARTO now needs an API key). Offline → tiles blank, vector layers still render.

## 10. Open items / sensible next steps

Optional extras from the companion PDFs (none started):
1. **Evidence graph view** (Well → Report → Event → Formation → Risk → Mitigation) — highest demo value.
2. **Well-log style track** (gamma ray / resistivity) on Well Intelligence.
3. **Role-select screen** (Field Engineer / Office Analyst / Manager) — currently just a label in the top bar.
4. **Cloud deployment** (Vercel frontend + Render/Railway backend) — currently local only.
5. Tesseract OCR for scanned PDFs (adapter exists; binary not installed).

Only the team can do: team names / official SIH template on the deck, narrated demo video, rehearsal
(`docs/DEMO_SCRIPT.md`), SIH portal submission.

When continuing: keep `docs/ASSUMPTIONS.md` updated for any spec deviation, re-run §3 checks, refresh
`docs/screenshots` (`tools/npm run shots`) and the deck (`npm run deck`) if the UI changes visibly.

## 11. Commit history

```
f8fb26e One toast per risk window; demo note on shared backend state
672063d Docs: mud-weight window screenshot, test counts; deck refresh
a616406 Fix review findings: alert evidence routing, scenario runner races, clean scenario start
dbef25a Reservoir properties, casing strings and offset-calibrated mud-weight window
930756c Pitch deck (10 slides, speaker notes); active-well view and event-window fixes
8fd69f0 Backup demo video; laptop-width top bar; aligned depth column and charts
12b3c9f Make start.sh executable
824ef60 Docs, start scripts, demo screenshots; alert snapshot depth; polish
2991fd5 Frontend: NWIS drilling-intelligence cockpit (Next.js 16, Tailwind 4, Leaflet, Recharts)
6b22dc9 Add .gitattributes: LF line endings, binary PDFs
ed79152 Backend: NWIS knowledge base, explainable risk engine, hybrid evidence search, document pipeline
```
