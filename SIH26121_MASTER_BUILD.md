# SIH26121 — NWIS: COMPLETE AUTONOMOUS BUILD SPECIFICATION
## Smart India Hackathon 2026 | Oil India Limited | Nearby Wells Intelligence System

> This is the master build specification the project was built from. Companion guidance
> (the "16-Hour Build & Master Prompt" and "Mock Data to Demo" blueprints) is summarised in
> `docs/BUILD_GUIDANCE.md`. Where the implementation deliberately deviates from this spec,
> the deviation is recorded in `docs/ASSUMPTIONS.md`.

---

## 🚨 ABSOLUTE RULES — READ FIRST, NEVER VIOLATE

1. **ASK ZERO QUESTIONS.** You are simultaneously the Product Manager, Lead Architect, Senior Frontend Engineer, Senior Backend Engineer, AI/ML Engineer, Data Engineer, UX Designer, and DevOps Engineer. Make every decision yourself. When in doubt, choose the simplest working option.
2. **WRITE COMPLETE CODE.** Never use `// ... rest of code`, `/* implement later */`, or placeholder comments. Every file must be fully functional and copy-paste runnable.
3. **EXECUTE SEQUENTIALLY.** Follow the phases exactly. Do not skip. Do not reorder. Build file-by-file.
4. **NO GENERIC SAAS.** This is a dark industrial drilling operations cockpit, not a startup landing page. Every pixel must communicate "oilfield command center."
5. **DEMO DATA IS SACRED.** All synthetic data must be internally consistent, geographically plausible (Assam basin, India), and contain the exact seed stories specified below. Never present synthetic data as real OIL data — label it "Demo Mode" visibly.
6. **EVIDENCE-FIRST AI.** The AI search must NEVER produce an unsupported claim. Every answer must cite a source document, page, well name, and depth range.
7. **EXPLAINABLE RISK.** Never show a mysterious "AI says High Risk." Every alert must show WHAT, WHERE, WHEN, WHY, WHICH historical wells, WHAT evidence, and WHAT to check.
8. **OFFLINE-READY.** The core demo must work without any external API calls. Use local/mock embeddings. The demo mode must be deterministic.
9. **OUTPUT PROTOCOL:** For each file, announce the filename, write the complete code block, then move to the next file. If you hit your output limit, stop at the end of a complete file. The user will say "continue" and you resume.

---

## 📋 SECTION 1: PROBLEM STATEMENT REQUIREMENTS (FROM OIL INDIA LIMITED)

### 1.1 Background
Oil India Limited has a digital real-time monitoring system (eRTMAC) providing real-time drilling data, mud logging, and wellsite analytics. However, drilling decisions in geologically complex formations require insights from nearby and historical wells. Historical knowledge is scattered across well completion reports (WCRs), daily drilling reports (DDRs), PDF documents, and individual memory. This causes delays and missed risk mitigation opportunities.

### 1.2 Problem Description — The platform must:
- **(P1)** Display nearby wells on a geospatial map relative to the active well.
- **(P2)** Provide instant access to historical drilling experiences and operational events from offset wells.
- **(P3)** Correlate drilling parameters, reservoir characteristics, mud losses, kicks, stuck pipe incidents, casing programs, cementing practices, and formation-specific risks across wells.
- **(P4)** Generate proactive alerts when current drilling operations approach depths or formations where similar challenges were encountered in nearby wells.

### 1.3 Expected Solution — The NWIS must:
- **(S1)** Use AI, NLP, OCR, and data analytics to automatically extract and structure information from historical drilling reports and well documents.
- **(S2)** Provide an interactive map-based visualization of nearby wells within a user-defined radius.
- **(S3)** Create a searchable knowledge repository of drilling events, lessons learned, operational challenges, and mitigation measures.
- **(S4)** Correlate geological, drilling, and reservoir data across wells based on depth and formation.
- **(S5)** Develop predictive analytics models that identify potential drilling risks: mud losses, stuck pipe, overpressure zones, torque spikes, cementing issues based on historical offset-well behaviour.
- **(S6)** Generate real-time alerts and recommendations for proactive decision-making.
- **(S7)** Present information through a user-friendly dashboard for field and office-based personnel.

### 1.4 Data Sources (to be simulated):
- Well Completion Reports (WCRs)
- Daily Drilling Reports (DDRs)
- Drilling and mud logging databases
- Historical well parameters and drilling records
- Reservoir and geological data
- eRTMAC data streams
- Well trajectory and survey data
- Casing, cementing, and mud program records
- Historical operational event records (mud losses, kicks, stuck pipe, fishing operations, NPT events)

### 1.5 Requirement-to-Feature Mapping (VERIFY ALL ARE BUILT):

