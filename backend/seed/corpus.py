"""Synthetic report corpus (DDR, WCR, mud logs, cementing, NPT, programmes).

Each document is a list of pages; each page becomes one DocumentChunk with page,
section and depth metadata. The text is written in drilling-report register and
quotes the structured event records so that search results and event provenance
always point at the same page.
"""
from __future__ import annotations

from datetime import date

from seed.field import WELLS, formation_at
from seed.parameters import parameters_at

W = {w["id"]: w for w in WELLS}


def _page(page: int, section: str, ds: float | None, de: float | None, text: str) -> dict:
    return dict(page=page, section=section, depth_start=ds, depth_end=de, text=" ".join(text.split()))


def _range(well_id: str, d_from: float, d_to: float, key: str, fmt: str = "{:.0f}") -> str:
    vals = [parameters_at(well_id, d)[key] for d in (d_from, (d_from + d_to) / 2, d_to)]
    lo, hi = min(vals), max(vals)
    return fmt.format(lo) if abs(hi - lo) < 1e-6 else f"{fmt.format(lo)}–{fmt.format(hi)}"


def ddr_header(well_id: str, day: int, dt: date, d_from: float, d_to: float, hole: str, casing: str,
               mud: str, summary: str, forecast: str) -> dict:
    w = W[well_id]
    p = parameters_at(well_id, d_to)
    text = f"""
    DAILY DRILLING REPORT — {w['name']} | Report No. {day} | Date: {dt.isoformat()} |
    Rig: {w['rig']} | Field: {w['field']} | Basin: Upper Assam Shelf.
    Depth 00:00 hrs {d_from:,.0f} m MD; depth 24:00 hrs {d_to:,.0f} m MD; 24-hr progress {d_to - d_from:,.0f} m.
    Hole size {hole}; last casing {casing}. Formation at report depth: {formation_at(well_id, d_to)}.
    Mud system: {mud}, mud weight {p['mud_weight']:.2f} sg, ECD {p['ecd']:.2f} sg.
    24-hr summary: {summary}
    Next 24-hr forecast: {forecast}
    """
    return _page(1, "Report Header & 24-hr Summary", d_from, d_to, text)


def ddr_params(well_id: str, page: int, d_from: float, d_to: float, kcl: float | None, extra: str = "") -> dict:
    p = parameters_at(well_id, d_to)
    kcl_txt = f"KCl {kcl:.1f}%," if kcl is not None else "oil/water ratio 75/25,"
    text = f"""
    Drilling parameters {d_from:,.0f}–{d_to:,.0f} m: WOB {_range(well_id, d_from, d_to, 'wob')} kN,
    RPM {_range(well_id, d_from, d_to, 'rpm')}, torque {_range(well_id, d_from, d_to, 'torque', '{:.1f}')} kN·m,
    flow rate {_range(well_id, d_from, d_to, 'flow_rate')} l/min, standpipe pressure {_range(well_id, d_from, d_to, 'standpipe_pressure')} psi,
    average ROP {_range(well_id, d_from, d_to, 'rop', '{:.1f}')} m/hr, hook load {_range(well_id, d_from, d_to, 'hook_load')} kN.
    Mud properties at {d_to:,.0f} m: MW {p['mud_weight']:.2f} sg, ECD {p['ecd']:.2f} sg, PV 22 cP, YP 18 lb/100ft²,
    gels 5/11, API fluid loss 4.2 ml, {kcl_txt} pH 9.6, LGS 5.5%. Background gas {p['gas_units']:.0f} units.
    {extra}
    """
    return _page(page, "Drilling Parameters & Mud Properties", d_from, d_to, text)


def wcr_summary(well_id: str, dt: date, casing: str, notes: str) -> dict:
    w = W[well_id]
    tops = "; ".join(
        f"{name} {top:,.0f} m" for name, top in
        zip(["Tipam", "Namsang", "Barail", "Kopili", "Sylhet"], _tops(well_id)) if top < w["td"]
    )
    text = f"""
    WELL COMPLETION REPORT — {w['name']} ({w['well_type']} well), {w['field']}, Upper Assam Shelf.
    Spud {w['spud'].isoformat()}, rig released {dt.isoformat()}. Total depth {w['td']:,.0f} m MD.
    Target: {w['target']}. Maximum inclination {w['inc']:.0f}° (azimuth {w['az']:.0f}°).
    Casing: {casing}. Formation tops (MD): Girujan surface; {tops}.
    {notes}
    """
    return _page(1, "Well Summary", 0, w["td"], text)


def _tops(well_id: str) -> list[float]:
    from seed.field import FORMATION_TOPS
    return FORMATION_TOPS[well_id]


