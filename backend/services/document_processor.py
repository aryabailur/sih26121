"""Document intelligence pipeline.

    upload → text extraction (PDF text layer | OCR adapter) → chunking → event extraction
           → structuring (well, date, formation, depth, provenance) → human review → commit

Extraction is rule-based NLP over sentences: each candidate event keeps the exact
sentences, page and section it came from, a confidence score, and a duplicate check
against the existing knowledge base. Nothing enters the knowledge base until an
engineer approves it in the review step.
"""
from __future__ import annotations

import re
import shutil
import threading
import time
import uuid
from collections import Counter
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import select

from config import DOC_STAGE_DELAY, UPLOAD_DIR
from database import SessionLocal
from models import Document, DocumentChunk, DrillingEvent, Formation, Well
from services import nlp
from services.ingest import chunk_text, tag_chunk
from services.taxonomy import EVENT_LABELS, EVENT_TO_FAMILY, FORMATIONS

STAGES = [
    ("uploaded", "Upload received"),
    ("extracting_text", "Extracting text (PDF text layer / OCR)"),
    ("chunking", "Chunking & tagging pages"),
    ("identifying_events", "Identifying drilling events"),
    ("structuring", "Structuring data & provenance"),
    ("review", "Awaiting human review"),
    ("saved", "Saved to knowledge base"),
]
STAGE_INDEX = {s: i for i, (s, _) in enumerate(STAGES)}

JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


# ------------------------------------------------------------------------------ OCR adapter
class OCRAdapter:
    """Pluggable OCR. Uses Tesseract (pytesseract) when installed; otherwise reports that
    scanned pages need OCR rather than silently dropping them."""

    def __init__(self) -> None:
        self.engine = None
        try:
            import pytesseract  # type: ignore

            pytesseract.get_tesseract_version()
            self.engine = pytesseract
        except Exception:
            self.engine = None

    @property
    def available(self) -> bool:
        return self.engine is not None

    @property
    def name(self) -> str:
        return "Tesseract OCR" if self.available else "OCR engine not installed"

    def image_to_text(self, path: Path) -> str | None:
        if not self.available:
            return None
        try:
            from PIL import Image  # type: ignore

            return self.engine.image_to_string(Image.open(path))
        except Exception:
            return None


OCR = OCRAdapter()


def extract_pages(path: Path) -> tuple[list[dict], list[str]]:
    """Return ([{page, text, method}], log)."""
    log: list[str] = []
    suffix = path.suffix.lower()
    pages: list[dict] = []
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        log.append(f"PDF opened: {len(reader.pages)} page(s)")
        for i, pg in enumerate(reader.pages, start=1):
            text = (pg.extract_text() or "").strip()
            if len(text) >= 20:
                pages.append(dict(page=i, text=text, method="text-layer"))
                log.append(f"Page {i}: {len(text):,} characters from text layer")
            else:
                log.append(f"Page {i}: no text layer — scanned page; {OCR.name}"
                           + ("" if OCR.available else " (install Tesseract to OCR scanned pages)"))
                pages.append(dict(page=i, text="", method="ocr-unavailable"))
    elif suffix in (".txt", ".md"):
        raw = path.read_text(encoding="utf-8", errors="replace")
        parts = re.split(r"\f|\n={3,}.*?={3,}\n", raw)
        for i, part in enumerate([p for p in parts if p.strip()], start=1):
            pages.append(dict(page=i, text=part.strip(), method="plain-text"))
        log.append(f"Plain text: {len(pages)} page(s)")
    elif suffix in (".png", ".jpg", ".jpeg", ".tif", ".tiff"):
        text = OCR.image_to_text(path)
        if text:
            pages.append(dict(page=1, text=text, method="ocr"))
            log.append(f"Image OCR: {len(text):,} characters ({OCR.name})")
        else:
            pages.append(dict(page=1, text="", method="ocr-unavailable"))
            log.append(f"Image received; {OCR.name} — page queued for OCR")
    else:
        raise ValueError(f"Unsupported file type: {suffix}")
    return pages, log


