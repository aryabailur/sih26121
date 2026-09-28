"""Synthetic Upper Assam Shelf field: wells, formation tops, trajectories and events.

All values are synthetic and generated for the SIH26121 demo. The six mandated seed
stories (Section 3.4 of the master spec) are reproduced verbatim; the remaining events
are designed so that offsets corroborate each other by formation and depth.
"""
from __future__ import annotations

import math
from datetime import date

CORE_FIELD = "Dikhow East (Demo Field)"
BASIN = "Upper Assam Shelf"

# ---------------------------------------------------------------------------------------
# Wells. W001–W011 use the exact coordinates / depths from the spec. W012–W015 are
# regional offsets placed 28–47 km away so the radius control has something to filter.
# ---------------------------------------------------------------------------------------
WELLS = [
    dict(id="W001", name="OIL-AX-102", role="active", status="drilling", lat=27.2510, lon=95.3520, td=3800, cur=3100,
         spud=date(2026, 7, 23), comp=None, well_type="development", target="Sylhet Limestone", rig="Rig DR-07 (2000 HP)",
         field=CORE_FIELD, kop=1500, build=2.0, inc=28.0, az=40.0),
    dict(id="W002", name="OIL-AX-99", role="offset", status="completed", lat=27.2580, lon=95.3610, td=3650, cur=3650,
         spud=date(2023, 2, 2), comp=date(2023, 4, 10), well_type="development", target="Sylhet Limestone", rig="Rig DR-04",
         field=CORE_FIELD, kop=1400, build=2.0, inc=26.0, az=55.0),
    dict(id="W003", name="OIL-AX-88", role="offset", status="completed", lat=27.2450, lon=95.3450, td=3720, cur=3720,
         spud=date(2022, 9, 15), comp=date(2022, 12, 2), well_type="development", target="Sylhet Limestone", rig="Rig DR-07",
         field=CORE_FIELD, kop=1600, build=2.0, inc=30.0, az=220.0),
    dict(id="W004", name="OIL-AX-77", role="offset", status="completed", lat=27.2620, lon=95.3380, td=3580, cur=3580,
         spud=date(2021, 12, 17), comp=date(2022, 2, 25), well_type="development", target="Kopili Shale", rig="Rig DR-02",
         field=CORE_FIELD, kop=1200, build=2.5, inc=35.0, az=300.0),
    dict(id="W005", name="OIL-AX-66", role="offset", status="completed", lat=27.2390, lon=95.3590, td=3900, cur=3900,
         spud=date(2021, 5, 6), comp=date(2021, 7, 30), well_type="development", target="Sylhet Limestone", rig="Rig DR-04",
         field=CORE_FIELD, kop=1700, build=2.0, inc=27.0, az=150.0, dogleg_at=3400),
    dict(id="W006", name="OIL-AX-55", role="offset", status="completed", lat=27.2550, lon=95.3700, td=3450, cur=3450,
         spud=date(2022, 4, 10), comp=date(2022, 6, 8), well_type="development", target="Barail Group", rig="Rig DR-02",
         field=CORE_FIELD, kop=2200, build=1.0, inc=8.0, az=90.0),
    dict(id="W007", name="OIL-AX-44", role="offset", status="completed", lat=27.2430, lon=95.3350, td=3600, cur=3600,
         spud=date(2021, 10, 1), comp=date(2021, 12, 20), well_type="development", target="Kopili Shale", rig="Rig DR-07",
         field=CORE_FIELD, kop=1500, build=2.0, inc=24.0, az=250.0),
    dict(id="W008", name="OIL-AX-33", role="offset", status="completed", lat=27.2670, lon=95.3550, td=3750, cur=3750,
         spud=date(2023, 6, 16), comp=date(2023, 8, 28), well_type="development", target="Sylhet Limestone", rig="Rig DR-04",
         field=CORE_FIELD, kop=1800, build=2.0, inc=22.0, az=10.0),
    dict(id="W009", name="OIL-AX-22", role="offset", status="completed", lat=27.2480, lon=95.3680, td=3500, cur=3500,
         spud=date(2022, 7, 1), comp=date(2022, 8, 24), well_type="development", target="Kopili Shale", rig="Rig DR-02",
         field=CORE_FIELD, kop=2400, build=1.0, inc=6.0, az=120.0),
    dict(id="W010", name="OIL-AX-11", role="offset", status="completed", lat=27.2600, lon=95.3470, td=3680, cur=3680,
         spud=date(2022, 1, 20), comp=date(2022, 3, 30), well_type="development", target="Sylhet Limestone", rig="Rig DR-07",
         field=CORE_FIELD, kop=1500, build=2.0, inc=29.0, az=330.0),
    dict(id="W011", name="OIL-AX-05", role="offset", status="completed", lat=27.2350, lon=95.3500, td=3550, cur=3550,
         spud=date(2020, 11, 5), comp=date(2021, 1, 18), well_type="exploration", target="Kopili Shale", rig="Rig DR-02",
         field=CORE_FIELD, kop=0, build=0.0, inc=2.0, az=0.0),
    dict(id="W012", name="OIL-DG-07", role="offset", status="completed", lat=27.4289, lon=95.5520, td=3620, cur=3620,
         spud=date(2019, 8, 1), comp=date(2019, 10, 15), well_type="exploration", target="Barail Group", rig="Rig DR-01",
         field="Dirak Block (regional)", kop=0, build=0.0, inc=1.5, az=0.0),
    dict(id="W013", name="OIL-MR-15", role="offset", status="completed", lat=27.2510, lon=95.0086, td=3480, cur=3480,
         spud=date(2018, 1, 20), comp=date(2018, 3, 28), well_type="exploration", target="Kopili Shale", rig="Rig DR-01",
         field="Namdang Block (regional)", kop=0, build=0.0, inc=2.5, az=0.0),
    dict(id="W014", name="OIL-DB-03", role="offset", status="completed", lat=27.5114, lon=95.0591, td=3800, cur=3800,
         spud=date(2017, 10, 2), comp=date(2017, 12, 30), well_type="exploration", target="Sylhet Limestone", rig="Rig DR-01",
         field="Tingrai Block (regional)", kop=0, build=0.0, inc=1.0, az=0.0),
    dict(id="W015", name="OIL-TK-11", role="offset", status="abandoned", lat=27.6477, lon=95.5144, td=3300, cur=3300,
         spud=date(2016, 3, 15), comp=date(2016, 5, 20), well_type="exploration", target="Barail Group", rig="Rig DR-01",
         field="Burhi Dihing Block (regional)", kop=0, build=0.0, inc=1.0, az=0.0),
]