| PS Req | NWIS Feature | Demo Proof |
|--------|-------------|------------|
| P1, S2 | Interactive GIS map with radius slider, active well, offset wells, trajectory/depth filters | Select active well → 25km radius → click offset well |
| P2, S3 | Document intelligence + event timeline + evidence viewer | Search "stuck pipe at 3400m" → get cited answer |
| P3, S4 | Depth/formation alignment, parameter comparison, event overlays | Compare active vs 3 offset wells on same depth axis |
| S1 | PDF ingestion → OCR adapter → chunking → extraction → structured events | Upload report → extracted event cards appear |
| S5 | Risk engine for losses, stuck pipe, overpressure, torque, cementing | Risk cards update as depth scrubber moves |
| S6, P4 | Depth-aware alert engine with lead distance and confidence | Enter risk zone → alert appears with "Why?" |
| S7 | Operations cockpit + map + timeline + analytics + evidence | Single-screen executive demo |

---

## 📋 SECTION 2: COMPLETE DATA MODEL

Implement these exact Pydantic/SQLAlchemy models. Every field is specified.

### 2.1 Well
```
id: str (UUID)
name: str (e.g., "OIL-AX-102")
status: enum ["active", "completed", "abandoned", "drilling"]
field: str (e.g., "Baghewala")
basin: str (e.g., "Upper Assam Shelf")
latitude: float
longitude: float
spud_date: date
total_depth_md: float (measured depth in meters)
current_depth_md: float (for active well)
total_depth_tvd: float (true vertical depth)
well_type: str (e.g., "development", "exploration")
formation_target: str
```

### 2.2 SurveyPoint (Well Trajectory)
```
id: str (UUID)
well_id: str (FK → Well)
md: float (measured depth)
tvd: float (true vertical depth)
inclination: float (degrees)
azimuth: float (degrees)
latitude: float
longitude: float
```

### 2.3 Formation
```
id: str (UUID)
well_id: str (FK → Well)
name: str (e.g., "Barail Group", "Girujan Shale", "Tipam Sandstone", "Namsang Formation")
top_md: float
base_md: float
lithology: str (e.g., "sandstone", "shale", "limestone")
risk_tags: list[str] (e.g., ["overpressure", "unstable"])
```

### 2.4 Document
```
id: str (UUID)
well_id: str (FK → Well)
title: str (e.g., "DDR OIL-AX-99 Day 45")
doc_type: enum ["DDR", "WCR", "mud_log", "casing_report", "cementing_report", "NPT_report"]
date: date
source_status: enum ["original", "synthetic_demo"]
file_path: str (optional)
```

### 2.5 DocumentChunk
```
id: str (UUID)
document_id: str (FK → Document)
text: str (the chunk content)
page: int
section: str
depth_start: float (nullable)
depth_end: float (nullable)
embedding: vector (if using vector DB)
```

### 2.6 DrillingEvent (CRITICAL — this is the knowledge core)
```
id: str (UUID)
well_id: str (FK → Well)
event_type: enum ["mud_loss", "stuck_pipe", "kick", "overpressure", "torque_spike", "wellbore_instability", "cementing_failure", "fishing", "NPT", "lost_circulation", "differential_sticking"]
depth_start: float
depth_end: float
formation: str (FK → Formation.name)
severity: enum ["low", "medium", "high", "critical"]
date: date
description: str (detailed narrative)
root_cause: str
mitigation_action: str
lessons_learned: str
npt_hours: float (non-productive time)
source_document_id: str (FK → Document)
source_page: int
source_section: str
```

### 2.7 ParameterSample (Simulated eRTMAC feed)
```
id: str (UUID)
well_id: str (FK → Well)
md: float
timestamp: datetime
rop: float (rate of penetration, m/hr)
wob: float (weight on bit, kN)
torque: float (kN·m)
rpm: float
flow_rate: float (l/min)
standpipe_pressure: float (psi)
mud_weight: float (sg)
ecd: float (equivalent circulating density, sg)
hook_load: float (kN)
pump_pressure: float (psi)
```

### 2.8 RiskZone
```
id: str (UUID)
formation: str
depth_start: float
depth_end: float
risk_type: enum (same as DrillingEvent.event_type)
severity: enum ["low", "medium", "high", "critical"]
historical_frequency: float (events per well in this zone)
contributing_wells: list[str] (well_ids)
```

### 2.9 Alert
```
id: str (UUID)
well_id: str (FK → Well)
triggered_at_depth: float
risk_type: str
score: float (0.0 to 1.0)
confidence: float (0.0 to 1.0)
lead_depth: float (meters ahead of current depth)
reasons: list[str] (human-readable explanations)
evidence_ids: list[str] (FK → DrillingEvent)
supporting_wells: list[str] (well_ids)
recommendation: str
status: enum ["active", "acknowledged", "dismissed", "reviewed"]
created_at: datetime
```

