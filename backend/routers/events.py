from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import ACTIVE_WELL_ID
from database import get_db
from models import Document, DocumentChunk, DrillingEvent, Well
from schemas import ChunkOut, DocumentOut, EventOut
from services.geo import haversine_km
from services.taxonomy import EVENT_LABELS, EVENT_TO_FAMILY, RISK_FAMILIES

router = APIRouter(prefix="/api/events", tags=["events"])


def _wells_in_radius(db: Session, radius_km: float | None) -> set[str] | None:
    if radius_km is None:
        return None
    a = db.get(Well, ACTIVE_WELL_ID)
    return {w.id for w in db.scalars(select(Well)).all()
            if haversine_km(a.latitude, a.longitude, w.latitude, w.longitude) <= radius_km}


def _with_well(db: Session, events: list[DrillingEvent]) -> list[dict]:
    wells = {w.id: w for w in db.scalars(select(Well)).all()}
    docs = {d.id: d for d in db.scalars(select(Document)).all()}
    out = []
    for e in events:
        d = docs.get(e.source_document_id or "")
        out.append(EventOut.model_validate(e).model_dump(mode="json") | dict(
            well_name=wells[e.well_id].name if e.well_id in wells else e.well_id,
            event_label=EVENT_LABELS.get(e.event_type, e.event_type),
            risk_family=EVENT_TO_FAMILY.get(e.event_type, e.event_type),
            document_title=d.title if d else None, document_type=d.doc_type if d else None,
        ))
    return out


@router.get("")
def list_events(well_id: str | None = None, event_type: str | None = None, formation: str | None = None,
                severity: str | None = None, depth_min: float | None = None, depth_max: float | None = None,
                radius_km: float | None = Query(None, gt=0), include_active: bool = True,
                db: Session = Depends(get_db)):
    stmt = select(DrillingEvent)
    if well_id:
        stmt = stmt.where(DrillingEvent.well_id == well_id)
    if event_type:
        types = RISK_FAMILIES.get(event_type, [event_type])
        stmt = stmt.where(DrillingEvent.event_type.in_(types))
    if formation:
        stmt = stmt.where(DrillingEvent.formation.ilike(f"{formation.split()[0]}%"))
    if severity:
        stmt = stmt.where(DrillingEvent.severity.in_(severity.split(",")))
    if depth_min is not None:
        stmt = stmt.where(DrillingEvent.depth_end >= depth_min)
    if depth_max is not None:
        stmt = stmt.where(DrillingEvent.depth_start <= depth_max)
    events = db.scalars(stmt.order_by(DrillingEvent.depth_start)).all()
    inside = _wells_in_radius(db, radius_km)
    if inside is not None:
        events = [e for e in events if e.well_id in inside]
    if not include_active:
        events = [e for e in events if e.well_id != ACTIVE_WELL_ID]
    return {"events": _with_well(db, events), "total": len(events)}


@router.get("/at-depth")
def events_at_depth(depth: float, formation: str | None = None, radius_km: float = 25.0, window: float = 75.0,
                    db: Session = Depends(get_db)):
    inside = _wells_in_radius(db, radius_km) or set()
    stmt = select(DrillingEvent).where(DrillingEvent.depth_start - window <= depth,
                                       DrillingEvent.depth_end + window >= depth)
    events = [e for e in db.scalars(stmt).all() if e.well_id in inside and e.well_id != ACTIVE_WELL_ID]
    if formation:
        events = [e for e in events if e.formation.lower().startswith(formation.split()[0].lower())]
    events.sort(key=lambda e: abs((e.depth_start + e.depth_end) / 2 - depth))
    return {"events": _with_well(db, events), "wells_affected": sorted({e.well_id for e in events}),
            "depth": depth, "window": window}


@router.get("/timeline")
def timeline(well_id: str = ACTIVE_WELL_ID, db: Session = Depends(get_db)):
    events = db.scalars(select(DrillingEvent).where(DrillingEvent.well_id == well_id).order_by(DrillingEvent.date)).all()
    rows = _with_well(db, events)
    return {"timeline": [dict(id=r["id"], date=r["date"], depth_start=r["depth_start"], depth_end=r["depth_end"],
                              event_type=r["event_type"], event_label=r["event_label"], severity=r["severity"],
                              title=r["title"], formation=r["formation"], npt_hours=r["npt_hours"]) for r in rows]}


@router.get("/{event_id}")
def event_detail(event_id: str, db: Session = Depends(get_db)):
    e = db.get(DrillingEvent, event_id)
    if not e:
        raise HTTPException(404, f"Event {event_id} not found")
    doc = db.get(Document, e.source_document_id) if e.source_document_id else None
    chunk = None
    if doc:
        chunk = db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == doc.id,
                                                       DocumentChunk.page == e.source_page)).first()
    return {"event": _with_well(db, [e])[0],
            "document": DocumentOut.model_validate(doc).model_dump(mode="json") if doc else None,
            "source_chunk": ChunkOut.model_validate(chunk).model_dump(mode="json") if chunk else None}
