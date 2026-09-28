"""SQLAlchemy ORM models — the NWIS knowledge schema.

The schema is engine-agnostic (SQLite for the prototype, PostgreSQL in production);
list-valued fields use the portable JSON type.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Well(Base):
    __tablename__ = "wells"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(12), default="offset")  # active | offset
    status: Mapped[str] = mapped_column(String(16))  # active | completed | abandoned | drilling
    field: Mapped[str] = mapped_column(String(60))
    basin: Mapped[str] = mapped_column(String(60))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    spud_date: Mapped[date] = mapped_column(Date)
    completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_depth_md: Mapped[float] = mapped_column(Float)
    current_depth_md: Mapped[float] = mapped_column(Float)
    total_depth_tvd: Mapped[float] = mapped_column(Float)
    well_type: Mapped[str] = mapped_column(String(20))
    formation_target: Mapped[str] = mapped_column(String(60))
    rig: Mapped[str] = mapped_column(String(40), default="")
    operator_note: Mapped[str] = mapped_column(Text, default="")
    # Planned mud weight per formation (drilling programme) — baseline for MW/ECD deviation.
    mud_program: Mapped[dict] = mapped_column(JSON, default=dict)

    formations: Mapped[list[Formation]] = relationship(back_populates="well", cascade="all, delete-orphan")
    events: Mapped[list[DrillingEvent]] = relationship(back_populates="well", cascade="all, delete-orphan")
    survey: Mapped[list[SurveyPoint]] = relationship(back_populates="well", cascade="all, delete-orphan")
    documents: Mapped[list[Document]] = relationship(back_populates="well", cascade="all, delete-orphan")


class SurveyPoint(Base):
    __tablename__ = "survey_points"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), index=True)
    md: Mapped[float] = mapped_column(Float)
    tvd: Mapped[float] = mapped_column(Float)
    inclination: Mapped[float] = mapped_column(Float)
    azimuth: Mapped[float] = mapped_column(Float)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    dogleg: Mapped[float] = mapped_column(Float, default=0.0)  # deg / 30 m
    is_planned: Mapped[int] = mapped_column(Integer, default=0)

    well: Mapped[Well] = relationship(back_populates="survey")


class Formation(Base):
    __tablename__ = "formations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), index=True)
    name: Mapped[str] = mapped_column(String(60), index=True)
    top_md: Mapped[float] = mapped_column(Float)
    base_md: Mapped[float] = mapped_column(Float)
    lithology: Mapped[str] = mapped_column(String(60))
    risk_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_prognosed: Mapped[int] = mapped_column(Integer, default=0)

    well: Mapped[Well] = relationship(back_populates="formations")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    well_id: Mapped[str | None] = mapped_column(ForeignKey("wells.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    doc_type: Mapped[str] = mapped_column(String(24))  # DDR | WCR | mud_log | casing_report | cementing_report | NPT_report
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_status: Mapped[str] = mapped_column(String(20), default="synthetic_demo")  # original | synthetic_demo | uploaded
    file_path: Mapped[str | None] = mapped_column(String(260), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=1)
    processing_status: Mapped[str] = mapped_column(String(24), default="indexed")
    processing_log: Mapped[list[str]] = mapped_column(JSON, default=list)
    summary: Mapped[str] = mapped_column(Text, default="")
    # Pipeline output awaiting human review (uploaded documents only).
    extraction: Mapped[dict] = mapped_column(JSON, default=dict)
    original_filename: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    well: Mapped[Well | None] = relationship(back_populates="documents")
    chunks: Mapped[list[DocumentChunk]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    page: Mapped[int] = mapped_column(Integer)
    section: Mapped[str] = mapped_column(String(80))
    depth_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth_end: Mapped[float | None] = mapped_column(Float, nullable=True)
    formation: Mapped[str | None] = mapped_column(String(60), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)

    document: Mapped[Document] = relationship(back_populates="chunks")


class DrillingEvent(Base):
    __tablename__ = "drilling_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(160), default="")
    depth_start: Mapped[float] = mapped_column(Float)
    depth_end: Mapped[float] = mapped_column(Float)
    formation: Mapped[str] = mapped_column(String(60))
    severity: Mapped[str] = mapped_column(String(10))
    date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text)
    root_cause: Mapped[str] = mapped_column(Text, default="")
    mitigation_action: Mapped[str] = mapped_column(Text, default="")
    lessons_learned: Mapped[str] = mapped_column(Text, default="")
    npt_hours: Mapped[float] = mapped_column(Float, default=0.0)
    source_document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_section: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # Numeric context recorded at the time of the event (e.g. {"ecd": 1.52, "mud_weight": 1.42}).
    event_params: Mapped[dict] = mapped_column(JSON, default=dict)
    origin: Mapped[str] = mapped_column(String(20), default="seed")  # seed | extracted
    extraction_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    well: Mapped[Well] = relationship(back_populates="events")
    source_document: Mapped[Document | None] = relationship()


class ParameterSample(Base):
    __tablename__ = "parameter_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), index=True)
    md: Mapped[float] = mapped_column(Float, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime)
    rop: Mapped[float] = mapped_column(Float)
    wob: Mapped[float] = mapped_column(Float)
    torque: Mapped[float] = mapped_column(Float)
    rpm: Mapped[float] = mapped_column(Float)
    flow_rate: Mapped[float] = mapped_column(Float)
    standpipe_pressure: Mapped[float] = mapped_column(Float)
    mud_weight: Mapped[float] = mapped_column(Float)
    ecd: Mapped[float] = mapped_column(Float)
    hook_load: Mapped[float] = mapped_column(Float)
    pump_pressure: Mapped[float] = mapped_column(Float)
    gas_units: Mapped[float] = mapped_column(Float, default=0.0)


class RiskZone(Base):
    __tablename__ = "risk_zones"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    formation: Mapped[str] = mapped_column(String(60))
    depth_start: Mapped[float] = mapped_column(Float)
    depth_end: Mapped[float] = mapped_column(Float)
    risk_type: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(10))
    historical_frequency: Mapped[float] = mapped_column(Float)
    contributing_wells: Mapped[list[str]] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(16), default="curated")  # curated | derived
    description: Mapped[str] = mapped_column(Text, default="")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), index=True)
    zone_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    triggered_at_depth: Mapped[float] = mapped_column(Float)
    risk_type: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(10))
    score: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    lead_depth: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    evidence_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    supporting_wells: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommendation: Mapped[str] = mapped_column(Text, default="")
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)  # full assessment at trigger time
    status: Mapped[str] = mapped_column(String(16), default="active")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AlertAudit(Base):
    __tablename__ = "alert_audit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.id"), index=True)
    action: Mapped[str] = mapped_column(String(24))  # raised | escalated | acknowledged | dismissed | reviewed
    depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    actor: Mapped[str] = mapped_column(String(60), default="NWIS risk engine")
    notes: Mapped[str] = mapped_column(Text, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    risk_type: Mapped[str] = mapped_column(String(32), index=True)
    text: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    source_event_ids: Mapped[list[str]] = mapped_column(JSON, default=list)


class WellSimilarity(Base):
    __tablename__ = "well_similarity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_a_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), index=True)
    well_b_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    formation_overlap: Mapped[float] = mapped_column(Float)
    depth_coverage: Mapped[float] = mapped_column(Float)
    trajectory_similarity: Mapped[float] = mapped_column(Float)
    parameter_similarity: Mapped[float] = mapped_column(Float)
    distance_km: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