### 2.10 Recommendation
```
id: str (UUID)
risk_type: str
text: str
rationale: str
source_event_ids: list[str]
```

### 2.11 WellSimilarity
```
well_a_id: str
well_b_id: str
score: float (0.0 to 1.0)
formation_overlap: float
depth_coverage: float
trajectory_similarity: float
parameter_similarity: float
reasons: list[str]
```

---

## 📋 SECTION 3: SYNTHETIC SEED DATA (EXACT VALUES — DO NOT DEVIATE)

### 3.1 Geographic Context
All wells are in the **Upper Assam Shelf basin**, near Duliajan, Assam, India.
Base coordinates: approximately **27.25°N, 95.35°E**.

### 3.2 Wells (1 Active + 10 Offset)

| well_id | name | role | lat | lon | total_depth | current_depth | status |
|---------|------|------|-----|-----|-------------|---------------|--------|
| W001 | OIL-AX-102 | ACTIVE | 27.2510 | 95.3520 | 3800 | 3100 | drilling |
| W002 | OIL-AX-99 | offset | 27.2580 | 95.3610 | 3650 | 3650 | completed |
| W003 | OIL-AX-88 | offset | 27.2450 | 95.3450 | 3720 | 3720 | completed |
| W004 | OIL-AX-77 | offset | 27.2620 | 95.3380 | 3580 | 3580 | completed |
| W005 | OIL-AX-66 | offset | 27.2390 | 95.3590 | 3900 | 3900 | completed |
| W006 | OIL-AX-55 | offset | 27.2550 | 95.3700 | 3450 | 3450 | completed |
| W007 | OIL-AX-44 | offset | 27.2430 | 95.3350 | 3600 | 3600 | completed |
| W008 | OIL-AX-33 | offset | 27.2670 | 95.3550 | 3750 | 3750 | completed |
| W009 | OIL-AX-22 | offset | 27.2480 | 95.3680 | 3500 | 3500 | completed |
| W010 | OIL-AX-11 | offset | 27.2600 | 95.3470 | 3680 | 3680 | completed |
| W011 | OIL-AX-05 | offset | 27.2350 | 95.3500 | 3550 | 3550 | completed |

### 3.3 Formations (shared across wells, with slight depth variations)

| Formation Name | Top MD (approx) | Base MD (approx) | Lithology | Risk Tags |
|---------------|-----------------|------------------|-----------|-----------|
| Girujan Shale | 0 | 800 | shale | ["wellbore_instability"] |
| Tipam Sandstone | 800 | 1600 | sandstone | [] |
| Namsang Formation | 1600 | 2400 | sandstone/shale | ["overpressure"] |
| Barail Group | 2400 | 3300 | sandstone/shale | ["mud_loss", "overpressure"] |
| Kopili Shale | 3300 | 3600 | shale | ["stuck_pipe", "wellbore_instability"] |
| Sylhet Limestone | 3600 | 3900 | limestone | ["kick", "lost_circulation"] |

### 3.4 MANDATORY SEED STORIES (These MUST exist in the data)

**Story 1: Mud Loss in Barail Group (W002 — OIL-AX-99)**
- Event: Severe mud loss (lost circulation)
- Depth: 3150m to 3220m
- Formation: Barail Group
- Severity: critical
- Date: 2023-03-15
- Description: "Total loss of circulation encountered at 3150m while drilling through fractured Barail sandstone. Mud weight was 1.42 sg. Lost 45 m³ of OBM over 6 hours."
- Root Cause: "Natural fractures in Barail sandstone exacerbated by high ECD (1.52 sg)."
- Mitigation: "Reduced mud weight to 1.38 sg, pumped LCM pills (calcium carbonate + graphite), cured losses after 18 hours."
- NPT: 18 hours
- Source: DDR OIL-AX-99 Day 42, Page 3

**Story 2: Stuck Pipe in Kopili Shale (W003 — OIL-AX-88)**
- Event: Stuck pipe (differential sticking)
- Depth: 3380m to 3420m
- Formation: Kopili Shale
- Severity: high
- Date: 2022-11-08
- Description: "Pipe stuck at 3400m during connection. Overpull of 80 kN. Shale swelling observed in cuttings."
- Root Cause: "Reactive Kopili shale swelling due to inadequate KCl inhibition in mud system. Hole left open for 45 minutes during BHA change."
- Mitigation: "Spotted 15 m³ of diesel-based spotting fluid, worked pipe for 12 hours, freed at 120 kN overpull. Increased KCl to 7% in mud system."
- NPT: 36 hours
- Source: DDR OIL-AX-88 Day 55, Page 7

