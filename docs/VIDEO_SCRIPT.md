# NWIS — 3:00.6 demo video · voiceover script

**Video:** `docs/video/NWIS_SIH26121_demo.mp4` (1080p30), `…_captioned.mp4` (burned-in captions),
`NWIS_SIH26121_demo.srt` (captions), `NWIS_score.wav` (the background music alone). The MP4s are not in git
(over GitHub's 100 MB limit) — rebuild with `tools/video/`.
The voice is **Team Huzzards' own narrator, cloned** from a sample recording (`tools/video/clone.py`, Chatterbox on
the local GPU). This page is the same script for reading it live instead.

**Structure (SIH brief):** Team & Problem Statement (0:00.5) · Problem (0:05.0) · Game-Changer (0:21.2) · Core Innovation (0:38.2) · Prototype Walkthrough (Live App) (0:56.8) · Long-Term Impact (2:41.7) · end 3:00.6.

## Reading guide

- **Tone:** calm and confident, like a senior engineer briefing a rig team — not a salesperson.
- **Pace:** brisk, about 180 words a minute. Each line has a **max** length (right column); finish inside it,
  because the picture is timed to it.
- **Pronunciation:** NWIS = **"En-wiss"** · eRTMAC = **"E-R-T-MAC"** · OIL-AX-102 = **"oil A-X one-oh-two"** · NPT = **"N-P-T"** · ECD = **"E-C-D"** · OCR = **"O-C-R"** · SIH26121 = **"S-I-H two-six-one-two-one"** · Barail = **"ba-RAIL"** · Kopili = **"ko-PEE-lee"** · Huzzards = **"HUZ-zards"** · depths as spoken numbers.

| # | Time | Max | Line (say this) | On screen |
|---|---|---|---|---|
| **00 · TEAM & PROBLEM STATEMENT** |||||
| T1 | 0:00.5 | 4.3 s | We are Team Huzzards, and this is our answer to SIH26121. | Black title card: "Team Huzzards", "Problem statement SIH26121 · Oil India Limited" |
| **01 · PROBLEM** |||||
| P1 | 0:05.0 | 2.9 s | Drilling engineers make decisions at the bit — in minutes. | Lithology cross-section; the bit drills to 3,100 m. "At the bit, you have minutes to decide." |
| P2 | 0:08.1 | 6.4 s | But what nearby wells faced at this exact depth — losses, stuck pipe, kicks — is buried in thousands of reports. | Nearby wells draw in; incidents stamp in at depth; report sheets bury them |
| P3 | 0:14.8 | 5.5 s | Unplanned events like these can eat ten to twenty percent of a well's time — and they repeat. | Black wipe to "10–20%" and a well-time bar; "The same trouble, well after well."; source line |
| **02 · GAME-CHANGER** |||||
| G1 | 0:21.2 | 2.9 s | Meet NWIS — the Nearby Wells Intelligence System. | Welcome screen, spinning globe |
| G2 | 0:24.3 | 8.1 s | It sits beside eRTMAC and connects the bit's depth to what nearby wells learned there: what happened, why, what worked — and the report page that proves it. | Click "Enter"; the globe dives into Upper Assam |
| G3 | 0:32.6 | 5.0 s | Not a dashboard. Not a chatbot. The memory of the field — when it matters. | Paper panel over the Command Center: "dashboard" and "chatbot" struck through |
| **03 · CORE INNOVATION** |||||
| I1 | 0:38.2 | 2.6 s | The core innovation is a depth-aware link. | Subsurface 3D builds itself; lower-third "The depth-aware link" |
| I2 | 0:41.1 | 6.9 s | As the bit drills, NWIS finds the offset wells that had trouble at that depth, and streams their evidence to the active well. | Bit steps into the Barail; evidence links stream to it |
| I3 | 0:48.2 | 8.3 s | Every alert is explainable, every sentence is cited — and a learned model cross-checks each score, without ever overriding the engineer. | Score taken apart to 0.83 vs the 0.75 threshold; cited DDR sentence; learned model 0.86 vs 0.76, "Advisory only" |
| **04 · PROTOTYPE WALKTHROUGH (live app)** |||||
| W1 | 0:56.8 | 6.4 s | This is the Command Center: well OIL-AX-102, drilling the Barail Group at 3,100 metres. | Command Center, 3D satellite map; lower-third with the demo-field disclosure |
| W2 | 1:03.7 | 5.5 s | Wellbore, live parameters, field map and risk radar — all driven by one depth. | Cursor tours the panels |
| W3 | 1:09.6 | 1.3 s | Let's start drilling. | Click "Run historical risk scenario" (3× time-lapse) |
| W4 | 1:12.8 | 4.9 s | At 3,150 metres, NWIS raises a mud-loss alert — before the losses begin. | Mud-loss alert toast; zoom in; lower-third |
| W5 | 1:18.0 | 4.2 s | Two offsets lost returns right here, and the ECD is climbing toward their loss point. | Pause; ECD tile flagged |
| W6 | 1:22.4 | 9.1 s | Switch to Subsurface: the rock layers come from every offset's formation tops, with true well paths and past incidents glowing at their depth. | Map flips to the 3D block; resume; lower-third |
| W7 | 1:32.5 | 4.5 s | At 3,380 metres, the stuck-pipe alert fires — and the evidence streams to the bit. | Stuck-pipe alert; the camera flies to the evidence |
| W8 | 1:37.2 | 6.1 s | Click Why, and the alert shows its working: every factor, every signal, every supporting well — and what to check next. | Why? dialog, scrolls |
| W9 | 1:43.6 | 6.9 s | The Well Intelligence page opens any offset: its drilling parameters against ours, depth for depth, beside every event and lesson. | Well Intelligence (night-shift theme): parameters vs depth, Lessons tab |
| W10 | 1:50.7 | 5.4 s | Compare correlates formation tops, casing and mud weights across the offsets — so the differences stand out. | Compare (night-shift theme): correlated cross-section, ECD tab |
| W11 | 1:56.4 | 6.7 s | Ask in plain English — every sentence of the answer is cited, and one click opens the original report page. | Question typed; cited answer; report page opens |
| W12 | 2:05.4 | 4.1 s | For the shift handover, the look-ahead brief turns the next 300 metres into one page: | Ctrl K → "brief" |
| W13 | 2:09.8 | 7.5 s | hazards, what worked fastest, the mud-weight window — and 8.8 hours of expected NPT, about eleven lakh rupees at stake. | Brief; zoom on expected NPT |
| W14 | 2:17.5 | 6.0 s | Even scanned reports are read with OCR and turned into events — and nothing is saved until an engineer approves it. | Scanned PDF → OCR pipeline → review |
| W15 | 2:28.0 | 5.4 s | And it's not just a demo: we ran the same pipeline on 1,970 real well histories from the Norwegian shelf — | Real-data page |
| W16 | 2:33.6 | 6.9 s | 611 drilling problems found in seconds, 94 percent correct on wells it had never seen. | Scan re-runs live; depth chart |
| **05 · LONG-TERM IMPACT** |||||
| V1 | 2:41.7 | 6.5 s | In our demo field, the offsets lost 110 hours in the three windows ahead — NWIS flagged every one before the bit got there. | 110 h builds from three hazard-striped windows; “Flagged at …” stamps |
| V2 | 2:48.4 | 6.4 s | Connected to eRTMAC and Oil India's archive, every rig, every handover and every new engineer gets the field's memory. | eRTMAC + OIL archive → NWIS → every rig / handover / new engineer; facts row |
| V3 | 2:55.1 | 3.7 s | NWIS. Know what's below — before you drill it. | End card on black; "before you drill it." swept in yellow; Team Huzzards |

