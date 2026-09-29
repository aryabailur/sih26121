from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from config import ACTIVE_WELL_ID, DATA_DISCLAIMER, DEFAULT_RADIUS_KM, DEFAULT_START_DEPTH, DEMO_MODE, LLM_PROVIDER
from database import SessionLocal, get_db
from models import Alert, AlertAudit, Document, DocumentChunk, DrillingEvent, Well
from schemas import ScenarioRequest
from services import document_processor as dp
from services import risk_engine, risk_model, search_engine

router = APIRouter(prefix="/api/simulation", tags=["simulation"])

SCENARIO_DEPTHS = [3100, 3120, 3140, 3150, 3160, 3180, 3200, 3250, 3300, 3350, 3370, 3380, 3400, 3420, 3450,
                   3500, 3550, 3570, 3580, 3600]

NARRATION = {
    3100: "Drilling 8-1/2\" hole in the Barail Group — mud-loss window flagged 50 m ahead.",
    3140: "Approaching the Barail loss window; ECD beginning to climb.",
    3150: "Entered the historical loss window (OIL-AX-99 total losses at 3,150 m).",
    3200: "Crossing the fractured Barail sandstone interval.",
    3300: "Kopili Shale top — reactive shale, stuck-pipe window 80 m ahead.",
    3350: "Torque trending up in the Kopili.",
    3380: "Entered the Kopili stuck-pipe window (OIL-AX-88 stuck at 3,400 m).",
    3450: "Clearing the stuck-pipe window.",
    3500: "Lower Kopili — torque/drag history at OIL-AX-77 and OIL-AX-22.",
    3570: "Approaching the Kopili–Sylhet boundary — kick window ahead.",
    3580: "Sylhet top — drilling break and SPP decline; OIL-AX-33 kicked here.",
    3600: "Scenario paused — review alerts and click “Why?”.",
}


@router.get("/ertmac")
def ertmac(well_id: str = ACTIVE_WELL_ID, depth: float = DEFAULT_START_DEPTH, db: Session = Depends(get_db)):
    ctx = risk_engine.load_context(db, well_id, DEFAULT_RADIUS_KM)
    fm = ctx.formation_at(depth)
    return {"parameters": risk_engine.simulated_parameters(ctx, depth), "trend": risk_engine.trend(ctx, depth),
            "formation": fm.name if fm else None, "timestamp": datetime.utcnow().isoformat() + "Z",
            "source": "simulated eRTMAC feed (demo)"}


@router.post("/demo-scenario")
def demo_scenario(req: ScenarioRequest, db: Session = Depends(get_db)):
    ranges = {"mud_loss": (3100, 3250), "stuck_pipe": (3300, 3450), "kick": (3500, 3600), "full": (3100, 3600)}
    lo, hi = ranges[req.scenario]
    depths = [d for d in SCENARIO_DEPTHS if lo <= d <= hi]
    ctx = risk_engine.load_context(db, ACTIVE_WELL_ID, DEFAULT_RADIUS_KM)
    steps, expected = [], []
    seen = set()
    for d in depths:
        assessments = risk_engine.assess(ctx, d, risk_engine.simulated_parameters(ctx, d))
        alerts = [a for a in assessments if a["alert_eligible"] and a["zone_id"] not in seen]
        for a in alerts:
            seen.add(a["zone_id"])
            expected.append(dict(depth=d, risk_type=a["risk_type"], risk_label=a["risk_label"], severity=a["severity"],
                                 score=a["score"], supporting_wells=[s["well_name"] for s in a["supporting_wells"]]))
        steps.append(dict(depth=d, narration=NARRATION.get(d), triggers=[a["risk_label"] for a in alerts],
                          highlight_wells=sorted({s["well_id"] for a in alerts for s in a["supporting_wells"]})))
    return {"scenario": req.scenario, "depth_progression": depths, "steps": steps, "alerts_expected": expected,
            "step_delay_ms": 1500}


@router.post("/reset")
def reset(db: Session = Depends(get_db)):
    db.execute(delete(AlertAudit))
    db.execute(delete(Alert))
    uploaded = db.scalars(select(Document).where(Document.source_status == "uploaded")).all()
    db.commit()
    for d in uploaded:
        dp.remove_uploaded(db, d.id)
    w = db.get(Well, ACTIVE_WELL_ID)
    if w:
        w.current_depth_md = DEFAULT_START_DEPTH
    db.commit()
    search_engine.rebuild_index(db)
    risk_engine.invalidate_cache()
    if uploaded:
        risk_model.retrain_in_background(SessionLocal)
    return {"success": True, "depth": DEFAULT_START_DEPTH, "removed_uploads": len(uploaded)}


@router.get("/state")
def state(db: Session = Depends(get_db)):
    return {
        "demo_mode": DEMO_MODE, "llm_provider": LLM_PROVIDER if not DEMO_MODE else "none (demo mode)",
        "disclaimer": DATA_DISCLAIMER, "active_well_id": ACTIVE_WELL_ID, "default_depth": DEFAULT_START_DEPTH,
        "default_radius_km": DEFAULT_RADIUS_KM,
        "knowledge_base": dict(
            wells=db.scalar(select(func.count()).select_from(Well)),
            events=db.scalar(select(func.count()).select_from(DrillingEvent)),
            documents=db.scalar(select(func.count()).select_from(Document)),
            chunks=db.scalar(select(func.count()).select_from(DocumentChunk)),
            alerts=db.scalar(select(func.count()).select_from(Alert)),
        ),
        "server_time": datetime.utcnow().isoformat() + "Z",
    }