**Story 3: Stuck Pipe in Kopili Shale (W005 — OIL-AX-66)**
- Event: Stuck pipe (mechanical)
- Depth: 3390m to 3430m
- Formation: Kopili Shale
- Severity: high
- Date: 2021-06-22
- Description: "Mechanical sticking at 3410m due to key seating in dogleg. Torque increased from 12 kN·m to 28 kN·m over 30 minutes."
- Root Cause: "Key seat formation at 3400m dogleg (8°/30m). Insufficient reaming during trip out."
- Mitigation: "Back-reamed to 3350m, reamed down with under-reamer, freed pipe. Modified tripping procedures to include reaming every stand."
- NPT: 24 hours
- Source: DDR OIL-AX-66 Day 48, Page 5

**Story 4: Torque Spikes (W004 — OIL-AX-77)**
- Event: Torque/drag anomaly
- Depth: 3500m to 3540m
- Formation: Kopili Shale (lower section)
- Severity: medium
- Date: 2022-02-14
- Description: "Progressive torque increase from 14 kN·m to 32 kN·m while drilling 3500-3540m. Intermittent stick-slip observed."
- Root Cause: "Poor hole cleaning in high-angle section (35°). Cuttings bed accumulation in Kopili shale."
- Mitigation: "Increased flow rate from 1800 to 2200 l/min, rotated off-bottom at 120 RPM for 30 min every 2 stands. Torque normalized."
- NPT: 8 hours
- Source: DDR OIL-AX-77 Day 60, Page 2

**Story 5: Kick/Overpressure (W008 — OIL-AX-33)**
- Event: Kick (gas influx)
- Depth: 3580m to 3610m
- Formation: Sylhet Limestone (top)
- Severity: critical
- Date: 2023-08-05
- Description: "Gas kick detected at 3590m. Pit gain of 3.2 m³. Flow check positive. Shut-in drill pipe pressure 450 psi."
- Root Cause: "Unexpected overpressure zone at top of Sylhet Limestone. Pore pressure exceeded mud weight (1.45 sg vs estimated 1.38 sg)."
- Mitigation: "Shut in well, circulated kill mud (1.55 sg) using Driller's Method. Well controlled after 6 hours. Increased mud weight to 1.52 sg for subsequent section."
- NPT: 12 hours
- Source: DDR OIL-AX-33 Day 51, Page 9

**Story 6: Cementing Failure (W007 — OIL-AX-44)**
- Event: Cementing issue
- Depth: 2800m to 2850m
- Formation: Barail Group (upper)
- Severity: medium
- Date: 2021-12-10
- Description: "Poor cement bond log in 9-5/8\" casing across Barail Group. Channeling detected from 2800-2850m."
- Root Cause: "Inadequate mud removal due to low flow rates during cementing. Eccentric casing in deviated section."
- Mitigation: "Squeeze cement job performed. CBL re-run showed acceptable bond. Recommendation: use centralizers every 2 joints in deviated sections."
- NPT: 48 hours
- Source: WCR OIL-AX-44, Page 22

### 3.5 Additional Events (generate 25-35 more events distributed across wells)
Include: minor mud losses, small kicks, fishing operations, BHA failures, bit trips, casing running issues, logging problems. Distribute them across different depths and formations to make the data feel realistic.

### 3.6 Risk Zones (derived from seed stories)

| risk_zone_id | formation | depth_start | depth_end | risk_type | severity | frequency | wells |
|-------------|-----------|-------------|-----------|-----------|----------|-----------|-------|
| RZ01 | Barail Group | 3100 | 3250 | mud_loss | critical | 0.4 | W002, W006 |
| RZ02 | Kopili Shale | 3350 | 3450 | stuck_pipe | high | 0.5 | W003, W005, W010 |
| RZ03 | Kopili Shale | 3480 | 3550 | torque_spike | medium | 0.3 | W004, W009 |
| RZ04 | Sylhet Limestone | 3560 | 3620 | kick | critical | 0.2 | W008 |
| RZ05 | Barail Group | 2750 | 2900 | cementing_failure | medium | 0.15 | W007 |

### 3.7 Documents (generate 15-20 mock documents)
- 8 DDRs (Daily Drilling Reports) for wells W002, W003, W004, W005, W008
- 4 WCRs (Well Completion Reports) for wells W002, W003, W007, W008
- 3 Mud Logs for wells W002, W004, W006
- 2 Cementing Reports for wells W007, W005
- Each document should have 3-5 chunks of realistic drilling text (200-500 words each) containing technical details, measurements, and event descriptions.

