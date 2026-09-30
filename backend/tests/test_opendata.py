"""Real-data proof: the pipeline on public Norwegian operator records (Sodir FactPages) + prose extraction rules."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from services.document_processor import extract_events  # noqa: E402

pytestmark = pytest.mark.skipif(not (Path(main.__file__).parent / "data/opendata/sodir_area.json").exists(),
                                reason="open-data bundle not built")


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app) as c:
        yield c


def _events(text: str, narrative: bool = True):
    return extract_events([{"page": 1, "text": text, "section": "Operations and results"}], None, narrative=narrative)


def test_prose_rules_learned_from_real_histories():
    # A sidetrack kick-off (and its common typo) is not a kick.
    assert _events("The hole was sidetracked with kick-off at 1836 m.") == []
    assert _events("A sidetrack was performed with kick-of at 1775 m.") == []
    # Negated mentions are not events; "not possible to cure" still is.
    assert _events("No kicks were recorded in this well.") == []
    assert [e["event_type"] for e in _events("It was not possible to cure the lost circulation at 2400 m.")] == ["mud_loss"]
    # Depth comes from the mention nearest the trigger, not the TD named earlier.
    e = _events("When washing back to TD at 3675 m the pipe stuck at 3647m.")[0]
    assert (e["event_type"], e["depth_start"]) == ("stuck_pipe", 3647)
    # A wireline cable getting stuck is not stuck pipe; a pressure survey is not a well-control event.
    assert _events("During the MDT run the wire line cable got stuck.") == []
    assert _events("RFT pressure measurements proved the sand 3 bar overpressured.") == []
    # Mud-programme depths in the next sentence do not leak into the event.
    e = _events("Some tight hole problems were experienced. The well was drilled with gel mud down to 520 m.")[0]
    assert e["event_type"] == "wellbore_instability" and e["depth_start"] is None


def test_shelf_scan_reads_every_history(client):
    s = client.get("/api/opendata/summary").json()
    shelf, area = s["shelf"], s["area"]
    assert shelf["histories"] >= 1900 and shelf["words"] > 500_000
    assert shelf["events"] > 400 and shelf["wells_with_events"] > 300
    assert {"stuck_pipe", "mud_loss", "kick"} <= set(shelf["by_family"])
    assert area["wells"] == 241 and area["with_lot"] > 100 and area["with_mud"] > 150
    assert "NLOD" in area["source"]["licence"]


def test_heldout_spotcheck_is_current_and_precise(client):
    sc = client.get("/api/opendata/spotcheck").json()
    # Every labelled key must still be produced by the extractor — change the rules, re-label the sample.
    assert sc["summary"]["n"] == sc["labelled"] == 50
    assert sc["summary"]["precision"] >= 0.9
    assert all(r["well"].split("/")[0] not in ("15", "16") for r in sc["rows"])


def test_offset_analysis_on_real_wells(client):
    r = client.get("/api/opendata/offsets", params=dict(name="15/9-19 SR", radius_km=25)).json()
    assert r["focus"]["field"] == "VOLVE"
    d = [o["distance_km"] for o in r["offsets"]]
    assert d == sorted(d) and d and max(d) <= 25
    assert r["events"] and all(e["depth_start"] is not None and e["sentence"] for e in r["events"])
    assert r["offset_lot"] and r["offset_mud"] and r["profile"]
    w = client.get("/api/opendata/well", params=dict(name="15/9-19 SR")).json()
    assert w["tops"] and w["history"] and w["card"]["fact_page_url"].startswith("https://factpages.sodir.no/")
