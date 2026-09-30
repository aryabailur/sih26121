"""Norwegian Offshore Directorate (Sodir) FactPages → NWIS open-data bundle.

Real, public operator records for every exploration wellbore on the Norwegian shelf: the written wellbore history
(what happened while drilling), formation tops, mud weights by depth, casing points and leak-off tests.
Licence: Norwegian Licence for Open Government Data (NLOD 2.0) — attribution required; reports, logs and core
images linked from the FactPages may carry third-party rights, so NWIS links to them and never copies them.

    python -m opendata.sodir            # build the bundle from the local cache (download what is missing)
    python -m opendata.sodir --refresh  # re-download every table first

Output (committed, so the demo runs offline): data/opendata/sodir_shelf.json.gz (every history + position) and
data/opendata/sodir_area.json (the detailed study area: tops, mud, casing/LOT, history paragraphs).
"""
from __future__ import annotations

import argparse
import csv
import gzip
import html
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data/opendata/cache"
OUT = ROOT / "data/opendata"
TABLES = ["wellbore_history", "wellbore_exploration_all", "wellbore_formation_top", "wellbore_mud", "wellbore_casing_and_lot"]
URL = ("https://factpages.sodir.no/public?/Factpages/external/tableview/{t}&rs:Command=Render&rc:Toolbar=false"
       "&rc:Parameters=f&IpAddress=not_used&CultureCode=en&rs:Format=CSV&Top100=false")
SOURCE = dict(
    name="Norwegian Offshore Directorate (Sodir) FactPages",
    url="https://factpages.sodir.no/",
    licence="Norwegian Licence for Open Government Data (NLOD 2.0)",
    licence_url="https://data.norge.no/nlod/en/2.0",
    attribution="Contains data from the Norwegian Offshore Directorate FactPages, used under NLOD 2.0.",
)
# Detailed study area: the Sleipner – Volve – Johan Sverdrup blocks (quadrants 15 and 16, central North Sea).
AREA_QUADRANTS = ("15", "16")
AREA_NAME = "Sleipner · Volve · Johan Sverdrup area (quadrants 15–16, North Sea)"

csv.field_size_limit(10**8)


def download(refresh: bool = False) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for t in TABLES:
        path = CACHE / f"{t}.csv"
        if path.exists() and not refresh:
            continue
        print(f"downloading {t} …", flush=True)
        with urllib.request.urlopen(URL.format(t=t), timeout=300) as r:
            path.write_bytes(r.read())