### 3.8 Parameter Samples (for eRTMAC simulation)
Generate 200 parameter samples for the active well (W001) from depth 3000m to 3500m. Include:
- Normal drilling parameters for most depths
- Anomalous torque increase starting at 3350m (foreshadowing stuck pipe zone)
- Mud weight fluctuations near 3150m (foreshadowing mud loss zone)
- Standpipe pressure drop at 3580m (foreshadowing kick zone)

---

## 📋 SECTION 4: BACKEND API SPECIFICATION (FastAPI)

### 4.1 Project Structure
```
backend/
├── main.py              # FastAPI app, CORS, routers
├── config.py            # Settings, DB URL, paths
├── database.py          # SQLAlchemy engine, session
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic request/response schemas
├── seed_data.py         # Data generation script (RUN ONCE)
├── routers/
│   ├── wells.py         # Well CRUD + nearby wells
│   ├── events.py        # Drilling events
│   ├── formations.py    # Formation data
│   ├── search.py        # AI evidence search
│   ├── risk.py          # Risk evaluation + alerts
│   ├── documents.py     # Document upload + processing
│   └── simulation.py    # eRTMAC simulation + demo mode
├── services/
│   ├── risk_engine.py   # Hybrid risk scoring logic
│   ├── search_engine.py # Hybrid retrieval (keyword + semantic + metadata)
│   ├── similarity.py    # Well similarity calculation
│   └── document_processor.py  # OCR adapter + chunking + extraction
├── data/
│   ├── synthetic_reports/   # Mock DDR/WCR text files
│   └── nwis.db              # SQLite database
└── requirements.txt
```

### 4.2 API Endpoints

**Wells Router (`/api/wells`)**
```
GET /api/wells
  → Returns all wells with basic info
  Response: { wells: [WellSummary] }

GET /api/wells/active
  → Returns the active well with current state
  Response: { well: WellDetail, current_state: CurrentState }

GET /api/wells/{well_id}
  → Returns full well profile
  Response: { well: WellDetail, formations: [Formation], events: [DrillingEvent], survey: [SurveyPoint] }

GET /api/wells/nearby?lat=27.251&lon=95.352&radius_km=25
  → Returns offset wells within radius
  Response: { wells: [WellSummary], distances: {well_id: km} }

GET /api/wells/{well_id}/similarity
  → Returns similarity scores with other wells
  Response: { similarities: [WellSimilarity] }
```

**Events Router (`/api/events`)**
```
GET /api/events?well_id=W002&event_type=mud_loss&depth_min=3000&depth_max=3500
  → Filtered drilling events
  Response: { events: [DrillingEvent], total: int }

GET /api/events/at-depth?depth=3400&formation=Kopili&radius_km=25
  → Events near a specific depth across all nearby wells
  Response: { events: [DrillingEvent], wells_affected: [str] }

GET /api/events/timeline?well_id=W001
  → Chronological events for timeline visualization
  Response: { timeline: [TimelineEvent] }
```

**Formations Router (`/api/formations`)**
```
GET /api/formations?well_id=W001
  → Formation tops for a well
  Response: { formations: [Formation] }

GET /api/formations/correlate?well_ids=W001,W002,W003
  → Cross-well formation correlation
  Response: { correlation: [FormationCorrelation] }
```

**Search Router (`/api/search`)**
```
POST /api/search/evidence
  Body: { query: str, well_id: str|null, formation: str|null, depth_min: float|null, depth_max: float|null, event_type: str|null, top_k: int }
  Response: {
    answer: str,
    confidence: float,
    evidence: [
      {
        chunk_text: str,
        document_title: str,
        document_type: str,
        well_name: str,
        page: int,
        section: str,
        depth_start: float,
        depth_end: float,
        relevance_score: float
      }
    ],
    related_wells: [str],
    suggested_queries: [str]
  }
```

**Risk Router (`/api/risk`)**
```
POST /api/risk/evaluate
  Body: { well_id: str, current_depth: float, parameters: { rop, wob, torque, rpm, flow, pressure, mud_weight, ecd } }
  Response: {
    alerts: [
      {
        risk_type: str,
        score: float,
        confidence: float,
        severity: str,
        lead_depth: float,
        risk_window: { start: float, end: float },
        affected_formation: str,
        reasons: [str],
        contributing_signals: [
          { signal: str, value: float, baseline: float, deviation: str }
        ],
        supporting_wells: [
          { well_id: str, well_name: str, event_type: str, depth: float, date: str }
        ],
        evidence_snippets: [str],
        recommendation: str,
        recommended_checks: [str]
      }
    ],
    overall_risk_level: str,
    next_risk_zone: { type: str, depth: float, distance: float }
  }

GET /api/risk/zones?formation=Kopili
  → All known risk zones
  Response: { zones: [RiskZone] }

POST /api/risk/acknowledge
  Body: { alert_id: str, status: str, notes: str }
  Response: { success: bool }
```

