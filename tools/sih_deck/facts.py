"""Pull the numbers the idea deck quotes straight from the running engine (in-process, read-only).

    cd backend && .venv\\Scripts\\python.exe ..\\tools\\sih_deck\\facts.py      -> tools/sih_deck/facts.json

Every figure on the slides that comes from the prototype (alert text, brief NPT, the risk-vs-depth chart, the
real-data counts, latency) is read from facts.json, so re-run this after engine or seed changes.
"""
from __future__ import annotations

import json
import os
import statistics
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

OUT = Path(__file__).with_name("facts.json")
FAMILIES = ("mud_loss", "stuck_pipe", "torque_spike", "kick")


def ms(fn, n=20):
    fn()  # warm
    t = []
    for _ in range(n):
        t0 = time.perf_counter()
        fn()
        t.append((time.perf_counter() - t0) * 1000)
    return round(statistics.median(t), 1)


with TestClient(main.app) as c:
    ev = lambda d: c.post("/api/risk/evaluate", json=dict(well_id="W001", current_depth=d, persist=False)).json()  # noqa: E731

    # risk along the path, exactly as the scenario sees it (live parameters on)
    series = {f: [] for f in FAMILIES}
    alerts = {}
    for d in range(3000, 3661, 10):
        best = {}
        for a in ev(d)["assessments"]:
            f = a["risk_type"]
            if f in series and a["score"] > best.get(f, {"score": -1})["score"]:
                best[f] = a
        for f in FAMILIES:
            a = best.get(f)
            series[f].append([d, round(a["score"], 3) if a else 0.0])
            if a and a.get("alert_eligible") and f not in alerts:
                alerts[f] = dict(depth=d, score=round(a["score"], 3), severity=a["severity"])

    a3100 = {a["risk_type"]: a for a in ev(3100)["assessments"]}
    a3150 = {a["risk_type"]: a for a in ev(3150)["assessments"]}
    ml = a3150["mud_loss"]
    keep = ("risk_type", "score", "severity", "confidence", "lead_depth", "alert_eligible", "headline", "summary",
            "recommendation", "recommendations", "checks", "what_worked", "factors", "supporting_wells", "evidence",
            "zone", "depth_start", "depth_end", "formation", "ml")
    alert_card = {k: ml[k] for k in keep if k in ml}

    brief = c.get("/api/risk/brief", params=dict(depth=3100, horizon_m=300)).json()
    model = c.get("/api/risk/model").json()
    od = c.get("/api/opendata/summary").json()
    spot = c.get("/api/opendata/spotcheck").json()

    lat = dict(
        evaluate_ms=ms(lambda: ev(3150)),
        search_ms=ms(lambda: c.post("/api/search/evidence", json=dict(query="What caused mud losses in the Barail near 3150 m?")).json(), 10),
        brief_ms=ms(lambda: c.get("/api/risk/brief", params=dict(depth=3100, horizon_m=300)).json(), 10),
    )

facts = dict(
    series=series,
    first_alerts=alerts,
    at_3100={k: dict(score=round(v["score"], 3), severity=v["severity"], lead=v.get("lead_depth"),
                     eligible=v.get("alert_eligible")) for k, v in a3100.items()},
    alert_3150=alert_card,
    brief=brief,
    model={k: model[k] for k in model if k != "learned"} | {"learned": {k: v for k, v in (model.get("learned") or {}).items()
                                                                          if k not in ("rows",)}},
    opendata=od,
    spotcheck={k: v for k, v in spot.items() if k != "items"},
    latency=lat,
)
OUT.write_text(json.dumps(facts, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
print("wrote", OUT)
print("first alerts:", alerts)
print("latency:", lat)
print("brief keys:", list(brief.keys()))
print("alert keys:", list(ml.keys()))