# ------------------------------------------------------------------------------ event extraction
EVENT_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("kick", re.compile(r"\b(kick|influx|pit gain|flow check (was )?positive|shut[- ]in drill pipe|SIDPP)\b", re.I)),
    ("overpressure", re.compile(r"overpressur|high (background|connection) gas|pore pressure exceed", re.I)),
    ("mud_loss", re.compile(r"loss(es)? of (circulation|returns)|lost circulation|mud loss|(partial|total|severe|seepage|static) losses|losses of \d", re.I)),
    ("differential_sticking", re.compile(r"differential(ly)? stuck|differential sticking", re.I)),
    ("stuck_pipe", re.compile(r"\b(stuck pipe|pipe (was |became |got )?stuck|mechanical sticking|jarred free|worked (the )?pipe free)", re.I)),
    ("cementing_failure", re.compile(r"cement bond|channel(l)?ing|squeeze (cement|job)|poor bond|micro-?annulus|top of cement", re.I)),
    ("fishing", re.compile(r"\bfishing\b|twist[- ]off|junk basket|\bovershot\b|lost .{0,30} in (the )?hole", re.I)),
    ("torque_spike", re.compile(r"torque (began rising|increase|increased|rising|spike|fluctuat)|stick[- ]slip|erratic torque", re.I)),
    ("wellbore_instability", re.compile(r"tight (hole|spot)|cavings|pack[- ]off|hole instability|shale swelling", re.I)),
    ("NPT", re.compile(r"bit balling|\bfailure\b|\brepair(ed)?\b|waiting on", re.I)),
]
CAUSE_RE = re.compile(r"\b(cause[ds]?|caused by|due to|attributed to|root cause|because)\b", re.I)
MITIGATION_RE = re.compile(r"\b(mitigation|pumped|spotted|reduced|raised|increased|circulated|worked|reamed|back-?reamed|"
                           r"squeez\w*|freed|cured|controlled|changed|replaced|jarred|weighted up)\b", re.I)
LESSON_RE = re.compile(r"\b(lesson|recommend\w*|in future|should)\b", re.I)
TIME_ENTRY_RE = re.compile(r"^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}")
# Report furniture that ends an event narrative (forecasts, headers, property blocks).
BOUNDARY_RE = re.compile(r"^(next 24|forecast|mud (system|properties)|hole size|depth 00|rig:|prepared by|recommendations?:)", re.I)
OVERPULL_RE = re.compile(r"(\d{2,3})\s*kN\s*overpull|overpull (?:of )?(\d{2,3})\s*kN", re.I)
CASING_RE = re.compile(r"\b\d{1,2}(?:-\d/\d)?\s?(?:in\b|\")")
CHEMICALS = ["KCl", "LCM", "CaCO3", "calcium carbonate", "graphite", "barite", "glycol", "diesel", "detergent", "OBM", "WBM", "polymer"]
EQUIPMENT = ["PDC", "tricone", "MWD", "BHA", "top drive", "jar", "overshot", "under-reamer", "mud pump", "BOP", "choke", "liner"]


def _event_type(sentence: str) -> str | None:
    for t, pat in EVENT_PATTERNS:
        if pat.search(sentence):
            return t
    return None


def _severity(t: str, text: str, npt: float | None) -> str:
    low = text.lower()
    overpull = [int(a or b) for a, b in OVERPULL_RE.findall(text)]
    if t == "kick" and (re.search(r"sidpp|shut[- ]in drill pipe", low) or re.search(r"pit gain of [2-9]", low)):
        return "critical"
    if "total loss" in low or "severe" in low:
        return "critical"
    if t in ("stuck_pipe", "differential_sticking") or "twist" in low or (overpull and max(overpull) >= 300):
        return "high"
    if (overpull and max(overpull) >= 150) or "partial losses" in low or (npt or 0) >= 8 or t in ("kick", "cementing_failure"):
        return "medium"
    return "low"


