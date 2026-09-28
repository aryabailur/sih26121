"""Hybrid evidence retrieval + citation-first answer composition.

Retrieval units are report chunks (page-level) and structured drilling events (which
carry their own document/page provenance). Ranking combines:

    0.40 · BM25 keyword score (normalised)
    0.35 · semantic cosine (offline concept-hash embedding; swappable, see EmbeddingProvider)
    0.25 · metadata alignment (depth window, formation, risk family, well)

Answers are composed extractively from the retrieved evidence only: every sentence
carries citation indices, and if nothing relevant clears the evidence threshold the
engine says so instead of answering.
"""
from __future__ import annotations

import math
import re
import zlib
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Document, DocumentChunk, DrillingEvent, ParameterSample, Well
from services import nlp
from services.geo import haversine_km
from services.taxonomy import EVENT_LABELS, EVENT_TO_FAMILY, FAMILY_CONCEPT, RISK_FAMILIES, RISK_LABELS

MIN_RELEVANCE = 0.28
W_KEYWORD, W_SEMANTIC, W_META = 0.40, 0.35, 0.25
BM25_FLOOR = 9.0
OFF_DOMAIN_MIN_COSINE = 0.20


# ------------------------------------------------------------------------------ embeddings
class EmbeddingProvider:
    """Interface: swap for sentence-transformers / bge / a hosted embedding API in production."""

    name = "abstract"

    def embed(self, text: str) -> dict[int, float]:
        raise NotImplementedError


class ConceptHashEmbedder(EmbeddingProvider):
    """Offline, deterministic sparse embedding: stemmed unigrams + bigrams + domain concepts,
    hashed into a fixed space. Domain synonym expansion ("lost circulation" ≈ "mud loss")
    gives it semantic reach beyond exact keywords."""

    name = "concept-hash-v1 (offline)"
    DIM = 4096

    def __init__(self) -> None:
        self.idf: dict[int, float] = {}

    def features(self, text: str) -> Counter:
        toks = nlp.tokenize(text)
        feats: Counter = Counter()
        for t in toks:
            feats[t] += 1.0
        for a, b in zip(toks, toks[1:]):
            feats[f"{a}_{b}"] += 0.6
        for c in nlp.concepts(text):
            feats[c] += 2.5
        for f in nlp.formations(text):
            feats["fm_" + f.split()[0].lower()] += 1.5
        return feats

    def _h(self, f: str) -> int:
        return zlib.crc32(f.encode()) % self.DIM

    def fit(self, texts: list[str]) -> None:
        df: Counter = Counter()
        for t in texts:
            df.update({self._h(f) for f in self.features(t)})
        n = len(texts)
        self.idf = {h: math.log(1 + n / (1 + c)) for h, c in df.items()}

    def embed(self, text: str) -> dict[int, float]:
        vec: dict[int, float] = {}
        for f, w in self.features(text).items():
            h = self._h(f)
            vec[h] = vec.get(h, 0.0) + w * self.idf.get(h, 1.0)
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {k: v / norm for k, v in vec.items()}


def cosine(a: dict[int, float], b: dict[int, float]) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(k, 0.0) for k, v in a.items())


# ------------------------------------------------------------------------------ index
@dataclass
class Unit:
    kind: str  # chunk | event
    id: str
    text: str
    well_id: str | None
    well_name: str
    document_id: str | None
    document_title: str
    document_type: str
    page: int | None
    section: str
    depth_start: float | None
    depth_end: float | None
    formation: str | None
    families: list[str]
    date: str | None
    event: DrillingEvent | None = None
    source_status: str = "synthetic_demo"
    tokens: list[str] = field(default_factory=list)
    vec: dict[int, float] = field(default_factory=dict)