FORMATION_DEFS = [
    # name, lithology, risk tags
    ("Girujan Shale", "shale / clay", ["wellbore_instability"]),
    ("Tipam Sandstone", "sandstone", []),
    ("Namsang Formation", "sandstone / shale", ["overpressure"]),
    ("Barail Group", "sandstone / shale", ["mud_loss", "overpressure"]),
    ("Kopili Shale", "shale", ["stuck_pipe", "wellbore_instability"]),
    ("Sylhet Limestone", "limestone", ["kick", "lost_circulation"]),
]

# Formation tops (MD, m) for Tipam, Namsang, Barail, Kopili, Sylhet. Girujan starts at 0.
FORMATION_TOPS = {
    "W001": [790, 1590, 2380, 3290, 3575],
    "W002": [805, 1610, 2395, 3300, 3595],
    "W003": [795, 1600, 2410, 3310, 3605],
    "W004": [820, 1625, 2420, 3320, 3610],
    "W005": [785, 1580, 2375, 3285, 3590],
    "W006": [810, 1605, 2400, 3305, 3600],
    "W007": [800, 1595, 2390, 3295, 3585],
    "W008": [798, 1598, 2388, 3292, 3578],
    "W009": [815, 1615, 2405, 3315, 3610],
    "W010": [792, 1592, 2385, 3298, 3600],
    "W011": [780, 1585, 2370, 3280, 3600],
    "W012": [850, 1660, 2450, 3340, 3640],
    "W013": [760, 1540, 2330, 3250, 3560],
    "W014": [830, 1640, 2430, 3330, 3565],
    "W015": [870, 1690, 2470, 3360, 3660],
}

SYLHET_BASE = 3950.0

# Prognosed reservoir / geomechanics properties per formation:
# (porosity %, pore pressure sg EMW, fracture gradient sg EMW). The Barail fracture gradient
# sits close to drilling ECD (the loss mechanism); the Sylhet is overpressured below the Kopili seal
# but was prognosed at 1.38 sg — the gap that caused the OIL-AX-33 kick.
FORMATION_PROPS = {
    "Girujan Shale": (32.0, 1.04, 1.58),
    "Tipam Sandstone": (24.0, 1.07, 1.64),
    "Namsang Formation": (20.0, 1.20, 1.70),
    "Barail Group": (18.0, 1.26, 1.56),
    "Kopili Shale": (6.0, 1.36, 1.76),
    "Sylhet Limestone": (11.0, 1.38, 1.62),
}


def formation_props(well_id: str, name: str) -> tuple[float, float, float]:
    """Per-well variation of the field properties (deterministic, ±2% porosity, ±0.01 sg)."""
    por, pp, fg = FORMATION_PROPS[name]
    k = (sum(ord(c) for c in well_id + name) % 5) - 2
    return round(por + k * 0.8, 1), round(pp + k * 0.005, 3), round(fg + k * 0.005, 3)


# Casing programmes (size, top MD, shoe MD). Active well: 7" liner is planned.
def casing_program(well_id: str, td: float) -> list[tuple[str, str, float, float, bool]]:
    tops = FORMATION_TOPS[well_id]
    inter_shoe = {"W001": 3020, "W002": 3005, "W003": 3020, "W004": 3040, "W005": 2995, "W006": 3010,
                  "W007": 3010, "W008": 3015, "W009": 3030, "W010": 3000, "W011": 2990}.get(well_id, 3000)
    out = [
        ("conductor", '20"', 0.0, 50.0 if well_id in ("W001", "W011") else 60.0, False),
        ("surface", '13-3/8"', 0.0, float(round(tops[0])), False),
        ("intermediate", '9-5/8"', 0.0, float(inter_shoe), False),
    ]
    if td > inter_shoe + 100:
        out.append(("production liner", '7"', float(inter_shoe - 100), float(td - 5), well_id == "W001"))
    return out


def formation_intervals(well_id: str, td: float) -> list[tuple[str, float, float, str, list[str]]]:
    tops = [0.0] + [float(t) for t in FORMATION_TOPS[well_id]]
    bases = tops[1:] + [SYLHET_BASE]
    out = []
    for (name, lith, tags), top, base in zip(FORMATION_DEFS, tops, bases):
        if top >= td - 5:
            break
        out.append((name, top, min(base, td), lith, tags))
    return out


def formation_at(well_id: str, md: float) -> str:
    tops = FORMATION_TOPS[well_id]
    name = FORMATION_DEFS[0][0]
    for (fname, _, _), top in zip(FORMATION_DEFS[1:], tops):
        if md >= top:
            name = fname
    return name


