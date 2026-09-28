"""Mud-weight window: prognosed pore pressure & fracture gradient, calibrated by offset evidence.

Offsets tell us where the prognosis was wrong:
* a loss event with a recorded loss-onset ECD caps the fracture gradient at that ECD over the event interval;
* a kick / overpressure event with a post-event mud weight raises pore pressure to ~0.02 sg below it.

Each calibration keeps its source event so the chart can say *why* the line moved.
"""
from __future__ import annotations

from bisect import bisect_left

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import CasingString, DrillingEvent, Formation, ParameterSample, Well
from services.geo import haversine_km
from services.taxonomy import EVENT_TO_FAMILY

TAPER_M = 25.0  # blend calibrated values in/out over this distance


def _formation_at(forms: list[Formation], md: float) -> Formation | None:
    cur = None
    for f in forms:
        if f.top_md <= md:
            cur = f
    return cur


def pressure_window(db: Session, well_id: str, radius_km: float = 25.0, step: float = 10.0) -> dict:
    well = db.get(Well, well_id)
    if well is None:
        raise KeyError(well_id)
    forms = db.scalars(select(Formation).where(Formation.well_id == well_id).order_by(Formation.top_md)).all()
    casing = db.scalars(select(CasingString).where(CasingString.well_id == well_id).order_by(CasingString.shoe_md)).all()
    samples = db.scalars(select(ParameterSample).where(ParameterSample.well_id == well_id).order_by(ParameterSample.md)).all()
    s_md = [s.md for s in samples]

    offsets = {w.id: w for w in db.scalars(select(Well).where(Well.id != well_id)).all()
               if haversine_km(well.latitude, well.longitude, w.latitude, w.longitude) <= radius_km}
    events = db.scalars(select(DrillingEvent).where(DrillingEvent.well_id.in_(list(offsets)))).all() if offsets else []

    frac_caps, pore_floors = [], []
    for e in events:
        fam = EVENT_TO_FAMILY.get(e.event_type)
        p = e.event_params or {}
        if fam == "mud_loss" and p.get("ecd"):
            frac_caps.append(dict(start=e.depth_start, end=e.depth_end, value=float(p["ecd"]), event_id=e.id,
                                  well=offsets[e.well_id].name, note=f"loss-onset ECD {p['ecd']} sg"))
        if fam == "kick":
            ref = p.get("post_kick_mud_weight") or p.get("mud_weight_after")
            if ref:
                pore_floors.append(dict(start=e.depth_start, end=e.depth_end + 40, value=round(float(ref) - 0.02, 3),
                                        event_id=e.id, well=offsets[e.well_id].name,
                                        note=f"controlled at {ref} sg → pore ≈ {float(ref) - 0.02:.2f} sg"))

    def weight(md: float, start: float, end: float) -> float:
        if start <= md <= end:
            return 1.0
        d = start - md if md < start else md - end
        return max(0.0, 1 - d / TAPER_M)

    rows = []
    md = 0.0
    while md <= well.total_depth_md + 1e-6:
        f = _formation_at(forms, md)
        pore = f.pore_pressure_sg if f else None
        frac = f.frac_gradient_sg if f else None
        pore_cal, frac_cal = pore, frac
        for c in frac_caps:
            w = weight(md, c["start"], c["end"])
            if w > 0 and frac_cal is not None:
                frac_cal = min(frac_cal, frac_cal - w * max(0.0, frac_cal - c["value"]))
        for c in pore_floors:
            w = weight(md, c["start"], c["end"])
            if w > 0 and pore_cal is not None:
                pore_cal = max(pore_cal, pore_cal + w * max(0.0, c["value"] - pore_cal))
        plan = (well.mud_program or {}).get(f.name) if f else None
        i = bisect_left(s_md, md)
        s = samples[min(i, len(samples) - 1)] if samples else None
        rows.append(dict(
            md=md, formation=f.name if f else None,
            pore_prognosed=pore, frac_prognosed=frac,
            pore_calibrated=round(pore_cal, 3) if pore_cal is not None else None,
            frac_calibrated=round(frac_cal, 3) if frac_cal is not None else None,
            mw_plan=plan, mw=s.mud_weight if s else None, ecd=s.ecd if s else None,
        ))
        md += step

    # Where does the plan leave the calibrated window?
    breaches = []
    for kind, test, msg in [
        ("kick", lambda r: r["mw_plan"] is not None and r["pore_calibrated"] is not None and r["mw_plan"] < r["pore_calibrated"],
         "Planned mud weight is below the offset-calibrated pore pressure"),
        ("losses", lambda r: r["mw_plan"] is not None and r["frac_calibrated"] is not None and r["mw_plan"] + 0.05 > r["frac_calibrated"],
         "Planned ECD (MW + 0.05) exceeds the offset-calibrated fracture gradient"),
    ]:
        hits = [r["md"] for r in rows if test(r)]
        if hits:
            breaches.append(dict(kind=kind, start=hits[0], end=hits[-1], message=msg))

    return dict(
        well_id=well_id, radius_km=radius_km, step=step, rows=rows,
        calibrations=[dict(kind="frac_cap", **c) for c in frac_caps] + [dict(kind="pore_floor", **c) for c in pore_floors],
        casing=[dict(name=c.name, size=c.size_in, top_md=c.top_md, shoe_md=c.shoe_md, planned=bool(c.planned)) for c in casing],
        breaches=breaches,
    )
