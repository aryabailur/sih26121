# NWIS — notes for Claude / contributors

SIH26121 prototype: FastAPI backend (`backend/`) + Next.js 16 cockpit (`frontend/`). Spec: `SIH26121_MASTER_BUILD.md`.
Deviations from the spec are recorded in `docs/ASSUMPTIONS.md` — keep that table current when you change behaviour.

## Run

- Backend: `cd backend && .venv\Scripts\python.exe -m uvicorn main:app --port 8000` (no `--reload` by default —
  restart after Python changes). `python seed_data.py` rebuilds the DB; an empty DB is auto-seeded at startup.
- Frontend: `cd frontend && npm run dev` — `/api/*` is proxied to the backend via `next.config.ts` rewrites.
- Tests: `cd backend && python -m pytest -q`. Scenario sanity check: `python -m tests.scenario_sweep`
  (expected: mud loss alert first at 3,150, stuck pipe at 3,380, kick at 3,580; nothing alert-eligible at 3,100).
- Frontend checks: `npx tsc --noEmit`, `npx eslint .`, `npm run build`.

## Things that bit us

- **Next.js 16**: read `frontend/node_modules/next/dist/docs/` before using framework APIs (async `params`,
  `useSearchParams` needs a `<Suspense>` boundary, no `next lint`).
- **Recharts vertical layout**: a numeric Y axis already has its minimum at the top; do **not** add `reversed`
  (it desyncs `Line` geometry from `ReferenceArea`/`ReferenceLine`). See `components/well/ParameterChart.tsx`.
- **React hooks lint (v7)**: no setState synchronously in effects, no ref writes during render — key child
  components on their target instead (see `WhyExplainer`, `SourceViewer`).
- **Windows**: edit files with the editor tools, not PowerShell `Get-Content`/`Set-Content` (they re-encode UTF-8
  and corrupt `–`, `·`, `≥`). Git-Bash needs `MSYS_NO_PATHCONV=1` when passing `/dashboard`-style args.
- The risk scenario is tuned: changing weights, event depths or `seed/parameters.py` precursors can move alert
  depths — re-run `tests.scenario_sweep` and `pytest`.

## Conventions

- Backend services are pure functions over SQLAlchemy sessions; routers stay thin.
- Every user-visible insight must carry provenance (document, page, well, depth).
- Colour is for status/identity only; values and labels use text tokens. Multi-well series use `SERIES_COLORS`
  (validated palette, active well first).
- Synthetic data must stay labelled as synthetic in UI and API.