# ---------------------------------------------------------------------------------------
# Trajectories — J-type profiles (vertical → build → tangent) at 30 m survey stations.
# ---------------------------------------------------------------------------------------
def build_trajectory(w: dict, station: float = 30.0) -> list[dict]:
    lat0, lon0 = w["lat"], w["lon"]
    kop, build, max_inc, az = w["kop"], w["build"], w["inc"], w["az"]
    td = w["td"]
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat0))
    points = []
    md = 0.0
    tvd = north = east = 0.0
    prev_inc = 0.0
    while md <= td + 0.01:
        if build <= 0:
            inc = max_inc if md > 300 else max_inc * md / 300
        elif md <= kop:
            inc = 0.3
        else:
            inc = min(max_inc, 0.3 + (md - kop) / 30.0 * build)
        # W005's documented dogleg (8°/30 m) around 3,400 m — the key-seat story.
        if w.get("dogleg_at") and abs(md - w["dogleg_at"]) <= 15:
            inc = max_inc + 4.0
        if points:
            d_md = station
            avg_inc = math.radians((inc + prev_inc) / 2)
            tvd += d_md * math.cos(avg_inc)
            horiz = d_md * math.sin(avg_inc)
            north += horiz * math.cos(math.radians(az))
            east += horiz * math.sin(math.radians(az))
        dogleg = abs(inc - prev_inc) if points else 0.0
        points.append(dict(
            md=round(md, 1), tvd=round(tvd, 1), inclination=round(inc, 2), azimuth=az,
            latitude=lat0 + north / m_per_deg_lat, longitude=lon0 + east / m_per_deg_lon,
            dogleg=round(dogleg, 2),
        ))
        prev_inc = inc
        md += station
    return points


# ---------------------------------------------------------------------------------------
# Drilling events. Six mandated stories + corroborating offsets + routine NPT.
# ---------------------------------------------------------------------------------------
def _e(**kw):
    kw.setdefault("event_params", {})
    kw.setdefault("lessons_learned", "")
    return kw


