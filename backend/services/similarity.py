"""Offset-well similarity.

score = 0.30·formation_overlap + 0.15·depth_coverage + 0.20·trajectory_similarity
      + 0.15·parameter_similarity + 0.20·distance_score

Each component is in [0, 1] and is reported with a plain-language reason so the
similarity badge in the UI can always be explained.
"""
from __future__ import annotations

import math
from bisect import bisect_left

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Formation, ParameterSample, SurveyPoint, Well, WellSimilarity
from services.geo import haversine_km

WEIGHTS = dict(formation=0.30, coverage=0.15, trajectory=0.20, parameter=0.15, distance=0.20)


def _interp(xs: list[float], ys: list[float], x: float) -> float:
    if not xs:
        return 0.0
    i = bisect_left(xs, x)
    if i <= 0:
        return ys[0]
    if i >= len(xs):
        return ys[-1]
    x0, x1 = xs[i - 1], xs[i]
    t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
    return ys[i - 1] + t * (ys[i] - ys[i - 1])


def well_profile(db: Session, well_id: str) -> dict:
    w = db.get(Well, well_id)
    forms = db.scalars(select(Formation).where(Formation.well_id == well_id)).all()
    survey = db.scalars(select(SurveyPoint).where(SurveyPoint.well_id == well_id).order_by(SurveyPoint.md)).all()
    samples = db.scalars(select(ParameterSample).where(ParameterSample.well_id == well_id).order_by(ParameterSample.md)).all()
    return dict(
        well=w,
        tops={f.name: f.top_md for f in forms},
        s_md=[s.md for s in survey], s_inc=[s.inclination for s in survey],
        p_md=[p.md for p in samples], p_mw=[p.mud_weight for p in samples], p_tq=[p.torque for p in samples],
    )


def compare_profiles(a: dict, b: dict) -> dict:
    wa, wb = a["well"], b["well"]
    shared = [f for f in a["tops"] if f in b["tops"]]
    if shared:
        closeness = [max(0.0, 1 - abs(a["tops"][f] - b["tops"][f]) / 150) for f in shared]
        formation_overlap = (sum(closeness) / len(closeness)) * (len(shared) / max(len(a["tops"]), 1))
    else:
        formation_overlap = 0.0
    depth_coverage = min(1.0, wb.total_depth_md / max(wa.total_depth_md, 1))

    top = min(wa.total_depth_md, wb.total_depth_md)
    grid = [d for d in range(100, int(top), 100)]
    if grid:
        dinc = [abs(_interp(a["s_md"], a["s_inc"], d) - _interp(b["s_md"], b["s_inc"], d)) for d in grid]
        trajectory_similarity = max(0.0, 1 - (sum(dinc) / len(dinc)) / 25)
        dmw = [abs(_interp(a["p_md"], a["p_mw"], d) - _interp(b["p_md"], b["p_mw"], d)) for d in grid]
        dtq = [abs(_interp(a["p_md"], a["p_tq"], d) - _interp(b["p_md"], b["p_tq"], d)) /
               max(_interp(a["p_md"], a["p_tq"], d), 1) for d in grid]
        parameter_similarity = 0.5 * max(0.0, 1 - (sum(dmw) / len(dmw)) / 0.1) + 0.5 * max(0.0, 1 - (sum(dtq) / len(dtq)) / 0.5)
    else:
        trajectory_similarity = parameter_similarity = 0.0

    dist = haversine_km(wa.latitude, wa.longitude, wb.latitude, wb.longitude)
    distance_score = math.exp(-dist / 15)

    score = (WEIGHTS["formation"] * formation_overlap + WEIGHTS["coverage"] * depth_coverage
             + WEIGHTS["trajectory"] * trajectory_similarity + WEIGHTS["parameter"] * parameter_similarity
             + WEIGHTS["distance"] * distance_score)

    max_inc_b = max(b["s_inc"]) if b["s_inc"] else 0
    max_inc_a = max(a["s_inc"]) if a["s_inc"] else 0
    reasons = [
        f"{len(shared)} of {len(a['tops'])} formations shared; tops within "
        f"{max((abs(a['tops'][f] - b['tops'][f]) for f in shared), default=0):.0f} m.",
        f"Offset TD {wb.total_depth_md:,.0f} m covers {depth_coverage * 100:.0f}% of the planned {wa.total_depth_md:,.0f} m.",
        f"Trajectory: max inclination {max_inc_b:.0f}° vs {max_inc_a:.0f}° planned.",
        f"Mud-weight / torque profile agreement {parameter_similarity * 100:.0f}%.",
        f"Surface distance {dist:.1f} km.",
    ]
    return dict(
        score=round(score, 3), formation_overlap=round(formation_overlap, 3), depth_coverage=round(depth_coverage, 3),
        trajectory_similarity=round(trajectory_similarity, 3), parameter_similarity=round(parameter_similarity, 3),
        distance_km=round(dist, 2), reasons=reasons,
    )


def compute_all(db: Session, anchor_id: str) -> list[WellSimilarity]:
    anchor = well_profile(db, anchor_id)
    rows = []
    for w in db.scalars(select(Well).where(Well.id != anchor_id)).all():
        c = compare_profiles(anchor, well_profile(db, w.id))
        rows.append(WellSimilarity(well_a_id=anchor_id, well_b_id=w.id, **c))
    return rows


def similarity_map(db: Session, anchor_id: str) -> dict[str, WellSimilarity]:
    rows = db.scalars(select(WellSimilarity).where(WellSimilarity.well_a_id == anchor_id)).all()
    if not rows:
        rows = compute_all(db, anchor_id)
        db.add_all(rows)
        db.commit()
    return {r.well_b_id: r for r in rows}
