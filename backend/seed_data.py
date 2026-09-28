"""Build the NWIS demo knowledge base (synthetic Upper Assam Shelf field).

    python seed_data.py

Idempotent: drops and recreates every table. Synthetic reports are written to
data/synthetic_reports/ and then ingested through the same parse → chunk → tag path
that uploaded documents use.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import REPORTS_DIR, UPLOAD_DIR  # noqa: E402
from database import Base, SessionLocal, engine  # noqa: E402
import models  # noqa: E402,F401
from models import (  # noqa: E402
    Document, DocumentChunk, DrillingEvent, Formation, ParameterSample, Recommendation, RiskZone,
    SurveyPoint, Well,
)
from seed.corpus import build_corpus  # noqa: E402
from seed.field import (  # noqa: E402
    BASIN, EVENTS, RECOMMENDATIONS, RISK_ZONES, WELLS, build_trajectory, formation_at, formation_intervals,
)
from seed.parameters import mud_program, parameters_at, sample_depths, timestamp_at  # noqa: E402
from seed.sample_docs import generate_samples  # noqa: E402
from services import similarity  # noqa: E402
from services.ingest import parse_report_file, tag_chunk, write_report_file  # noqa: E402


def seed() -> dict:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    for f in UPLOAD_DIR.glob("*"):
        f.unlink(missing_ok=True)
    db = SessionLocal()
    counts: dict[str, int] = {}
    try:
        # ---- wells, formations, survey ----
        for w in WELLS:
            traj = build_trajectory(w)
            tvd_td = traj[-1]["tvd"] if traj else w["td"]
            db.add(Well(
                id=w["id"], name=w["name"], role=w["role"], status=w["status"], field=w["field"], basin=BASIN,
                latitude=w["lat"], longitude=w["lon"], spud_date=w["spud"], completion_date=w["comp"],
                total_depth_md=w["td"], current_depth_md=w["cur"], total_depth_tvd=round(tvd_td, 1),
                well_type=w["well_type"], formation_target=w["target"], rig=w["rig"],
                operator_note="Synthetic demo well" if w["role"] == "offset" else "Active well — simulated eRTMAC feed",
                mud_program=mud_program(w["id"]),
            ))
            for name, top, base, lith, tags in formation_intervals(w["id"], w["td"]):
                db.add(Formation(
                    id=f"FM-{w['id']}-{name.split()[0][:4].upper()}", well_id=w["id"], name=name, top_md=top,
                    base_md=base, lithology=lith, risk_tags=tags,
                    is_prognosed=int(w["role"] == "active" and top > w["cur"]),
                ))
            for i, p in enumerate(traj):
                db.add(SurveyPoint(id=f"SV-{w['id']}-{i:04d}", well_id=w["id"],
                                   is_planned=int(w["role"] == "active" and p["md"] > w["cur"]), **p))
        db.flush()
        counts["wells"] = len(WELLS)

        # ---- parameter samples (simulated eRTMAC / mud logging) ----
        n_samples = 0
        for w in WELLS:
            rows = []
            for md in sample_depths(w["id"]):
                p = parameters_at(w["id"], md)
                p.pop("formation")
                rows.append(ParameterSample(well_id=w["id"], timestamp=timestamp_at(w["id"], md), **p))
            db.add_all(rows)
            n_samples += len(rows)
        counts["parameter_samples"] = n_samples

        # ---- documents: write report files, ingest them back ----
        for f in REPORTS_DIR.glob("*.txt"):
            f.unlink()
        n_chunks = 0
        corpus = build_corpus()
        for d in corpus:
            path = write_report_file(d, REPORTS_DIR)
            parsed = parse_report_file(path)
            meta = parsed["meta"]
            wid = meta["well"]
            db.add(Document(
                id=meta["id"], well_id=wid, title=meta["title"], doc_type=meta["type"], date=meta["date"],
                source_status="synthetic_demo", file_path=f"synthetic_reports/{path.name}", page_count=meta["pages"],
                processing_status="indexed", summary=meta.get("summary", ""),
                processing_log=["Ingested from synthetic report file", f"{len(parsed['pages'])} pages chunked and tagged"],
            ))
            for p in parsed["pages"]:
                formation, tags = tag_chunk(p["text"], p["depth_start"], p["depth_end"],
                                            formation_lookup=lambda md, _w=wid: formation_at(_w, md))
                db.add(DocumentChunk(
                    id=f"{meta['id']}-P{p['page']:02d}", document_id=meta["id"], text=p["text"], page=p["page"],
                    section=p["section"], depth_start=p["depth_start"], depth_end=p["depth_end"],
                    formation=formation, tags=tags,
                ))
                n_chunks += 1
        db.flush()
        counts["documents"] = len(corpus)
        counts["chunks"] = n_chunks

        # ---- drilling events ----
        for e in EVENTS:
            db.add(DrillingEvent(origin="seed", **e))
        counts["events"] = len(EVENTS)

        for z in RISK_ZONES:
            db.add(RiskZone(**z))
        for r in RECOMMENDATIONS:
            db.add(Recommendation(**r))
        db.commit()

        # ---- similarity of every well to the active well ----
        db.add_all(similarity.compute_all(db, "W001"))
        db.commit()
        counts["risk_zones"] = len(RISK_ZONES)
        counts["samples_generated"] = len(generate_samples())
    finally:
        db.close()
    return counts


if __name__ == "__main__":
    result = seed()
    print("NWIS demo knowledge base created (SYNTHETIC DATA):")
    for k, v in result.items():
        print(f"  {k:>18}: {v}")