**Documents Router (`/api/documents`)**
```
POST /api/documents/upload
  → Simulated PDF upload (accept file, return processing status)
  Response: { document_id: str, status: "processing" }

GET /api/documents/{doc_id}/status
  → Processing status
  Response: { status: "completed", events_extracted: int, chunks: int }

GET /api/documents/{doc_id}/extracted
  → Extracted events and entities
  Response: { events: [DrillingEvent], entities: [Entity] }
```

**Simulation Router (`/api/simulation`)**
```
GET /api/simulation/ertmac?well_id=W001&depth=3100
  → Simulated real-time parameters at depth
  Response: { parameters: ParameterSample, timestamp: str }

POST /api/simulation/demo-scenario
  → Run the full demo scenario
  Body: { scenario: "mud_loss" | "stuck_pipe" | "kick" }
  Response: { depth_progression: [float], alerts_triggered: [Alert], events_revealed: [DrillingEvent] }

POST /api/simulation/reset
  → Reset demo state
  Response: { success: bool }
```

---

## 📋 SECTION 5: RISK ENGINE LOGIC (Explainable Hybrid Score)

### 5.1 Risk Score Formula
```
risk_score = (
    w1 * proximity_score +      # How close is current depth to a known risk zone?
    w2 * frequency_score +      # How many events occurred in this zone across offset wells?
    w3 * similarity_score +     # How similar are the affected offset wells to the active well?
    w4 * formation_score +      # Does the current formation match historically risky formations?
    w5 * parameter_score +      # Are current drilling parameters anomalous?
    w6 * trajectory_score       # Is the well trajectory similar to wells that had issues?
)

Default weights: w1=0.30, w2=0.25, w3=0.15, w4=0.15, w5=0.10, w6=0.05
```

### 5.2 Proximity Score
```
distance = abs(current_depth - nearest_risk_zone_center)
if distance <= 50m: proximity_score = 1.0
elif distance <= 150m: proximity_score = 1.0 - (distance - 50) / 100
else: proximity_score = 0.0
```

### 5.3 Frequency Score
```
frequency_score = min(1.0, historical_event_count_in_zone / 5.0)
```

### 5.4 Parameter Anomaly Detection
```
For each parameter (torque, pressure, mud_weight, ecd):
    deviation = abs(current_value - baseline_mean) / baseline_std
    if deviation > 2.0: anomaly = True
parameter_score = count(anomalies) / total_parameters
```

### 5.5 Alert Thresholds
```
if risk_score >= 0.75: severity = "critical", trigger alert immediately
elif risk_score >= 0.55: severity = "high", trigger alert with 100m lead
elif risk_score >= 0.35: severity = "medium", show warning card
else: severity = "low", no alert
```

### 5.6 Alert "Why?" Explanation Generator
For every alert, generate human-readable reasons:
```
reasons = []
if proximity_score > 0.5:
    reasons.append(f"Current depth ({current_depth}m) is within {distance}m of a known {risk_type} zone ({zone_start}-{zone_end}m).")
if frequency_score > 0.3:
    reasons.append(f"{event_count} {risk_type} events recorded in this interval across {well_count} offset wells.")
if similarity_score > 0.4:
    reasons.append(f"Active well trajectory and formation profile are {similarity_pct}% similar to {similar_well_name}, which experienced {risk_type} at {event_depth}m.")
if parameter_score > 0.2:
    reasons.append(f"Current {anomaly_param} ({current_val}) is {deviation}x above baseline ({baseline_val}).")
if formation_score > 0.3:
    reasons.append(f"Currently drilling through {formation_name}, which has a history of {risk_type} in this field.")
```

---

## 📋 SECTION 6: FRONTEND ARCHITECTURE

### 6.1 Project Structure
```
frontend/
├── app/
│   ├── layout.tsx           # Root layout, dark theme, font
│   ├── page.tsx             # Redirect to /dashboard
│   ├── dashboard/
│   │   ├── page.tsx         # Screen A: Operations Command Center
│   │   ├── nearby/page.tsx  # Screen B: Nearby Wells
│   │   ├── well/[wellId]/page.tsx # Screen C: Well Intelligence
│   │   ├── search/page.tsx  # Screen D: AI Evidence Search
│   │   ├── risk/page.tsx    # Screen E: Risk Explorer
│   │   └── documents/page.tsx # Screen F: Document Intelligence
│   └── globals.css          # Tailwind + custom dark theme
├── components/
│   ├── layout/   (TopNav, Sidebar, CommandCenter)
│   ├── map/      (FieldMap, WellMarker, RadiusControl, MapLegend)
│   ├── dashboard/(KPIStrip, RiskWatch, DepthTimeline, LiveFeed)
│   ├── well/     (WellProfileDrawer, FormationBands, EventTimeline, ParameterChart, ComparePanel)
│   ├── risk/     (RiskCard, AlertPanel, WhyExplainer, RiskSimulator)
│   ├── search/   (SearchBar, AnswerPanel, EvidenceCard, SourceCitation)
│   ├── documents/(UploadZone, ProcessingStepper, ExtractedEvents)
│   ├── shared/   (DepthScrubber, SimilarityBadge, FilterBar, StatusBadge, GlassCard, DemoModeToggle)
│   └── ui/       (button, card, input, slider, sheet, accordion, badge, toast, tooltip, dialog, select, tabs, progress)
├── lib/ (api.ts, store.ts, types.ts, utils.ts)
└── public/icons/
```

