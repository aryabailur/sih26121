from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import ACTIVE_WELL_ID, DEFAULT_START_DEPTH
from database import get_db
from models import Document, DrillingEvent, Formation, ParameterSample, SurveyPoint, Well
from schemas import DocumentOut, EventOut, FormationOut, SimilarityOut, SurveyOut, WellDetail, WellSummary
from services import risk_engine, similarity
from services.geo import bearing_deg, compass, haversine_km
from services.taxonomy import EVENT_TO_FAMILY, SEVERITY_ORDER

router = APIRouter(prefix="/api/wells", tags=["wells"])


def _enriched(db: Session, anchor: Well) -> list[dict]:
    sims = similarity.similarity_map(db, anchor.id)
    events = db.scalars(select(DrillingEvent)).all()
    by_well: dict[str, list[DrillingEvent]] = defaultdict(list)
    for e in events:
        by_well[e.well_id].append(e)
    docs = defaultdict(int)
    for d in db.scalars(select(Document)).all():
        if d.well_id:
            docs[d.well_id] += 1
    out = []
    for w in db.scalars(select(Well).order_by(Well.id)).all():
        evs = by_well.get(w.id, [])
        dist = haversine_km(anchor.latitude, anchor.longitude, w.latitude, w.longitude)
        brg = bearing_deg(anchor.latitude, anchor.longitude, w.latitude, w.longitude)
        s = sims.get(w.id)
        worst = max((e.severity for e in evs), key=lambda x: SEVERITY_ORDER[x], default=None)
        out.append(dict(
            **WellSummary.model_validate(w).model_dump(mode="json"),
            distance_km=round(dist, 2), bearing=round(brg, 1), direction=compass(brg) if w.id != anchor.id else "—",
            similarity=round(s.score, 3) if s else (1.0 if w.id == anchor.id else None),
            event_count=len(evs), npt_hours=round(sum(e.npt_hours for e in evs), 1),
            history_severity=worst, event_types=sorted({e.event_type for e in evs}),
            risk_families=sorted({EVENT_TO_FAMILY.get(e.event_type, e.event_type) for e in evs}),
            document_count=docs.get(w.id, 0),
        ))
    return out


@router.get("")
def list_wells(db: Session = Depends(get_db)):
    anchor = db.get(Well, ACTIVE_WELL_ID)
    return {"wells": _enriched(db, anchor), "active_well_id": ACTIVE_WELL_ID}


@router.get("/active")
def active_well(db: Session = Depends(get_db)):
    w = db.get(Well, ACTIVE_WELL_ID)
    if not w:
        raise HTTPException(404, "Active well not found — run seed_data.py")
    ctx = risk_engine.load_context(db, w.id, 25.0)
    depth = w.current_depth_md or DEFAULT_START_DEPTH
    fm = ctx.formation_at(depth)
    forms = db.scalars(select(Formation).where(Formation.well_id == w.id).order_by(Formation.top_md)).all()
    return {
        "well": WellDetail.model_validate(w).model_dump(mode="json"),
        "formations": [FormationOut.model_validate(f).model_dump(mode="json") for f in forms],
        "current_state": {
            "depth": depth, "formation": fm.name if fm else None,
            "parameters": risk_engine.simulated_parameters(ctx, depth),
            "status": "drilling", "feed": "simulated eRTMAC (demo)",
        },
    }


@router.get("/nearby")
def nearby(lat: float = 27.2510, lon: float = 95.3520, radius_km: float = Query(25.0, gt=0, le=200),
           db: Session = Depends(get_db)):
    anchor = db.get(Well, ACTIVE_WELL_ID)
    rows = [r for r in _enriched(db, anchor) if r["id"] != anchor.id]
    for r in rows:
        r["distance_km"] = round(haversine_km(lat, lon, r["latitude"], r["longitude"]), 2)
    inside = sorted([r for r in rows if r["distance_km"] <= radius_km], key=lambda r: r["distance_km"])
    return {"wells": inside, "distances": {r["id"]: r["distance_km"] for r in inside}, "radius_km": radius_km,
            "outside_count": len(rows) - len(inside)}


@router.get("/trajectories")
def trajectories(db: Session = Depends(get_db)):
    out = {}
    for w in db.scalars(select(Well)).all():
        pts = db.scalars(select(SurveyPoint).where(SurveyPoint.well_id == w.id).order_by(SurveyPoint.md)).all()
        sel = [p for i, p in enumerate(pts) if i % 3 == 0 or i == len(pts) - 1]
        out[w.id] = [dict(md=p.md, lat=p.latitude, lon=p.longitude, planned=bool(p.is_planned)) for p in sel]
    return {"trajectories": out}


@router.get("/{well_id}")
def well_profile(well_id: str, db: Session = Depends(get_db)):
    w = db.get(Well, well_id)
    if not w:
        raise HTTPException(404, f"Well {well_id} not found")
    forms = db.scalars(select(Formation).where(Formation.well_id == well_id).order_by(Formation.top_md)).all()
    events = db.scalars(select(DrillingEvent).where(DrillingEvent.well_id == well_id).order_by(DrillingEvent.depth_start)).all()
    survey = db.scalars(select(SurveyPoint).where(SurveyPoint.well_id == well_id).order_by(SurveyPoint.md)).all()
    docs = db.scalars(select(Document).where(Document.well_id == well_id).order_by(Document.date)).all()
    anchor = db.get(Well, ACTIVE_WELL_ID)
    sim = similarity.similarity_map(db, ACTIVE_WELL_ID).get(well_id)
    return {
        "well": WellDetail.model_validate(w).model_dump(mode="json"),
        "formations": [FormationOut.model_validate(f).model_dump(mode="json") for f in forms],
        "events": [EventOut.model_validate(e).model_dump(mode="json") for e in events],
        "survey": [SurveyOut.model_validate(s).model_dump(mode="json") for s in survey],
        "documents": [DocumentOut.model_validate(d).model_dump(mode="json") for d in docs],
        "similarity_to_active": SimilarityOut.model_validate(sim).model_dump(mode="json") if sim else None,
        "distance_to_active_km": round(haversine_km(anchor.latitude, anchor.longitude, w.latitude, w.longitude), 2),
    }


@router.get("/{well_id}/similarity")
def well_similarity(well_id: str, db: Session = Depends(get_db)):
    if not db.get(Well, well_id):
        raise HTTPException(404, f"Well {well_id} not found")
    sims = similarity.similarity_map(db, well_id)
    rows = sorted(sims.values(), key=lambda s: -s.score)
    return {"similarities": [SimilarityOut.model_validate(s).model_dump(mode="json") for s in rows],
            "weights": similarity.WEIGHTS}


@router.get("/{well_id}/parameters")
def well_parameters(well_id: str, md_min: float = 0, md_max: float = 10000, step: float = Query(10, ge=1),
                    db: Session = Depends(get_db)):
    rows = db.scalars(select(ParameterSample).where(
        ParameterSample.well_id == well_id, ParameterSample.md >= md_min, ParameterSample.md <= md_max,
    ).order_by(ParameterSample.md)).all()
    out, last = [], -1e9
    for r in rows:
        if r.md - last >= step - 1e-6:
            out.append(dict(md=r.md, rop=r.rop, wob=r.wob, torque=r.torque, rpm=r.rpm, flow_rate=r.flow_rate,
                            standpipe_pressure=r.standpipe_pressure, mud_weight=r.mud_weight, ecd=r.ecd,
                            hook_load=r.hook_load, gas_units=r.gas_units))
            last = r.md
    return {"well_id": well_id, "samples": out}