class SearchIndex:
    def __init__(self, db: Session):
        self.embedder = ConceptHashEmbedder()
        self.units: list[Unit] = []
        wells = {w.id: w for w in db.scalars(select(Well)).all()}
        docs = {d.id: d for d in db.scalars(select(Document)).all()}
        self.wells = wells
        for c in db.scalars(select(DocumentChunk)).all():
            d = docs.get(c.document_id)
            if d is None or d.processing_status not in ("indexed",):
                continue
            fams = sorted({f for f, concept in FAMILY_CONCEPT.items() if concept in (c.tags or [])})
            w = wells.get(d.well_id or "")
            self.units.append(Unit(
                kind="chunk", id=c.id, text=c.text, well_id=d.well_id, well_name=w.name if w else "—",
                document_id=d.id, document_title=d.title, document_type=d.doc_type, page=c.page, section=c.section,
                depth_start=c.depth_start, depth_end=c.depth_end, formation=c.formation, families=fams,
                date=d.date.isoformat() if d.date else None, source_status=d.source_status,
            ))
        for e in db.scalars(select(DrillingEvent)).all():
            d = docs.get(e.source_document_id or "")
            w = wells.get(e.well_id)
            text = (f"{e.title}. {EVENT_LABELS.get(e.event_type, e.event_type)} in {e.formation} at "
                    f"{e.depth_start:,.0f}–{e.depth_end:,.0f} m. {e.description} Root cause: {e.root_cause} "
                    f"Mitigation: {e.mitigation_action} Lessons: {e.lessons_learned}")
            self.units.append(Unit(
                kind="event", id=e.id, text=text, well_id=e.well_id, well_name=w.name if w else e.well_id,
                document_id=e.source_document_id, document_title=d.title if d else "Structured event record",
                document_type=d.doc_type if d else "event", page=e.source_page, section=e.source_section or "",
                depth_start=e.depth_start, depth_end=e.depth_end, formation=e.formation,
                families=[EVENT_TO_FAMILY.get(e.event_type, e.event_type)], date=e.date.isoformat(), event=e,
                source_status=d.source_status if d else "synthetic_demo",
            ))
        texts = [u.text for u in self.units]
        self.embedder.fit(texts)
        self.df: Counter = Counter()
        for u in self.units:
            u.tokens = nlp.tokenize(u.text)
            u.vec = self.embedder.embed(u.text)
            self.df.update(set(u.tokens))
        self.avgdl = sum(len(u.tokens) for u in self.units) / max(len(self.units), 1)
        self.n = len(self.units)

    def bm25(self, q_tokens: list[str], u: Unit, k1: float = 1.4, b: float = 0.75) -> float:
        tf = Counter(u.tokens)
        dl = len(u.tokens) or 1
        s = 0.0
        for t in set(q_tokens):
            if t not in tf:
                continue
            idf = math.log(1 + (self.n - self.df[t] + 0.5) / (self.df[t] + 0.5))
            s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * dl / self.avgdl))
        return s


_INDEX: list[SearchIndex | None] = [None]


def get_index(db: Session) -> SearchIndex:
    if _INDEX[0] is None:
        _INDEX[0] = SearchIndex(db)
    return _INDEX[0]


def rebuild_index(db: Session) -> SearchIndex:
    _INDEX[0] = SearchIndex(db)
    return _INDEX[0]


# ------------------------------------------------------------------------------ search
def _depth_score(u: Unit, ranges: list[tuple[float, float]]) -> float | None:
    if not ranges:
        return None
    if u.depth_start is None or u.depth_end is None:
        return 0.2
    width = u.depth_end - u.depth_start
    if width > 1200:  # whole-well summary pages
        return 0.25
    best = 0.0
    for a, b in ranges:
        a2, b2 = a - 50, b + 50
        if u.depth_end >= a2 and u.depth_start <= b2:
            return 1.0 if width <= 300 else 0.6
        dist = min(abs(u.depth_start - b2), abs(u.depth_end - a2))
        best = max(best, max(0.0, 1 - dist / 300))
    return best


def _meta(u: Unit, q: nlp.QueryIntent, ranges: list[tuple[float, float]], forms: list[str]) -> float:
    parts = []
    ds = _depth_score(u, ranges)
    if ds is not None:
        parts.append(ds)
    if forms:
        parts.append(1.0 if u.formation in forms else (0.6 if any(f.split()[0].lower() in u.text.lower() for f in forms) else 0.0))
    if q.families:
        parts.append(1.0 if set(q.families) & set(u.families) else 0.0)
    if q.wells:
        parts.append(1.0 if u.well_name in q.wells else 0.0)
    return sum(parts) / len(parts) if parts else 0.3