def build_corpus() -> list[dict]:
    docs: list[dict] = []

    def doc(id_, well_id, title, doc_type, dt, page_count, pages, summary):
        docs.append(dict(id=id_, well_id=well_id, title=title, doc_type=doc_type, date=dt,
                         page_count=page_count, pages=pages, summary=summary))

    # ======================================================================== W002 OIL-AX-99
    doc("DOC-W002-DDR42", "W002", "DDR OIL-AX-99 Day 42", "DDR", date(2023, 3, 15), 6, [
        ddr_header("W002", 42, date(2023, 3, 15), 3122, 3220, '8-1/2"', '9-5/8" at 3,005 m', "OBM",
                   "Drilled 8-1/2\" hole in Barail Group from 3,122 m to 3,150 m. Total loss of circulation at 3,150 m. "
                   "Pumped LCM pills, reduced mud weight, cured losses; resumed drilling to 3,220 m with controlled parameters.",
                   "Drill ahead to the Kopili Shale top (~3,300 m); maintain ECD below 1.48 sg; keep LCM on standby."),
        ddr_params("W002", 2, 3122, 3150, None,
                   "ECD climbed from 1.47 to 1.52 sg over the last 20 m before losses as ROP increased in fractured sand."),
        _page(3, "Operations Time Log & Losses", 3150, 3220, """
            06:10–06:40 Drilling at 3,150 m, observed sudden loss of returns. Total loss of circulation encountered at 3150m
            while drilling through fractured Barail sandstone. Mud weight was 1.42 sg. Lost 45 m³ of OBM over 6 hours.
            Picked up off bottom, stopped pumps, monitored annulus — static losses 7 m³/hr.
            06:40–12:40 Pumped 2 x 8 m³ LCM pills (calcium carbonate + graphite, 60 ppb). Partial returns restored.
            Root cause assessment: natural fractures in Barail sandstone exacerbated by high ECD (1.52 sg).
            12:40–20:00 Reduced mud weight to 1.38 sg in steps of 0.01 sg, circulated at 1,600 l/min, pumped third LCM pill.
            Losses cured after 18 hours in total (NPT 18 hrs).
            20:00–24:00 Resumed drilling 3,150–3,220 m at reduced flow rate 1,750 l/min, ROP limited to 10 m/hr, ECD 1.46 sg.
            No further losses.
        """),
        _page(4, "Lessons & Forecast", 3150, 3220, """
            Lessons learned (drilling engineer, OIL-AX-99): the Barail sandstone between 3,150 m and 3,220 m is naturally
            fractured. Losses began when ECD reached 1.52 sg. For future wells in this area: keep ECD ≤1.48 sg between
            3,100 and 3,250 m, pre-treat the active system with 15 ppb background LCM (sized calcium carbonate) before 3,140 m,
            and drill the interval at reduced flow rate with controlled ROP. Keep a 16 m³ LCM pill pre-mixed at the rig floor.
            Consider a lightweight lead slurry for the 7" liner cement job across this interval.
        """),
    ], "Day 42 — total losses at 3,150 m in Barail sandstone; 45 m³ OBM lost; cured with LCM and MW reduction.")

    doc("DOC-W002-DDR40", "W002", "DDR OIL-AX-99 Day 40", "DDR", date(2023, 3, 13), 4, [
        ddr_header("W002", 40, date(2023, 3, 13), 2935, 3010, '8-1/2"', '9-5/8" at 3,005 m', "OBM",
                   "Drilled out 9-5/8\" shoe track and 3 m new formation; FIT to 1.62 sg EMW. Drilled 8-1/2\" hole to 3,010 m.",
                   "Continue drilling Barail Group; monitor for losses."),
        _page(2, "Operations Summary", 2960, 2985, """
            Seepage losses of 2–3 m³/hr observed at 2,962 m while drilling permeable Barail sand with 1.40 sg mud; total 6 m³ lost
            (2,960–2,985 m). Added 15 ppb fine CaCO₃ background LCM; losses stopped within 2 hours. NPT 2 hrs.
            Recommendation: carry background LCM from 2,900 m in the Barail.
        """),
        _page(3, "Mud Report", 2935, 3010, """
            Mud report: OBM, MW 1.40 sg, oil/water ratio 75/25, electrical stability 780 V, PV 24 cP, YP 16 lb/100ft²,
            HTHP fluid loss 3.8 ml. Background LCM 15 ppb CaCO₃ (F/M blend) added after seepage losses. Pit volume trend stable
            after treatment. Solids control: shakers dressed with 170 mesh screens.
        """),
    ], "Day 40 — seepage losses at 2,962 m treated with background LCM.")

    doc("DOC-W002-WCR", "W002", "Well Completion Report OIL-AX-99", "WCR", date(2023, 4, 20), 28, [
        wcr_summary("W002", date(2023, 4, 10), '20" at 60 m, 13-3/8" at 805 m, 9-5/8" at 3,005 m, 7" liner 2,900–3,645 m',
                    "Principal drilling problems: total losses in Barail at 3,150–3,220 m (18 hrs NPT), tight hole in Kopili, "
                    "7\" liner cement shortfall. Total NPT 38 hrs."),
        _page(6, "Drilling Problems Summary", 3440, 3455, """
            Kopili Shale (3,300–3,595 m): tight spot at 3,448 m during wiper trip with 20 t (196 kN) overpull; reamed twice.
            Cause attributed to time-dependent swelling / creep of the Kopili shale after 70 hours of open-hole exposure.
            Mud weight raised from 1.42 to 1.44 sg. NPT 4 hrs. Recommendation: schedule wiper trips before Kopili exposure
            exceeds 72 hours.
        """),
        _page(9, "Casing & Cementing", 3000, 3220, """
            7" liner cementing: partial losses of 12 m³ during displacement; top of cement evaluated 180 m below plan by CBL.
            Root cause: cementing across the not-fully-healed Barail loss zone (3,150–3,220 m); ECD during displacement reached
            1.58 sg. Remedial: top-up squeeze through the liner lap. A lightweight (1.55 sg) lead slurry has been adopted for
            future wells. NPT 14 hrs.
        """),
        _page(12, "Lessons Learned", 3100, 3250, """
            Key lessons for offset planning: (1) The Barail loss window (3,150–3,220 m) is fracture-controlled — hold ECD ≤1.48 sg
            and pre-treat with LCM. (2) Cure losses completely before cementing across the Barail; use lightweight lead slurry.
            (3) In the Kopili, limit open-hole exposure and maintain mud weight ≥1.44 sg.
        """),
    ], "Completion report — losses, Kopili tight hole, liner cement shortfall and lessons.")

    doc("DOC-W002-ML", "W002", "Mud Log OIL-AX-99", "mud_log", date(2023, 4, 12), 14, [
        _page(1, "Lithology — Barail Group", 2400, 3300, """
            Barail Group 2,395–3,300 m: interbedded fine- to medium-grained sandstone, grey shale and thin coal stringers.
            Sandstone porosity visually 16–22%. Natural fractures noted in cuttings (slickensided fragments) from 3,140 m.
            Drilling break at 3,146 m (ROP 9 → 18 m/hr) preceded the total losses at 3,150 m.
        """),
        _page(2, "Gas & Losses Record", 3100, 3250, """
            Losses record: 3,150 m total loss of returns, 45 m³ OBM lost over 6 hours; ECD at onset 1.52 sg (PWD).
            Mud weight 1.42 sg. Background gas 30 units, no connection gas. After LCM treatment and MW reduction to 1.38 sg,
            full returns from 3,158 m. Pit volume totaliser and flow-out paddle both showed the event; flow-out dropped
            from 38% to 0% within 2 minutes.
        """),
        _page(3, "Lithology — Kopili & Sylhet", 3300, 3650, """
            Kopili Shale 3,300–3,595 m: dark grey to black fissile shale, reactive, with splintery cavings above 3,440 m.
            Sylhet Limestone 3,595–3,650 m: nummulitic limestone, tight; background gas 60–90 units, no kicks recorded.
        """),
    ], "Mud log — lithology, gas and loss record for OIL-AX-99.")

    # ======================================================================== W003 OIL-AX-88
    doc("DOC-W003-DDR55", "W003", "DDR OIL-AX-88 Day 55", "DDR", date(2022, 11, 8), 9, [
        ddr_header("W003", 55, date(2022, 11, 8), 3372, 3400, '8-1/2"', '9-5/8" at 3,020 m', "KCl-polymer WBM",
                   "Drilled Kopili Shale 3,372–3,400 m. Changed BHA (MWD). Pipe stuck at 3,400 m on connection; worked pipe, "
                   "spotted diesel-based fluid; pipe freed after 12 hours of working.",
                   "Circulate and condition mud, raise KCl to 7%, wiper trip, resume drilling."),
        _page(3, "Mud Report", 3372, 3400, """
            Mud report: KCl-polymer WBM, MW 1.43 sg, KCl 4.0% (programme 7%; depleted by dilution), PV 20 cP, YP 17,
            API fluid loss 5.4 ml, MBT 12 kg/m³ rising — indicating shale reactivity. Cuttings soft and sticky;
            shale swelling observed in cuttings from 3,385 m.
        """),
        _page(7, "Stuck Pipe Incident", 3380, 3420, """
            Stuck pipe incident report. Pipe stuck at 3400m during connection. Overpull of 80 kN. Shale swelling observed in
            cuttings. Hole had been left open for 45 minutes during BHA change prior to the connection.
            Root cause: reactive Kopili shale swelling due to inadequate KCl inhibition in mud system (4% vs 7% programme);
            hole left open for 45 minutes during BHA change.
            Freeing: spotted 15 m³ of diesel-based spotting fluid, worked pipe for 12 hours, freed at 120 kN overpull.
            Increased KCl to 7% in mud system. NPT 36 hrs including conditioning and wiper trip.
        """),
        _page(8, "Freeing Operations & Forecast", 3380, 3420, """
            After freeing, circulated bottoms-up with high-viscosity sweep, cavings reduced. Reamed 3,380–3,420 m.
            Lessons: maintain KCl ≥7% before entering the Kopili; keep static time under 15 minutes; spot a pill before BHA
            changes; monitor MBT each tour. These practices are to be carried into the OIL-AX well programme.
        """),
    ], "Day 55 — stuck pipe at 3,400 m in Kopili; 36 hrs NPT; KCl raised to 7%.")

    doc("DOC-W003-DDR53", "W003", "DDR OIL-AX-88 Day 53", "DDR", date(2022, 11, 6), 6, [
        ddr_header("W003", 53, date(2022, 11, 6), 3318, 3372, '8-1/2"', '9-5/8" at 3,020 m', "KCl-polymer WBM",
                   "Drilled from Barail into Kopili Shale (top 3,310 m). Cavings and erratic torque from 3,352 m; raised MW.",
                   "Continue drilling Kopili with sweeps every stand."),
        _page(4, "Hole Condition", 3350, 3370, """
            Splintery cavings (15% of returns) and erratic torque at 3,352–3,370 m; 3 m³ of cavings over 6 hours.
            Assessed as mechanical instability of Kopili shale with 1.41 sg mud weight below the collapse gradient.
            Raised mud weight to 1.43 sg and pumped high-viscosity sweeps; cavings reduced to 3%. NPT 5 hrs.
        """),
        ddr_params("W003", 5, 3318, 3372, 4.5, "KCl dropping with dilution; programme 7%."),
    ], "Day 53 — Kopili cavings and erratic torque at 3,352–3,370 m.")

    doc("DOC-W003-WCR", "W003", "Well Completion Report OIL-AX-88", "WCR", date(2022, 12, 15), 24, [
        wcr_summary("W003", date(2022, 12, 2), '20" at 60 m, 13-3/8" at 800 m, 9-5/8" at 3,020 m, 7" liner to 3,715 m',
                    "Total NPT 74 hrs: stuck pipe in Kopili (36 hrs), logging tool fishing (22 hrs), MWD failure (11 hrs), cavings (5 hrs)."),
        _page(5, "NPT Summary", 2600, 3420, """
            NPT summary: MWD pulser failure at 2,612 m (Barail) — pulled out to change tool, 11 hrs; seal failure with LCM
            plugging suspected; LCM particle size screened to MWD tolerance thereafter. Stuck pipe at 3,400 m (Kopili) — 36 hrs.
            Cavings 3,352–3,370 m — 5 hrs.
        """),
        _page(8, "Logging Operations", 3700, 3715, """
            Density-neutron logging tool stuck at 3,712 m in the Sylhet Limestone; recovered by cut-and-thread fishing with an
            overshot on drill pipe after 22 hours. Cause: differential sticking of the tool against permeable Sylhet limestone
            with 1.44 sg overbalance. Recommendation: log the Sylhet on drill pipe (TLC) or minimise stationary readings.
        """),
        _page(11, "Lessons Learned", 3300, 3600, """
            Kopili Shale lessons: inhibition is critical — the stuck pipe at 3,400 m occurred with KCl at 4%. Maintain KCl ≥7%,
            MBT below 10 kg/m³, and keep connections short. Enter the Kopili with at least 1.43 sg mud weight. The 7% KCl
            practice has been recommended for all subsequent OIL-AX wells.
        """),
    ], "Completion report — Kopili stuck pipe, fishing, MWD failure, KCl lessons.")

    # ======================================================================== W004 OIL-AX-77
    doc("DOC-W004-DDR60", "W004", "DDR OIL-AX-77 Day 60", "DDR", date(2022, 2, 14), 5, [
        ddr_header("W004", 60, date(2022, 2, 14), 3488, 3540, '8-1/2"', '9-5/8" at 3,040 m', "KCl-polymer WBM",
                   "Drilled lower Kopili 3,488–3,540 m at 35° inclination. Progressive torque increase with stick-slip; "
                   "increased flow rate and off-bottom rotation; torque normalised.",
                   "Drill to TD 3,580 m; circulate clean; POOH for logs."),
        _page(2, "Drilling Parameters & Events", 3500, 3540, """
            Progressive torque increase from 14 kN·m to 32 kN·m while drilling 3500-3540m. Intermittent stick-slip observed
            (surface RPM oscillating 80–140). Root cause: poor hole cleaning in high-angle section (35°). Cuttings bed
            accumulation in Kopili shale. Mitigation: increased flow rate from 1800 to 2200 l/min, rotated off-bottom at
            120 RPM for 30 min every 2 stands. Torque normalized. NPT 8 hrs.
        """),
        _page(3, "Hole Cleaning Programme", 3450, 3580, """
            Revised hole-cleaning programme for inclination above 30°: minimum flow 2,200 l/min, pipe rotation ≥120 RPM,
            tandem sweeps (low-vis/high-vis) every 2 stands, cuttings-bed monitoring by torque & drag trend. Lesson: drill the
            lower Kopili at ≥2,200 l/min where inclination exceeds 30°.
        """),
    ], "Day 60 — torque 14 → 32 kN·m with stick-slip at 3,500–3,540 m; hole cleaning.")

    doc("DOC-W004-ML", "W004", "Mud Log OIL-AX-77", "mud_log", date(2022, 2, 20), 12, [
        _page(1, "Lithology Summary", 0, 3580, """
            Lithology: Girujan clays to 820 m; Tipam sandstone 820–1,625 m; Namsang sand/shale interbeds 1,625–2,420 m with
            hard stringers; Barail 2,420–3,320 m; Kopili shale 3,320–3,580 m (TD). High-angle J-profile, 35° tangent from 1,700 m.
        """),
        _page(2, "Drilling Events Log", 2240, 2245, """
            Drill-string twist-off at 2,241 m (fatigue crack in a 6-1/2" drill collar pin) while drilling Namsang interbeds;
            142 m fish recovered with an 8-1/8" overshot after two runs. Cause: connection fatigue from high lateral vibration.
            NPT 30 hrs. Drill-collar inspection every 250 rotating hours instituted.
        """),
        _page(3, "Drilling Events Log", 3460, 3540, """
            Pack-off tendency with standpipe pressure spikes of +250 psi at 3,468 m (Kopili, 35°) — cuttings loading;
            reduced ROP to 8 m/hr and pumped tandem sweeps (NPT 3 hrs). From 3,500 m torque rose progressively with stick-slip;
            see DDR Day 60.
        """),
    ], "Mud log — twist-off in Namsang and pack-off/torque in Kopili.")

    # ======================================================================== W005 OIL-AX-66
    doc("DOC-W005-DDR48", "W005", "DDR OIL-AX-66 Day 48", "DDR", date(2021, 6, 22), 7, [
        ddr_header("W005", 48, date(2021, 6, 22), 3395, 3430, '8-1/2"', '9-5/8" at 2,995 m', "KCl-polymer WBM",
                   "Tripping out for bit change from 3,430 m; mechanical sticking at 3,410 m in dogleg; back-reamed and "
                   "freed pipe with under-reamer run.",
                   "Revise tripping procedure (ream every stand), run back to bottom, drill ahead."),
        _page(2, "Survey & Dogleg", 3370, 3430, """
            Survey at 3,400 m: inclination 31° (from 27°), dogleg 8°/30 m — above the 5°/30 m programme limit. Unplanned
            build caused by a formation push at the Kopili bedding. Directional driller advised to hold and drop back to 27°.
        """),
        _page(5, "Stuck Pipe Incident", 3390, 3430, """
            Mechanical sticking at 3410m due to key seating in dogleg. Torque increased from 12 kN·m to 28 kN·m over 30 minutes.
            Root cause: key seat formation at 3400m dogleg (8°/30m). Insufficient reaming during trip out.
            Mitigation: back-reamed to 3350m, reamed down with under-reamer, freed pipe. Modified tripping procedures to include
            reaming every stand. NPT 24 hrs.
        """),
        _page(6, "Revised Tripping Procedure", 3350, 3450, """
            Revised procedure for the Kopili interval: ream and back-ream every stand through doglegs >5°/30 m; limit trip speed
            to 2 min/stand; record pick-up/slack-off weights every stand; stop and circulate if overpull exceeds 50 kN.
            Lesson: keep doglegs below 5°/30 m in the Kopili.
        """),
    ], "Day 48 — key-seat mechanical sticking at 3,410 m; torque 12 → 28 kN·m.")

    doc("DOC-W005-DDR57", "W005", "DDR OIL-AX-66 Day 57", "DDR", date(2021, 7, 1), 5, [
        ddr_header("W005", 57, date(2021, 7, 1), 3572, 3612, '8-1/2"', '9-5/8" at 2,995 m', "KCl-polymer WBM",
                   "Drilled through Kopili–Sylhet boundary (3,590 m). High background and connection gas; weighted up to 1.50 sg.",
                   "Drill Sylhet at controlled ROP with flow checks every drilling break."),
        _page(3, "Gas & Pressure Evaluation", 3595, 3610, """
            High background gas (180 → 420 units) and connection gas at the Sylhet top (3,596 m); mud weight raised from
            1.44 to 1.50 sg in 0.02 sg steps. Flow checks negative. Controlled drilling at 5 m/hr. Interpretation: transition into
            overpressured Sylhet limestone below the Kopili seal. NPT 6 hrs. Lesson: weight up to at least 1.50 sg before the
            Sylhet top.
        """),
        _page(4, "Mud Weight-up Schedule", 3572, 3612, """
            Weight-up schedule executed: 1.44 → 1.46 sg at 3,598 m; 1.48 sg at 3,602 m; 1.50 sg at 3,606 m. Barite additions
            42 t. Connection gas reduced from 220 to 60 units after reaching 1.50 sg. Pore pressure estimated 1.47 sg EMW
            at the Sylhet top from d-exponent and gas trend.
        """),
    ], "Day 57 — overpressure indications at Sylhet top; MW 1.44 → 1.50 sg.")

    doc("DOC-W005-CEM", "W005", "7-in Liner Cementing Report OIL-AX-66", "cementing_report", date(2021, 7, 26), 8, [
        _page(1, "Job Summary", 3280, 3900, """
            7" liner run and cemented 2,900–3,895 m. Job pumped as designed; full returns during displacement. CBL shows good
            bond across Kopili and Sylhet. Centralisation: one rigid centraliser per joint through the build section and the
            Kopili; spacer pumped at turbulent flow (1,400 l/min).
        """),
        _page(2, "Pre-job Well Conditions", 3720, 3760, """
            Pre-job conditions: partial losses of 6–10 m³/hr had occurred in vuggy Sylhet limestone between 3,720 and 3,760 m
            on 12 July with 1.50 sg mud. LCM pills pumped and mud weight reduced from 1.50 to 1.48 sg; losses cured before the
            liner job (NPT 10 hrs). Lightweight lead slurry (1.55 sg) selected to limit ECD across the loss interval.
        """),
        _page(3, "Job Design & Execution", 2900, 3895, """
            Slurry design: lead 1.55 sg lightweight, tail 1.90 sg Class G. Spacer 1.60 sg, 12 m³, turbulent flow.
            Displacement at 1,400 l/min; maximum ECD 1.54 sg (below the 1.58 sg loss threshold). Centralisers: 1 per joint.
            Liner hanger set and tested to 1,500 psi.
        """),
        _page(4, "Evaluation & Lessons", 2900, 3895, """
            CBL/VDL: good bond from 2,950 m to 3,890 m. Lesson: full centralisation in deviated sections and lightweight lead
            slurry across loss zones delivered a competent liner cement job.
        """),
    ], "7\" liner cementing — good bond; centraliser and lightweight-slurry practice.")

    # ======================================================================== W006 OIL-AX-55
    doc("DOC-W006-ML", "W006", "Mud Log OIL-AX-55", "mud_log", date(2022, 6, 2), 11, [
        _page(1, "Lithology & Hole Condition", 0, 900, """
            Girujan clays 0–810 m: soft, sticky, reactive. Hole enlargement and clay balling at 450–520 m; tight hole on trip out
            (NPT 3 hrs). Reamed; added 3% KCl and glycol to the mud system.
        """),
        _page(2, "Drilling Events Log", 2880, 2890, """
            Differential sticking after a 10-minute static survey at 2,886 m (Barail); freed with 40 t (392 kN) overpull and
            jarring after 6 hours. Cause: depleted Barail sand, 1.40 sg overbalance and high fluid loss (API FL 6 ml).
            Actions: API fluid loss reduced below 4 ml; surveys taken while rotating slowly.
        """),
        _page(3, "Losses & Gas Record", 3150, 3220, """
            Partial losses of 8–12 m³/hr at 3,172 m; 38 m³ lost in total (3,170–3,205 m). ECD at onset 1.51 sg; mud weight
            1.41 sg. Cause: induced fractures in Barail sandstone. Mitigation: reduced flow rate from 2,050 to 1,750 l/min and
            pumped a 60 ppb LCM pill; losses healed in 5 hours (NPT 7 hrs). Lesson: drill the Barail between 3,150 and 3,220 m
            with ECD below 1.48 sg.
        """),
    ], "Mud log — Girujan clay balling, differential sticking, partial losses at 3,172 m.")

    # ======================================================================== W007 OIL-AX-44
    doc("DOC-W007-WCR", "W007", "Well Completion Report OIL-AX-44", "WCR", date(2021, 12, 28), 30, [
        wcr_summary("W007", date(2021, 12, 20), '20" at 60 m, 13-3/8" at 800 m, 9-5/8" at 3,010 m, 7" liner to 3,595 m',
                    "Total NPT 59 hrs: squeeze cementing (48 hrs), Namsang gas influx (5 hrs), casing held up (6 hrs)."),
        _page(9, "Well Control", 2150, 2160, """
            Minor gas influx at 2,154 m (Namsang): 0.8 m³ pit gain, flow check positive, shut in with SIDPP 120 psi.
            Cause: gas-charged Namsang sand with marginal 1.28 sg mud weight. Circulated out through the choke with 1.32 sg
            mud using the Wait & Weight method. NPT 5 hrs.
        """),
        _page(14, "Casing Programme", 0, 3600, """
            Casing: 13-3/8" to 800 m; 9-5/8" to 3,010 m (held up at 2,768 m, washed down); 7" liner 2,900–3,595 m.
            9-5/8" centralisation: one bow-spring centraliser every 4 joints through the 24° tangent (programme minimum).
        """),
        _page(22, "Cement Evaluation", 2800, 2850, """
            Poor cement bond log in 9-5/8" casing across Barail Group. Channeling detected from 2800-2850m.
            Root cause: inadequate mud removal due to low flow rates during cementing (displacement 4 bpm). Eccentric casing
            in deviated section (stand-off <60%). Squeeze cement job performed. CBL re-run showed acceptable bond.
            Recommendation: use centralizers every 2 joints in deviated sections. NPT 48 hrs.
        """),
        _page(24, "Lessons Learned", 2750, 2900, """
            Cementing lessons: centralise every 2 joints in deviated sections (stand-off ≥70%), displace at turbulent flow,
            condition mud (reduce YP) before cementing. Compare OIL-AX-66, where one centraliser per joint gave good bond.
        """),
    ], "Completion report — channeling behind 9-5/8\" casing at 2,800–2,850 m; squeeze.")

    doc("DOC-W007-CEM", "W007", "9-5/8-in Casing Cementing Report OIL-AX-44", "cementing_report", date(2021, 11, 27), 6, [
        _page(1, "Casing Running", 2760, 3010, """
            9-5/8" casing held up at 2,768 m; last three joints washed down; landed at 3,010 m. Cause: ledges in interbedded
            Barail and no wiper trip before running casing. NPT 6 hrs.
        """),
        _page(2, "Job Design", 2400, 3010, """
            Slurry: lead 1.60 sg, tail 1.90 sg. Spacer 8 m³. Planned displacement 4 bpm (laminar) to limit ECD. Centralisers
            1 per 4 joints (bow-spring). Stand-off modelled 55–60% through 24° tangent.
        """),
        _page(3, "Job Execution & Returns", 2400, 3010, """
            Pumped as planned; full returns. Bumped plug with 500 psi over final circulating pressure. Floats held.
            Note: low displacement rate and poor stand-off create channeling risk in the deviated Barail section.
        """),
    ], "9-5/8\" cementing — casing held up; low-rate displacement and sparse centralisation.")

    # ======================================================================== W008 OIL-AX-33
    doc("DOC-W008-DDR51", "W008", "DDR OIL-AX-33 Day 51", "DDR", date(2023, 8, 5), 11, [
        ddr_header("W008", 51, date(2023, 8, 5), 3561, 3610, '8-1/2"', '9-5/8" at 3,015 m', "KCl-polymer WBM",
                   "Drilled Kopili into Sylhet top. Gas kick at 3,590 m; shut in; killed with 1.55 sg mud (Driller's Method); "
                   "induced losses during kill; stabilised at 1.52 sg.",
                   "Circulate, condition, flow check; drill Sylhet at 1.52 sg."),
        ddr_params("W008", 2, 3561, 3590, 7.0, "Drilling break at 3,586 m (ROP 7 → 16 m/hr) before the kick; SPP declined 180 psi."),
        _page(9, "Well Control Incident", 3580, 3610, """
            Gas kick detected at 3590m. Pit gain of 3.2 m³. Flow check positive. Shut-in drill pipe pressure 450 psi.
            Root cause: unexpected overpressure zone at top of Sylhet Limestone. Pore pressure exceeded mud weight (1.45 sg vs
            estimated 1.38 sg). Actions: shut in well, circulated kill mud (1.55 sg) using Driller's Method. Well controlled
            after 6 hours. Increased mud weight to 1.52 sg for subsequent section. NPT 12 hrs.
        """),
        _page(10, "Post-kill Operations", 3600, 3615, """
            Induced losses of 9 m³ while circulating 1.55 sg kill mud (3,600–3,615 m): kill-mud ECD exceeded the Sylhet
            fracture gradient. Reduced circulating rate, spotted an LCM pill and stabilised at 1.52 sg. NPT 4 hrs.
            Lesson: enter the Sylhet with ≥1.52 sg mud weight and flow-check every drilling break below 3,560 m.
        """),
    ], "Day 51 — gas kick at 3,590 m (pit gain 3.2 m³, SIDPP 450 psi); killed at 1.55 sg.")

    doc("DOC-W008-WCR", "W008", "Well Completion Report OIL-AX-33", "WCR", date(2023, 9, 10), 26, [
        wcr_summary("W008", date(2023, 8, 28), '20" at 60 m, 13-3/8" at 800 m, 9-5/8" at 3,015 m, 7" liner to 3,745 m',
                    "Total NPT 18 hrs: kick at Sylhet top (12 hrs), induced losses (4 hrs), Kopili tight hole (2 hrs)."),
        _page(7, "Drilling Problems Summary", 3410, 3425, """
            Kopili: tight hole on wiper trip at 3,410–3,425 m; reamed through without sticking. KCl held at 7% and mud weight
            1.44 sg throughout the Kopili. The 7% KCl practice adopted after OIL-AX-88 prevented a stuck-pipe event in the
            Kopili. NPT 2 hrs.
        """),
        _page(10, "Pore Pressure Review", 3560, 3620, """
            Post-well pore pressure review: the Sylhet top at 3,578 m is overpressured (~1.50 sg EMW), not the prognosed
            1.38 sg. The Kopili acts as a seal. Offset OIL-AX-66 recorded the same transition at 3,596 m. Recommendation for
            future wells: weight up to ≥1.52 sg before the Sylhet top and treat any drilling break below 3,560 m as a potential
            kick indicator.
        """),
    ], "Completion report — Sylhet overpressure review and Kopili KCl practice.")

    # ======================================================================== W009, W010 NPT reports
    doc("DOC-W009-NPT", "W009", "NPT Report OIL-AX-22", "NPT_report", date(2022, 8, 24), 4, [
        _page(1, "NPT Overview", 0, 3500, """
            NPT report OIL-AX-22 (near-vertical development well, TD 3,500 m in Kopili). Total NPT 14 hrs across two events:
            torque/stick-slip near TD (6 hrs) and mud pump failure (8 hrs).
        """),
        _page(2, "NPT Event 1", 3480, 3498, """
            Erratic torque rising from 15 to 27 kN·m with stick-slip at 3,480–3,498 m; TD called early at 3,500 m.
            Cause: cuttings bed and PDC bit whirl in the Kopili. Actions: reduced WOB, increased RPM and pumped sweeps.
            NPT 6 hrs.
        """),
        _page(3, "NPT Event 2", 2310, 2320, """
            Mud pump #2 failure (fluid-end valve washout) at 2,315 m; drilled on a single pump at reduced rate. Valves and
            seats replaced; pump-maintenance check added to the tour sheet. NPT 8 hrs.
        """),
    ], "NPT — lower Kopili torque/stick-slip; mud pump failure.")

    doc("DOC-W010-NPT", "W010", "NPT Report OIL-AX-11", "NPT_report", date(2022, 3, 30), 4, [
        _page(1, "NPT Overview", 0, 3680, """
            NPT report OIL-AX-11 (29° J-profile, TD 3,680 m in Sylhet). Total NPT 13 hrs: momentary stuck pipe in Kopili (3 hrs)
            and top-drive IBOP failure (10 hrs).
        """),
        _page(2, "NPT Event 1", 3395, 3410, """
            Pipe stuck momentarily on a connection at 3,402 m with 150 kN overpull; worked free with jars in 2 hours.
            Cause: swelling Kopili shale with KCl depleted to 4.5%. KCl restored to 7%. Lesson: check KCl every tour while in
            the Kopili. NPT 3 hrs.
        """),
        _page(3, "NPT Event 2", 1980, 1985, """
            Top drive IBOP actuator failure at 1,982 m (hydraulic seal); actuator replaced from rig spares. NPT 10 hrs.
        """),
    ], "NPT — momentary stuck pipe at 3,402 m (KCl 4.5%); top-drive failure.")

    doc("DOC-W011-WCR", "W011", "Well Completion Report OIL-AX-05", "WCR", date(2021, 1, 30), 20, [
        wcr_summary("W011", date(2021, 1, 18), '20" at 50 m, 13-3/8" at 780 m, 9-5/8" at 2,990 m',
                    "Vertical exploration well; TD 3,550 m in Kopili. Total NPT 18 hrs."),
        _page(4, "Drilling Problems", 1420, 1425, """
            Lost a tricone bit cone at 1,422 m (Tipam); recovered with a reverse-circulation junk basket after 14 hours.
            Cause: bearing failure after excessive on-bottom hours. Bit-hour limits introduced for the Tipam.
        """),
        _page(5, "Drilling Problems", 2520, 3372, """
            Seepage losses of 1.5 m³/hr at 2,520–2,540 m in permeable Barail sand; background LCM added (NPT 1 hr).
            Kopili: cavings and tight hole at 3,360–3,372 m; reamed; mud weight raised to 1.43 sg (NPT 3 hrs).
        """),
    ], "Completion report — bit cone fishing, seepage losses, Kopili cavings.")

    # ======================================================================== Regional WCRs
    for wid, dt, casing, prob_page in [
        ("W012", date(2019, 10, 25), '13-3/8" at 850 m, 9-5/8" at 3,050 m', _page(3, "Drilling Problems", 3140, 3165, """
            Partial losses of 10 m³/hr at 3,142 m in fractured Barail sandstone; LCM pills and reduced flow rate; NPT 6 hrs.""")),
        ("W013", date(2018, 4, 5), '13-3/8" at 760 m, 9-5/8" at 2,980 m', _page(3, "Drilling Problems", 3410, 3420, """
            Pipe stuck at 3,414 m after a connection in swelling Kopili shale; jarred free after 12 hours with spotting fluid.""")),
        ("W014", date(2018, 1, 8), '13-3/8" at 830 m, 9-5/8" at 3,060 m', _page(3, "Well Control", 3570, 3585, """
            Gas kick with 2.1 m³ pit gain at 3,572 m (Sylhet top); shut in and killed with 1.54 sg mud by Driller's method;
            NPT 10 hrs. Overpressured Sylhet top below the Kopili seal.""")),
        ("W015", date(2016, 5, 28), '13-3/8" at 870 m, 9-5/8" at 3,000 m', _page(3, "Cement Evaluation", 2810, 2840, """
            Poor cement bond across 2,810–2,840 m behind 9-5/8" casing; remedial squeeze; attributed to low displacement rate.""")),
    ]:
        w = W[wid]
        doc(f"DOC-{wid}-WCR", wid, f"Well Completion Report {w['name']}", "WCR", dt, 18, [
            wcr_summary(wid, w["comp"], casing, f"Regional exploration well, {w['field']}."),
            prob_page,
        ], f"Regional completion report — {w['name']}.")

    # ======================================================================== W001 active well
    doc("DOC-W001-DDR68", "W001", "DDR OIL-AX-102 Day 68", "DDR", date(2026, 9, 28), 5, [
        ddr_header("W001", 68, date(2026, 9, 28), 3062, 3100, '8-1/2"', '9-5/8" at 3,020 m', "KCl-polymer WBM",
                   "Drilled 8-1/2\" hole in Barail Group from 3,062 m to 3,100 m. Parameters steady, no losses.",
                   "Drill ahead in Barail towards the Kopili Shale (prognosed top 3,290 m)."),
        ddr_params("W001", 2, 3062, 3100, 6.5),
        _page(3, "Operations Time Log", 3062, 3100, """
            00:00–05:30 Drilled 3,062–3,078 m, WOB 17 t, 120 RPM, 1,900 l/min. 05:30–06:00 Survey: 28.1° / 40°.
            06:00–14:00 Drilled 3,078–3,092 m. 14:00–14:30 Circulated bottoms-up, shakers clean. 14:30–24:00 Drilled to 3,100 m.
            Pit volume stable; no losses; background gas 25 units.
        """),
        _page(4, "Cumulative Events & NPT", 0, 3100, """
            Cumulative NPT to date 12 hrs. (1) Tight hole while pulling out at 610–655 m in Girujan clays with 15 t (147 kN)
            overpull; back-reamed, MW raised to 1.12 sg, 3% KCl added (3 hrs). (2) Bit balling in Namsang claystone at
            1,845 m; ROP fell from 18 to 4 m/hr; tripped for a PDC with larger junk slots, flow raised to 3,000 l/min (9 hrs).
        """),
    ], "Active well Day 68 — drilling Barail at 3,100 m; no losses.")

    doc("DOC-W001-PROG", "W001", "Casing & Mud Programme OIL-AX-102", "casing_report", date(2026, 7, 10), 12, [
        _page(1, "Casing Programme", 0, 3800, """
            Casing programme OIL-AX-102: 20" conductor 50 m; 13-3/8" surface casing 790 m (Girujan base); 9-5/8" intermediate
            3,020 m (Barail); 7" liner 2,920–3,800 m (TD in Sylhet). J-profile: KOP 1,500 m, build 2°/30 m to 28°, azimuth 40°.
        """),
        _page(2, "Mud Programme", 0, 3800, """
            Mud programme (planned MW): Girujan 1.12 sg; Tipam 1.20 sg; Namsang 1.30 sg; Barail 1.40 sg; Kopili 1.44 sg;
            Sylhet 1.44 sg (prognosed pore pressure 1.38 sg). KCl-polymer WBM from 800 m, KCl 6–7%.
        """),
        _page(3, "Cementing Programme", 2400, 3800, """
            9-5/8" casing: centralisers per standard (1 per 3 joints in tangent). 7" liner: lead 1.60 sg, tail 1.90 sg,
            displacement 1,200 l/min. Programme prepared before NWIS offset review.
        """),
    ], "Active-well programme — casing, mud weights by formation, cementing.")

    return docs
