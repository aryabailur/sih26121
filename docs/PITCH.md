# NWIS — pitch content

## One line

**NWIS gives every drilling engineer institutional memory — connecting the active well's current depth to
what nearby and historical wells experienced, why it happened, and what to check next.**

## 30 seconds

Today, critical drilling knowledge is distributed across completion reports, daily reports, databases and
individual experience. NWIS turns that fragmented history into a depth-aware intelligence layer alongside
real-time monitoring. It maps nearby wells, correlates formations and events, retrieves evidence from
historical reports, compares similar wells, and raises explainable risk alerts before the active well reaches
historically difficult intervals. The engineer stays in control; NWIS makes the relevant institutional memory
available at the moment it matters.

## The insight (one slide)

> Engineers don't lack data — they lack the link between *this depth, right now* and *what happened at this
> depth before*. NWIS is that link.

## Demo-field numbers (synthetic — say so)

- 10 offset wells within 25 km; 36 recorded drilling events; 26 reports indexed into 84 searchable pages.
- In the three windows OIL-AX-102 is about to drill (Barail losses, Kopili stuck pipe, Sylhet kick), offsets
  recorded **8 events and 110 hours of NPT**. NWIS surfaces each one before the bit gets there, with the
  mitigation that worked.

## 10-slide deck outline

| # | Slide | Content | Speaker note |
|---|---|---|---|
| 1 | Title | NWIS — Nearby Wells Intelligence System · SIH26121 · team | "Institutional memory beside the active well." |
| 2 | Problem | Knowledge scattered in DDRs, WCRs, mud logs, people; engineers search manually; risks repeat | Open with the operational pain, not tech |
| 3 | Insight | "This depth, right now ↔ what happened here before" | The one idea everything is built on |
| 4 | Solution | Workflow: active well → depth → nearby wells → events → correlation → evidence → risk → alert → checks | Show the chain as one line |
| 5 | Live demo | Scenario run + Why? (see DEMO_SCRIPT.md) | Trigger one alert live |
| 6 | Explainable risk | Six weighted factors, thresholds, alert policy, confidence; "not a black box" | Show the Why? screenshot |
| 7 | Evidence-first AI | Hybrid retrieval, cited answers, insufficient-evidence behaviour; optional LLM grounded on the same evidence | "No answer without a source page" |
| 8 | Document intelligence | PDF/OCR → extraction → dedupe → human review → knowledge base | Engineers stay the gatekeepers of what becomes knowledge |
| 9 | Architecture & integration | FastAPI + Next.js; eRTMAC/WITSML, OIL archive, PostgreSQL/pgvector, SSO — plug-in points | Standalone layer beside eRTMAC, not a replacement |
| 10 | Impact & next steps | Faster offset review, fewer repeated NPT events, onboarding of new engineers; next: real data, calibrated weights, closed-loop lessons | End: "decision support — the engineer decides" |

## What makes it stand out

1. **Not another dashboard** — it connects current context with historical institutional memory.
2. **Not another RAG chatbot** — answers are tied to well + depth + formation + evidence.
3. **Not a black-box model** — risk is explainable and operationally contextual.
4. **Not just GIS** — map, depth correlation, documents and risk are synchronised on one depth.
5. **Not just document search** — unstructured reports become structured events and lessons.
6. **A standalone intelligence layer** that sits beside eRTMAC rather than replacing it.

## Anticipated judge questions

- *Is this real OIL data?* No — a coherent synthetic field; the schema and ingestion path are built for authorised data.
- *How accurate is the prediction?* The prototype ranks risk transparently; it is not a calibrated probability.
  Calibration on labelled OIL NPT history is the first production step (weights stay explainable).
- *Why not an LLM for everything?* Deterministic, offline, auditable answers for the demo; an optional Claude
  adapter synthesises answers over the same cited evidence and is rejected if it cites nothing.
- *Won't it spam alerts?* Alarm-rationalisation policy: medium-history windows need live confirmation; alerts
  are deduplicated per zone and escalate instead of repeating.
- *What about scanned reports?* The OCR adapter uses Tesseract when installed and otherwise flags scanned pages
  for OCR instead of silently dropping them.