def extract_events(pages: list[dict], formation_lookup) -> list[dict]:
    out: list[dict] = []
    doc_formation = None
    for p in pages:
        fms = nlp.formations(p["text"])
        if fms and doc_formation is None:
            doc_formation = fms[0]
    for p in pages:
        # PDF text layers wrap mid-phrase ("bit\nballing"); collapse whitespace before matching.
        sents = [" ".join(s.split()) for s in nlp.sentences(p["text"])]
        i = 0
        while i < len(sents):
            t = _event_type(sents[i])
            if t is None or (t == "NPT" and re.match(r"^NPT\b", sents[i])):
                i += 1
                continue
            group = [sents[i]]
            j = i + 1
            while j < len(sents) and len(group) < 6:
                s = sents[j]
                if TIME_ENTRY_RE.match(s) or s.startswith("##") or BOUNDARY_RE.match(s):
                    break
                nt = _event_type(s)
                if nt and nt not in (t, "NPT", "wellbore_instability") and not CAUSE_RE.search(s) and not MITIGATION_RE.search(s):
                    break
                group.append(s)
                j += 1
            text = " ".join(group)
            ds = nlp.depths(text)
            if ds:
                d0 = min(a for a, _ in ds)
                d1 = max(b for _, b in ds)
            else:
                d0 = d1 = None
            fm_mentions = nlp.formations(text)
            formation = fm_mentions[0] if fm_mentions else (
                formation_lookup((d0 + d1) / 2) if (d0 is not None and formation_lookup) else doc_formation)
            npt = nlp.npt_hours(text)
            cause = " ".join(s for s in group[1:] if CAUSE_RE.search(s))
            mitig = " ".join(s for s in group[1:] if MITIGATION_RE.search(s) and not CAUSE_RE.search(s))
            lesson = " ".join(s for s in group if LESSON_RE.search(s))
            conf = 0.45 + (0.15 if d0 is not None else 0) + (0.10 if formation else 0) + (0.10 if cause else 0) \
                + (0.10 if mitig else 0) + (0.05 if npt else 0) + (0.05 if t not in ("NPT", "wellbore_instability") else 0)
            conf = round(min(conf, 0.97), 2)
            desc = re.sub(r"^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\s*", "", group[0])
            out.append(dict(
                candidate_id=f"C{len(out) + 1:02d}", event_type=t, event_label=EVENT_LABELS.get(t, t),
                depth_start=d0, depth_end=d1, formation=formation, severity=_severity(t, text, npt),
                description=desc, root_cause=cause, mitigation_action=mitig, lessons_learned=lesson,
                npt_hours=npt or 0.0, source_page=p["page"], source_section=p.get("section") or f"Page {p['page']}",
                evidence_text=text, confidence=conf, needs_review=conf < 0.75,
            ))
            i = j
    return _merge_within_document(out)


def _merge_within_document(cands: list[dict]) -> list[dict]:
    """A report often mentions one event twice (24-hr summary + time log). Keep the richer
    candidate per risk family and overlapping depth window, and note where else it appeared."""
    kept: list[dict] = []
    for c in sorted(cands, key=lambda c: -c["confidence"]):
        fam = EVENT_TO_FAMILY.get(c["event_type"])
        dup = None
        if c["depth_start"] is not None:
            for k in kept:
                if (k["depth_start"] is not None and EVENT_TO_FAMILY.get(k["event_type"]) == fam
                        and k["depth_start"] - 30 <= c["depth_end"] and c["depth_start"] <= k["depth_end"] + 30):
                    dup = k
                    break
        if dup:
            dup.setdefault("also_mentioned_on", []).append(c["source_page"])
            continue
        kept.append(c)
    kept.sort(key=lambda c: (c["source_page"], c["depth_start"] or 0))
    for n, c in enumerate(kept, start=1):
        c["candidate_id"] = f"C{n:02d}"
    return kept


def extract_entities(pages: list[dict]) -> list[dict]:
    counts: Counter = Counter()
    first_page: dict[tuple[str, str], int] = {}

    def add(kind: str, value: str, page: int) -> None:
        counts[(kind, value)] += 1
        first_page.setdefault((kind, value), page)

    for p in pages:
        t = p["text"]
        for w in nlp.well_names(t):
            add("well", w, p["page"])
        for f in nlp.formations(t):
            add("formation", f, p["page"])
        for a, b in nlp.depths(t):
            add("depth", f"{a:,.0f} m" if a == b else f"{a:,.0f}–{b:,.0f} m", p["page"])
        for mw in nlp.mud_weights(t):
            add("mud_weight", f"{mw:.2f} sg", p["page"])
        for c in CASING_RE.findall(t):
            add("casing_size", c.strip(), p["page"])
        for d in nlp.iso_dates(t):
            add("date", d, p["page"])
        low = t.lower()
        for c in CHEMICALS:
            if c.lower() in low:
                add("chemical", c, p["page"])
        for e in EQUIPMENT:
            if re.search(r"\b" + re.escape(e.lower()) + r"\b", low):
                add("equipment", e, p["page"])
    order = ["well", "formation", "date", "depth", "mud_weight", "casing_size", "chemical", "equipment"]
    items = [dict(type=k, value=v, count=n, page=first_page[(k, v)]) for (k, v), n in counts.items()]
    items.sort(key=lambda x: (order.index(x["type"]), -x["count"]))
    return items


