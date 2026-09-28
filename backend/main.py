"""NWIS — Nearby Wells Intelligence System API (SIH26121, Oil India Limited).

    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, select

from config import CORS_ORIGINS, DATA_DISCLAIMER, DEMO_MODE
from database import SessionLocal, engine, init_db
from routers import documents, events, formations, risk, search, simulation, wells


def _ensure_seeded() -> None:
    from models import Well

    if not inspect(engine).has_table("wells"):
        init_db()
    db = SessionLocal()
    try:
        empty = (db.scalar(select(func.count()).select_from(Well)) or 0) == 0
    finally:
        db.close()
    if empty:
        from seed_data import seed

        seed()


@asynccontextmanager
async def lifespan(_: FastAPI):
    _ensure_seeded()
    from services import search_engine

    db = SessionLocal()
    try:
        search_engine.rebuild_index(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="NWIS — Nearby Wells Intelligence System",
    description="Decision-support intelligence layer beside eRTMAC. " + DATA_DISCLAIMER,
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])

for r in (wells, events, formations, risk, search, documents, simulation):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "demo_mode": DEMO_MODE, "disclaimer": DATA_DISCLAIMER}
