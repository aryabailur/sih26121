# 3-minute judge demo — click path and talking points

**Before the judges arrive**

- Start with `.\start.ps1` (or `./start.sh`) at least a minute early; open `http://localhost:3000` (welcome globe).
- Chrome/Edge with hardware acceleration on (the 3D map is WebGL). Pick the theme in the left rail (sun/moon) —
  *Daylight* for bright rooms / projectors, *Night shift* for a dark room.
- Press **Reset** (↻ in the top bar): bit back to 3,100 m, alerts and uploads cleared.
- Browser at 1600×900 or larger, zoom 100%. Keep **one** NWIS tab open: alerts live on the shared backend, so
  Run / Reset in a second tab (or on a teammate's laptop pointed at the same server) clears the first tab's alerts.
- Backup: `docs/screenshots/00…14` and `docs/nwis-demo-walkthrough.webm` walk the same flow if anything fails.

---

### 0:00–0:20 — The problem (welcome → Command Center)

On the welcome screen click **Drilling engineer → Enter as drilling engineer**: the globe dives into Upper Assam.

> "A drilling engineer sees live data in eRTMAC, but the history that matters — what happened at this depth in
> the wells around us — is scattered across daily reports, completion reports and people's memory.
> NWIS puts that institutional memory beside the active well."

Point at: the **wellbore** on the left (bit at **3,100 m** in the **Barail Group**, offset events pinned at their
depths), the live KPI tiles, and the **Right now** card — *Watch closely · next: mud loss window at 3,150 m,
50 m ahead*.

### 0:20–0:55 — The map

1. Point at the 3D map: the active well (purple, pulsing, with the radar sweep), its drilled path and the dashed
   planned path, the bit's surface position (diamond), ten offset wells inside the **25 km** radius, and the
   history towers (taller = more NPT and events, colour = worst event). The dashed blue links march towards
   OIL-AX-99 and OIL-AX-55 — the offsets that lost returns at this depth.
2. Map filter chips → click **Losses** and **Stuck pipe**. Wells without that history dim.
3. Click **OIL-AX-99** → the profile drawer opens: 1.18 km NE, **93 % similar**, four events.

> "Similarity blends formation tops, depth coverage, trajectory, drilling parameters and distance — it tells
> the engineer which offsets are worth trusting."

### 0:55–1:25 — Historical intelligence

4. In the drawer, the critical event **Total loss of circulation, 3,150–3,220 m, Barail Group**: cause (natural
   fractures + ECD 1.52 sg), mitigation (MW to 1.38 sg, LCM pills, 18 h NPT) and the source
   **DDR OIL-AX-99 Day 42 · p.3** — click it to open the exact report page with highlights.
5. **Open well intelligence** → formation column, events on the depth axis, and OIL-AX-99's parameters with the
   active well dashed over them. Optional: sidebar → **Correlate & Compare** to show formation tops for
   OIL-AX-102 vs 99 / 88 / 66 on one depth axis.

> "Same depth axis, same formations — the engineer sees immediately that OIL-AX-102 is about to drill the same
> fractured sandstone."

### 1:25–1:55 — Evidence search

6. Sidebar → **Evidence Search**, click the suggestion or type:
   **"What mitigations were used for stuck pipe in Kopili Shale?"**
7. The answer names OIL-AX-88, OIL-AX-66 and OIL-AX-11 with what worked (spotting fluid + KCl to 7 %,
   back-reaming the key seat, jarring), every sentence with superscript citations. Click a superscript →
   the evidence card highlights; **Open source page** shows the report page.

> "No answer without evidence. If the knowledge base can't support it, NWIS says so." (Optional: type
> "helicopter crew change schedule" → *Insufficient evidence*.)

### 1:55–2:25 — Proactive alerts

8. Top bar → **Run historical risk scenario** (the bit advances 3,100 → 3,600 m; the replay dock at the bottom shows
   progress, the three expected alert beats and the narration).
   - **3,150 m — Mud Loss alert (HIGH)**: the toast slides in, the screen edge flashes, the camera frames
     OIL-AX-99 and OIL-AX-55; the ECD tile flags an anomaly. At 3,160 m it escalates to critical.
   - **3,380 m — Stuck Pipe alert**: OIL-AX-88 / 66 / 11; torque ≈1.3× baseline.
   - **3,500 m** — torque/drag stays a *watch* card: medium history, no live confirmation → no alarm fatigue.
   - **3,580 m — Kick / Overpressure alert (CRITICAL)**: OIL-AX-33 kicked at 3,590 m; SPP drop and drilling
     break; current MW 1.44 sg is below the 1.52 sg that controlled OIL-AX-33.

> "It's not waiting for the problem — it raises the alert when the bit enters the depth window where similar
> wells had trouble, and it escalates when live signals confirm."

### 2:25–2:50 — Explainability

9. On the **Stuck Pipe** card click **Why?**:
   - numbered reasons, the weighted factor breakdown (`0.30 × proximity … = score`),
   - live signals vs baseline, the three supporting wells with quotes and page citations,
   - the **learned-model cross-check** ("80 % — 20× the base rate; the model agrees"),
   - recommended checks (tick them off) and what worked in offsets, and the audit trail.
10. Type a note ("KCl verified 7 %") → **Acknowledge**. The audit trail records it.

### 2:50–3:00 — Close

> "NWIS does not replace the drilling engineer. It reduces the time between a signal and the historical
> evidence needed to make an informed decision."

---

### If time allows / Q&A props

- **Document Intelligence → Process sample report**: an OIL-AX-22 DDR the system has never seen → 3 candidate
  events, one flagged as a possible duplicate, entities, human review → **Save to knowledge base** → then search
  "tight hole overpull in Kopili near 3432 m" and the new page is cited.
- **Document Intelligence → Process scanned report · OCR**: an image-only PDF (no text layer). Tesseract reads it
  (~93 % word confidence, *Text* tab); extraction still finds the differential sticking at 2,655 m in the Barail.
  Point at the one OCR misread — "that is why an engineer approves every fact".
- **Correlate & Compare**: white walls on each bore are casing strings with labelled shoes; the table's amber cells
  show OIL-AX-102 plans 1.44 sg in the Sylhet where offsets ran 1.50 sg — the physics behind the kick alert.
- **Risk Explorer → How the score works → Learned from offset-well history**: backtest AUC 0.86 vs 0.76 and the
  learned weights. "Where's the ML?" is answered here.
- **Nearby Wells → radius** 25 → 1.5 km (fewer offsets, risk engine re-scores) → 50 km (4 regional wells appear).
- **Risk Explorer**: predicted risk along the whole well path; click the chart to jump the bit; model card with
  weights, alert policy and limitations.
- **Risk Explorer → Mud-weight window**: the prognosis (dashed) vs the offset-calibrated window (solid). The
  fracture gradient notches down where OIL-AX-99/55 lost returns; pore pressure steps up where OIL-AX-33/66 took
  gas — and the planned 1.44 sg in the Sylhet is flagged as below it. Run the scenario and watch the live ECD
  touch the Barail notch at ~3,160 m. "This is the physics behind the alerts."
- **Live** toggle (top bar): the bit advances 2 m every 2 s like a live feed.
- Map controls: **Orbit** (slow presentation spin), **2D / 3D**, **Satellite / Map**, **Towers** on/off.
- Role menu (avatar, top right): switch to *Office analyst* (lands on Evidence Search) or *Drilling manager*
  (lands on Risk Explorer).
- Be explicit: all data is synthetic; weights are transparent, not trained; decision support only.
