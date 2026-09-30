# NWIS — notes for Claude / contributors

**New session? Read `HANDOFF.md` first** — current status, run/verify commands, the tuned demo scenario, repo map,
API list, gotchas and open items.

SIH26121 prototype: FastAPI backend (`backend/`) + Next.js 16 cockpit (`frontend/`, MapLibre 3D map, Motion,
Daylight/Night-shift themes). Spec: `SIH26121_MASTER_BUILD.md`.
Deviations from the spec are recorded in `docs/ASSUMPTIONS.md` — keep that table current when you change behaviour.

## Run

- Backend: `cd backend && .venv\Scripts\python.exe -m uvicorn main:app --port 8000` (no `--reload` by default —
  restart after Python changes). `python seed_data.py` rebuilds the DB; an empty DB is auto-seeded at startup.
- Frontend: `cd frontend && npm run dev` — `/api/*` is proxied to the backend via `next.config.ts` rewrites.
- Tests: `cd backend && python -m pytest -q`. Scenario sanity check: `python -m tests.scenario_sweep`
  (expected: mud loss alert first at 3,150, stuck pipe at 3,380, kick at 3,580; nothing alert-eligible at 3,100).
  Requirements coverage vs the official SIH26121 text: `python -m tests.requirements_check` (expect 20/20 PASS).
- Frontend checks: `npx tsc --noEmit`, `npx eslint .`, `npm run build`. E2E: `cd tools && npm run verify`.

## Things that bit us

- **Next.js 16**: read `frontend/node_modules/next/dist/docs/` before using framework APIs (async `params`,
  `useSearchParams` needs a `<Suspense>` boundary, no `next lint`).
- **Recharts vertical layout**: a numeric Y axis already has its minimum at the top; do **not** add `reversed`
  (it desyncs `Line` geometry from `ReferenceArea`/`ReferenceLine`). See `components/well/ParameterChart.tsx`.
- **React hooks lint (v7)**: no setState synchronously in effects, no ref writes during render, no mutating a
  value returned by `useMemo` (react-hooks/immutability) — key child components on their target instead (see
  `WhyExplainer`, `SourceViewer`); size DOM through a ref (see the radar in `FieldMap`).
- **MapLibre v6**: its tile worker is served from `public/maplibre/` (copied by `predev`/`prebuild`,
  `scripts/copy-maplibre-worker.mjs`, git-ignored) and wired with `setWorkerUrl`. `maplibre-gl.css` sets
  `.maplibregl-map { position: relative }` — the map container needs `!absolute inset-0` or it collapses to 0 px.
  Paint properties need literal colours (no CSS vars); markers are portal-rendered React (`WellPin`).
- **three.js (Subsurface 3D)**: import it only through `components/subsurface/index.tsx` (`next/dynamic`, no SSR);
  never import `Subsurface3D.tsx` / `geometry.ts` statically from a page — use `focus.ts` to talk to the view.
  Switching Surface ↔ Subsurface creates/destroys WebGL contexts, so unmount disposes everything and calls
  `forceContextLoss()`. CSS2D label classes are Tailwind strings: `calc()` inside arbitrary values needs `_` for
  spaces (`[transform:translateX(calc(50%_+_26px))]`). The Command Center map title reads "10 offsets · 25 km"
  (with the view switch) — `tools/verify_scenario.mjs` matches that text.
- **Motion**: springs support only two keyframes — give multi-keyframe values a tween transition. Avoid
  `<AnimatePresence mode="wait">` for fast-changing keys (it got stuck mid-scenario); use enter-only keyed elements.
- **Theme tokens**: colours come from CSS variables in `app/globals.css` (`bg-surface`, `text-ink-2`, `brand`, …);
  don't hard-code slate/cyan classes. Recharts takes `var(--…)` strings via `CHART` in `lib/utils.ts`.
- **Legibility floor**: body text ≥ 12.5 px, micro labels (ticks, units, tags) ≥ 11 px; text ≥ 4.5:1 contrast.
  `ink-4` is for separators / placeholders only. Coloured text on a white chip uses `SEVERITY_STYLE[*].deep`;
  white text sits on deep fills (solid badges use `deep`). Check with `cd tools && node audit_text.mjs --detail`
  (`THEME=dark` for the night theme; it over-reports on gradient cards and translucent tags — verify visually).
- **Headless screenshots**: launch Chromium with `--use-angle=d3d11` (see `tools/shot.mjs`); the software rasteriser
  runs the 3D map at ~3 fps and animations look frozen.
- **Windows**: edit files with the editor tools, not PowerShell `Get-Content`/`Set-Content` (they re-encode UTF-8
  and corrupt `–`, `·`, `≥`). Git-Bash needs `MSYS_NO_PATHCONV=1` when passing `/dashboard`-style args.
  Don't patch files through a Bash heredoc'd Python script when the text has backslashes (`\t`, `\n`, Windows
  paths): the escapes get interpreted and corrupt the file — use the Edit/Write tools.
- **Open data** (`/api/opendata`, *Real data* screen): bundles in `backend/data/opendata/` are committed; rebuild with
  `cd backend && python -m opendata.sodir [--refresh]` (raw CSV cache is git-ignored). Changing the extractor can
  invalidate the held-out labels in `backend/opendata/spotcheck.json` — `tests/test_opendata.py` checks every key
  still exists; re-label honestly (never tune on the held-out wells). `extract_events(narrative=True)` is prose
  mode; uploads use the default mode.
- **Hosting**: Vercel (frontend) proxies `/api/*` to `NWIS_BACKEND_URL`, read at **build** time — without it the
  hosted site shows the welcome page but no data. Backend = `backend/Dockerfile` on Render (`render.yaml`, free:
  0.1 CPU / 512 MB, sleeps after 15 min). The image bakes the seeded DB and `services/opendata.precompute()`
  (the 1,970-history scan, ~30 s at 0.1 CPU; cache keyed on bundles + source, ignored if stale). Cold start ≈ 35 s;
  `store.init` retries for 3 min and shows "Waking up the NWIS server" meanwhile.
- The risk scenario is tuned: changing weights, event depths or `seed/parameters.py` precursors can move alert
  depths — re-run `tests.scenario_sweep` and `pytest`.
- Scenario runner (`lib/store.ts`): a fresh run clears alerts (`POST /api/risk/alerts/clear`) and restores the
  default radius so it is reproducible; `scenarioRun` tokens stop superseded loops; alert toasts are announced
  even for superseded evaluation responses (alerts are only reported as new once).

## Conventions

- Backend services are pure functions over SQLAlchemy sessions; routers stay thin.
- Every user-visible insight must carry provenance (document, page, well, depth).
- Colour is for status/identity only; values and labels use text tokens. Multi-well series use `SERIES_COLORS`
  (active well = brand indigo first). Severity colours: `SEVERITY_STYLE` (`hex` fills, `ink` text, `gradient`
  for toasts/hero cards); risk families: `FAMILY_META` + `FamilyIcon`; strata: `FORMATION_COLORS`.
- The demo field is disclosed once, not repeated: welcome screen ("Demo field modelled on real Upper Assam geology —
  illustrative wells, not Oil India records"), rail "Demo field" chip, deck title, API disclaimer. Never present it as
  OIL data; don't re-add per-card badges. The *Real data* screen is the only real (public) data — keep it separate.
- The learned model (`services/risk_model.py`) is a cross-check only — it must never change scores or alerts.
