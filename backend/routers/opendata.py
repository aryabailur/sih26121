"""Real-data proof — the NWIS pipeline on public Norwegian operator records (read-only, separate from the demo KB)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from services import opendata

router = APIRouter(prefix="/api/opendata", tags=["open data"])


def _need_data() -> None:
    if not opendata.available():
        raise HTTPException(503, "Open-data bundle missing — run `python -m opendata.sodir` in /backend")


def _scan_stats(fresh: bool = False) -> dict:
    s = opendata.scan_shelf(fresh)
    return {k: v for k, v in s.items() if k not in ("wells", "events_list")}


@router.get("/summary")
def summary():
    _need_data()
    return {"area": opendata.area_summary(), "shelf": _scan_stats()}


@router.get("/shelf")
def shelf(fresh: bool = False):
    """Every published history on the shelf read by the extractor (`fresh=true` re-runs it and times it)."""
    _need_data()
    s = opendata.scan_shelf(fresh)
    return _scan_stats() | {"wells": s["wells"]}


@router.get("/wells")
def wells():
    _need_data()
    return {"wells": opendata.area_wells()}


@router.get("/well")
def well(name: str):
    _need_data()
    d = opendata.well_detail(name)
    if d is None:
        raise HTTPException(404, f"Wellbore {name} is not in the study area")
    return d


@router.get("/offsets")
def offsets(name: str = opendata.DEFAULT_FOCUS, radius_km: float = Query(25.0, gt=0, le=200), depth: float | None = None):
    _need_data()
    d = opendata.offsets(name, radius_km, depth)
    if d is None:
        raise HTTPException(404, f"Wellbore {name} is not in the study area")
    return d


@router.get("/spotcheck")
def spotcheck():
    _need_data()
    s = opendata.spotcheck()
    if s is None:
        raise HTTPException(404, "No spot-check labels")
    return s
