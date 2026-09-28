"""Pydantic request/response schemas (API contract; mirrored in frontend/lib/types.ts)."""
from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["low", "medium", "high", "critical"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class WellSummary(ORM):
    id: str
    name: str
    role: str
    status: str
    field: str
    basin: str
    latitude: float
    longitude: float
    spud_date: date
    completion_date: date | None
    total_depth_md: float
    current_depth_md: float
    total_depth_tvd: float
    well_type: str
    formation_target: str
    rig: str


class WellDetail(WellSummary):
    operator_note: str
    mud_program: dict


class FormationOut(ORM):
    id: str
    well_id: str
    name: str
    top_md: float
    base_md: float
    lithology: str
    risk_tags: list[str]
    is_prognosed: int


class SurveyOut(ORM):
    md: float
    tvd: float
    inclination: float
    azimuth: float
    latitude: float
    longitude: float
    dogleg: float
    is_planned: int


class EventOut(ORM):
    id: str
    well_id: str
    event_type: str
    title: str
    depth_start: float
    depth_end: float
    formation: str
    severity: str
    date: date
    description: str
    root_cause: str
    mitigation_action: str
    lessons_learned: str
    npt_hours: float
    source_document_id: str | None
    source_page: int | None
    source_section: str | None
    event_params: dict
    origin: str
    extraction_confidence: float | None


class DocumentOut(ORM):
    id: str
    well_id: str | None
    title: str
    doc_type: str
    date: date | None
    source_status: str
    page_count: int
    processing_status: str
    summary: str
    original_filename: str | None = None


class ChunkOut(ORM):
    id: str
    document_id: str
    text: str
    page: int
    section: str
    depth_start: float | None
    depth_end: float | None
    formation: str | None
    tags: list[str]


class RiskZoneOut(ORM):
    id: str
    formation: str
    depth_start: float
    depth_end: float
    risk_type: str
    severity: str
    historical_frequency: float
    contributing_wells: list[str]
    source: str
    description: str


class SimilarityOut(ORM):
    well_a_id: str
    well_b_id: str
    score: float
    formation_overlap: float
    depth_coverage: float
    trajectory_similarity: float
    parameter_similarity: float
    distance_km: float
    reasons: list[str]


class DrillingParams(BaseModel):
    rop: float | None = None
    wob: float | None = None
    torque: float | None = None
    rpm: float | None = None
    flow_rate: float | None = Field(default=None, alias="flow")
    standpipe_pressure: float | None = Field(default=None, alias="pressure")
    mud_weight: float | None = None
    ecd: float | None = None
    hook_load: float | None = None

    model_config = ConfigDict(populate_by_name=True)


class RiskEvaluateRequest(BaseModel):
    well_id: str = "W001"
    current_depth: float
    parameters: DrillingParams | None = None
    radius_km: float = 25.0
    persist: bool = True


class AcknowledgeRequest(BaseModel):
    alert_id: str
    status: Literal["active", "acknowledged", "dismissed", "reviewed"]
    notes: str = ""
    actor: str = "Drilling Engineer"


class SearchContext(BaseModel):
    well_id: str | None = "W001"
    depth: float | None = None
    formation: str | None = None
    radius_km: float | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    well_id: str | None = None
    formation: str | None = None
    depth_min: float | None = None
    depth_max: float | None = None
    event_type: str | None = None
    doc_type: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    top_k: int = Field(default=6, ge=1, le=15)
    context: SearchContext | None = None


class ScenarioRequest(BaseModel):
    scenario: Literal["full", "mud_loss", "stuck_pipe", "kick"] = "full"


class ReviewDecision(BaseModel):
    candidate_id: str
    approved: bool
    event_type: str | None = None
    depth_start: float | None = None
    depth_end: float | None = None
    formation: str | None = None
    severity: Severity | None = None
    description: str | None = None
    root_cause: str | None = None
    mitigation_action: str | None = None
    lessons_learned: str | None = None
    npt_hours: float | None = None


class CommitRequest(BaseModel):
    decisions: list[ReviewDecision]
    well_id: str | None = None