EVENTS = [
    # ---------------- W001 OIL-AX-102 (active — only intervals already drilled) -----------------
    _e(id="EV-W001-01", well_id="W001", event_type="wellbore_instability", title="Tight hole in Girujan clays",
       depth_start=610, depth_end=655, formation="Girujan Shale", severity="low", date=date(2026, 7, 27),
       description="Tight hole while pulling out at 610–655 m in Girujan clays with 15 t (147 kN) overpull; interval back-reamed.",
       root_cause="Hydration of reactive Girujan clays in 1.10 sg WBM after an extended circulation.",
       mitigation_action="Back-reamed the interval, raised mud weight to 1.12 sg and added 3% KCl.",
       lessons_learned="Maintain KCl ≥3% in top-hole and minimise open-hole time before running 13-3/8\" casing.",
       npt_hours=3, source_document_id="DOC-W001-DDR68", source_page=4, source_section="Cumulative Events & NPT"),
    _e(id="EV-W001-02", well_id="W001", event_type="NPT", title="Bit balling in Namsang claystone",
       depth_start=1845, depth_end=1850, formation="Namsang Formation", severity="low", date=date(2026, 8, 14),
       description="Bit balling in Namsang claystone; ROP fell from 18 to 4 m/hr; tripped for bit change.",
       root_cause="Sticky claystone with insufficient bit hydraulics (HSI 1.8).",
       mitigation_action="Changed to a PDC bit with larger junk slots and raised flow to 3,000 l/min; ROP restored.",
       lessons_learned="Plan HSI ≥2.5 and anti-balling nozzles for the Namsang interval.",
       npt_hours=9, source_document_id="DOC-W001-DDR68", source_page=4, source_section="Cumulative Events & NPT"),

    # ---------------- W002 OIL-AX-99 -----------------
    _e(id="EV-W002-01", well_id="W002", event_type="mud_loss", title="Total loss of circulation in fractured Barail sandstone",
       depth_start=3150, depth_end=3220, formation="Barail Group", severity="critical", date=date(2023, 3, 15),
       description="Total loss of circulation encountered at 3150m while drilling through fractured Barail sandstone. Mud weight was 1.42 sg. Lost 45 m³ of OBM over 6 hours.",
       root_cause="Natural fractures in Barail sandstone exacerbated by high ECD (1.52 sg).",
       mitigation_action="Reduced mud weight to 1.38 sg, pumped LCM pills (calcium carbonate + graphite), cured losses after 18 hours.",
       lessons_learned="Keep ECD ≤1.48 sg between 3,100 and 3,250 m, pre-treat with 15 ppb background LCM before 3,140 m and drill the interval at reduced flow rate.",
       npt_hours=18, source_document_id="DOC-W002-DDR42", source_page=3, source_section="Operations Time Log & Losses",
       event_params={"mud_weight": 1.42, "ecd": 1.52, "loss_volume_m3": 45, "cure_mud_weight": 1.38}),
    _e(id="EV-W002-02", well_id="W002", event_type="lost_circulation", title="Seepage losses in upper Barail sand",
       depth_start=2960, depth_end=2985, formation="Barail Group", severity="low", date=date(2023, 3, 13),
       description="Seepage losses of 2–3 m³/hr at 2,962 m in permeable Barail sand; total 6 m³ lost.",
       root_cause="Permeable Barail sand with 1.40 sg mud weight.",
       mitigation_action="Added 15 ppb fine CaCO₃ background LCM; losses stopped within 2 hours.",
       lessons_learned="Carry background LCM from 2,900 m in Barail.",
       npt_hours=2, source_document_id="DOC-W002-DDR40", source_page=2, source_section="Operations Summary",
       event_params={"mud_weight": 1.40}),
    _e(id="EV-W002-03", well_id="W002", event_type="wellbore_instability", title="Tight spot in Kopili on wiper trip",
       depth_start=3440, depth_end=3455, formation="Kopili Shale", severity="low", date=date(2023, 3, 24),
       description="Tight spot at 3,448 m during wiper trip with 20 t (196 kN) overpull; reamed twice.",
       root_cause="Time-dependent swelling / creep of Kopili shale.",
       mitigation_action="Reamed the interval and raised mud weight from 1.42 to 1.44 sg.",
       lessons_learned="Schedule wiper trips before Kopili exposure exceeds 72 hours.",
       npt_hours=4, source_document_id="DOC-W002-WCR", source_page=6, source_section="Drilling Problems Summary"),
    _e(id="EV-W002-04", well_id="W002", event_type="cementing_failure", title="7\" liner cement shortfall across Barail loss zone",
       depth_start=3000, depth_end=3220, formation="Barail Group", severity="medium", date=date(2023, 4, 2),
       description="7\" liner cementing: partial losses of 12 m³ during displacement; top of cement evaluated 180 m below plan.",
       root_cause="Cementing across the not-fully-healed Barail loss zone; ECD during displacement reached 1.58 sg.",
       mitigation_action="Top-up squeeze through the liner lap; lightweight (1.55 sg) lead slurry adopted for future wells.",
       lessons_learned="Cure losses fully before cementing and use a lightweight lead slurry across the Barail.",
       npt_hours=14, source_document_id="DOC-W002-WCR", source_page=9, source_section="Casing & Cementing",
       event_params={"ecd": 1.58}),

    # ---------------- W003 OIL-AX-88 -----------------
    _e(id="EV-W003-01", well_id="W003", event_type="stuck_pipe", title="Stuck pipe (differential sticking) during connection",
       depth_start=3380, depth_end=3420, formation="Kopili Shale", severity="high", date=date(2022, 11, 8),
       description="Pipe stuck at 3400m during connection. Overpull of 80 kN. Shale swelling observed in cuttings.",
       root_cause="Reactive Kopili shale swelling due to inadequate KCl inhibition in mud system. Hole left open for 45 minutes during BHA change.",
       mitigation_action="Spotted 15 m³ of diesel-based spotting fluid, worked pipe for 12 hours, freed at 120 kN overpull. Increased KCl to 7% in mud system.",
       lessons_learned="Maintain KCl ≥7% before entering the Kopili, keep static time under 15 minutes and spot a pill before BHA changes.",
       npt_hours=36, source_document_id="DOC-W003-DDR55", source_page=7, source_section="Stuck Pipe Incident",
       event_params={"overpull_kn": 80, "kcl_pct": 4.0, "static_minutes": 45, "mud_weight": 1.43}),
    _e(id="EV-W003-02", well_id="W003", event_type="wellbore_instability", title="Kopili cavings and erratic torque",
       depth_start=3350, depth_end=3370, formation="Kopili Shale", severity="medium", date=date(2022, 11, 6),
       description="Splintery cavings (15% of returns) and erratic torque at 3,352–3,370 m; 3 m³ of cavings over 6 hours.",
       root_cause="Mechanical instability of Kopili shale with 1.41 sg mud weight below the collapse gradient.",
       mitigation_action="Raised mud weight to 1.43 sg and pumped high-viscosity sweeps.",
       lessons_learned="Enter the Kopili with ≥1.43 sg mud weight.",
       npt_hours=5, source_document_id="DOC-W003-DDR53", source_page=4, source_section="Hole Condition"),
    _e(id="EV-W003-03", well_id="W003", event_type="NPT", title="MWD pulser failure",
       depth_start=2600, depth_end=2615, formation="Barail Group", severity="low", date=date(2022, 10, 22),
       description="MWD pulser failure at 2,612 m; pulled out of hole to change the tool.",
       root_cause="Pulser seal failure (LCM plugging suspected).",
       mitigation_action="Replaced MWD tool; screened LCM particle size to the MWD tolerance.",
       npt_hours=11, source_document_id="DOC-W003-WCR", source_page=5, source_section="NPT Summary"),
    _e(id="EV-W003-04", well_id="W003", event_type="fishing", title="Wireline logging tool stuck in Sylhet",
       depth_start=3700, depth_end=3715, formation="Sylhet Limestone", severity="medium", date=date(2022, 11, 28),
       description="Density-neutron logging tool stuck at 3,712 m; recovered by cut-and-thread fishing on drill pipe.",
       root_cause="Differential sticking of the logging tool against permeable Sylhet limestone (1.44 sg overbalance).",
       mitigation_action="Cut-and-thread fishing with overshot; tool recovered after 22 hours.",
       lessons_learned="Log the Sylhet on drill pipe (TLC) or minimise stationary readings.",
       npt_hours=22, source_document_id="DOC-W003-WCR", source_page=8, source_section="Logging Operations"),

    # ---------------- W004 OIL-AX-77 -----------------
    _e(id="EV-W004-01", well_id="W004", event_type="torque_spike", title="Progressive torque increase with stick-slip",
       depth_start=3500, depth_end=3540, formation="Kopili Shale", severity="medium", date=date(2022, 2, 14),
       description="Progressive torque increase from 14 kN·m to 32 kN·m while drilling 3500-3540m. Intermittent stick-slip observed.",
       root_cause="Poor hole cleaning in high-angle section (35°). Cuttings bed accumulation in Kopili shale.",
       mitigation_action="Increased flow rate from 1800 to 2200 l/min, rotated off-bottom at 120 RPM for 30 min every 2 stands. Torque normalized.",
       lessons_learned="Drill the lower Kopili at ≥2,200 l/min where inclination exceeds 30°.",
       npt_hours=8, source_document_id="DOC-W004-DDR60", source_page=2, source_section="Drilling Parameters & Events",
       event_params={"torque_before": 14, "torque_peak": 32, "inclination": 35, "flow_after": 2200}),
    _e(id="EV-W004-02", well_id="W004", event_type="wellbore_instability", title="Pack-off tendency in high-angle Kopili",
       depth_start=3460, depth_end=3475, formation="Kopili Shale", severity="low", date=date(2022, 2, 12),
       description="Pack-off tendency with standpipe pressure spikes of +250 psi at 3,468 m.",
       root_cause="Cuttings loading in the 35° tangent section.",
       mitigation_action="Reduced ROP to 8 m/hr and pumped tandem sweeps.",
       npt_hours=3, source_document_id="DOC-W004-ML", source_page=3, source_section="Drilling Events Log"),
    _e(id="EV-W004-03", well_id="W004", event_type="fishing", title="Drill-string twist-off in Namsang",
       depth_start=2240, depth_end=2245, formation="Namsang Formation", severity="high", date=date(2022, 1, 19),
       description="Drill-string twist-off at 2,241 m (fatigue crack in a 6-1/2\" drill collar pin); 142 m fish recovered with an overshot after two runs.",
       root_cause="Connection fatigue from high lateral vibration in Namsang interbeds.",
       mitigation_action="Fished with an 8-1/8\" overshot; instituted drill-collar inspection every 250 rotating hours.",
       lessons_learned="Run downhole vibration monitoring through the Namsang interbeds.",
       npt_hours=30, source_document_id="DOC-W004-ML", source_page=2, source_section="Drilling Events Log"),

    # ---------------- W005 OIL-AX-66 -----------------
    _e(id="EV-W005-01", well_id="W005", event_type="stuck_pipe", title="Mechanical sticking at key seat",
       depth_start=3390, depth_end=3430, formation="Kopili Shale", severity="high", date=date(2021, 6, 22),
       description="Mechanical sticking at 3410m due to key seating in dogleg. Torque increased from 12 kN·m to 28 kN·m over 30 minutes.",
       root_cause="Key seat formation at 3400m dogleg (8°/30m). Insufficient reaming during trip out.",
       mitigation_action="Back-reamed to 3350m, reamed down with under-reamer, freed pipe. Modified tripping procedures to include reaming every stand.",
       lessons_learned="Keep doglegs below 5°/30 m in the Kopili and ream every stand when tripping through it.",
       npt_hours=24, source_document_id="DOC-W005-DDR48", source_page=5, source_section="Stuck Pipe Incident",
       event_params={"torque_before": 12, "torque_peak": 28, "dogleg_deg_30m": 8}),
    _e(id="EV-W005-02", well_id="W005", event_type="overpressure", title="Overpressure indications at Sylhet top",
       depth_start=3595, depth_end=3610, formation="Sylhet Limestone", severity="medium", date=date(2021, 7, 1),
       description="High background gas (180 → 420 units) and connection gas at the Sylhet top (3,596 m); mud weight raised from 1.44 to 1.50 sg.",
       root_cause="Transition into overpressured Sylhet limestone below the Kopili seal.",
       mitigation_action="Weighted up in 0.02 sg steps to 1.50 sg; flow checks negative; controlled drilling at 5 m/hr.",
       lessons_learned="Weight up to at least 1.50 sg before the Sylhet top.",
       npt_hours=6, source_document_id="DOC-W005-DDR57", source_page=3, source_section="Gas & Pressure Evaluation",
       event_params={"mud_weight_before": 1.44, "mud_weight_after": 1.50}),
    _e(id="EV-W005-03", well_id="W005", event_type="lost_circulation", title="Partial losses in vuggy Sylhet limestone",
       depth_start=3720, depth_end=3760, formation="Sylhet Limestone", severity="medium", date=date(2021, 7, 12),
       description="Partial losses of 6–10 m³/hr in vuggy Sylhet limestone between 3,720 and 3,760 m.",
       root_cause="Vuggy / fractured carbonate with 1.50 sg mud weight.",
       mitigation_action="Pumped LCM pills and reduced mud weight from 1.50 to 1.48 sg.",
       npt_hours=10, source_document_id="DOC-W005-CEM", source_page=2, source_section="Pre-job Well Conditions"),

    # ---------------- W006 OIL-AX-55 -----------------
    _e(id="EV-W006-01", well_id="W006", event_type="mud_loss", title="Partial losses in Barail sandstone",
       depth_start=3170, depth_end=3205, formation="Barail Group", severity="medium", date=date(2022, 5, 21),
       description="Partial losses of 8–12 m³/hr at 3,172 m; 38 m³ lost in total.",
       root_cause="Induced fractures in Barail sandstone at an ECD of 1.51 sg.",
       mitigation_action="Reduced flow rate from 2,050 to 1,750 l/min and pumped a 60 ppb LCM pill; losses healed in 5 hours.",
       lessons_learned="Drill the Barail between 3,150 and 3,220 m with ECD below 1.48 sg.",
       npt_hours=7, source_document_id="DOC-W006-ML", source_page=3, source_section="Losses & Gas Record",
       event_params={"ecd": 1.51, "mud_weight": 1.41}),
    _e(id="EV-W006-02", well_id="W006", event_type="wellbore_instability", title="Clay balling and tight hole in Girujan",
       depth_start=450, depth_end=520, formation="Girujan Shale", severity="low", date=date(2022, 4, 13),
       description="Hole enlargement and clay balling in the Girujan; tight hole on trip out.",
       root_cause="Reactive clays with low inhibition.",
       mitigation_action="Reamed; added 3% KCl and glycol.",
       npt_hours=3, source_document_id="DOC-W006-ML", source_page=1, source_section="Lithology & Hole Condition"),
    _e(id="EV-W006-03", well_id="W006", event_type="differential_sticking", title="Differential sticking after survey",
       depth_start=2880, depth_end=2890, formation="Barail Group", severity="medium", date=date(2022, 5, 12),
       description="Differential sticking after a 10-minute static survey at 2,886 m; freed with 40 t (392 kN) overpull and jarring.",
       root_cause="Depleted Barail sand, 1.40 sg overbalance and high fluid loss (API FL 6 ml).",
       mitigation_action="Jarred free in 6 hours; reduced API fluid loss below 4 ml; surveys taken while rotating slowly.",
       npt_hours=6, source_document_id="DOC-W006-ML", source_page=2, source_section="Drilling Events Log"),

    # ---------------- W007 OIL-AX-44 -----------------
    _e(id="EV-W007-01", well_id="W007", event_type="cementing_failure", title="Poor cement bond / channeling behind 9-5/8\" casing",
       depth_start=2800, depth_end=2850, formation="Barail Group", severity="medium", date=date(2021, 12, 10),
       description="Poor cement bond log in 9-5/8\" casing across Barail Group. Channeling detected from 2800-2850m.",
       root_cause="Inadequate mud removal due to low flow rates during cementing. Eccentric casing in deviated section.",
       mitigation_action="Squeeze cement job performed. CBL re-run showed acceptable bond. Recommendation: use centralizers every 2 joints in deviated sections.",
       lessons_learned="Use centralizers every 2 joints in deviated sections and displace at turbulent flow.",
       npt_hours=48, source_document_id="DOC-W007-WCR", source_page=22, source_section="Cement Evaluation"),
    _e(id="EV-W007-02", well_id="W007", event_type="kick", title="Minor gas influx in Namsang",
       depth_start=2150, depth_end=2160, formation="Namsang Formation", severity="low", date=date(2021, 10, 29),
       description="Minor gas influx at 2,154 m: 0.8 m³ pit gain, flow check positive, shut in with SIDPP 120 psi.",
       root_cause="Gas-charged Namsang sand with marginal 1.28 sg mud weight.",
       mitigation_action="Circulated out through the choke with 1.32 sg mud (Wait & Weight method).",
       npt_hours=5, source_document_id="DOC-W007-WCR", source_page=9, source_section="Well Control"),
    _e(id="EV-W007-03", well_id="W007", event_type="NPT", title="9-5/8\" casing held up",
       depth_start=2760, depth_end=2790, formation="Barail Group", severity="low", date=date(2021, 11, 25),
       description="9-5/8\" casing held up at 2,768 m; last three joints washed down; landed at 3,010 m.",
       root_cause="Ledges in interbedded Barail and no wiper trip before running casing.",
       mitigation_action="Circulated and washed down; casing landed at 3,010 m.",
       npt_hours=6, source_document_id="DOC-W007-CEM", source_page=1, source_section="Casing Running"),

    # ---------------- W008 OIL-AX-33 -----------------
    _e(id="EV-W008-01", well_id="W008", event_type="kick", title="Gas kick at the Sylhet top",
       depth_start=3580, depth_end=3610, formation="Sylhet Limestone", severity="critical", date=date(2023, 8, 5),
       description="Gas kick detected at 3590m. Pit gain of 3.2 m³. Flow check positive. Shut-in drill pipe pressure 450 psi.",
       root_cause="Unexpected overpressure zone at top of Sylhet Limestone. Pore pressure exceeded mud weight (1.45 sg vs estimated 1.38 sg).",
       mitigation_action="Shut in well, circulated kill mud (1.55 sg) using Driller's Method. Well controlled after 6 hours. Increased mud weight to 1.52 sg for subsequent section.",
       lessons_learned="Enter the Sylhet with ≥1.52 sg mud weight and flow-check every drilling break below 3,560 m.",
       npt_hours=12, source_document_id="DOC-W008-DDR51", source_page=9, source_section="Well Control Incident",
       event_params={"mud_weight": 1.45, "pit_gain_m3": 3.2, "sidpp_psi": 450, "kill_mud_weight": 1.55, "post_kick_mud_weight": 1.52}),
    _e(id="EV-W008-02", well_id="W008", event_type="lost_circulation", title="Induced losses during kill circulation",
       depth_start=3600, depth_end=3615, formation="Sylhet Limestone", severity="medium", date=date(2023, 8, 5),
       description="Induced losses of 9 m³ while circulating 1.55 sg kill mud.",
       root_cause="Kill-mud ECD exceeded the Sylhet fracture gradient.",
       mitigation_action="Reduced circulating rate, spotted an LCM pill and stabilised at 1.52 sg.",
       npt_hours=4, source_document_id="DOC-W008-DDR51", source_page=10, source_section="Post-kill Operations"),
    _e(id="EV-W008-03", well_id="W008", event_type="wellbore_instability", title="Tight hole in Kopili on wiper trip",
       depth_start=3410, depth_end=3425, formation="Kopili Shale", severity="low", date=date(2023, 7, 28),
       description="Tight hole on wiper trip at 3,410–3,425 m; reamed through without sticking (KCl held at 7%).",
       root_cause="Minor shale swelling.",
       mitigation_action="Reamed through; maintained 7% KCl and 1.44 sg mud weight.",
       lessons_learned="The 7% KCl practice adopted after OIL-AX-88 prevented a stuck-pipe event in the Kopili.",
       npt_hours=2, source_document_id="DOC-W008-WCR", source_page=7, source_section="Drilling Problems Summary"),

    # ---------------- W009 OIL-AX-22 -----------------
    _e(id="EV-W009-01", well_id="W009", event_type="torque_spike", title="Erratic torque and stick-slip near TD",
       depth_start=3480, depth_end=3498, formation="Kopili Shale", severity="medium", date=date(2022, 8, 15),
       description="Erratic torque rising from 15 to 27 kN·m with stick-slip at 3,480–3,498 m; TD called early at 3,500 m.",
       root_cause="Cuttings bed and PDC bit whirl in the Kopili.",
       mitigation_action="Reduced WOB, increased RPM and pumped sweeps; TD called at 3,500 m.",
       npt_hours=6, source_document_id="DOC-W009-NPT", source_page=2, source_section="NPT Event 1",
       event_params={"torque_before": 15, "torque_peak": 27}),
    _e(id="EV-W009-02", well_id="W009", event_type="NPT", title="Mud pump failure",
       depth_start=2310, depth_end=2320, formation="Namsang Formation", severity="low", date=date(2022, 7, 27),
       description="Mud pump #2 failure (fluid-end valve washout); drilled on a single pump at reduced rate.",
       root_cause="Worn fluid-end valves.",
       mitigation_action="Replaced valves and seats; added a pump-maintenance check to the tour sheet.",
       npt_hours=8, source_document_id="DOC-W009-NPT", source_page=3, source_section="NPT Event 2"),

    # ---------------- W010 OIL-AX-11 -----------------
    _e(id="EV-W010-01", well_id="W010", event_type="stuck_pipe", title="Momentary stuck pipe on connection",
       depth_start=3395, depth_end=3410, formation="Kopili Shale", severity="medium", date=date(2022, 3, 8),
       description="Pipe stuck momentarily on a connection at 3,402 m with 150 kN overpull; worked free in 2 hours.",
       root_cause="Swelling Kopili shale with KCl depleted to 4.5%.",
       mitigation_action="Worked pipe with jars and freed it in 2 hours; KCl restored to 7%.",
       lessons_learned="Check KCl every tour while in the Kopili.",
       npt_hours=3, source_document_id="DOC-W010-NPT", source_page=2, source_section="NPT Event 1",
       event_params={"overpull_kn": 150, "kcl_pct": 4.5}),
    _e(id="EV-W010-02", well_id="W010", event_type="NPT", title="Top drive IBOP actuator failure",
       depth_start=1980, depth_end=1985, formation="Namsang Formation", severity="low", date=date(2022, 2, 14),
       description="Top drive IBOP actuator failure at 1,982 m; repaired on location.",
       root_cause="Hydraulic actuator seal failure.",
       mitigation_action="Replaced the actuator from rig spares.",
       npt_hours=10, source_document_id="DOC-W010-NPT", source_page=3, source_section="NPT Event 2"),

    # ---------------- W011 OIL-AX-05 -----------------
    _e(id="EV-W011-01", well_id="W011", event_type="fishing", title="Lost bit cone in Tipam",
       depth_start=1420, depth_end=1425, formation="Tipam Sandstone", severity="medium", date=date(2020, 11, 16),
       description="Lost a tricone bit cone at 1,422 m; recovered with a reverse-circulation junk basket.",
       root_cause="Bearing failure after excessive on-bottom hours.",
       mitigation_action="Junk basket run; bit-hour limits introduced for Tipam.",
       npt_hours=14, source_document_id="DOC-W011-WCR", source_page=4, source_section="Drilling Problems"),
    _e(id="EV-W011-02", well_id="W011", event_type="lost_circulation", title="Seepage losses in Barail",
       depth_start=2520, depth_end=2540, formation="Barail Group", severity="low", date=date(2020, 12, 6),
       description="Seepage losses of 1.5 m³/hr at 2,520–2,540 m.",
       root_cause="Permeable Barail sand.",
       mitigation_action="Background LCM added; losses stopped.",
       npt_hours=1, source_document_id="DOC-W011-WCR", source_page=5, source_section="Drilling Problems"),
    _e(id="EV-W011-03", well_id="W011", event_type="wellbore_instability", title="Kopili cavings and tight hole",
       depth_start=3360, depth_end=3372, formation="Kopili Shale", severity="low", date=date(2021, 1, 2),
       description="Cavings and tight hole at 3,360–3,372 m; reamed.",
       root_cause="Kopili shale instability.",
       mitigation_action="Reamed; mud weight raised to 1.43 sg.",
       npt_hours=3, source_document_id="DOC-W011-WCR", source_page=5, source_section="Drilling Problems"),

    # ---------------- Regional offsets -----------------
    _e(id="EV-W012-01", well_id="W012", event_type="mud_loss", title="Partial losses in Barail (regional)",
       depth_start=3140, depth_end=3165, formation="Barail Group", severity="medium", date=date(2019, 9, 12),
       description="Partial losses of 10 m³/hr at 3,142 m in Barail sandstone.",
       root_cause="Fractured Barail sandstone.",
       mitigation_action="LCM pills; reduced flow rate.",
       npt_hours=6, source_document_id="DOC-W012-WCR", source_page=3, source_section="Drilling Problems"),
    _e(id="EV-W013-01", well_id="W013", event_type="stuck_pipe", title="Stuck pipe in Kopili (regional)",
       depth_start=3410, depth_end=3420, formation="Kopili Shale", severity="medium", date=date(2018, 3, 4),
       description="Pipe stuck at 3,414 m after a connection; jarred free after 12 hours.",
       root_cause="Swelling Kopili shale.",
       mitigation_action="Jarring and spotting fluid.",
       npt_hours=12, source_document_id="DOC-W013-WCR", source_page=3, source_section="Drilling Problems"),
    _e(id="EV-W014-01", well_id="W014", event_type="kick", title="Gas kick at Sylhet top (regional)",
       depth_start=3570, depth_end=3585, formation="Sylhet Limestone", severity="high", date=date(2017, 11, 20),
       description="Gas kick with 2.1 m³ pit gain at 3,572 m; shut in and killed with 1.54 sg mud.",
       root_cause="Overpressured Sylhet top.",
       mitigation_action="Driller's method kill with 1.54 sg mud.",
       npt_hours=10, source_document_id="DOC-W014-WCR", source_page=3, source_section="Well Control"),
    _e(id="EV-W015-01", well_id="W015", event_type="cementing_failure", title="Poor cement bond across Barail (regional)",
       depth_start=2810, depth_end=2840, formation="Barail Group", severity="low", date=date(2016, 5, 2),
       description="Poor cement bond across 2,810–2,840 m behind 9-5/8\" casing.",
       root_cause="Low displacement rate.",
       mitigation_action="Remedial squeeze.",
       npt_hours=8, source_document_id="DOC-W015-WCR", source_page=3, source_section="Cement Evaluation"),
]