### 6.2 Design Tokens
```
cockpit: bg #0a0e17 · surface #111827 · elevated #1e293b · border #1e3a5f · text #f1f5f9 · muted #94a3b8 · dim #475569
status:  normal #22d3ee · warning #f59e0b · danger #ef4444 · success #10b981 · info #3b82f6
```

### 6.3 Screen Specifications

**SCREEN A: Operations Command Center (`/dashboard`)**
- **Top Bar (60px):** NWIS logo + subtitle | active well selector (default OIL-AX-102) | Current Depth **3100m** | Formation **Barail Group** | "DEMO MODE" badge | last updated | user role
- **KPI Strip:** Current Depth · Formation · ROP · WOB · Torque · ECD — each with a sparkline of the last 20 readings
- **Main Area (60/40):** field map (active well pulsing cyan, offsets, 25km radius) | Risk Watch stack sorted by severity
- **Bottom Panel:** depth timeline 0–3800m with formation bands, event markers, current-depth cursor; contextual line e.g. "At current depth (3100m): 2 offset wells experienced mud loss within 50m of this depth"

**SCREEN B: Nearby Wells (`/dashboard/nearby`)** — full-width map, radius slider (default 25km), filter chips (formation, event type, distance, date), sortable well table (Name, Distance, TD, Similarity, Risk, Events), click → WellProfileDrawer, "Compare Selected".

**SCREEN C: Well Intelligence (`/dashboard/well/[wellId]`)** — header; formation bands; depth-aligned event timeline; parameter charts (ROP, torque, pressure vs depth); lessons learned, mitigation cards, source documents; "Compare with Active Well" overlay.

**SCREEN D: AI Evidence Search (`/dashboard/search`)** — 3 columns: filters | query + suggested queries + answer | evidence cards (document, type, well, page, depth, relevance, highlighted excerpt). Answer shows "Based on X evidence sources" with superscript citations.

**SCREEN E: Risk Explorer (`/dashboard/risk`)** — 2-column risk cards: type, score bar, confidence, interval, formation, "Why?" (signals, supporting wells, evidence), recommended checks, Acknowledge / Dismiss / Review.

**SCREEN F: Document Intelligence (`/dashboard/documents`)** — upload zone; stepper Upload → Extracting Text → Identifying Events → Structuring Data → Review; extracted events table; "Human Review Required" on low confidence; "Save to Knowledge Base".

---

## 📋 SECTION 7: SIGNATURE COMPONENTS

### 7.1 DepthScrubber (THE MOST IMPORTANT COMPONENT)
Slider 0 → total depth. On change: TopNav depth, KPI strip, formation indicator, map highlights of offset wells with events near this depth, Risk Watch re-scores, timeline cursor moves, entering a RiskZone triggers red pulse + toast. Track coloured by formation bands; risk zones highlighted.

### 7.2 GlassCard
```css
background: rgba(17, 24, 39, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgba(30, 58, 95, 0.5);
border-radius: 8px;
box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
```

### 7.3 RiskCard — risk badge + score + confidence; interval + formation; "Why?" accordion; acknowledge/dismiss; slides in with red glow.
### 7.4 EvidenceCard — title + type badge; excerpt with highlighted terms; well | page | depth | relevance; click → full excerpt dialog.
### 7.5 DemoModeToggle — DEMO MODE (amber, deterministic, enables Run Scenario) vs LIVE (simulated).

---

## 📋 SECTION 8: DEMO MODE & SCENARIO BUTTON

- Seeded SQLite, no external calls, deterministic alerts, pre-generated eRTMAC samples, "Reset Demo" → depth 3100m, alerts cleared.
- **Run Historical Risk Scenario:** 3100 → 3200 (mud loss alert at ~3150, W002 highlighted) → 3350–3380 (stuck pipe alert, W003/W005 evidence) → 3580 (critical kick alert) → pause for "Why?".
```typescript
const depths = [3100, 3120, 3140, 3150, 3160, 3180, 3200, 3250, 3300, 3350, 3370, 3380, 3400, 3420, 3450, 3500, 3550, 3570, 3580, 3600];
for (const depth of depths) { setCurrentDepth(depth); await evaluateRisk(depth); await delay(1500); }
```

