"""Lightweight, dependency-free drilling-text NLP.

Used for query understanding, chunk tagging and the document event extractor.
Rule-based on purpose: every extraction is traceable to the text span that produced it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from services.taxonomy import CONCEPT_SYNONYMS, FORMATION_ALIASES

STOPWORDS = set("""
a an the and or of in on at to for from by with without is are was were be been being this that these those it its
as into over under between during while what which who whom how when where why do does did show me list give tell
about any all across near around here there current currently well wells nearby offset offsets m meter meters metre
metres our we you i can could would should please than then also each per has have had not no
""".split())

_DEPTH_RANGE = re.compile(
    r"(?<![\d.])(\d{1,2},?\d{3}|\d{3,4})(?:\.\d+)?\s*(?:m|mMD|m MD)?\s*(?:-|–|—|to|and)\s*"
    r"(\d{1,2},?\d{3}|\d{3,4})(?:\.\d+)?\s*(?:m\b|mMD|m MD|metres|meters)",
    re.IGNORECASE,
)
_DEPTH_SINGLE = re.compile(r"(?<![\d.\-/])(\d{1,2},\d{3}|\d{3,4})(?:\.\d+)?\s*(?:m\b|mMD|m MD|metres|meters)", re.IGNORECASE)
_WELL_NAME = re.compile(r"\bOIL[-\s]?([A-Z]{2})[-\s]?(\d{2,3})\b", re.IGNORECASE)
_MUD_WEIGHT = re.compile(r"(\d\.\d{2})\s*sg\b", re.IGNORECASE)
_DATE_ISO = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_HOURS = re.compile(r"(?:NPT|lost time)[^.;]{0,30}?(\d+(?:\.\d+)?)\s*(?:hrs|hours|hr|h)\b", re.IGNORECASE)
_HOURS_ALT = re.compile(r"(\d+(?:\.\d+)?)\s*(?:hrs|hours)\s*(?:of\s*)?NPT", re.IGNORECASE)


def _num(s: str) -> float:
    return float(s.replace(",", "").replace(" ", ""))


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("’", "'")).strip()


def stem(tok: str) -> str:
    for suf in ("ings", "ing", "ies", "es", "ed", "s"):
        if tok.endswith(suf) and len(tok) - len(suf) >= 4:
            return tok[: -len(suf)] + ("y" if suf == "ies" else "")
    return tok


def tokenize(text: str) -> list[str]:
    toks = re.findall(r"[a-z0-9][a-z0-9\-]*", normalize(text))
    return [stem(t) for t in toks if t not in STOPWORDS and not t.isdigit() and len(t) > 1]


def concepts(text: str) -> list[str]:
    t = " " + normalize(text) + " "
    found = []
    for concept, phrases in CONCEPT_SYNONYMS.items():
        for p in phrases:
            if re.search(r"(?<![a-z])" + re.escape(p) + r"(?![a-z])", t):
                found.append(concept)
                break
    return found


def depths(text: str) -> list[tuple[float, float]]:
    """Return depth intervals mentioned in text (single depths become zero-width intervals)."""
    out: list[tuple[float, float]] = []
    spans = []
    for m in _DEPTH_RANGE.finditer(text):
        a, b = _num(m.group(1)), _num(m.group(2))
        if 50 <= a <= 6000 and 50 <= b <= 6000:
            out.append((min(a, b), max(a, b)))
            spans.append(m.span())
    for m in _DEPTH_SINGLE.finditer(text):
        if any(s <= m.start() < e for s, e in spans):
            continue
        v = _num(m.group(1))
        if 50 <= v <= 6000:
            out.append((v, v))
    return out


def query_depths(text: str) -> list[tuple[float, float]]:
    """Depth parsing for queries, where users often omit the unit ("near 3400")."""
    found = depths(text)
    if found:
        return found
    out = []
    for m in re.finditer(r"(?<![\d.\-])(\d{1,2},\d{3}|\d{4})(?![\d.])", text):
        v = _num(m.group(1))
        if 100 <= v <= 6000 and not (1990 <= v <= 2035 and re.search(r"\b(19|20)\d{2}\b", m.group(0))):
            out.append((v, v))
    return out


def formations(text: str) -> list[str]:
    t = normalize(text)
    return sorted({full for alias, full in FORMATION_ALIASES.items() if alias in t})


def well_names(text: str) -> list[str]:
    return sorted({f"OIL-{m.group(1).upper()}-{m.group(2)}" for m in _WELL_NAME.finditer(text)})


def mud_weights(text: str) -> list[float]:
    return [float(v) for v in _MUD_WEIGHT.findall(text)]


def iso_dates(text: str) -> list[str]:
    return _DATE_ISO.findall(text)


def npt_hours(text: str) -> float | None:
    m = _HOURS.search(text) or _HOURS_ALT.search(text)
    return float(m.group(1)) if m else None


def sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(])", text.strip())
    return [p.strip() for p in parts if len(p.strip()) > 3]


@dataclass
class QueryIntent:
    raw: str
    tokens: list[str]
    concepts: list[str]
    families: list[str]
    depth_ranges: list[tuple[float, float]]
    formations: list[str]
    wells: list[str]
    intent: str
    refers_to_current: bool
    extras: dict = field(default_factory=dict)


def parse_query(q: str) -> QueryIntent:
    from services.taxonomy import CONCEPT_TO_FAMILY

    c = concepts(q)
    fams = []
    for x in c:
        f = CONCEPT_TO_FAMILY.get(x)
        if f and f not in fams:
            fams.append(f)
    t = normalize(q)
    if "compare" in t or " vs " in t or "versus" in t:
        intent = "compare"
    elif re.search(r"current (\w+ )?(risk|alert)|this alert|evidence for", t):
        intent = "risk_evidence"
    elif "concept_mitigation" in c or re.search(r"\b(mitigat|cure|freed|how (was|were|did))", t):
        intent = "mitigation"
    elif "concept_cause" in c:
        intent = "cause"
    elif re.search(r"\b(which|list|show)\b", t):
        intent = "list"
    else:
        intent = "summary"
    refers = bool(re.search(r"\b(here|this (formation|depth|interval|well)|current|ahead|we are|our well)\b", t))
    return QueryIntent(
        raw=q, tokens=tokenize(q), concepts=c, families=fams, depth_ranges=query_depths(q),
        formations=formations(q), wells=well_names(q), intent=intent, refers_to_current=refers,
    )