def detect_doc_type(text: str) -> str:
    low = text.lower()
    for key, t in [("daily drilling report", "DDR"), ("completion report", "WCR"), ("mud log", "mud_log"),
                   ("cementing", "cementing_report"), ("npt report", "NPT_report"), ("casing", "casing_report")]:
        if key in low:
            return t
    return "DDR"


# ------------------------------------------------------------------------------ job runner
def _set(doc_id: str, stage: str, msg: str | None = None, **extra) -> None:
    with _LOCK:
        job = JOBS.setdefault(doc_id, dict(stage="uploaded", log=[], started=time.time()))
        job["stage"] = stage
        job["stage_index"] = STAGE_INDEX[stage]
        job["progress"] = round(100 * STAGE_INDEX[stage] / (len(STAGES) - 2))
        if msg:
            job["log"].append(dict(t=round(time.time() - job["started"], 2), stage=stage, message=msg))
        job.update(extra)


def _persist_status(doc_id: str, status: str) -> None:
    db = SessionLocal()
    try:
        d = db.get(Document, doc_id)
        if d:
            d.processing_status = status
            d.processing_log = [e["message"] for e in JOBS.get(doc_id, {}).get("log", [])]
            db.commit()
    finally:
        db.close()


def run_pipeline(doc_id: str, path: Path) -> None:
    try:
        _set(doc_id, "extracting_text", f"Received {path.name} ({path.stat().st_size / 1024:.1f} KB)")
        time.sleep(DOC_STAGE_DELAY)
        pages, log = extract_pages(path)
        for m in log:
            _set(doc_id, "extracting_text", m)
        _persist_status(doc_id, "extracting_text")
        full = "\n".join(p["text"] for p in pages)
        if not full.strip():
            _set(doc_id, "review", "No machine-readable text found — manual transcription or OCR required.",
                 error="no_text")
            _persist_status(doc_id, "review")
            _save_extraction(doc_id, pages, [], [], [], None, None, None)
            return

        time.sleep(DOC_STAGE_DELAY)
        _set(doc_id, "chunking", "Splitting pages into retrieval chunks (≤220 words, 40-word overlap)")
        db = SessionLocal()
        try:
            names = nlp.well_names(full)
            well = None
            if names:
                top = Counter(n for n in re.findall(r"OIL-[A-Z]{2}-\d{2,3}", full.upper())).most_common(1)
                target = top[0][0] if top else names[0]
                well = db.scalars(select(Well).where(Well.name == target)).first()
            if well:
                _set(doc_id, "chunking", f"Well identified: {well.name} → {well.id}")
                forms = db.scalars(select(Formation).where(Formation.well_id == well.id).order_by(Formation.top_md)).all()

                def lookup(md: float) -> str | None:
                    cur = None
                    for f in forms:
                        if f.top_md <= md:
                            cur = f.name
                    return cur
            else:
                _set(doc_id, "chunking", "No known well name found — assign the well during review")
                lookup = None  # type: ignore[assignment]

            chunks = []
            for p in pages:
                for k, piece in enumerate(chunk_text(p["text"])):
                    ds = nlp.depths(piece)
                    d0 = min(a for a, _ in ds) if ds else None
                    d1 = max(b for _, b in ds) if ds else None
                    formation, tags = tag_chunk(piece, d0, d1, lookup)
                    first = piece.split(".")[0].strip("# ").strip()
                    section = first[:60] if first.isupper() or len(first) < 40 else f"Page {p['page']}"
                    p.setdefault("section", section)
                    chunks.append(dict(page=p["page"], index=k, text=piece, section=section, depth_start=d0,
                                       depth_end=d1, formation=formation, tags=tags))
            _set(doc_id, "chunking", f"{len(chunks)} chunk(s) created and tagged with depth, formation and concepts")
            _persist_status(doc_id, "chunking")

            time.sleep(DOC_STAGE_DELAY)
            _set(doc_id, "identifying_events", "Scanning sentences for losses, sticking, kicks, torque, cementing, NPT…")
            events = extract_events(pages, lookup)
            for e in events:
                where = "n/a" if e["depth_start"] is None else "{:,.0f} m".format(e["depth_start"])
                _set(doc_id, "identifying_events",
                     f"p.{e['source_page']}: {e['event_label']} at {where} (confidence {e['confidence'] * 100:.0f}%)")
            _persist_status(doc_id, "identifying_events")

            time.sleep(DOC_STAGE_DELAY)
            _set(doc_id, "structuring", "Linking provenance (document, page, section) and checking for duplicates")
            if well:
                existing = db.scalars(select(DrillingEvent).where(DrillingEvent.well_id == well.id)).all()
                for e in events:
                    if e["depth_start"] is None:
                        continue
                    fam = EVENT_TO_FAMILY.get(e["event_type"])
                    for x in existing:
                        if EVENT_TO_FAMILY.get(x.event_type) == fam and x.depth_end + 20 >= e["depth_start"] and x.depth_start - 20 <= e["depth_end"]:
                            e["possible_duplicate_of"] = dict(id=x.id, title=x.title, depth_start=x.depth_start,
                                                              depth_end=x.depth_end)
                            e["needs_review"] = True
                            _set(doc_id, "structuring", f"{e['candidate_id']} may duplicate existing event {x.id} ({x.title})")
                            break
            for e in events:
                if e["depth_start"] is None:
                    e["needs_review"] = True  # an event without depth can't be placed — reviewer must add it
                e["approved"] = (not e.get("possible_duplicate_of") and e["confidence"] >= 0.6
                                 and e["depth_start"] is not None)
            entities = extract_entities(pages)
            dates = nlp.iso_dates(full)
            doc_date = dates[0] if dates else None
            doc_type = detect_doc_type(full)
            m = re.search(r"Report No\.?\s*(\d+)", full)
            title = (f"{'DDR' if doc_type == 'DDR' else doc_type.replace('_', ' ')} {well.name if well else 'Unassigned well'}"
                     + (f" Day {m.group(1)}" if m and doc_type == "DDR" else "") + " (uploaded)")
            _set(doc_id, "structuring", f"Document classified as {doc_type}; {len(entities)} entities extracted")
            _save_extraction(doc_id, pages, chunks, events, entities, well.id if well else None, doc_date, doc_type, title)
        finally:
            db.close()
        time.sleep(DOC_STAGE_DELAY)
        n_review = sum(1 for e in events if e["needs_review"])
        _set(doc_id, "review", f"{len(events)} candidate event(s) ready — {n_review} flagged for human review")
        _persist_status(doc_id, "review")
    except Exception as exc:  # pragma: no cover - surfaced in UI
        _set(doc_id, "review", f"Processing error: {exc}", error=str(exc))
        _persist_status(doc_id, "error")


