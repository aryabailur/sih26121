"""Runtime settings for the NWIS backend.

Everything is overridable through environment variables so the same code can run
against the bundled synthetic SQLite database (demo) or a PostgreSQL instance
populated with authorised OIL data (production integration point).
"""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = DATA_DIR / "synthetic_reports"
UPLOAD_DIR = DATA_DIR / "uploads"
SAMPLE_DIR = DATA_DIR / "samples"

for _d in (DATA_DIR, REPORTS_DIR, UPLOAD_DIR, SAMPLE_DIR):
    _d.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("NWIS_DATABASE_URL", f"sqlite:///{(DATA_DIR / 'nwis.db').as_posix()}")

# Demo mode keeps every calculation deterministic and blocks any network call.
DEMO_MODE = os.getenv("NWIS_DEMO_MODE", "1") == "1"

ACTIVE_WELL_ID = os.getenv("NWIS_ACTIVE_WELL", "W001")
DEFAULT_RADIUS_KM = float(os.getenv("NWIS_DEFAULT_RADIUS_KM", "25"))
DEFAULT_START_DEPTH = 3100.0

# Optional LLM answer synthesis. Off by default: the extractive, citation-first
# answer composer is used unless a provider is explicitly configured AND demo mode is off.
LLM_PROVIDER = os.getenv("NWIS_LLM_PROVIDER", "none")  # "none" | "anthropic"
LLM_MODEL = os.getenv("NWIS_LLM_MODEL", "claude-opus-5")

# Seconds per processing stage in the document pipeline (purely cosmetic pacing so the
# UI stepper is readable during a live demo; the extraction itself is real).
DOC_STAGE_DELAY = float(os.getenv("NWIS_DOC_STAGE_DELAY", "0.7"))

CORS_ORIGINS = os.getenv(
    "NWIS_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

DATA_DISCLAIMER = (
    "Demo field modelled on real Upper Assam stratigraphy: wells, events, documents and parameters are illustrative, "
    "created for the SIH26121 prototype, and are NOT Oil India Limited operational data. /api/opendata serves real "
    "public well records (Norwegian Offshore Directorate FactPages, NLOD 2.0)."
)