def _passes_filters(u: Unit, f: dict, radius_wells: set[str] | None) -> bool:
    if f.get("well_id") and u.well_id != f["well_id"]:
        return False
    if f.get("formation"):
        want = f["formation"].lower()
        if not ((u.formation or "").lower().startswith(want.split()[0]) or want.split()[0] in u.text.lower()):
            return False
    if f.get("event_type"):
        fam = EVENT_TO_FAMILY.get(f["event_type"], f["event_type"])
        if fam not in u.families:
            return False
    if f.get("depth_min") is not None and (u.depth_end is None or u.depth_end < f["depth_min"]):
        return False
    if f.get("depth_max") is not None and (u.depth_start is None or u.depth_start > f["depth_max"]):
        return False
    if f.get("date_from") and (u.date is None or u.date < f["date_from"]):
        return False
    if f.get("date_to") and (u.date is None or u.date > f["date_to"]):
        return False
    if f.get("doc_type") and u.document_type != f["doc_type"]:
        return False
    if radius_wells is not None and u.well_id not in radius_wells:
        return False
    return True


def _highlights(q: nlp.QueryIntent, text: str) -> list[str]:
    terms = set()
    low = text.lower()
    for t in re.findall(r"[a-z][a-z\-]{3,}", q.raw.lower()):
        if t in nlp.STOPWORDS:
            continue
        stemmed = nlp.stem(t)
        if stemmed in low:
            terms.add(stemmed)
    from services.taxonomy import CONCEPT_SYNONYMS
    for c in q.concepts:
        for p in CONCEPT_SYNONYMS.get(c, []):
            if len(p) > 3 and p in low:
                terms.add(p)
    for f in q.formations:
        terms.add(f.split()[0].lower())
    for a, b in q.depth_ranges:
        for m in re.finditer(r"\d,?\d{3}", text):
            v = float(m.group(0).replace(",", ""))
            if a - 60 <= v <= b + 60:
                terms.add(m.group(0))
    return sorted(terms, key=len, reverse=True)[:12]


def _evidence_card(u: Unit, score: float, parts: dict, q: nlp.QueryIntent, linked: DrillingEvent | None = None) -> dict:
    ev = u.event or linked
    return dict(
        kind=u.kind, id=u.id, chunk_text=u.text if u.kind == "chunk" else (ev.description if ev else u.text),
        document_id=u.document_id, document_title=u.document_title, document_type=u.document_type,
        well_id=u.well_id, well_name=u.well_name, page=u.page, section=u.section,
        depth_start=u.depth_start, depth_end=u.depth_end, formation=u.formation, date=u.date,
        relevance_score=round(score, 3), score_breakdown={k: round(v, 3) for k, v in parts.items()},
        event_id=ev.id if ev else None, event_type=ev.event_type if ev else None,
        event_label=EVENT_LABELS.get(ev.event_type) if ev else None, severity=ev.severity if ev else None,
        root_cause=ev.root_cause if ev else None, mitigation=ev.mitigation_action if ev else None,
        lessons=ev.lessons_learned if ev else None, npt_hours=ev.npt_hours if ev else None,
        description=ev.description if ev else None, title=ev.title if ev else None,
        event_depth_start=ev.depth_start if ev else None, event_depth_end=ev.depth_end if ev else None,
        event_formation=ev.formation if ev else None,
        highlights=_highlights(q, u.text), source_status=u.source_status,
    )