def _save_extraction(doc_id, pages, chunks, events, entities, well_id, doc_date, doc_type, title=None) -> None:
    db = SessionLocal()
    try:
        d = db.get(Document, doc_id)
        if not d:
            return
        d.extraction = dict(pages=[dict(page=p["page"], method=p["method"], text=p["text"]) for p in pages],
                            chunks=chunks, events=events, entities=entities, well_id=well_id,
                            date=doc_date, doc_type=doc_type)
        if well_id:
            d.well_id = well_id
        if doc_type:
            d.doc_type = doc_type
        if doc_date:
            d.date = date.fromisoformat(doc_date)
        if title:
            d.title = title
        d.page_count = len(pages)
        db.commit()
    finally:
        db.close()


def start_upload(filename: str, data: bytes) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)[-120:] or "upload.pdf"
    doc_id = f"DOC-UP-{datetime.utcnow().strftime('%H%M%S')}-{uuid.uuid4().hex[:4]}"
    path = UPLOAD_DIR / f"{doc_id}_{safe}"
    path.write_bytes(data)
    db = SessionLocal()
    try:
        db.add(Document(id=doc_id, well_id=None, title=safe, doc_type="DDR", date=None, source_status="uploaded",
                        file_path=f"uploads/{path.name}", page_count=0, processing_status="uploaded",
                        processing_log=[], summary="", extraction={}, original_filename=filename))
        db.commit()
    finally:
        db.close()
    with _LOCK:
        JOBS[doc_id] = dict(stage="uploaded", stage_index=0, progress=0, started=time.time(),
                            log=[dict(t=0.0, stage="uploaded", message=f"Upload received: {filename}")])
    threading.Thread(target=run_pipeline, args=(doc_id, path), daemon=True).start()
    return doc_id


def start_sample(sample_path: Path) -> str:
    return start_upload(sample_path.name, sample_path.read_bytes())


