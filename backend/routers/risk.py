from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import ACTIVE_WELL_ID
from database import get_db
from models import Alert, AlertAudit, RiskZone
from schemas import AcknowledgeRequest, RiskEvaluateRequest, RiskZoneOut
from services import risk_engine
from services.taxonomy import RISK_LABELS

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.post("/evaluate")
def evaluate(req: RiskEvaluateRequest, db: Session = Depends(get_db)):
    params = req.parameters.model_dump(exclude_none=True) if req.parameters else None
    try:
        return risk_engine.evaluate(db, req.well_id, req.current_depth, params, req.radius_km, persist=req.persist)
    except KeyError:
        raise HTTPException(404, f"Well {req.well_id} not found")


@router.get("/zones")
def zones(formation: str | None = None, db: Session = Depends(get_db)):
    stmt = select(RiskZone).order_by(RiskZone.depth_start)
    rows = db.scalars(stmt).all()
    if formation:
        rows = [z for z in rows if z.formation.lower().startswith(formation.split()[0].lower())]
    return {"zones": [RiskZoneOut.model_validate(z).model_dump(mode="json") | {"risk_label": RISK_LABELS.get(z.risk_type, z.risk_type)}
                      for z in rows]}


@router.get("/alerts")
def alerts(well_id: str = ACTIVE_WELL_ID, db: Session = Depends(get_db)):
    rows = db.scalars(select(Alert).where(Alert.well_id == well_id).order_by(Alert.created_at)).all()
    return {"alerts": [risk_engine.alert_dict(a) for a in rows]}


@router.post("/acknowledge")
def acknowledge(req: AcknowledgeRequest, db: Session = Depends(get_db)):
    a = db.get(Alert, req.alert_id)
    if not a:
        raise HTTPException(404, f"Alert {req.alert_id} not found")
    a.status = req.status
    a.notes = req.notes
    a.updated_at = datetime.utcnow()
    db.add(AlertAudit(alert_id=a.id, action=req.status, actor=req.actor, notes=req.notes or f"Marked {req.status}"))
    db.commit()
    return {"success": True, "alert": risk_engine.alert_dict(a)}


@router.get("/alerts/{alert_id}/audit")
def audit(alert_id: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(AlertAudit).where(AlertAudit.alert_id == alert_id).order_by(AlertAudit.timestamp)).all()
    return {"audit": [dict(action=r.action, depth=r.depth, actor=r.actor, notes=r.notes,
                           timestamp=r.timestamp.isoformat() + "Z") for r in rows]}


@router.get("/profile")
def profile(well_id: str = ACTIVE_WELL_ID, radius_km: float = 25.0, step: float = 10.0, db: Session = Depends(get_db)):
    return risk_engine.risk_profile(db, well_id, radius_km, max(step, 5.0))


@router.get("/clusters")
def clusters(well_id: str = ACTIVE_WELL_ID, radius_km: float = 25.0, db: Session = Depends(get_db)):
    return {"clusters": risk_engine.event_clusters(db, well_id, radius_km)}


@router.get("/model")
def model_card():
    return {
        "name": "NWIS explainable hybrid risk score",
        "weights": risk_engine.WEIGHTS,
        "thresholds": risk_engine.THRESHOLDS,
        "lookahead_m": risk_engine.LOOKAHEAD_M,
        "approach_window_m": risk_engine.APPROACH_M,
        "factors": {
            "proximity": "1.0 inside the offset event window; up to 0.5 when approaching (linear over 150 m); decays after passing.",
            "frequency": "Distinct offset wells within the radius with this event in the window ÷ 5 (capped at 1).",
            "similarity": "Mean well-similarity (formations, coverage, trajectory, parameters, distance) of those offsets.",
            "formation": "1.0 when drilling the zone formation; 0.5 within 50 m above its prognosed top.",
            "parameter": "Share of the risk family's live signals flagged against programme / rolling baseline / offset limits.",
            "trajectory": "Inclination match with the offset well at the event depth.",
        },
        "alert_policy": "High/critical-history zones alert at ≥0.55; medium/low-history zones alert only at ≥0.75 "
                        "(live signal confirmation). Below that, the assessment is shown as a watch card.",
        "limitations": [
            "Rule-weighted, not statistically calibrated — scores rank risk, they are not probabilities.",
            "Demo data is synthetic; weights must be tuned on authorised OIL history before operational use.",
            "Decision support only — the engineer remains the decision maker.",
        ],
    }
