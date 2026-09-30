"""Real-data proof: the NWIS pipeline on public Norwegian operator records (Sodir FactPages, NLOD 2.0).

The same event extractor that reads uploaded DDRs runs on each wellbore's written history (narrative mode), the
formation at each event comes from that well's real formation tops, and the offset analysis mirrors the Assam
cockpit: offsets within a radius, what they reported at which depth, their mud weights and leak-off tests.
Everything is read-only and separate from the demo knowledge base (it never changes the tuned scenario).
"""
from __future__ import annotations

import gzip
import hashlib
import json
import re
import threading
import time
from collections import Counter
from functools import lru_cache
from pathlib import Path

from opendata.sodir import OUT, parse_text
from services.document_processor import extract_events
from services.geo import haversine_km
from services.taxonomy import EVENT_LABELS, EVENT_TO_FAMILY, RISK_LABELS, SEVERITY_ORDER

AREA_FILE = OUT / "sodir_area.json"
SHELF_FILE = OUT / "sodir_shelf.json.gz"
SPOTCHECK_FILE = Path(__file__).resolve().parents[1] / "opendata/spotcheck.json"
# "failure" / "repair" / "waiting on" in prose histories are mostly equipment remarks, not drilling hazards.
SKIP_TYPES = {"NPT"}
_LOCK = threading.Lock()


def available() -> bool:
    return AREA_FILE.exists() and SHELF_FILE.exists()


