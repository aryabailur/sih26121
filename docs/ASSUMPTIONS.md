# Assumptions, deviations and limitations

## Data

- All data is **synthetic** (realistic wells on real Upper Assam stratigraphy — Girujan, Tipam, Namsang, Barail,
  Kopili, Sylhet). It is disclosed once per surface rather than on every label: the welcome screen, the rail's
  "Demo data" chip (hover for details), the pitch deck title slide, and
  the API (`/api/health`, `/api/simulation/state`). It is never presented as Oil India data.
- Field name "Dikhow East (Demo Field)" and regional block names are fictional; coordinates follow the spec
  (≈27.25 °N, 95.35 °E, Upper Assam Shelf).
- IDs are readable strings (`W001`, `EV-W002-01`, `DOC-W002-DDR42`) instead of UUIDs so citations stay legible.

## Deviations from `SIH26121_MASTER_BUILD.md` (and why)

| Spec | Implementation | Reason |
|---|---|---|
| 1 active + 10 offsets | + 4 regional offsets at 28–47 km (W012–W015) | All ten spec offsets lie within 2 km, so a 5–50 km radius slider would never change anything. With the regional wells, 25 km still shows exactly the ten spec offsets and 50 km shows 14. |
| Radius slider 5–50 km | Stepped 0.5–50 km | Lets the radius actually filter the core cluster (1.5 km → 4 offsets). |
| Risk weights 0.30/0.25/0.15/0.15/0.10/0.05, proximity to zone centre | 0.30/0.20/0.10/0.10/0.25/0.05, proximity to the offset **event** window | With the spec values the static factors alone put the bit "high" at 3,100 m (zone RZ01 starts at 3,100 m), so the scenario could not distinguish approaching from entering. The spec thresholds (0.35/0.55/0.75) are unchanged. |
| Alert at ≥0.55 for every zone | Medium/low-history zones need ≥0.75 | Alarm rationalisation — otherwise the lower-Kopili torque window would raise a fourth alert without live evidence. |
| Mud loss alert "HIGH" at 3,150 m | HIGH at 3,150 m, escalates to CRITICAL at 3,160 m | Live ECD/MW anomalies confirm the risk one step later; the escalation is recorded in the audit trail. |
| RiskZone RZ04 contributing wells: W008 | Live evidence also includes W005's overpressure at the Sylhet top | Added as a corroborating event; the stored zone keeps the spec's contributing-well list. |
| 200 parameter samples 3,000–3,500 m | Every 2.5 m from 3,000 to 3,800 m (+ every 10 m above) | The spec's kick precursor is at 3,580 m, outside 3,000–3,500 m. |
| Documents: 15–20 | 26 (+ 1 sample upload) | Every seeded event needs a real source page; regional wells and the active well's own programme added. |
| Shadcn UI | Hand-built primitives in `components/ui` | Same pattern (Tailwind-styled, accessible) without an interactive generator. |
| MapLibre/Mapbox | MapLibre GL JS v6 (globe + 3D terrain) with key-free tiles: Esri World Imagery + reference labels, OpenFreeMap vector streets, AWS Terrarium DEM | No token needed; well, path, tower and risk layers still render if tiles are offline. |
| Dark industrial cockpit only | Two themes: **Daylight** (default) and **Night shift** (dark), toggled in the rail and remembered per browser | Team redesign brief: a brighter, friendlier product look; light UIs project better in judge rooms, and the dark control-room palette is one click away. |
| Glassmorphism on panels, sheets and nav | Solid cards; frosted glass only for controls floating over the map | Legibility — solid surfaces read better in daylight and over satellite imagery. |
| Horizontal depth scrubber on the Command Center | Vertical **wellbore navigator** (drag the bit down the strata column); the horizontal ruler stays on Risk Explorer | Depth reads top-to-bottom like a well log, matching how drillers think about the hole. |
| `/` opens the dashboard | `/` is a welcome screen with role select (Drilling engineer / Office analyst / Drilling manager) and a globe fly-in | The role picks the landing workspace; it is still cosmetic (no authentication). |
| LangChain + ChromaDB | Dependency-free hybrid retrieval | Offline, deterministic, runs on any laptop; `EmbeddingProvider` is the swap point. |
| "Predictive analytics models" | Explainable hand-set score drives alerts; a logistic model backtested leave-one-well-out on the offsets cross-checks it (`services/risk_model.py`) | Keeps alerts transparent and the tuned scenario stable while still learning from history (AUC ≈ 0.86 vs 0.76). Pure Python — no ML dependencies. |
| OCR adapter (optional) | Tesseract via `pytesseract` in the base requirements; binary auto-discovered; scanned sample report included | OCR is demonstrable end to end; scanned pages report word confidence and still go through human review. |
| (not in spec) Subsurface view | **Subsurface 3D** (three.js): cut-away block of the wells within 5 km — formation tops interpolated between wells by inverse-distance weighting, true well paths from the surveys (TVD), events at their depth, hazard windows as sleeves on the active plan, a depth plane that follows the bit. Depth drawn ×0.6 | A visual correlation aid, **not a geological model**: surfaces are interpolated only from the offsets' picked tops. Uses the same evaluation as the map, so alerts, links and "Why?" agree. Needs WebGL; Esri imagery on the ground plane falls back to a flat colour offline. |
| (not in spec) Look-ahead brief | `GET /api/risk/brief` + Brief screen: hazard windows in the next N m (150/300/500/to TD) for shift handover and drill-the-well-on-paper | Projected severity scores each window **from offset history only** (bit at the window top, live-parameter factor = 0) — no future parameters are used. Likelihood = offsets that hit the window ÷ offsets drilled to that depth; expected NPT = likelihood × mean NPT per affected offset; worst case = the largest per-offset NPT per window. Never records alerts. |
| NPT cost | ₹ exposure = NPT hours ÷ 24 × a **rig spread rate of ₹30 lakh/day** (editable on the Brief, stored per viewer) | An illustrative onshore spread rate, not an OIL contract figure — replace with the actual rate. |
| (not in spec) Spoken alerts | Browser speech synthesis reads each new/escalated alert once; **off by default**, toggled in the top bar | Hands-free for the driller's cabin; no audio leaves the browser. |
| (not in spec) Command palette | Ctrl K or `/`: jump to screens, wells, depths (≥ 100 m) and hazard windows; run demo actions; hand a question to Ask | Keyboard-first navigation for office users; the same actions exist as buttons. |
| Trajectories payload | `/api/wells/trajectories` points now include `tvd` | Needed for true-vertical positioning in 3D; additive, older clients ignore it. |
| Demo-data wording | "Demo field modelled on real Upper Assam geology — illustrative wells, not Oil India records" (welcome, rail chip "DEMO FIELD", deck title, API disclaimer) | Same honesty as before, less apologetic; it now points to the real-data proof. |
| (not in spec) Real-data proof | `/api/opendata/*` + *Real data* screen: every published exploration-wellbore history on the Norwegian shelf (Sodir FactPages, **NLOD 2.0**, retrieved 30 Sep 2026) run through the same event extractor (narrative mode), plus the offset analysis on real formation tops, mud weights and leak-off tests (Sleipner–Volve–Johan Sverdrup area, quadrants 15–16) | OIL records are confidential, so the pipeline is proven on the largest public archive of operator well histories. Kept **separate** from the demo knowledge base — it never touches the tuned scenario. Bundle committed (`backend/data/opendata/`) so it runs offline; rebuild with `python -m opendata.sodir`. Reports/logs linked from the FactPages may carry third-party rights — NWIS links to them, never copies them. |
| Extraction accuracy claim | **Held-out** spot-check: prose rules tuned on quadrants 15–16, then frozen; 50 extractions from other wellbores hand-checked against their sentences → 94 % real incidents of the right type (47/50), 94 % right depth (29/31). Labels in `backend/opendata/spotcheck.json` | Precision only — recall is not measured. Labelled by the development team, not by drilling engineers; `tests/test_opendata.py` fails if the extractor stops producing a labelled event (re-label after changing rules). |
| Prose extraction (narrative mode) | `extract_events(..., narrative=True)` for well histories: depth only from the triggering sentence (nearest mention), follow-on sentences only of the same risk family, planning/tool/pressure-survey guards, depth-less back-references dropped | Learned from real text: "kick-off" is a sidetrack, mud-programme depths leak into neighbouring events, "no shallow gas" is negation. Upload/DDR mode keeps its original behaviour (only the kick-off and negation fixes apply to both). |

