from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import ACTIVE_WELL_ID
from database import get_db
from models import DrillingEvent, Formation, Well
from schemas import FormationOut
from services.taxonomy import EVENT_LABELS, FORMATIONS

router = APIRouter(prefix="/api/formations", tags=["formations"])


@router.get("")
def formations(well_id: str = ACTIVE_WELL_ID, db: Session = Depends(get_db)):
    rows = db.scalars(select(Formation).where(Formation.well_id == well_id).order_by(Formation.top_md)).all()
    return {"formations": [FormationOut.model_validate(f).model_dump(mode="json") for f in rows]}


@router.get("/correlate")
def correlate(well_ids: str, db: Session = Depends(get_db)):
    ids = [w.strip() for w in well_ids.split(",") if w.strip()]
    wells = {w.id: w for w in db.scalars(select(Well).where(Well.id.in_(ids))).all()}
    forms = db.scalars(select(Formation).where(Formation.well_id.in_(ids))).all()
    events = db.scalars(select(DrillingEvent).where(DrillingEvent.well_id.in_(ids))).all()
    correlation = []
    for name in FORMATIONS:
        per_well = []
        for wid in ids:
            f = next((x for x in forms if x.well_id == wid and x.name == name), None)
            if f is None or wid not in wells:
                continue
            evs = [e for e in events if e.well_id == wid and f.top_md <= (e.depth_start + e.depth_end) / 2 < f.base_md]
            per_well.append(dict(
                well_id=wid, well_name=wells[wid].name, top_md=f.top_md, base_md=f.base_md,
                thickness=round(f.base_md - f.top_md, 1), prognosed=bool(f.is_prognosed),
                events=[dict(id=e.id, event_type=e.event_type, label=EVENT_LABELS.get(e.event_type, e.event_type),
                             depth_start=e.depth_start, depth_end=e.depth_end, severity=e.severity) for e in evs],
            ))
        if per_well:
            tops = [p["top_md"] for p in per_well]
            correlation.append(dict(formation=name, wells=per_well, top_spread_m=round(max(tops) - min(tops), 1),
                                    risk_tags=next((f.risk_tags for f in forms if f.name == name), []),
                                    event_count=sum(len(p["events"]) for p in per_well)))
    return {"correlation": correlation, "well_ids": ids}