@lru_cache(maxsize=1)
def _area() -> dict:
    return json.loads(AREA_FILE.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _shelf() -> dict:
    with gzip.open(SHELF_FILE, "rt", encoding="utf-8") as f:
        return json.load(f)


def event_key(well: str, sentence: str) -> str:
    return hashlib.sha1(f"{well}|{sentence}".encode("utf-8")).hexdigest()[:10]


def formation_lookup(tops: list[dict]):
    """Depth (MD) → the most specific lithostratigraphic unit containing it (formation, else group)."""
    def at(md: float) -> str | None:
        best = None
        for t in tops:
            if t["top_md"] is not None and t["base_md"] is not None and t["top_md"] <= md < t["base_md"]:
                if best is None or (t["level"] == "FORMATION" and best["level"] != "FORMATION"):
                    best = t
        return best["name"].title().replace(" Gp", " Group") if best else None
    return at


NAMED_UNIT_RE = re.compile(r"\b([A-ZÆØÅ][a-zæøå]+(?: [A-ZÆØÅ][a-zæøå]+)?) (Formation|Group|Fm|Gp)\b")
AGE_WORDS = {"Early", "Middle", "Late", "Lower", "Upper", "Jurassic", "Triassic", "Cretaceous", "Paleocene", "Eocene", "Permian", "The"}
# Well tests describe flow on purpose — they are not drilling incidents.
SKIP_SECTIONS = {"testing", "well testing", "test"}


def extract_history(well: str, paragraphs: list[dict], lookup=None) -> list[dict]:
    pages = [dict(page=i + 1, text=parse_text(p["text"]) if p["section"].strip().lower() not in SKIP_SECTIONS else "",
                  section=p["section"]) for i, p in enumerate(paragraphs)]
    out = []
    for e in extract_events(pages, lookup, narrative=True):
        if e["event_type"] in SKIP_TYPES:
            continue
        if not e["formation"]:
            # No depth to look up — use a unit the sentence names ("mud losses in the Skagerrak Formation").
            m = NAMED_UNIT_RE.search(e["description"])
            if m:
                words = [w for w in m.group(1).split() if w not in AGE_WORDS]
                e["formation"] = f"{' '.join(words)} {'Group' if m.group(2) in ('Group', 'Gp') else 'Fm'}" if words else None
        fam = EVENT_TO_FAMILY.get(e["event_type"], "NPT")
        out.append(dict(
            key=event_key(well, e["description"]), well=well, type=e["event_type"],
            label=EVENT_LABELS.get(e["event_type"], e["event_type"]), family=fam, family_label=RISK_LABELS.get(fam, fam),
            depth_start=e["depth_start"], depth_end=e["depth_end"], formation=e["formation"], severity=e["severity"],
            confidence=e["confidence"], sentence=e["description"], evidence=e["evidence_text"],
            paragraph=e["source_page"], section=e["source_section"], cause=e["root_cause"], mitigation=e["mitigation_action"],
        ))
    return out


# ------------------------------------------------------------------------------ shelf-wide scan
_SCAN: dict = {}


def scan_shelf(fresh: bool = False) -> dict:
    """Run the extractor over every published history on the shelf (timed, so the UI can show it live)."""
    with _LOCK:
        if _SCAN and not fresh:
            return _SCAN
        shelf = _shelf()
        t0 = time.perf_counter()
        wells, fams, paragraphs, words, events = [], Counter(), 0, 0, []
        for w in shelf["wells"]:
            paragraphs += len(w["history"])
            words += sum(len(p["text"].split()) for p in w["history"])
            ev = extract_history(w["name"], w["history"])
            events += ev
            for e in ev:
                fams[e["family"]] += 1
            worst = max((e["family"] for e in ev), key=lambda f: _FAMILY_RANK.get(f, 0), default=None)
            wells.append(dict(name=w["name"], lat=w["latitude"], lon=w["longitude"], year=w["entry_year"], events=len(ev),
                              families=sorted({e["family"] for e in ev}), worst=worst))
        seconds = time.perf_counter() - t0
        _SCAN.clear()
        _SCAN.update(
            source=shelf["source"], histories=len(shelf["wells"]), paragraphs=paragraphs, words=words,
            events=sum(fams.values()), wells_with_events=sum(1 for w in wells if w["events"]),
            by_family=dict(fams.most_common()), seconds=round(seconds, 2), wells=wells, events_list=events,
            years=[min(w["year"] for w in wells if w["year"]), max(w["year"] for w in wells if w["year"])],
        )
        return _SCAN


_FAMILY_RANK = {"kick": 5, "mud_loss": 4, "stuck_pipe": 3, "NPT": 2, "wellbore_instability": 1, "cementing_failure": 1, "torque_spike": 1}


# ------------------------------------------------------------------------------ study area
@lru_cache(maxsize=1)
def area_events() -> dict[str, list[dict]]:
    return {w["name"]: extract_history(w["name"], w["history"], formation_lookup(w["tops"])) for w in _area()["wells"]}


def _well(name: str) -> dict | None:
    return next((w for w in _area()["wells"] if w["name"] == name), None)


def _card(w: dict, ev: list[dict]) -> dict:
    return dict(
        name=w["name"], operator=w["operator"], purpose=w["purpose"], content=w["content"], field=w["field"],
        entry_year=w["entry_year"], total_depth_md=w["total_depth_md"], water_depth=w["water_depth"],
        latitude=w["latitude"], longitude=w["longitude"], fact_page_url=w["fact_page_url"], events=len(ev),
        families=sorted({e["family"] for e in ev}),
        worst=max((e["severity"] for e in ev), key=lambda s: SEVERITY_ORDER[s], default=None),
        has_mud=bool(w["mud"]), has_lot=any(c["lot_sg"] for c in w["casing"]),
    )


def area_summary() -> dict:
    a = _area()
    evs = area_events()
    fams = Counter(e["family"] for ev in evs.values() for e in ev)
    spot = spotcheck()
    return dict(
        source=a["source"], area=a["area"], wells=len(a["wells"]), events=sum(fams.values()),
        wells_with_events=sum(1 for ev in evs.values() if ev), by_family=dict(fams.most_common()),
        with_mud=sum(1 for w in a["wells"] if w["mud"]), with_lot=sum(1 for w in a["wells"] if any(c["lot_sg"] for c in w["casing"])),
        with_tops=sum(1 for w in a["wells"] if w["tops"]), spotcheck=spot["summary"] if spot else None,
        default_focus=DEFAULT_FOCUS,
    )


def area_wells() -> list[dict]:
    evs = area_events()
    return [_card(w, evs[w["name"]]) for w in _area()["wells"]]


def well_detail(name: str) -> dict | None:
    w = _well(name)
    if not w:
        return None
    ev = area_events()[name]
    groups = [t for t in w["tops"] if t["level"] == "GROUP"]
    return dict(card=_card(w, ev), events=ev, tops=w["tops"], groups=groups, mud=w["mud"], casing=w["casing"],
                history=w["history"], facility=w["facility"], formation_at_td=w["formation_at_td"], age_at_td=w["age_at_td"],
                entry_date=w["entry_date"], completion_date=w["completion_date"], max_inclination=w["max_inclination"],
                drilling_days=w["drilling_days"], kelly_bushing=w["kelly_bushing"])


DEFAULT_FOCUS = "15/9-19 SR"  # the Volve discovery well — Equinor's open Volve dataset comes from this field


def offsets(name: str, radius_km: float = 25.0, depth: float | None = None) -> dict | None:
    """NWIS core loop on real data: offsets around a focus well, what they reported at which depth."""
    focus = _well(name)
    if not focus:
        return None
    evs = area_events()
    rows = []
    for w in _area()["wells"]:
        if w["name"] == name:
            continue
        d = haversine_km(focus["latitude"], focus["longitude"], w["latitude"], w["longitude"])
        if d > radius_km:
            continue
        rows.append(dict(**_card(w, evs[w["name"]]), distance_km=round(d, 2),
                         groups=[dict(name=t["name"], top_md=t["top_md"], base_md=t["base_md"]) for t in w["tops"] if t["level"] == "GROUP"]))
    rows.sort(key=lambda r: r["distance_km"])
    names = {r["name"] for r in rows}
    offset_events = sorted((e | dict(distance_km=next(r["distance_km"] for r in rows if r["name"] == e["well"]))
                            for n in names for e in evs[n] if e["depth_start"] is not None), key=lambda e: e["depth_start"])
    # What offsets reported, per 250 m of depth (MD) — the real-data version of the risk ribbon.
    bins: dict[int, Counter] = {}
    for e in offset_events:
        b = int(e["depth_start"] // 250) * 250
        bins.setdefault(b, Counter())[e["family"]] += 1
    profile = [dict(depth=b, total=sum(c.values()), by_family=dict(c)) for b, c in sorted(bins.items())]
    near = [e for e in offset_events if depth is not None and abs(e["depth_start"] - depth) <= 150]
    mud_pts = [dict(well=w["name"], md=m["md"], mud_weight=m["mud_weight"]) for w in _area()["wells"] if w["name"] in names for m in w["mud"]]
    lot_pts = [dict(well=w["name"], md=c["casing_md"] or c["hole_md"], lot=c["lot_sg"], casing=c["diameter"])
               for w in _area()["wells"] if w["name"] in names for c in w["casing"] if c["lot_sg"] and (c["casing_md"] or c["hole_md"])]
    focus_lot = [dict(md=c["casing_md"] or c["hole_md"], lot=c["lot_sg"], casing=c["diameter"]) for c in focus["casing"]
                 if c["lot_sg"] and (c["casing_md"] or c["hole_md"])]
    fams = Counter(e["family"] for e in offset_events)
    return dict(
        focus=_card(focus, evs[name]), focus_events=evs[name], focus_mud=focus["mud"], focus_lot=focus_lot,
        focus_groups=[t for t in focus["tops"] if t["level"] == "GROUP"], radius_km=radius_km, offsets=rows,
        events=offset_events, profile=profile, at_depth=near, depth=depth, by_family=dict(fams.most_common()),
        offset_mud=mud_pts, offset_lot=lot_pts,
        headline=(f"{len(rows)} offset wellbores within {radius_km:g} km reported {len(offset_events)} drilling problems"
                  + (f" — most often {RISK_LABELS.get(fams.most_common(1)[0][0], '').lower()} ({fams.most_common(1)[0][1]})" if fams else "")
                  + "."),
    )


# ------------------------------------------------------------------------------ spot-check (hand-labelled sample)
def _held_out() -> list[dict]:
    """Shelf extractions from wells OUTSIDE the study area — the rules were tuned on the study area only."""
    from opendata.sodir import AREA_QUADRANTS

    return [e for e in scan_shelf()["events_list"] if e["well"].split("/")[0] not in AREA_QUADRANTS]


def sample_for_spotcheck(n: int = 50) -> list[dict]:
    """Deterministic held-out sample (every k-th extraction ordered by key) for hand labelling."""
    allev = sorted(_held_out(), key=lambda e: e["key"])
    k = max(1, len(allev) // n)
    return allev[::k][:n]


@lru_cache(maxsize=1)
def spotcheck() -> dict | None:
    if not SPOTCHECK_FILE.exists():
        return None
    labels = json.loads(SPOTCHECK_FILE.read_text(encoding="utf-8"))
    by_key = {e["key"]: e for e in _held_out()}
    rows = []
    for lab in labels["labels"]:
        e = by_key.get(lab["key"])
        if e is None:
            continue  # extractor changed since labelling — the row no longer exists
        rows.append(dict(e, verdict=lab["verdict"], note=lab.get("note", "")))
    n = len(rows)
    type_ok = sum(1 for r in rows if r["verdict"] in ("correct", "depth_off"))
    depth_rows = [r for r in rows if r["verdict"] in ("correct", "depth_off") and r["depth_start"] is not None]
    depth_ok = sum(1 for r in depth_rows if r["verdict"] == "correct")
    return dict(
        method=labels["method"], labelled=len(labels["labels"]), rows=rows,
        summary=dict(n=n, type_correct=type_ok, precision=round(type_ok / n, 3) if n else None,
                     depth_checked=len(depth_rows), depth_correct=depth_ok,
                     depth_accuracy=round(depth_ok / len(depth_rows), 3) if depth_rows else None),
    )