## Known limitations

- Alert weights and thresholds are hand-set; the learned cross-check is fitted on the synthetic field, so its numbers show the method, not field accuracy.
- Concept-hash embeddings approximate semantics through a domain synonym lexicon; they are not a neural encoder.
- Event extraction is rule-based and tuned to drilling-report English; it will miss unusual phrasing (those
  documents still get chunked and become searchable).
- Scanned PDFs need the Tesseract binary installed — without it, scanned pages are flagged, not read. English only (`eng` traineddata).
- Similarity is computed against the active well only (on demand for others).
- One active well; no authentication; the role only picks the landing screen and label.
- The map imagery and terrain need internet; everything else is offline.
- The 3D map needs WebGL with hardware acceleration for smooth animation (software rendering works, slowly).
- The subsurface block interpolates formation tops between wells (IDW); between and beyond the wells it is a
  smooth guess, not seismic-constrained. The brief's expected NPT is a simple frequency estimate on ≤ 10 offsets.

## Next three improvements

1. Real data connectors: eRTMAC/WITSML → `ParameterSample`; OIL report archive → batch ingest; PostgreSQL + pgvector.
2. Calibration: fit factor weights and alert thresholds on labelled historical NPT events per risk family,
   report precision/recall, keep the factors and explanations unchanged.
3. Closed loop: capture acknowledgements and outcomes as new lessons; generate pre-spud offset-review packs for
   planned wells.
