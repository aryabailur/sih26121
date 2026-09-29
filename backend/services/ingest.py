"""Report file format + chunk tagging.

Synthetic reports are written to ``data/synthetic_reports/*.txt`` with page markers and
then ingested through the same parse → chunk → tag path used for uploaded documents, so
the seeded knowledge base exercises the real pipeline.
"""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from services import nlp

HEADER_RE = re.compile(r"^### NWIS-DOC (.+)$")
TITLE_RE = re.compile(r"^### TITLE (.+)$")
SUMMARY_RE = re.compile(r"^### SUMMARY (.+)$")
PAGE_RE = re.compile(r"^=== PAGE (\d+) \| SECTION (.+?) \| DEPTH ([\d.]+|-)-([\d.]+|-) ===$")


def write_report_file(doc: dict, directory: Path) -> Path:
    path = directory / f"{doc['id']}.txt"
    lines = [
        f"### NWIS-DOC id={doc['id']} | well={doc['well_id']} | type={doc['doc_type']} | date={doc['date'].isoformat()} | pages={doc['page_count']}",
        f"### TITLE {doc['title']}",
        f"### SUMMARY {doc['summary']}",
    ]
    for p in doc["pages"]:
        ds = "-" if p["depth_start"] is None else f"{p['depth_start']:.0f}"
        de = "-" if p["depth_end"] is None else f"{p['depth_end']:.0f}"
        lines.append(f"=== PAGE {p['page']} | SECTION {p['section']} | DEPTH {ds}-{de} ===")
        lines.append(p["text"])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return path


def parse_report_file(path: Path) -> dict:
    meta: dict = {}
    pages: list[dict] = []
    current: dict | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if m := HEADER_RE.match(line):
            for part in m.group(1).split(" | "):
                k, v = part.split("=", 1)
                meta[k.strip()] = v.strip()
        elif m := TITLE_RE.match(line):
            meta["title"] = m.group(1)
        elif m := SUMMARY_RE.match(line):
            meta["summary"] = m.group(1)
        elif line.startswith("### "):
            continue
        elif m := PAGE_RE.match(line):
            current = dict(page=int(m.group(1)), section=m.group(2),
                           depth_start=None if m.group(3) == "-" else float(m.group(3)),
                           depth_end=None if m.group(4) == "-" else float(m.group(4)), text="")
            pages.append(current)
        elif current is not None:
            current["text"] = (current["text"] + " " + line).strip()
    meta["date"] = date.fromisoformat(meta["date"])
    meta["pages"] = int(meta.get("pages", len(pages)))
    return dict(meta=meta, pages=pages)


def tag_chunk(text: str, depth_start: float | None, depth_end: float | None,
              formation_lookup=None) -> tuple[str | None, list[str]]:
    """Return (formation, tags) for a chunk. Tags are concept tokens used for filtering/boosting."""
    forms = nlp.formations(text)
    formation = forms[0] if len(forms) == 1 else None
    if formation is None and formation_lookup and depth_start is not None and depth_end is not None:
        # Page covers a narrow interval → attribute it to the formation at its midpoint.
        if depth_end - depth_start <= 400:
            formation = formation_lookup((depth_start + depth_end) / 2)
    return formation, nlp.concepts(text)


def chunk_text(text: str, max_words: int = 220, overlap: int = 40) -> list[str]:
    """Word-window chunking with overlap, used for free-form uploaded pages."""
    words = text.split()
    if len(words) <= max_words:
        return [text.strip()] if text.strip() else []
    out, i = [], 0
    while i < len(words):
        out.append(" ".join(words[i:i + max_words]))
        if i + max_words >= len(words):
            break
        i += max_words - overlap
    return out