*About 481 words in 143 s of speech.*

## Recording it live instead

1. Record each line as its own file named by its ID (`T1.wav`, `P1.wav`, … `V3.wav`), in a quiet room, 48 kHz.
   Don't add silence at the ends; the tool trims it.
2. `cd tools/video && .venv\Scripts\python.exe tts.py --human <folder>` — replaces the clips and updates the timings.
3. Every take and scene is timed from those durations, so re-run the pipeline:
   `node record.mjs` (needs the app running) → `node scenes.mjs` → `.venv\Scripts\python.exe edit.py`.

## Claims in the video, and where they come from

| Claim | Source |
|---|---|
| Unplanned events can take 10–20 % of well time, led by stuck pipe and lost circulation | Elsevier ScienceDirect Topics, "Loss of Circulation" (shown on screen) |
| 110 h NPT in the three windows ahead; alerts at 3,150 / 3,380 / 3,580 m | NWIS demo field (illustrative data), `tests.scenario_sweep` |
| 8.8 h expected NPT ≈ ₹11 lakh; ₹1.4 crore for 110 h | Look-ahead brief at an **assumed** ₹30 lakh/day spread rate |
| Learned model AUC 0.86 vs 0.76 hand-set | `GET /api/risk/model` (leave-one-well-out backtest on the demo offsets) |
| 1,970 real histories, 611 problems found in 2.5 s, 94 % held-out precision | `GET /api/opendata/summary` — Sodir FactPages (NLOD 2.0), hand-checked sample of 50 |
| 100 % of alerts cite a source page | By design: every alert carries its offset evidence with document, page, well and depth |
| 20/20 requirements | `python -m tests.requirements_check` |
