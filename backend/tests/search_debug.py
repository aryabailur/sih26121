"""Print top retrieval hits with score breakdowns for a few probe queries.

    python -m tests.search_debug "your query"
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal  # noqa: E402
from services import nlp, search_engine  # noqa: E402

PROBES = [
    "helicopter crew change schedule",
    "What caused mud loss in the Barail Group near 3150m?",
    "What mitigations were used for stuck pipe in Kopili Shale?",
    "What mitigations were used for overpressure in nearby wells?",
    "What cementing issues were encountered in the Barail Group?",
    "Show stuck pipe events in Kopili Shale across all offset wells.",
    "catering contract",
]


def main() -> None:
    db = SessionLocal()
    idx = search_engine.get_index(db)
    for q in sys.argv[1:] or PROBES:
        qi = nlp.parse_query(q)
        qvec = idx.embedder.embed(q)
        rows = []
        for u in idx.units:
            bm = idx.bm25(qi.tokens, u)
            cs = search_engine.cosine(qvec, u.vec)
            mt = search_engine._meta(u, qi, qi.depth_ranges, qi.formations)
            rows.append((bm, cs, mt, u))
        rows.sort(key=lambda r: -(r[0] / 10 + r[1]))
        print(f"\n## {q}  intent={qi.intent} fams={qi.families} forms={qi.formations} depths={qi.depth_ranges}")
        for bm, cs, mt, u in rows[:4]:
            print(f"  bm25={bm:6.2f} cos={cs:.3f} meta={mt:.2f}  {u.kind:5} {u.well_name:10} {u.document_title[:40]} p{u.page}")
    db.close()


if __name__ == "__main__":
    main()
