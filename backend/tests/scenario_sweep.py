"""Print the risk engine's view at each demo-scenario depth (no persistence).

    python -m tests.scenario_sweep
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal  # noqa: E402
from services import risk_engine  # noqa: E402

DEPTHS = [3000, 3100, 3120, 3140, 3150, 3160, 3180, 3200, 3250, 3300, 3350, 3370, 3380, 3400, 3420, 3450,
          3500, 3550, 3570, 3575, 3580, 3600]


def main() -> None:
    db = SessionLocal()
    for d in DEPTHS:
        res = risk_engine.evaluate(db, "W001", d, persist=False)
        cells = []
        for a in res["assessments"]:
            flag = "*" if a["alert_eligible"] else " "
            cells.append(f"{a['risk_type'][:8]:>8} {a['score']:.2f}{a['severity'][0].upper()}{flag}")
        print(f"{d:>5} {res['current_formation'][:10]:<10} " + " | ".join(cells))
    db.close()


if __name__ == "__main__":
    main()