def job_status(doc_id: str) -> dict | None:
    job = JOBS.get(doc_id)
    db = SessionLocal()
    try:
        d = db.get(Document, doc_id)
        if d is None:
            return None
        if job is None:
            stage = "saved" if d.processing_status == "indexed" else ("review" if d.processing_status == "review" else d.processing_status)
            job = dict(stage=stage if stage in STAGE_INDEX else "review", log=[dict(t=0, stage=stage, message=m) for m in d.processing_log or []])
        ex = d.extraction or {}
        return dict(
            document_id=doc_id, status=job.get("stage"), stage_index=STAGE_INDEX.get(job.get("stage", "uploaded"), 0),
            progress=job.get("progress", 100 if job.get("stage") == "saved" else 0),
            stages=[dict(key=k, label=lbl) for k, lbl in STAGES], log=job.get("log", []), error=job.get("error"),
            events_extracted=len(ex.get("events", [])), chunks=len(ex.get("chunks", [])),
            entities=len(ex.get("entities", [])), title=d.title, well_id=d.well_id, ocr_engine=OCR.name,
        )
    finally:
        db.close()


def commit_document(doc_id: str, decisions: list[dict], well_id: str | None) -> dict:
    db = SessionLocal()
    try:
        d = db.get(Document, doc_id)
        if d is None:
            raise KeyError(doc_id)
        if d.processing_status == "indexed":
            raise ValueError("This document is already saved to the knowledge base.")
        ex = d.extraction or {}
        wid = well_id or ex.get("well_id") or d.well_id
        if not wid:
            raise ValueError("Assign a well before saving to the knowledge base.")
        d.well_id = wid
        by_id = {c["candidate_id"]: c for c in ex.get("events", [])}
        saved_events, skipped = [], []
        doc_date = d.date or date.today()
        for dec in decisions:
            c = by_id.get(dec.get("candidate_id"))
            if not c or not dec.get("approved"):
                continue
            c = {**c, **{k: v for k, v in dec.items() if k in (
                "event_type", "depth_start", "depth_end", "formation", "severity", "description", "root_cause",
                "mitigation_action", "lessons_learned", "npt_hours") and v is not None}}
            if c["depth_start"] is None:
                skipped.append(dict(candidate_id=c["candidate_id"], reason="no depth"))
                continue
            ev_id = f"EV-{wid}-X{len(saved_events) + 1:02d}-{doc_id[-6:]}"
            db.add(DrillingEvent(
                id=ev_id, well_id=wid, event_type=c["event_type"],
                title=f"{EVENT_LABELS.get(c['event_type'], c['event_type'])} (extracted)",
                depth_start=float(c["depth_start"]), depth_end=float(c["depth_end"] or c["depth_start"]),
                formation=c.get("formation") or "Unknown", severity=c["severity"], date=doc_date,
                description=c["description"], root_cause=c.get("root_cause", ""),
                mitigation_action=c.get("mitigation_action", ""), lessons_learned=c.get("lessons_learned", ""),
                npt_hours=float(c.get("npt_hours") or 0), source_document_id=doc_id, source_page=c["source_page"],
                source_section=c.get("source_section"), origin="extracted", extraction_confidence=c["confidence"],
            ))
            saved_events.append(ev_id)
        n_chunks = 0
        for ch in ex.get("chunks", []):
            db.add(DocumentChunk(
                id=f"{doc_id}-P{ch['page']:02d}-{ch['index']}", document_id=doc_id, text=ch["text"], page=ch["page"],
                section=ch["section"], depth_start=ch["depth_start"], depth_end=ch["depth_end"],
                formation=ch["formation"], tags=ch["tags"],
            ))
            n_chunks += 1
        d.processing_status = "indexed"
        d.summary = f"Uploaded and reviewed: {len(saved_events)} event(s) approved, {n_chunks} chunk(s) indexed."
        db.commit()
        _set(doc_id, "saved", f"Saved {len(saved_events)} event(s) and {n_chunks} chunk(s) to the knowledge base")
        return dict(success=True, events_saved=len(saved_events), event_ids=saved_events, chunks_indexed=n_chunks,
                    skipped=skipped)
    finally:
        db.close()


def remove_uploaded(db, doc_id: str) -> bool:
    d = db.get(Document, doc_id)
    if d is None or d.source_status != "uploaded":
        return False
    for e in db.scalars(select(DrillingEvent).where(DrillingEvent.source_document_id == doc_id)).all():
        db.delete(e)
    if d.file_path:
        from config import DATA_DIR
        (DATA_DIR / d.file_path).unlink(missing_ok=True)
    db.delete(d)
    db.commit()
    JOBS.pop(doc_id, None)
    return True


def copy_sample(src: Path) -> Path:
    dst = UPLOAD_DIR / src.name
    shutil.copy(src, dst)
    return dst


__all__ = ["start_upload", "start_sample", "job_status", "commit_document", "remove_uploaded", "FORMATIONS"]