def retrieve(db: Session, q: nlp.QueryIntent, filters: dict, ranges: list[tuple[float, float]], forms: list[str],
             top_k: int, radius_wells: set[str] | None) -> list[dict]:
    idx = get_index(db)
    qvec = idx.embedder.embed(q.raw + " " + " ".join(forms))
    q_tokens = q.tokens + [nlp.stem(t) for f in forms for t in f.lower().split()]
    scored = []
    for u in idx.units:
        if not _passes_filters(u, filters, radius_wells):
            continue
        scored.append((u, idx.bm25(q_tokens, u), cosine(qvec, u.vec), _meta(u, q, ranges, forms)))
    if not scored:
        return []
    # Absolute floor so a single weak keyword hit is not inflated to 1.0 by max-normalisation.
    max_bm = max(max(s[1] for s in scored), BM25_FLOOR)
    # Queries with no drilling cue (risk family, formation, depth, well) must match semantically.
    domain_cue = bool(q.families or forms or ranges or q.wells)
    ranked = []
    for u, bm, cs, mt in scored:
        if not domain_cue and cs < OFF_DOMAIN_MIN_COSINE:
            continue
        final = W_KEYWORD * (bm / max_bm) + W_SEMANTIC * cs + W_META * mt + (0.04 if u.kind == "event" else 0.0)
        ranked.append((final, u, dict(keyword=bm / max_bm, semantic=cs, metadata=mt)))
    ranked.sort(key=lambda t: -t[0])

    # Merge a structured event with the report page it was extracted from.
    events_by_page = {}
    for _, u, _ in ranked:
        if u.kind == "event" and u.document_id:
            events_by_page.setdefault((u.document_id, u.page), u.event)
    out, seen_pages = [], set()
    for final, u, parts in ranked:
        if final < MIN_RELEVANCE or len(out) >= top_k:
            break
        key = (u.document_id, u.page)
        if key in seen_pages:
            continue
        seen_pages.add(key)
        if u.kind == "event":
            # Prefer showing the source report page (verbatim evidence) with the event attached.
            chunk = next((c for c in idx.units if c.kind == "chunk" and c.document_id == u.document_id and c.page == u.page), None)
            if chunk is not None:
                out.append(_evidence_card(chunk, final, parts, q, linked=u.event))
                continue
        out.append(_evidence_card(u, final, parts, q, linked=events_by_page.get(key)))
    return out


# ------------------------------------------------------------------------------ answer composition
def _first_sentence(text: str, limit: int = 220) -> str:
    s = nlp.sentences(text)
    t = s[0] if s else text
    return t if len(t) <= limit else t[: limit - 1].rsplit(" ", 1)[0] + "…"


def _fmt_depth(a: float | None, b: float | None) -> str:
    if a is None:
        return "depth n/a"
    if b is None or abs(b - a) < 1:
        return f"{a:,.0f} m"
    return f"{a:,.0f}–{b:,.0f} m"


