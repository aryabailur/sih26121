"""Tests for the learned risk cross-check, casing / mud-programme correlation and OCR of scanned reports."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from services.document_processor import OCR  # noqa: E402

SCANNED = "DDR_OIL-AX-44_Day38_SCANNED.pdf"


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app) as c:
        c.post("/api/simulation/reset")
        yield c
        c.post("/api/simulation/reset")


def test_learned_model_backtest(client):
    learned = client.get("/api/risk/model").json()["learned"]
    assert learned["status"] == "ready", learned
    assert learned["rows"] > 500 and learned["positives"] > 20 and learned["wells"] >= 10
    assert 0.5 < learned["auc_rule"] <= 1 and 0.5 < learned["auc_model"] <= 1
    assert set(learned["learned_weights"]) == set(learned["hand_weights"])
    assert abs(sum(learned["learned_weights"].values()) - 1) < 0.01


def test_learned_probability_rides_along_without_changing_scores(client):
    def ev(depth):
        r = client.post("/api/risk/evaluate", json=dict(well_id="W001", current_depth=depth, persist=False)).json()
        return {a["risk_type"]: a for a in r["assessments"]}

    ml_3100 = ev(3100)["mud_loss"]
    a3200 = ev(3200)["mud_loss"]
    assert "ml" in a3200 and 0 <= a3200["ml"]["probability"] <= 1
    # Deeper into the historical loss window the learned probability rises, and it flags the alert.
    assert a3200["ml"]["probability"] > ml_3100["ml"]["probability"]
    assert a3200["ml"]["elevated"] and a3200["ml"]["verdict"] == "agrees"
    assert a3200["score"] == pytest.approx(0.84, abs=0.01)  # the explainable score is untouched
    kick = ev(3580)["kick"]
    assert kick["alert_eligible"] and kick["ml"]["elevated"]


def test_casing_and_mud_programme_correlated(client):
    r = client.get("/api/formations/correlate", params=dict(well_ids="W001,W002,W003")).json()
    assert set(r["casing"]) == {"W001", "W002", "W003"}
    for wid, strings in r["casing"].items():
        sizes = [c["size_in"] for c in strings]
        assert '9-5/8"' in sizes, (wid, sizes)
    assert any(c["planned"] for c in r["casing"]["W001"])  # the active well's 7" liner is still a plan
    assert r["mud_program"]["W002"]["Barail Group"] == pytest.approx(1.42)
    assert r["mud_program"]["W001"]["Sylhet Limestone"] == pytest.approx(1.44)


@pytest.mark.skipif(not OCR.available, reason="Tesseract OCR not installed")
def test_scanned_report_is_ocrd_and_extracted(client):
    doc_id = client.post("/api/documents/upload-sample", params=dict(name=SCANNED)).json()["document_id"]
    for _ in range(120):
        s = client.get(f"/api/documents/{doc_id}/status").json()
        if s["status"] in ("review", "saved"):
            break
        time.sleep(0.25)
    assert s["status"] == "review", s
    assert s["ocr_engine"].startswith("Tesseract")
    ex = client.get(f"/api/documents/{doc_id}/extracted").json()
    assert ex["pages"] and all(p["method"] == "ocr" for p in ex["pages"])
    stuck = next(e for e in ex["events"] if e["event_type"] == "differential_sticking")
    assert stuck["depth_start"] == 2655 and stuck["formation"] == "Barail Group"
    assert ex["detected"]["well_id"] == "W007"
    client.post("/api/simulation/reset")
