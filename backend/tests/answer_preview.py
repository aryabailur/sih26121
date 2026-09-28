"""Print composed answers and a sample alert explanation (manual quality check).

    python -m tests.answer_preview
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal  # noqa: E402
from services import risk_engine, search_engine  # noqa: E402

QUERIES = [
    ("What mitigations were used for stuck pipe in Kopili Shale?", None),
    ("What caused mud loss in the Barail Group near 3150m?", None),
    ("What happened in this formation near 3400 m?", {"depth": 3400, "formation": "Kopili Shale"}),
    ("Which nearby wells experienced stuck pipe here?", {"depth": 3380, "formation": "Kopili Shale"}),
    ("What mitigations were used for overpressure in nearby wells?", None),
]


def main() -> None:
    db = SessionLocal()
    for q, ctx in QUERIES:
        c = {"well_id": "W001", "radius_km": 25, **(ctx or {})}
        r = search_engine.search(db, q, {}, c)
        print(f"\n## {q}\nconfidence={r['confidence']}  evidence={len(r['evidence'])}")
        print(r["answer"])
        for i, e in enumerate(r["evidence"], 1):
            print(f"   [{i}] {e['well_name']} | {e['document_title']} p{e['page']} | {e['depth_start']}-{e['depth_end']} | {e['relevance_score']}")
    res = risk_engine.evaluate(db, "W001", 3380, persist=False)
    a = next(x for x in res["assessments"] if x["risk_type"] == "stuck_pipe")
    print("\n## Stuck pipe @3380 — WHY")
    for reason in a["reasons"]:
        print(" -", reason)
    print(" confidence:", a["confidence"], a["confidence_note"])
    print(" recommendation:", a["recommendation"])
    print(" context:", res["context"]["text"])
    db.close()


if __name__ == "__main__":
    main()