def compose_answer(q: nlp.QueryIntent, evidence: list[dict], forms: list[str], ranges) -> list[dict]:
    """Return answer sentences, each with the evidence indices (1-based) that support it."""
    # Work on the structured event behind each evidence card (its own depth interval, not the page's).
    with_events = []
    for i, e in enumerate(evidence):
        if e["event_id"]:
            with_events.append((i + 1, {**e, "depth_start": e["event_depth_start"], "depth_end": e["event_depth_end"],
                                        "formation": e["event_formation"] or e["formation"]}))
    if q.families:
        fam_types = {t for f in q.families for t in RISK_FAMILIES.get(f, [f])}
        focused = [(i, e) for i, e in with_events if e["event_type"] in fam_types]
        with_events = focused or with_events
    if ranges:
        near = [(i, e) for i, e in with_events
                if any(e["depth_end"] >= a - 200 and e["depth_start"] <= b + 200 for a, b in ranges)]
        with_events = near or with_events
    sev_rank = {"critical": 3, "high": 2, "medium": 1, "low": 0}
    with_events.sort(key=lambda t: (-sev_rank.get(t[1]["severity"] or "low", 0), -t[1]["relevance_score"]))
    label = " / ".join(RISK_LABELS.get(f, f).lower() for f in q.families) or "drilling events"
    sentences: list[dict] = []
    if with_events:
        wells = []
        for _, e in with_events:
            if e["well_name"] not in wells:
                wells.append(e["well_name"])
        lo = min(e["depth_start"] for _, e in with_events if e["depth_start"] is not None)
        hi = max(e["depth_end"] for _, e in with_events if e["depth_end"] is not None)
        fm_set = sorted({e["formation"] for _, e in with_events if e["formation"]})
        fm_txt = f" in the {', '.join(fm_set)}" if fm_set else ""
        sentences.append(dict(
            text=f"{len(wells)} offset well{'s' if len(wells) > 1 else ''} ({', '.join(wells)}) recorded {label}{fm_txt} "
                 f"between {lo:,.0f} and {hi:,.0f} m.",
            citations=[i for i, _ in with_events]))
        top = with_events[:3]
        if q.intent == "mitigation":
            for i, e in top:
                if e["mitigation"]:
                    sentences.append(dict(text=f"{e['well_name']} ({_fmt_depth(e['depth_start'], e['depth_end'])}): {e['mitigation']}",
                                          citations=[i]))
            lessons = [(i, e) for i, e in top if e["lessons"]]
            if lessons:
                i, e = lessons[0]
                sentences.append(dict(text=f"Lesson recorded: {e['lessons']}", citations=[i]))
        elif q.intent == "cause":
            for i, e in top:
                if e["root_cause"]:
                    sentences.append(dict(text=f"{e['well_name']} ({_fmt_depth(e['depth_start'], e['depth_end'])}): {e['root_cause']}",
                                          citations=[i]))
        elif q.intent == "list":
            items = "; ".join(f"{e['well_name']} at {_fmt_depth(e['depth_start'], e['depth_end'])} "
                              f"({e['severity']}, {e['document_title']} p.{e['page']})" for i, e in with_events[:5])
            sentences.append(dict(text=f"Events: {items}.", citations=[i for i, _ in with_events[:5]]))
            i, e = with_events[0]
            if e["mitigation"]:
                sentences.append(dict(text=f"Most severe case mitigation — {e['well_name']}: {e['mitigation']}", citations=[i]))
        else:
            for i, e in top[:2]:
                cause = f" Cause: {e['root_cause']}" if e["root_cause"] else ""
                sentences.append(dict(text=f"{e['well_name']} ({_fmt_depth(e['depth_start'], e['depth_end'])}, {e['severity']}): "
                                           f"{e.get('description') or _first_sentence(e['chunk_text'])}{cause}",
                                      citations=[i]))
            mit = next(((i, e) for i, e in top if e["mitigation"]), None)
            if mit:
                i, e = mit
                sentences.append(dict(text=f"What worked at {e['well_name']}: {e['mitigation']}", citations=[i]))
    else:
        # Report pages without a structured event — quote the most relevant sentence of each.
        for i, e in enumerate(evidence[:3], start=1):
            best = max(nlp.sentences(e["chunk_text"]) or [e["chunk_text"]],
                       key=lambda s: sum(1 for t in q.tokens if t in s.lower()))
            sentences.append(dict(text=f"{e['document_title']} (p.{e['page']}): {best}", citations=[i]))
    return sentences


def _param_card(well: Well, sample: ParameterSample, is_active: bool) -> dict:
    title = (f"eRTMAC parameter record {well.name} @ {sample.md:,.0f} m (simulated)" if is_active
             else f"Mud-logging database {well.name} @ {sample.md:,.0f} m")
    text = (f"MD {sample.md:,.0f} m — ROP {sample.rop:.1f} m/hr, WOB {sample.wob:.0f} kN, torque {sample.torque:.1f} kN·m, "
            f"RPM {sample.rpm:.0f}, flow {sample.flow_rate:,.0f} l/min, SPP {sample.standpipe_pressure:,.0f} psi, "
            f"MW {sample.mud_weight:.2f} sg, ECD {sample.ecd:.2f} sg, hook load {sample.hook_load:,.0f} kN.")
    return dict(kind="parameter", id=f"PS-{well.id}-{sample.md:.0f}", chunk_text=text, document_id=None,
                document_title=title, document_type="parameter_log", well_id=well.id, well_name=well.name, page=None,
                section="Drilling parameters", depth_start=sample.md, depth_end=sample.md, formation=None,
                date=sample.timestamp.date().isoformat(), relevance_score=1.0, score_breakdown={}, event_id=None,
                event_type=None, event_label=None, severity=None, root_cause=None, mitigation=None, lessons=None,
                npt_hours=None, highlights=[], source_status="synthetic_demo",
                params=dict(rop=sample.rop, wob=sample.wob, torque=sample.torque, ecd=sample.ecd,
                            mud_weight=sample.mud_weight, standpipe_pressure=sample.standpipe_pressure))


def _nearest_sample(db: Session, well_id: str, md: float) -> ParameterSample | None:
    lo = db.scalars(select(ParameterSample).where(ParameterSample.well_id == well_id, ParameterSample.md <= md)
                    .order_by(ParameterSample.md.desc()).limit(1)).first()
    return lo


