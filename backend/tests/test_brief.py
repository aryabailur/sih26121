"""Look-ahead brief (shift handover / drill-the-well-on-paper) and the TVD-bearing trajectories for the 3D view."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app) as c:
        c.post("/api/simulation/reset")
        yield c
        c.post("/api/simulation/reset")


def test_brief_lists_hazards_ahead_with_citations(client):
    b = client.get("/api/risk/brief", params=dict(depth=3100, horizon_m=300)).json()
    assert b["window"] == {"start": 3100, "end": 3400}
    assert [h["zone_id"] for h in b["hazards"]] == ["RZ01", "RZ02"]
    mud, stuck = b["hazards"]
    assert mud["risk_type"] == "mud_loss" and mud["window"]["start"] == 3150 and mud["distance_m"] == 50
    assert mud["offsets_hit"] == 2 and mud["offsets_reached"] == 10
    assert all(h["projected"]["alert_eligible"] for h in b["hazards"])
    # Every piece of evidence is cited to a report page.
    assert all(e["document_id"] and e["page"] for h in b["hazards"] for e in h["evidence"])
    assert b["sources"] and all(s["pages"] for s in b["sources"])
    # What worked is ranked by the NPT it took; the loss-onset ECD caps the window.
    assert [w["npt_hours"] for w in stuck["what_worked"]] == sorted(w["npt_hours"] for w in stuck["what_worked"])
    assert mud["mud_window"]["frac_min"] == pytest.approx(1.51, abs=0.01)
    assert b["npt"]["expected_hours"] <= b["npt"]["worst_case_hours"] <= b["npt"]["offset_total_hours"]
    assert "Kopili Shale" in b["headline"]


def test_brief_flags_mud_programme_breach_and_never_records_alerts(client):
    client.post("/api/risk/alerts/clear")
    b = client.get("/api/risk/brief", params=dict(depth=3100, horizon_m=600)).json()
    kick = next(h for h in b["hazards"] if h["risk_type"] == "kick")
    assert any(br["kind"] == "kick" for br in kick["breaches"])
    assert kick["mud_window"]["mw_min"] > max(kick["mud_window"]["mw_plan"])
    assert client.get("/api/risk/alerts").json()["alerts"] == []


def test_brief_quiet_interval(client):
    b = client.get("/api/risk/brief", params=dict(depth=2400, horizon_m=300)).json()
    assert b["hazards"] == [] and b["npt"]["expected_hours"] == 0
    assert "no offset-well hazard windows" in b["headline"]


def test_trajectories_carry_tvd(client):
    t = client.get("/api/wells/trajectories").json()["trajectories"]["W001"]
    assert t[0]["tvd"] == 0 and 0 < t[-1]["tvd"] <= t[-1]["md"]
