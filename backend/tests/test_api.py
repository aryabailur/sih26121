"""End-to-end API tests for the NWIS demo (run: python -m pytest -q)."""
from __future__ import annotations

import sys
import time
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


def test_wells_and_radius(client):
    r = client.get("/api/wells").json()
    assert len(r["wells"]) == 15
    active = next(w for w in r["wells"] if w["id"] == "W001")
    assert active["name"] == "OIL-AX-102" and active["current_depth_md"] == 3100
    near = client.get("/api/wells/nearby", params=dict(radius_km=25)).json()
    assert len(near["wells"]) == 10  # the ten spec offsets; regional wells sit at 28–47 km
    wide = client.get("/api/wells/nearby", params=dict(radius_km=50)).json()
    assert len(wide["wells"]) == 14


def test_seed_stories_present(client):
    ev = client.get("/api/events", params=dict(well_id="W002", event_type="mud_loss")).json()["events"]
    story = next(e for e in ev if e["depth_start"] == 3150)
    assert story["severity"] == "critical" and story["source_page"] == 3
    assert story["document_title"] == "DDR OIL-AX-99 Day 42"
    at = client.get("/api/events/at-depth", params=dict(depth=3400)).json()
    assert {"W003", "W005", "W010"} <= set(at["wells_affected"])


def test_risk_story(client):
    def ev(depth):
        return client.post("/api/risk/evaluate", json=dict(well_id="W001", current_depth=depth, persist=False)).json()

    a3100 = {a["risk_type"]: a for a in ev(3100)["assessments"]}
    assert a3100["mud_loss"]["severity"] == "medium" and not a3100["mud_loss"]["alert_eligible"]
    a3150 = {a["risk_type"]: a for a in ev(3150)["assessments"]}
    assert a3150["mud_loss"]["alert_eligible"] and a3150["mud_loss"]["severity"] == "high"
    assert any("OIL-AX-99" in s["well_name"] for s in a3150["mud_loss"]["supporting_wells"])
    assert not {a["risk_type"]: a for a in ev(3370)["assessments"]}["stuck_pipe"]["alert_eligible"]
    sp = {a["risk_type"]: a for a in ev(3380)["assessments"]}["stuck_pipe"]
    assert sp["alert_eligible"] and {"W003", "W005"} <= {s["well_id"] for s in sp["supporting_wells"]}
    kick = {a["risk_type"]: a for a in ev(3580)["assessments"]}["kick"]
    assert kick["severity"] == "critical" and kick["alert_eligible"]
    assert kick["reasons"] and kick["evidence"][0]["document_title"]


def test_alert_lifecycle(client):
    client.post("/api/simulation/reset")
    for d in (3100, 3150, 3160):
        r = client.post("/api/risk/evaluate", json=dict(well_id="W001", current_depth=d)).json()
    alerts = r["active_alerts"]
    assert len(alerts) == 1 and alerts[0]["risk_type"] == "mud_loss" and alerts[0]["severity"] == "critical"
    aid = alerts[0]["id"]
    assert client.post("/api/risk/acknowledge", json=dict(alert_id=aid, status="acknowledged", notes="LCM on standby")).json()["success"]
    audit = client.get(f"/api/risk/alerts/{aid}/audit").json()["audit"]
    assert [x["action"] for x in audit] == ["raised", "escalated", "acknowledged"]


def test_search_cited(client):
    r = client.post("/api/search/evidence", json=dict(query="What mitigations were used for stuck pipe in Kopili Shale?")).json()
    assert not r["insufficient"] and r["evidence"]
    assert "[1]" in r["answer"]
    assert any(e["well_name"] == "OIL-AX-88" for e in r["evidence"])
    for e in r["evidence"]:
        assert e["document_title"] and e["well_name"]
    r2 = client.post("/api/search/evidence", json=dict(query="What caused mud loss in the Barail Group near 3150m?")).json()
    assert r2["evidence"][0]["well_name"] in ("OIL-AX-99", "OIL-AX-55")
    none = client.post("/api/search/evidence", json=dict(query="helicopter crew change schedule")).json()
    assert none["insufficient"]


def test_search_compare_and_risk_intents(client):
    r = client.post("/api/search/evidence", json=dict(
        query="Compare drilling parameters between OIL-AX-102 and OIL-AX-99 at 3200m.")).json()
    assert {e["well_name"] for e in r["evidence"] if e["kind"] == "parameter"} == {"OIL-AX-102", "OIL-AX-99"}
    r = client.post("/api/search/evidence", json=dict(
        query="Show evidence for the current stuck pipe risk alert.", context=dict(depth=3380))).json()
    assert not r["insufficient"] and "Stuck Pipe" in r["answer"]


def test_document_pipeline(client):
    r = client.post("/api/documents/upload-sample").json()
    doc_id = r["document_id"]
    for _ in range(60):
        s = client.get(f"/api/documents/{doc_id}/status").json()
        if s["status"] in ("review", "saved"):
            break
        time.sleep(0.25)
    assert s["status"] == "review", s
    ex = client.get(f"/api/documents/{doc_id}/extracted").json()
    types = {e["event_type"] for e in ex["events"]}
    assert "wellbore_instability" in types and ex["detected"]["well_id"] == "W009"
    assert any(e.get("possible_duplicate_of") for e in ex["events"])
    decisions = [dict(candidate_id=e["candidate_id"], approved=e["approved"]) for e in ex["events"]]
    res = client.post(f"/api/documents/{doc_id}/commit", json=dict(decisions=decisions)).json()
    assert res["events_saved"] >= 1 and res["chunks_indexed"] >= 1
    again = client.post(f"/api/documents/{doc_id}/commit", json=dict(decisions=decisions))
    assert again.status_code == 400  # already saved — refused, not a 500
    hit = client.post("/api/search/evidence", json=dict(query="tight hole overpull at 3432 m OIL-AX-22")).json()
    assert any(e["document_id"] == doc_id for e in hit["evidence"])
    client.post("/api/simulation/reset")
    assert client.get(f"/api/documents/{doc_id}/status").status_code == 404


def test_alert_evidence_matches_requested_family(client):
    client.post("/api/simulation/reset")
    for d in (3380, 3600):
        client.post("/api/risk/evaluate", json=dict(well_id="W001", current_depth=d))
    r = client.post("/api/search/evidence", json=dict(
        query="Show evidence for the current stuck pipe risk alert.", context=dict(depth=3600, radius_km=25))).json()
    assert not r["insufficient"]
    assert "stuck pipe alert raised at 3,380" in r["answer"].lower()
    assert "Kick" not in r["answer_sentences"][0]["text"]
    assert client.post("/api/risk/alerts/clear").json()["cleared"] >= 1
    client.post("/api/simulation/reset")


def test_scenario_and_profile(client):
    sc = client.post("/api/simulation/demo-scenario", json=dict(scenario="full")).json()
    trig = [(a["depth"], a["risk_type"]) for a in sc["alerts_expected"]]
    assert trig == [(3150, "mud_loss"), (3380, "stuck_pipe"), (3580, "kick")]
    prof = client.get("/api/risk/profile", params=dict(step=50)).json()["profile"]
    assert max(p["score"] for p in prof) > 0.75