def suggested_queries(context: dict | None) -> list[str]:
    base = [
        "What caused mud loss in the Barail Group near 3150m?",
        "Show stuck pipe events in Kopili Shale across all offset wells.",
        "What mitigations were used for overpressure in nearby wells?",
        "Compare drilling parameters between OIL-AX-102 and OIL-AX-99 at 3200m.",
        "What cementing issues were encountered in the Barail Group?",
        "Show evidence for the current stuck pipe risk alert.",
    ]
    if context and context.get("depth"):
        d = context["depth"]
        fm = context.get("formation")
        where = f"in the {fm} " if fm else ""
        base.insert(0, f"What happened {where}near {d:,.0f} m in nearby wells?")
    return base


def search(db: Session, query: str, filters: dict, context: dict | None, top_k: int = 6) -> dict:
    from services import risk_engine

    q = nlp.parse_query(query)
    ctx_depth = (context or {}).get("depth")
    ctx_form = (context or {}).get("formation")
    ranges = list(q.depth_ranges)
    forms = list(q.formations)
    if q.refers_to_current and ctx_depth is not None and not ranges:
        ranges = [(ctx_depth - 100, ctx_depth + 250)]
    if re.search(r"this formation|current formation", q.raw.lower()) and ctx_form and ctx_form not in forms:
        forms.append(ctx_form)
    if filters.get("depth_min") is not None or filters.get("depth_max") is not None:
        ranges = ranges or [(filters.get("depth_min") or 0, filters.get("depth_max") or 6000)]

    radius_wells = None
    active_id = (context or {}).get("well_id") or "W001"
    if (context or {}).get("radius_km"):
        aw = db.get(Well, active_id)
        radius_wells = {w.id for w in db.scalars(select(Well)).all()
                        if haversine_km(aw.latitude, aw.longitude, w.latitude, w.longitude) <= context["radius_km"]}

    understanding = dict(intent=q.intent, families=q.families, depth_ranges=ranges, formations=forms, wells=q.wells,
                         used_context=bool(q.refers_to_current and ctx_depth is not None))

    # ---- intent: evidence for the current risk alert ----
    if q.intent == "risk_evidence":
        depth = ctx_depth if ctx_depth is not None else 3100.0
        res = risk_engine.evaluate(db, active_id, depth, persist=False, radius_km=(context or {}).get("radius_km") or 25.0)
        cands = res["assessments"]
        if q.families:
            cands = [a for a in cands if a["risk_type"] in q.families] or cands
        if not cands:
            return _insufficient(q, understanding, context, "No active risk assessment at the current depth.")
        a = cands[0]
        evidence = []
        idx = get_index(db)
        for ev in a["evidence"]:
            chunk = next((c for c in idx.units if c.kind == "chunk" and c.document_id == ev["document_id"] and c.page == ev["page"]), None)
            if chunk:
                evt = next((u.event for u in idx.units if u.kind == "event" and u.id == ev["event_id"]), None)
                evidence.append(_evidence_card(chunk, 0.9, {}, q, linked=evt))
        sentences = [dict(text=f"{a['risk_label']} risk is {a['severity'].upper()} at {depth:,.0f} m (score {a['score']:.2f}, "
                                f"confidence {a['confidence'] * 100:.0f}%) for the {a['affected_formation']} window "
                                f"{a['risk_window']['start']:,.0f}–{a['risk_window']['end']:,.0f} m.",
                           citations=list(range(1, len(evidence) + 1)))]
        for i, ev in enumerate(evidence[:3], start=1):
            sentences.append(dict(text=f"{ev['well_name']} ({_fmt_depth(ev['depth_start'], ev['depth_end'])}): "
                                       f"{_first_sentence(ev['chunk_text'])}", citations=[i]))
        sentences.append(dict(text=f"Recommended: {a['recommendation']}", citations=[1] if evidence else []))
        return _result(q, understanding, sentences, evidence, context, confidence=a["confidence"])

    # ---- intent: parameter comparison ----
    if q.intent == "compare":
        depth = ranges[0][0] if ranges else (ctx_depth or 3100.0)
        names = q.wells or []
        wells = [w for w in db.scalars(select(Well)).all() if w.name in names]
        if not any(w.id == active_id for w in wells):
            wells.insert(0, db.get(Well, active_id))
        evidence, sentences = [], []
        for w in wells[:4]:
            s = _nearest_sample(db, w.id, depth)
            if s:
                evidence.append(_param_card(w, s, w.id == active_id))
        extra = retrieve(db, q, {k: v for k, v in filters.items() if k != "well_id"}, [(depth - 60, depth + 60)], forms,
                         3, radius_wells)
        evidence += [e for e in extra if e["event_id"]][:2]
        for i, e in enumerate(evidence, start=1):
            if e["kind"] == "parameter":
                p = e["params"]
                sentences.append(dict(text=f"{e['well_name']} at {e['depth_start']:,.0f} m: ECD {p['ecd']:.2f} sg, MW {p['mud_weight']:.2f} sg, "
                                           f"torque {p['torque']:.1f} kN·m, ROP {p['rop']:.1f} m/hr, SPP {p['standpipe_pressure']:,.0f} psi.",
                                      citations=[i]))
            else:
                sentences.append(dict(text=f"Offset context — {e['well_name']} {_fmt_depth(e['depth_start'], e['depth_end'])}: "
                                           f"{_first_sentence(e['chunk_text'])}", citations=[i]))
        if not evidence:
            return _insufficient(q, understanding, context)
        return _result(q, understanding, sentences, evidence, context, confidence=0.8)

    evidence = retrieve(db, q, filters, ranges, forms, top_k, radius_wells)
    if not evidence:
        return _insufficient(q, understanding, context)
    if q.families and not any(e["event_type"] and EVENT_TO_FAMILY.get(e["event_type"]) in q.families for e in evidence) \
            and not any(set(q.families) & set(
                f for f, c in FAMILY_CONCEPT.items() if c in nlp.concepts(e["chunk_text"])) for e in evidence):
        return _insufficient(q, understanding, context,
                             f"No {', '.join(RISK_LABELS[f].lower() for f in q.families)} evidence matches these filters.",
                             nearest=evidence[:3])
    sentences = compose_answer(q, evidence, forms, ranges)
    top = evidence[0]["relevance_score"]
    n_wells = len({e["well_id"] for e in evidence})
    meta_top = evidence[0]["score_breakdown"].get("metadata", 0.5)
    confidence = min(0.95, 0.25 + 0.45 * min(1.0, top / 0.75) + 0.1 * min(1.0, n_wells / 3) + 0.15 * meta_top)
    return _result(q, understanding, sentences, evidence, context, confidence=confidence)