---

## 📋 SECTION 9: AI EVIDENCE SEARCH PIPELINE

Query preprocessing (wells, depths, formations, event types) → hybrid retrieval (keyword + semantic + metadata filter) → re-rank & merge (top 5) → answer generation with strict grounding → answer + evidence cards + citations.

LLM system prompt (when an LLM is configured):
```
You are a drilling engineering knowledge assistant for Oil India Limited's NWIS system.
You MUST answer ONLY based on the provided evidence chunks.
You MUST cite every claim with [Doc: title, Page: X, Well: name, Depth: XXXXm].
If the evidence is insufficient, say "Insufficient evidence in the knowledge base to answer this query with confidence."
Never fabricate drilling data, measurements, or events.
Keep answers concise (3-5 sentences) and operationally actionable.
```

Suggested queries:
1. "What caused mud loss in the Barail Group near 3150m?"
2. "Show stuck pipe events in Kopili Shale across all offset wells."
3. "What mitigations were used for overpressure in nearby wells?"
4. "Compare drilling parameters between OIL-AX-102 and OIL-AX-99 at 3200m."
5. "What cementing issues were encountered in the Barail Group?"
6. "Show evidence for the current stuck pipe risk alert."

---

## 📋 SECTION 10: EXECUTION PHASES
1. Backend foundation · 2. Backend intelligence (events, formations, risk engine, search) · 3. Backend simulation (documents, eRTMAC, similarity) · 4. Frontend foundation · 5. Layout & map · 6. Depth scrubber, KPIs, risk watch, timeline · 7. Well intelligence, search · 8. Risk explorer, documents, polish, README.

---

## 📋 SECTION 11: 3-MINUTE JUDGE DEMO SCRIPT

- **[0:00-0:20] Hook** — historical knowledge trapped in scattered reports; NWIS is a depth-aware intelligence layer beside eRTMAC.
- **[0:20-0:55] Map** — OIL-AX-102 at 3,100 m in Barail; 10 offsets within 25 km; filter mud loss + stuck pipe.
- **[0:55-1:25] Historical intelligence** — OIL-AX-99: 3,150–3,220 m severe losses in Barail; cause, mitigation, cited DDR page 3.
- **[1:25-1:55] AI evidence search** — "What mitigations were used for stuck pipe in Kopili Shale?" → concise answer + evidence cards.
- **[1:55-2:25] Predictive alerts** — Run Historical Risk Scenario: mud loss at 3,150 m, stuck pipe at 3,380 m, critical kick at 3,580 m.
- **[2:25-2:50] Explainability** — "Why?" → signals, supporting wells, evidence, recommended checks; acknowledge/dismiss/review.
- **[2:50-3:00] Close** — "NWIS does not replace the drilling engineer. It reduces the time between a signal and the historical evidence needed to make an informed decision."

---

## 📋 SECTION 12: PITCH CONTENT

**One-line:** "NWIS gives every drilling engineer institutional memory — connecting the active well's current depth to what nearby and historical wells experienced, why it happened, and what to check next."

**30-second:** "Today, critical drilling knowledge is distributed across completion reports, daily reports, databases, and individual experience. NWIS turns that fragmented history into a depth-aware intelligence layer alongside real-time monitoring. It maps nearby wells, correlates formations and events, retrieves evidence from historical reports, compares similar wells, and raises explainable risk alerts before the active well reaches historically difficult intervals. The engineer stays in control; NWIS makes the relevant institutional memory available at the moment it matters."

**What makes it stand out:** not another dashboard · not another RAG chatbot · not a black-box model · not just GIS · not just document search · a standalone intelligence layer beside eRTMAC.

---

## 📋 SECTION 13: FINAL CHECKLIST
- [ ] All 7 PS requirements (S1-S7) are demonstrable
- [ ] All 4 problem descriptions (P1-P4) are addressed
- [ ] All 9 data source types are simulated
- [ ] 6 screens are built and navigable
- [ ] Depth scrubber syncs map, timeline, risk cards, and KPIs
- [ ] AI search returns cited evidence (document, page, well, depth)
- [ ] Risk alerts show "Why?" with contributing factors and historical wells
- [ ] Demo scenario button triggers 3 alerts automatically
- [ ] Document upload simulation shows processing → extraction → review
- [ ] UI is dark industrial cockpit with glassmorphism
- [ ] All data is labeled "Demo/Synthetic"
- [ ] No external API calls required for core demo
- [ ] README with run instructions exists
- [ ] 3-minute demo video is recorded
- [ ] Pitch deck is prepared
