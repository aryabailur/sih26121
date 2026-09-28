"""Pressure-window calibration tests (run: python -m pytest -q)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


def test_pressure_window_calibration():
    with TestClient(main.app) as c:
        r = c.get("/api/wells/W001/pressure-window").json()
        rows = {row["md"]: row for row in r["rows"]}
        # Barail losses cap the fracture gradient at the offsets' loss-onset ECD (1.51–1.52 sg).
        assert rows[3180.0]["frac_calibrated"] <= 1.52 < rows[3180.0]["frac_prognosed"]
        # Sylhet kick raises pore pressure above the 1.38 sg prognosis.
        assert rows[3600.0]["pore_calibrated"] >= 1.48 > rows[3600.0]["pore_prognosed"]
        # The plan (1.44 sg in the Sylhet) sits below the calibrated pore pressure → kick breach reported.
        assert any(b["kind"] == "kick" and b["start"] <= 3600 <= b["end"] for b in r["breaches"])
        assert {c_["well"] for c_ in r["calibrations"]} >= {"OIL-AX-99", "OIL-AX-33"}
        assert any(cs["size"] == '9-5/8"' for cs in r["casing"])
        prof = c.get("/api/wells/W002").json()
        assert prof["casing"] and prof["formations"][0]["pore_pressure_sg"] is not None