# ---------------------------------------------------------------------------------------
# Risk register. RZ01–RZ05 exactly as specified; RZ06–RZ07 were derived by clustering
# recurring offset events that the curated register did not cover.
# ---------------------------------------------------------------------------------------
RISK_ZONES = [
    dict(id="RZ01", formation="Barail Group", depth_start=3100, depth_end=3250, risk_type="mud_loss", severity="critical",
         historical_frequency=0.4, contributing_wells=["W002", "W006"], source="curated",
         description="Fractured Barail sandstone — losses when ECD exceeds ~1.50 sg."),
    dict(id="RZ02", formation="Kopili Shale", depth_start=3350, depth_end=3450, risk_type="stuck_pipe", severity="high",
         historical_frequency=0.5, contributing_wells=["W003", "W005", "W010"], source="curated",
         description="Reactive Kopili shale and dogleg key-seating — stuck pipe on connections and trips."),
    dict(id="RZ03", formation="Kopili Shale", depth_start=3480, depth_end=3550, risk_type="torque_spike", severity="medium",
         historical_frequency=0.3, contributing_wells=["W004", "W009"], source="curated",
         description="Cuttings-bed build-up in the lower Kopili — torque/drag and stick-slip."),
    dict(id="RZ04", formation="Sylhet Limestone", depth_start=3560, depth_end=3620, risk_type="kick", severity="critical",
         historical_frequency=0.2, contributing_wells=["W008"], source="curated",
         description="Overpressured Sylhet top beneath the Kopili seal — gas kicks."),
    dict(id="RZ05", formation="Barail Group", depth_start=2750, depth_end=2900, risk_type="cementing_failure", severity="medium",
         historical_frequency=0.15, contributing_wells=["W007"], source="curated",
         description="Deviated Barail section — cement channeling behind 9-5/8\" casing."),
    dict(id="RZ06", formation="Sylhet Limestone", depth_start=3595, depth_end=3765, risk_type="mud_loss", severity="medium",
         historical_frequency=0.2, contributing_wells=["W008", "W005"], source="derived",
         description="Derived by NWIS event clustering — vuggy Sylhet losses and kill-induced losses."),
    dict(id="RZ07", formation="Namsang Formation", depth_start=2230, depth_end=2330, risk_type="NPT", severity="medium",
         historical_frequency=0.2, contributing_wells=["W004", "W009"], source="derived",
         description="Derived by NWIS event clustering — equipment NPT and a twist-off in Namsang interbeds."),
]