def _rows(table: str):
    with open(CACHE / f"{table}.csv", encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def _num(v: str | None) -> float | None:
    try:
        return float((v or "").strip().replace(",", "."))
    except ValueError:
        return None


def _s(v: str | None) -> str | None:
    return (v or "").strip() or None


def _iso(d: str | None) -> str | None:
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", d or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def _text(fragment: str) -> str:
    t = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def parse_history(raw: str) -> list[dict]:
    """HTML history → [{section, text}] paragraphs; bold-only paragraphs become section headings."""
    out, section = [], "General"
    for p in re.split(r"</p\s*>", raw or "", flags=re.I):
        if not p.strip():
            continue
        bold = re.fullmatch(r"\s*<p[^>]*>\s*(<[^>]+>\s*)*<b>(.*?)</b>(\s*<[^>]+>)*\s*", p, flags=re.I | re.S)
        text = _text(p)
        if not text:
            continue
        if bold and len(text) < 60:
            section = text
            continue
        out.append(dict(section=section, text=text))
    return out


def parse_text(paragraph: str) -> str:
    """Copy of a paragraph for depth parsing: drop TVD and feet conversions so MD is the only depth per mention."""
    t = re.sub(r"\(\s*[\d.,]+\s*m\s*(TVD|TVDSS|SS)[^)]*\)", "", paragraph, flags=re.I)
    t = re.sub(r"\(\s*[\d.,]+\s*(ft|feet|')\s*\)", "", t, flags=re.I)
    t = re.sub(r"(\d)\s*m(RKB|MD|BRT|DF)\b", r"\1 m \2", t)
    # Volumes whose superscript was lost in the export ("a total loss of 1353 m WBM, 68 m SW") are not depths.
    t = re.sub(r"(\d)\s*m\s+(WBM|OBM|SW|brine|mud|cement|seawater)\b", r"\1 m3 \2", t, flags=re.I)
    t = re.sub(r"(\d)\s*m\s+TVD( RKB)?", r"\1 TVD", t)  # remaining bare TVD values are not MD depths
    return re.sub(r"\s+", " ", t).strip()


def build() -> dict:
    meta = {r["wlbWellboreName"]: r for r in _rows("wellbore_exploration_all")}
    hist = {r["wlbName"]: parse_history(r["wlbHistory"]) for r in _rows("wellbore_history")}

    def well_meta(name: str) -> dict:
        m = meta.get(name, {})
        return dict(
            name=name, npdid=m.get("wlbNpdidWellbore"), operator=_s(m.get("wlbDrillingOperator")),
            purpose=_s(m.get("wlbPurpose")), status=_s(m.get("wlbStatus")), content=_s(m.get("wlbContent")),
            field=_s(m.get("wlbField")), discovery=_s(m.get("wlbDiscovery")), main_area=_s(m.get("wlbMainArea")),
            entry_date=_iso(m.get("wlbEntryDate")), completion_date=_iso(m.get("wlbCompletionDate")),
            entry_year=int(m["wlbEntryYear"]) if (m.get("wlbEntryYear") or "").isdigit() else None,
            total_depth_md=_num(m.get("wlbTotalDepth")), final_tvd=_num(m.get("wlbFinalVerticalDepth")),
            water_depth=_num(m.get("wlbWaterDepth")), kelly_bushing=_num(m.get("wlbKellyBushElevation")),
            max_inclination=_num(m.get("wlbMaxInclation")), formation_at_td=_s(m.get("wlbFormationAtTd")),
            age_at_td=_s(m.get("wlbAgeAtTd")), facility=_s(m.get("wlbDrillingFacility")),
            drilling_days=_num(m.get("wlbDrillingDays")), bht=_num(m.get("wlbBottomHoleTemperature")),
            latitude=_num(m.get("wlbNsDecDeg")), longitude=_num(m.get("wlbEwDecDeg")),
            fact_page_url=_s(m.get("wlbFactPageUrl")),
        )

    shelf = []
    for name, paras in hist.items():
        w = well_meta(name)
        if w["latitude"] is None:
            continue
        shelf.append(dict(name=name, latitude=w["latitude"], longitude=w["longitude"], operator=w["operator"],
                          entry_year=w["entry_year"], content=w["content"], total_depth_md=w["total_depth_md"],
                          fact_page_url=w["fact_page_url"], history=paras))

    area_names = {n for n in hist if n.split("/")[0] in AREA_QUADRANTS and meta.get(n, {}).get("wlbNsDecDeg")}
    tops: dict[str, list] = {n: [] for n in area_names}
    for r in _rows("wellbore_formation_top"):
        if r["wlbName"] in tops:
            tops[r["wlbName"]].append(dict(name=r["lsuName"].strip(), level=r["lsuLevel"].strip(), parent=r["lsuNameParent"].strip() or None,
                                           top_md=_num(r["lsuTopDepth"]), base_md=_num(r["lsuBottomDepth"])))
    mud: dict[str, list] = {n: [] for n in area_names}
    for r in _rows("wellbore_mud"):
        if r["wlbName"] in mud and _num(r["wlbMD"]) and _num(r["wlbMudWeightAtMD"]):
            mud[r["wlbName"]].append(dict(md=_num(r["wlbMD"]), mud_weight=_num(r["wlbMudWeightAtMD"]),
                                          mud_type=(r["wlbMudType"] or "").strip() or None, date=_iso(r["wlbMudDateMeasured"])))
    casing: dict[str, list] = {n: [] for n in area_names}
    for r in _rows("wellbore_casing_and_lot"):
        if r["wlbName"] in casing:
            casing[r["wlbName"]].append(dict(
                type=(r["wlbCasingType"] or "").strip() or None, diameter=(r["wlbCasingDiameter"] or "").strip() or None,
                casing_md=_num(r["wlbCasingDepth"]) or None, hole_diameter=(r["wlbHoleDiameter"] or "").strip() or None,
                hole_md=_num(r["wlbHoleDepth"]) or None, lot_sg=_num(r["wlbLotMudDencity"]) or None,
                test=(r["wlbFormationTestType"] or "").strip() or None))
    area = []
    for n in sorted(area_names):
        w = well_meta(n)
        w.update(tops=sorted((t for t in tops[n] if t["top_md"] is not None), key=lambda t: (t["top_md"], t["level"] != "GROUP")),
                 mud=sorted(mud[n], key=lambda m: m["md"]), casing=sorted(casing[n], key=lambda c: c["casing_md"] or c["hole_md"] or 0),
                 history=hist[n])
        area.append(w)

    retrieved = date.today().isoformat()
    source = dict(SOURCE, retrieved=retrieved, tables=[URL.format(t=t) for t in TABLES])
    OUT.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT / "sodir_shelf.json.gz", "wt", encoding="utf-8") as f:
        json.dump(dict(source=source, wells=shelf), f, ensure_ascii=False, separators=(",", ":"))
    (OUT / "sodir_area.json").write_text(json.dumps(dict(source=source, area=AREA_NAME, quadrants=AREA_QUADRANTS, wells=area),
                                                    ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return dict(shelf=len(shelf), area=len(area), retrieved=retrieved)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="re-download every FactPages table")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    download(args.refresh)
    print(build())