def _result(q, understanding, sentences, evidence, context, confidence: float) -> dict:
    for s in sentences:
        s["citations"] = sorted(set(s["citations"]))
    answer = " ".join(f"{s['text']} " + "".join(f"[{c}]" for c in s["citations"]) for s in sentences).strip()
    related = []
    for e in evidence:
        if e["well_name"] not in related and e["well_name"] != "—":
            related.append(e["well_name"])
    return dict(query=q.raw, answer=answer, answer_sentences=sentences, confidence=round(confidence, 3),
                insufficient=False, evidence=evidence, related_wells=related, understanding=understanding,
                suggested_queries=suggested_queries(context), retrieval=dict(
                    method="hybrid", weights=dict(keyword=W_KEYWORD, semantic=W_SEMANTIC, metadata=W_META),
                    embedder=ConceptHashEmbedder.name, min_relevance=MIN_RELEVANCE, generator="extractive-citation"))


def _insufficient(q, understanding, context, why: str | None = None, nearest: list | None = None) -> dict:
    msg = "Insufficient evidence in the knowledge base to answer this query with confidence."
    if why:
        msg += " " + why
    return dict(query=q.raw, answer=msg, answer_sentences=[dict(text=msg, citations=[])], confidence=0.15,
                insufficient=True, evidence=nearest or [], related_wells=[], understanding=understanding,
                suggested_queries=suggested_queries(context), retrieval=dict(
                    method="hybrid", weights=dict(keyword=W_KEYWORD, semantic=W_SEMANTIC, metadata=W_META),
                    embedder=ConceptHashEmbedder.name, min_relevance=MIN_RELEVANCE, generator="extractive-citation"))