RECOMMENDATIONS = [
    dict(id="REC-ML-01", risk_type="mud_loss", text="Hold ECD ≤1.48 sg and carry 15 ppb background LCM through 3,100–3,250 m.",
         rationale="OIL-AX-99 lost circulation at ECD 1.52 sg; OIL-AX-55 at 1.51 sg.", source_event_ids=["EV-W002-01", "EV-W006-01"]),
    dict(id="REC-SP-01", risk_type="stuck_pipe", text="Enter the Kopili with KCl ≥7%, keep static time <15 min and ream every stand through doglegs.",
         rationale="OIL-AX-88 stuck at 4% KCl after 45 min static; OIL-AX-66 key-seated in an 8°/30 m dogleg; OIL-AX-33 drilled the Kopili cleanly at 7% KCl.",
         source_event_ids=["EV-W003-01", "EV-W005-01", "EV-W010-01", "EV-W008-03"]),
    dict(id="REC-KK-01", risk_type="kick", text="Weight up to ≥1.52 sg before the Sylhet top (~3,575 m) and flow-check every drilling break.",
         rationale="OIL-AX-33 kicked at 1.45 sg; OIL-AX-66 needed 1.50 sg to control gas at the Sylhet top.",
         source_event_ids=["EV-W008-01", "EV-W005-02"]),
    dict(id="REC-TQ-01", risk_type="torque_spike", text="Drill the lower Kopili at ≥2,200 l/min with off-bottom rotation every 2 stands.",
         rationale="OIL-AX-77 normalised torque after raising flow from 1,800 to 2,200 l/min.", source_event_ids=["EV-W004-01", "EV-W009-01"]),
    dict(id="REC-CM-01", risk_type="cementing_failure", text="Centralise every 2 joints in deviated sections and displace at turbulent flow.",
         rationale="OIL-AX-44 channeling at 2,800–2,850 m traced to eccentric casing and low displacement rate.",
         source_event_ids=["EV-W007-01", "EV-W002-04"]),
]
