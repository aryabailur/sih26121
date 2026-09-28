from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import DEMO_MODE, LLM_PROVIDER
from database import get_db
from schemas import SearchRequest
from services import llm, search_engine

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/evidence")
def evidence_search(req: SearchRequest, db: Session = Depends(get_db)):
    filters = req.model_dump(include={"well_id", "formation", "depth_min", "depth_max", "event_type", "doc_type",
                                      "date_from", "date_to"}, exclude_none=True)
    context = req.context.model_dump() if req.context else None
    result = search_engine.search(db, req.query, filters, context, req.top_k)
    if not result["insufficient"] and not DEMO_MODE and LLM_PROVIDER != "none":
        synthesized = llm.grounded_answer(req.query, result["evidence"])
        if synthesized:
            result["answer_extractive"] = result["answer"]
            result["answer"] = synthesized
            result["retrieval"]["generator"] = f"llm:{LLM_PROVIDER} (grounded on cited evidence)"
    return result


@router.get("/suggestions")
def suggestions(depth: float | None = None, formation: str | None = None):
    return {"suggested_queries": search_engine.suggested_queries({"depth": depth, "formation": formation} if depth else None)}
