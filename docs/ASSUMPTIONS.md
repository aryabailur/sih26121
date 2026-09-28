# Assumptions, deviations and limitations

## Data

- All data is **synthetic** and labelled as such in the UI (top bar "Demo mode", sidebar "Synthetic data",
  document badges) and API (`/api/health`, `/api/simulation/state`).
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
| MapLibre/Mapbox | Leaflet + Esri tiles | No token needed; vector layers render offline. |
| LangChain + ChromaDB | Dependency-free hybrid retrieval | Offline, deterministic, runs on any laptop; `EmbeddingProvider` is the swap point. |

## Known limitations

- Weights and thresholds are hand-set; no statistical calibration.
- Concept-hash embeddings approximate semantics through a domain synonym lexicon; they are not a neural encoder.
- Event extraction is rule-based and tuned to drilling-report English; it will miss unusual phrasing (those
  documents still get chunked and become searchable).
- Scanned PDFs need Tesseract (optional dependency) — without it, scanned pages are reported, not read.
- Similarity is computed against the active well only (on demand for others).
- One active well; no authentication; the role label is cosmetic.
- The map basemap needs internet; everything else is offline.

## Next three improvements

1. Real data connectors: eRTMAC/WITSML → `ParameterSample`; OIL report archive → batch ingest; PostgreSQL + pgvector.
2. Calibration: fit factor weights and alert thresholds on labelled historical NPT events per risk family,
   report precision/recall, keep the factors and explanations unchanged.
3. Closed loop: capture acknowledgements and outcomes as new lessons; generate pre-spud offset-review packs for
   planned wells.
