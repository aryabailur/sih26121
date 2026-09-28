from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from config import DATA_DIR, SAMPLE_DIR
from database import get_db
from models import Document, DocumentChunk, DrillingEvent, Well
from schemas import ChunkOut, CommitRequest, DocumentOut, EventOut
from services import document_processor as dp
from services import risk_engine, search_engine

router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED = (".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg", ".tif", ".tiff")


@router.get("")
def list_documents(well_id: str | None = None, doc_type: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Document).order_by(Document.date.desc())
    if well_id:
        stmt = stmt.where(Document.well_id == well_id)
    if doc_type:
        stmt = stmt.where(Document.doc_type == doc_type)
    docs = db.scalars(stmt).all()
    chunk_counts = dict(db.execute(select(DocumentChunk.document_id, func.count()).group_by(DocumentChunk.document_id)).all())
    event_counts = dict(db.execute(select(DrillingEvent.source_document_id, func.count()).group_by(DrillingEvent.source_document_id)).all())
    wells = {w.id: w.name for w in db.scalars(select(Well)).all()}
    return {"documents": [DocumentOut.model_validate(d).model_dump(mode="json") | dict(
        well_name=wells.get(d.well_id or "", "—"), chunk_count=chunk_counts.get(d.id, 0),
        event_count=event_counts.get(d.id, 0)) for d in docs]}


@router.get("/samples/list")
def samples():
    return {"samples": [dict(name=p.name, size_kb=round(p.stat().st_size / 1024, 1),
                             url=f"/api/documents/samples/{p.name}") for p in sorted(SAMPLE_DIR.glob("*.pdf"))]}


@router.get("/samples/{name}")
def sample_file(name: str):
    path = (SAMPLE_DIR / name).resolve()
    if path.parent != SAMPLE_DIR.resolve() or not path.exists():
        raise HTTPException(404, "Sample not found")
    return FileResponse(path, media_type="application/pdf", filename=name)


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    name = file.filename or "upload.pdf"
    if not name.lower().endswith(ALLOWED):
        raise HTTPException(415, f"Unsupported file type. Allowed: {', '.join(ALLOWED)}")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (limit 15 MB)")
    if not data:
        raise HTTPException(400, "Empty file")
    doc_id = dp.start_upload(name, data)
    return {"document_id": doc_id, "status": "processing"}


@router.post("/upload-sample")
def upload_sample(name: str | None = None):
    files = sorted(SAMPLE_DIR.glob("*.pdf"))
    if not files:
        raise HTTPException(404, "No sample documents — run seed_data.py")
    path = next((f for f in files if f.name == name), files[0])
    return {"document_id": dp.start_sample(path), "status": "processing", "file": path.name}


@router.get("/{doc_id}/status")
def status(doc_id: str):
    s = dp.job_status(doc_id)
    if s is None:
        raise HTTPException(404, f"Document {doc_id} not found")
    return s


@router.get("/{doc_id}/extracted")
def extracted(doc_id: str, db: Session = Depends(get_db)):
    d = db.get(Document, doc_id)
    if not d:
        raise HTTPException(404, f"Document {doc_id} not found")
    ex = d.extraction or {}
    wells = [dict(id=w.id, name=w.name) for w in db.scalars(select(Well).order_by(Well.id)).all()]
    return {
        "document": DocumentOut.model_validate(d).model_dump(mode="json"),
        "events": ex.get("events", []), "entities": ex.get("entities", []),
        "chunks": ex.get("chunks", []),
        "pages": [dict(page=p["page"], method=p["method"], text=p["text"][:4000]) for p in ex.get("pages", [])],
        "detected": dict(well_id=ex.get("well_id"), date=ex.get("date"), doc_type=ex.get("doc_type")),
        "wells": wells,
    }


@router.post("/{doc_id}/commit")
def commit(doc_id: str, req: CommitRequest, db: Session = Depends(get_db)):
    try:
        result = dp.commit_document(doc_id, [d.model_dump() for d in req.decisions], req.well_id)
    except KeyError:
        raise HTTPException(404, f"Document {doc_id} not found")
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    search_engine.rebuild_index(db)
    risk_engine.invalidate_cache()
    return result


@router.delete("/{doc_id}")
def delete(doc_id: str, db: Session = Depends(get_db)):
    if not dp.remove_uploaded(db, doc_id):
        raise HTTPException(400, "Only uploaded documents can be removed")
    search_engine.rebuild_index(db)
    risk_engine.invalidate_cache()
    return {"success": True}


@router.get("/{doc_id}/file")
def original_file(doc_id: str, db: Session = Depends(get_db)):
    d = db.get(Document, doc_id)
    if not d or not d.file_path:
        raise HTTPException(404, "No file stored for this document")
    path = (DATA_DIR / d.file_path).resolve()
    if DATA_DIR.resolve() not in path.parents or not path.exists():
        raise HTTPException(404, "File missing")
    return FileResponse(path, filename=path.name)


@router.get("/{doc_id}")
def document_detail(doc_id: str, db: Session = Depends(get_db)):
    d = db.get(Document, doc_id)
    if not d:
        raise HTTPException(404, f"Document {doc_id} not found")
    chunks = db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == doc_id).order_by(DocumentChunk.page)).all()
    events = db.scalars(select(DrillingEvent).where(DrillingEvent.source_document_id == doc_id)).all()
    w = db.get(Well, d.well_id) if d.well_id else None
    return {"document": DocumentOut.model_validate(d).model_dump(mode="json") | dict(well_name=w.name if w else "—"),
            "chunks": [ChunkOut.model_validate(c).model_dump(mode="json") for c in chunks],
            "events": [EventOut.model_validate(e).model_dump(mode="json") for e in events]}
