# Build guidance (companion documents)

Two companion documents shaped the build alongside `SIH26121_MASTER_BUILD.md`. Their key guidance, and where it
landed in the product:

## "SIH26121 NWIS — 16-Hour Build Package & Master Prompt"

| Guidance | Where it is implemented |
|---|---|
| Build a decision cockpit, not a chatbot; the chat/search is one interface into the evidence | Six-screen cockpit; Evidence Search is one screen |
| Killer workflow: active well → depth → offsets → events → evidence → similarity → risk → checks → engineer decision | Command Center + depth scrubber + Why? view |
| Every alert answers WHAT / WHERE / WHEN / WHY / WHICH wells / WHAT evidence / WHAT to check / HOW confident | `RiskAssessment` fields, RiskCard, WhyExplainer |
| Explainable hybrid score, no fake precision | `services/risk_engine.py`, Risk Explorer model card |
| Seed deliberate stories (Barail losses, Kopili stuck pipe, lower-Kopili torque, Sylhet kick, cementing) and make the active well approach them | `seed/field.py`, scenario 3,100 → 3,600 m |
| Provenance on every extracted fact (source, page/section, well, depth, date) | `DrillingEvent` source fields, SourceViewer |
| Depth scrubber as signature interaction; "Run Historical Risk Scenario"; deterministic offline demo mode; reset | `DepthScrubber`, store scenario runner, `/api/simulation/*` |
| Screens A–F | `/dashboard`, `/nearby`, `/well/[id]`, `/search`, `/risk`, `/documents` (+ `/compare`) |
| High-impact extras: similarity score, event clustering, compare mode, acknowledgement, audit trail | All implemented |
| Presentation checklist: open with the problem, show the map, trigger one alert live, click Why?, say "decision support", distinguish synthetic data, keep an offline path, have screenshots | `docs/DEMO_SCRIPT.md`, `docs/screenshots/` |

## "From Mock Data to a Million-Dollar Demo — 16-Hour Blueprint"

| Guidance | Where it is implemented |
|---|---|
| High-fidelity synthetic DDRs/WCRs with formations, mud weights, casing programmes and mitigations | `seed/corpus.py` (26 reports) |
| Geospatial JSON with offset wells and historical risks | `seed/field.py` |
| Simulated eRTMAC stream with a scripted anomaly (pressure drop) that fires an alert | `seed/parameters.py` precursors; SPP drop + drilling break at 3,580 m |
| Industrial HMI: dark background, colour reserved for status, alarm-fatigue avoidance | Tailwind tokens, status-only colour, alert policy |
| Glassmorphism on panels, sheets and nav (moderate blur, legible text) | `glass` / `glass-strong` utilities |
| Sparklines next to KPIs; data-freshness indicators; stale values visibly marked | KPIStrip sparklines; "Last update" freshness (struck-through when stale); hatched paused feed |
| Transparent decision trail for every AI output; show the exact source sentences | Why? view; evidence cards with highlighted excerpts |
| Role-aware experience hint | Role label in the top bar (full RBAC is out of scope) |
| RAG over the reports (LangChain + ChromaDB suggested) | Dependency-free hybrid retrieval with the same contract; optional Claude synthesis |
