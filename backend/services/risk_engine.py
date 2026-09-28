"""Explainable hybrid risk engine.

For every risk zone that has offset-well evidence inside the search radius:

    score = Σ wᵢ · fᵢ     (fᵢ ∈ [0, 1], weights below — all surfaced in the UI)

    proximity   how close the bit is to the depth window where offsets had the event
    frequency   distinct offset wells with the event in this window  (count / 5)
    similarity  mean well-similarity of those offsets to the active well
    formation   active well is in (1.0) or within 50 m of (0.5) the zone formation
    parameter   share of the family's live signals that are anomalous
    trajectory  inclination match at the event depth

Severity: ≥0.75 critical · ≥0.55 high · ≥0.35 medium · else low.
Alert policy (alarm rationalisation): zones whose history is high/critical raise an alert
at ≥0.55; zones with medium/low history only alert at ≥0.75 (i.e. when live signals
confirm). Everything else is shown as a "watch" card — no silent black boxes.
"""
from __future__ import annotations

import threading
import uuid
from bisect import bisect_left
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models import Alert, AlertAudit, Document, DrillingEvent, Formation, ParameterSample, RiskZone, SurveyPoint, Well
from services.geo import haversine_km
from services.similarity import similarity_map
from services.taxonomy import (
    EVENT_LABELS, FAMILY_PARAMETERS, PARAMETER_LABELS, RECOMMENDATION_HEADLINE, RECOMMENDED_CHECKS, RISK_FAMILIES,
    RISK_LABELS, SEVERITY_ORDER,
)

WEIGHTS = dict(proximity=0.30, frequency=0.20, similarity=0.10, formation=0.10, parameter=0.25, trajectory=0.05)
THRESHOLDS = dict(critical=0.75, high=0.55, medium=0.35)
LOOKAHEAD_M = 300.0
LOOKBEHIND_M = 150.0
APPROACH_M = 150.0
PASSED_DECAY_M = 100.0
CONTEXT_WINDOW_M = 75.0
RELATED_FAMILIES = {"stuck_pipe": ["wellbore_instability"], "kick": ["mud_loss"], "mud_loss": ["cementing_failure"]}

# Minimum deviation gates (in addition to z ≥ 2 for rolling-baseline signals).
RATIO_GATES = {
    "torque": (1.20, None), "hook_load": (1.05, None), "standpipe_pressure": (1.06, 0.95),
    "rop": (1.60, 0.50), "rpm": (1.10, 0.90),
}
ABS_GATES = {"mud_weight": 0.015, "ecd": 0.02}

_CTX_CACHE: dict[tuple, "Context"] = {}
_KB_VERSION = [0]


def invalidate_cache() -> None:
    _KB_VERSION[0] += 1
    _CTX_CACHE.clear()


def severity_for(score: float) -> str:
    if score >= THRESHOLDS["critical"]:
        return "critical"
    if score >= THRESHOLDS["high"]:
        return "high"
    if score >= THRESHOLDS["medium"]:
        return "medium"
    return "low"


def _interp(xs: list[float], ys: list[float], x: float) -> float:
    i = bisect_left(xs, x)
    if i <= 0:
        return ys[0]
    if i >= len(xs):
        return ys[-1]
    x0, x1 = xs[i - 1], xs[i]
    t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
    return ys[i - 1] + t * (ys[i] - ys[i - 1])


@dataclass
class Context:
    well: Well
    radius_km: float
    formations: list[Formation]
    s_md: list[float]
    s_inc: list[float]
    samples: list[ParameterSample]
    sample_md: list[float]
    offsets: dict[str, Well]
    distances: dict[str, float]
    sims: dict
    offset_survey: dict[str, tuple[list[float], list[float]]]
    events: list[DrillingEvent]
    zones: list[RiskZone]
    docs: dict[str, Document]

    def formation_at(self, md: float) -> Formation | None:
        cur = None
        for f in self.formations:
            if f.top_md <= md:
                cur = f
        return cur

    def formation_top(self, name: str) -> float | None:
        for f in self.formations:
            if f.name == name:
                return f.top_md
        return None

    def inc_at(self, md: float) -> float:
        return _interp(self.s_md, self.s_inc, md) if self.s_md else 0.0

    def offset_inc_at(self, well_id: str, md: float) -> float:
        xs, ys = self.offset_survey.get(well_id, ([], []))
        return _interp(xs, ys, md) if xs else 0.0


def load_context(db: Session, well_id: str, radius_km: float) -> Context:
    key = (well_id, round(radius_km, 2), _KB_VERSION[0])
    if key in _CTX_CACHE:
        return _CTX_CACHE[key]
    well = db.get(Well, well_id)
    if well is None:
        raise KeyError(well_id)
    formations = db.scalars(select(Formation).where(Formation.well_id == well_id).order_by(Formation.top_md)).all()
    survey = db.scalars(select(SurveyPoint).where(SurveyPoint.well_id == well_id).order_by(SurveyPoint.md)).all()
    samples = db.scalars(select(ParameterSample).where(ParameterSample.well_id == well_id).order_by(ParameterSample.md)).all()
    offsets, distances = {}, {}
    for w in db.scalars(select(Well).where(Well.id != well_id)).all():
        d = haversine_km(well.latitude, well.longitude, w.latitude, w.longitude)
        if d <= radius_km:
            offsets[w.id] = w
            distances[w.id] = d
    offset_survey = {}
    for wid in offsets:
        pts = db.scalars(select(SurveyPoint).where(SurveyPoint.well_id == wid).order_by(SurveyPoint.md)).all()
        offset_survey[wid] = ([p.md for p in pts], [p.inclination for p in pts])
    events = db.scalars(select(DrillingEvent).where(DrillingEvent.well_id.in_(list(offsets)))).all() if offsets else []
    zones = db.scalars(select(RiskZone).order_by(RiskZone.depth_start)).all()
    docs = {d.id: d for d in db.scalars(select(Document)).all()}
    ctx = Context(
        well=well, radius_km=radius_km, formations=list(formations), s_md=[s.md for s in survey],
        s_inc=[s.inclination for s in survey], samples=list(samples), sample_md=[s.md for s in samples],
        offsets=offsets, distances=distances, sims=similarity_map(db, well_id), offset_survey=offset_survey,
        events=list(events), zones=list(zones), docs=docs,
    )
    _CTX_CACHE[key] = ctx
    return ctx


# ------------------------------------------------------------------------------------ parameters
PARAM_KEYS = ["rop", "wob", "torque", "rpm", "flow_rate", "standpipe_pressure", "mud_weight", "ecd", "hook_load",
              "pump_pressure", "gas_units"]


def simulated_parameters(ctx: Context, depth: float) -> dict:
    """Simulated eRTMAC reading at depth (nearest recorded sample of the active well)."""
    if not ctx.samples:
        return {}
    i = bisect_left(ctx.sample_md, depth)
    if i >= len(ctx.samples):
        i = len(ctx.samples) - 1
    elif i > 0 and abs(ctx.sample_md[i - 1] - depth) < abs(ctx.sample_md[i] - depth):
        i -= 1
    s = ctx.samples[i]
    return {k: getattr(s, k) for k in PARAM_KEYS} | {"md": s.md}


def trend(ctx: Context, depth: float, n: int = 20) -> list[dict]:
    i = bisect_left(ctx.sample_md, depth)
    rows = ctx.samples[max(0, i - n + 1): i + 1]
    return [{k: getattr(s, k) for k in PARAM_KEYS} | {"md": s.md} for s in rows]


def _rolling_baseline(ctx: Context, key: str, depth: float) -> tuple[float, float] | None:
    lo, hi = depth - 250, depth - 60
    xs, ys = [], []
    i = bisect_left(ctx.sample_md, lo)
    while i < len(ctx.samples) and ctx.sample_md[i] <= hi:
        xs.append(ctx.sample_md[i])
        ys.append(getattr(ctx.samples[i], key))
        i += 1
    if len(xs) < 8:
        return None
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxx = sum((x - mx) ** 2 for x in xs) or 1.0
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    pred = my + slope * (depth - mx)
    resid = [y - (my + slope * (x - mx)) for x, y in zip(xs, ys)]
    std = (sum(r * r for r in resid) / max(len(resid) - 2, 1)) ** 0.5
    return pred, max(std, abs(pred) * 0.01, 1e-6)


def signal(ctx: Context, key: str, depth: float, value: float, family: str, supporting: list[DrillingEvent]) -> dict:
    label, unit = PARAMETER_LABELS[key]
    out = dict(signal=key, label=label, unit=unit, value=round(value, 3), baseline=None, ratio=None, z=None,
               deviation="baseline building", anomalous=False, note="", reference=None)
    if key in ABS_GATES:
        fm = ctx.formation_at(depth)
        planned = (ctx.well.mud_program or {}).get(fm.name if fm else "", None)
        if planned is None:
            return out
        base = planned + (0.05 if key == "ecd" else 0.0)
        delta = value - base
        out.update(baseline=round(base, 3), deviation=f"{delta:+.3f} sg vs programme", ratio=round(value / base, 3))
        if (key == "ecd" and delta >= ABS_GATES[key]) or (key == "mud_weight" and abs(delta) >= ABS_GATES[key]):
            out["anomalous"] = True
            out["note"] = f"{label} {value:.2f} sg deviates {delta:+.3f} sg from the programme ({base:.2f} sg)."
        # Offset-referenced limits — the historical value at which the event occurred.
        if family == "mud_loss" and key == "ecd":
            onsets = [(e.event_params or {}).get("ecd") for e in supporting]
            onsets = [(o, e) for o, e in zip(onsets, supporting) if o]
            if onsets:
                onset, ev = min(onsets, key=lambda t: t[0])
                wname = ctx.offsets[ev.well_id].name if ev.well_id in ctx.offsets else ev.well_id
                out["reference"] = dict(value=onset, well=wname, meaning="loss-onset ECD")
                if value >= onset - 0.03:
                    out["anomalous"] = True
                    out["note"] = (f"ECD {value:.2f} sg is within {max(onset - value, 0):.2f} sg of the {onset:.2f} sg "
                                   f"loss-onset ECD recorded at {wname}.")
        if family == "kick" and key == "mud_weight":
            refs = []
            for e in supporting:
                p = e.event_params or {}
                r = p.get("post_kick_mud_weight") or p.get("mud_weight_after")
                if r:
                    refs.append((r, e))
            if refs:
                ref, ev = max(refs, key=lambda t: t[0])
                wname = ctx.offsets[ev.well_id].name if ev.well_id in ctx.offsets else ev.well_id
                out["reference"] = dict(value=ref, well=wname, meaning="mud weight that controlled the offset")
                if value < ref - 0.02:
                    out["anomalous"] = True
                    out["note"] = (f"Mud weight {value:.2f} sg is {ref - value:.2f} sg below the {ref:.2f} sg that "
                                   f"controlled {wname}.")
        return out

    bl = _rolling_baseline(ctx, key, depth)
    if bl is None:
        return out
    pred, std = bl
    ratio = value / pred if pred else 1.0
    z = (value - pred) / std
    hi, lo = RATIO_GATES.get(key, (1.2, 0.8))
    out.update(baseline=round(pred, 2), ratio=round(ratio, 3), z=round(z, 2), deviation=f"{ratio:.2f}× baseline")
    if (hi and ratio >= hi and z >= 2) or (lo and ratio <= lo and z <= -2):
        out["anomalous"] = True
        out["note"] = f"{label} {value:,.1f} {unit} is {ratio:.2f}× the rolling baseline ({pred:,.1f} {unit})."
    return out


# ------------------------------------------------------------------------------------ zone scoring
def _supporting_events(ctx: Context, zone: RiskZone, family: str | None = None) -> list[DrillingEvent]:
    fam_types = RISK_FAMILIES.get(family or zone.risk_type, [zone.risk_type])
    lo, hi = zone.depth_start - 30, zone.depth_end + 30
    return [e for e in ctx.events if e.event_type in fam_types and e.depth_end >= lo and e.depth_start <= hi]


def _cite(ctx: Context, e: DrillingEvent) -> dict:
    doc = ctx.docs.get(e.source_document_id or "")
    w = ctx.offsets.get(e.well_id)
    return dict(
        event_id=e.id, well_id=e.well_id, well_name=w.name if w else e.well_id, event_type=e.event_type,
        event_label=EVENT_LABELS.get(e.event_type, e.event_type), title=e.title, severity=e.severity,
        depth_start=e.depth_start, depth_end=e.depth_end, formation=e.formation, date=e.date.isoformat(),
        description=e.description, root_cause=e.root_cause, mitigation=e.mitigation_action,
        lessons=e.lessons_learned, npt_hours=e.npt_hours,
        document_id=e.source_document_id, document_title=doc.title if doc else None,
        document_type=doc.doc_type if doc else None, page=e.source_page, section=e.source_section,
        similarity=round(ctx.sims[e.well_id].score, 3) if e.well_id in ctx.sims else None,
        distance_km=round(ctx.distances.get(e.well_id, 0), 2),
    )


def assess_zone(ctx: Context, zone: RiskZone, depth: float, params: dict) -> dict | None:
    family = zone.risk_type
    support = _supporting_events(ctx, zone)
    if not support:
        return None
    env_start = min(e.depth_start for e in support)
    env_end = max(e.depth_end for e in support)
    if env_start - depth > LOOKAHEAD_M or depth - env_end > LOOKBEHIND_M:
        return None
    label = RISK_LABELS.get(family, family)

    # proximity
    if env_start <= depth <= env_end:
        proximity, position, gap = 1.0, "inside", 0.0
    elif depth < env_start:
        gap = env_start - depth
        proximity, position = max(0.0, 0.5 * (1 - gap / APPROACH_M)), "ahead"
    else:
        gap = depth - env_end
        proximity, position = max(0.0, 0.5 * (1 - gap / PASSED_DECAY_M)), "passed"

    wells = sorted({e.well_id for e in support})
    frequency = min(1.0, len(wells) / 5.0)
    sim_vals = [ctx.sims[w].score for w in wells if w in ctx.sims]
    similarity = sum(sim_vals) / len(sim_vals) if sim_vals else 0.0

    fm = ctx.formation_at(depth)
    zone_top = ctx.formation_top(zone.formation)
    if fm and fm.name == zone.formation:
        formation_score = 1.0
    elif zone_top is not None and 0 < zone_top - depth <= 50:
        formation_score = 0.5
    else:
        formation_score = 0.0

    signals = [signal(ctx, k, depth, float(params[k]), family, support)
               for k in FAMILY_PARAMETERS.get(family, []) if params.get(k) is not None]
    parameter_score = (sum(1 for s in signals if s["anomalous"]) / len(signals)) if signals else 0.0

    traj_vals = []
    for e in support:
        mid = (e.depth_start + e.depth_end) / 2
        traj_vals.append(max(0.0, 1 - abs(ctx.inc_at(mid) - ctx.offset_inc_at(e.well_id, mid)) / 20))
    trajectory = sum(traj_vals) / len(traj_vals) if traj_vals else 0.0

    factors = dict(proximity=proximity, frequency=frequency, similarity=similarity, formation=formation_score,
                   parameter=parameter_score, trajectory=trajectory)
    score = sum(WEIGHTS[k] * v for k, v in factors.items())
    severity = severity_for(score)
    history_severe = SEVERITY_ORDER.get(zone.severity, 0) >= SEVERITY_ORDER["high"]
    alert_threshold = THRESHOLDS["high"] if history_severe else THRESHOLDS["critical"]
    alert_eligible = score >= alert_threshold

    # ---------------- explanation ("Why?") ----------------
    names = [ctx.offsets[w].name for w in wells]
    best = max(wells, key=lambda w: ctx.sims[w].score if w in ctx.sims else 0)
    best_ev = max((e for e in support if e.well_id == best), key=lambda e: SEVERITY_ORDER.get(e.severity, 0))
    reasons: list[str] = []
    if position == "inside":
        reasons.append(f"Bit at {depth:,.0f} m is inside the historical {label.lower()} window "
                       f"({env_start:,.0f}–{env_end:,.0f} m) recorded in {len(wells)} offset well(s).")
    elif position == "ahead" and gap <= APPROACH_M:
        reasons.append(f"Current depth ({depth:,.0f} m) is {gap:,.0f} m above the historical {label.lower()} window "
                       f"({env_start:,.0f}–{env_end:,.0f} m).")
    elif position == "ahead":
        reasons.append(f"Historical {label.lower()} window starts {gap:,.0f} m ahead ({env_start:,.0f} m).")
    else:
        reasons.append(f"Bit has passed the {label.lower()} window by {gap:,.0f} m; open-hole exposure remains.")
    reasons.append(f"{len(support)} {label.lower()} event(s) recorded in this interval across {len(wells)} offset "
                   f"well(s) within {ctx.radius_km:g} km: {', '.join(names)}.")
    if best in ctx.sims:
        reasons.append(f"Active well is {ctx.sims[best].score * 100:.0f}% similar to {ctx.offsets[best].name}, which "
                       f"recorded {best_ev.title.lower()} at {best_ev.depth_start:,.0f}–{best_ev.depth_end:,.0f} m.")
    for s in signals:
        if s["anomalous"]:
            reasons.append(s["note"])
    if formation_score == 1.0:
        reasons.append(f"Currently drilling {zone.formation}, which has a history of {label.lower()} in this field.")
    elif formation_score == 0.5:
        reasons.append(f"Approaching the {zone.formation} top (prognosed {zone_top:,.0f} m, {zone_top - depth:,.0f} m ahead).")

    evidence = [_cite(ctx, e) for e in sorted(support, key=lambda e: (-SEVERITY_ORDER.get(e.severity, 0), e.depth_start))]
    related = []
    for rf in RELATED_FAMILIES.get(family, []):
        related += [_cite(ctx, e) for e in _supporting_events(ctx, zone, rf)]
    snippets = [f"{ev['well_name']} ({ev['depth_start']:,.0f}–{ev['depth_end']:,.0f} m): {ev['description']} "
                f"[{ev['document_title']}, p.{ev['page']}]" for ev in evidence]

    checks = list(RECOMMENDED_CHECKS.get(family, []))
    offset_practice = []
    for ev in evidence[:3]:
        if ev["lessons"]:
            offset_practice.append(f"{ev['well_name']}: {ev['lessons']}")
        elif ev["mitigation"]:
            offset_practice.append(f"{ev['well_name']} mitigation: {ev['mitigation']}")
    recommendation = RECOMMENDATION_HEADLINE.get(family, "Review offset evidence.")
    if offset_practice:
        recommendation += " " + offset_practice[0]

    n_docs = len({e.source_document_id for e in support if e.source_document_id})
    confidence = min(0.95, 0.35 + 0.30 * min(1.0, len(wells) / 3) + 0.10 * min(1.0, n_docs / 3)
                     + 0.15 * similarity + (0.10 if signals else 0.0))
    confidence_note = (f"{len(wells)} supporting well(s), {n_docs} source document(s), mean similarity "
                       f"{similarity * 100:.0f}%, {'live parameters available' if signals else 'no live parameters'}.")

    factor_rows = []
    explain = {
        "proximity": f"{position} window ({'0' if position == 'inside' else f'{gap:,.0f}'} m)",
        "frequency": f"{len(wells)} well(s) / 5",
        "similarity": f"mean {similarity * 100:.0f}%",
        "formation": ("in " + zone.formation) if formation_score == 1 else ("approaching " + zone.formation) if formation_score else "different formation",
        "parameter": f"{sum(1 for s in signals if s['anomalous'])}/{len(signals)} signals anomalous",
        "trajectory": f"inclination match {trajectory * 100:.0f}%",
    }
    for k, v in factors.items():
        factor_rows.append(dict(factor=k, value=round(v, 3), weight=WEIGHTS[k], contribution=round(WEIGHTS[k] * v, 3),
                                explanation=explain[k]))

    return dict(
        evaluated_at_depth=depth,
        zone_id=zone.id, zone_source=zone.source, risk_type=family, risk_label=label,
        score=round(score, 3), confidence=round(confidence, 3), confidence_note=confidence_note,
        severity=severity, historical_severity=zone.severity, alert_eligible=alert_eligible,
        alert_threshold=alert_threshold, status="alert" if alert_eligible else "watch",
        position=position, lead_depth=round(env_start - depth, 1),
        risk_window=dict(start=env_start, end=env_end), zone_window=dict(start=zone.depth_start, end=zone.depth_end),
        affected_formation=zone.formation, current_formation=fm.name if fm else None,
        reasons=reasons, factors=factor_rows, contributing_signals=signals,
        supporting_wells=[dict(well_id=ev["well_id"], well_name=ev["well_name"], event_type=ev["event_type"],
                               depth=ev["depth_start"], date=ev["date"], similarity=ev["similarity"],
                               distance_km=ev["distance_km"], severity=ev["severity"]) for ev in evidence],
        evidence=evidence, related_events=related, evidence_snippets=snippets,
        recommendation=recommendation, recommended_checks=checks, offset_practice=offset_practice,
        evidence_ids=[ev["event_id"] for ev in evidence],
    )


def assess(ctx: Context, depth: float, params: dict) -> list[dict]:
    out = [a for z in ctx.zones if (a := assess_zone(ctx, z, depth, params))]
    out.sort(key=lambda a: -a["score"])
    return out


# ------------------------------------------------------------------------------------ alerts
_ALERT_LOCK = threading.Lock()


def _record_alerts(db: Session, well_id: str, depth: float, assessments: list[dict]) -> list[Alert]:
    # Serialised so two overlapping evaluations cannot both insert an alert for the same zone.
    with _ALERT_LOCK:
        return _record_alerts_locked(db, well_id, depth, assessments)


def clear_alerts(db: Session, well_id: str) -> int:
    with _ALERT_LOCK:
        ids = [a.id for a in db.scalars(select(Alert).where(Alert.well_id == well_id)).all()]
        if ids:
            db.execute(delete(AlertAudit).where(AlertAudit.alert_id.in_(ids)))
            db.execute(delete(Alert).where(Alert.id.in_(ids)))
            db.commit()
        return len(ids)


def _record_alerts_locked(db: Session, well_id: str, depth: float, assessments: list[dict]) -> list[Alert]:
    existing = {a.zone_id: a for a in db.scalars(select(Alert).where(Alert.well_id == well_id)).all()}
    new_alerts = []
    now = datetime.utcnow()
    for a in assessments:
        if not a["alert_eligible"]:
            continue
        cur = existing.get(a["zone_id"])
        if cur is None:
            alert = Alert(
                id=f"AL-{uuid.uuid4().hex[:10]}", well_id=well_id, zone_id=a["zone_id"], triggered_at_depth=depth,
                risk_type=a["risk_type"], severity=a["severity"], score=a["score"], confidence=a["confidence"],
                lead_depth=a["lead_depth"], reasons=a["reasons"], evidence_ids=a["evidence_ids"],
                supporting_wells=[s["well_id"] for s in a["supporting_wells"]], recommendation=a["recommendation"],
                snapshot=a, status="active", created_at=now, updated_at=now,
            )
            db.add(alert)
            db.flush()
            db.add(AlertAudit(alert_id=alert.id, action="raised", depth=depth, timestamp=now,
                              notes=f"{a['risk_label']} {a['severity'].upper()} (score {a['score']:.2f}, "
                                    f"confidence {a['confidence'] * 100:.0f}%) at {depth:,.0f} m; "
                                    f"evidence {', '.join(a['evidence_ids'])}"))
            new_alerts.append(alert)
        elif SEVERITY_ORDER[a["severity"]] > SEVERITY_ORDER[cur.severity] and cur.status == "active":
            db.add(AlertAudit(alert_id=cur.id, action="escalated", depth=depth, timestamp=now,
                              notes=f"{cur.severity} → {a['severity']} (score {cur.score:.2f} → {a['score']:.2f}) at {depth:,.0f} m"))
            cur.severity, cur.score, cur.confidence = a["severity"], a["score"], a["confidence"]
            cur.reasons, cur.snapshot, cur.updated_at = a["reasons"], a, now
            new_alerts.append(cur)
    db.commit()
    return new_alerts


def alert_dict(a: Alert) -> dict:
    snap = a.snapshot or {}
    return dict(
        id=a.id, well_id=a.well_id, zone_id=a.zone_id, triggered_at_depth=a.triggered_at_depth, risk_type=a.risk_type,
        risk_label=RISK_LABELS.get(a.risk_type, a.risk_type), severity=a.severity, score=a.score,
        confidence=a.confidence, lead_depth=a.lead_depth, reasons=a.reasons, evidence_ids=a.evidence_ids,
        supporting_wells=a.supporting_wells, recommendation=a.recommendation, status=a.status, notes=a.notes,
        created_at=a.created_at.isoformat() + "Z", updated_at=a.updated_at.isoformat() + "Z", assessment=snap,
    )


def context_summary(ctx: Context, depth: float) -> dict:
    near = [e for e in ctx.events
            if e.depth_start - CONTEXT_WINDOW_M <= depth <= e.depth_end + CONTEXT_WINDOW_M]
    by_type: dict[str, set] = {}
    for e in near:
        by_type.setdefault(EVENT_LABELS.get(e.event_type, e.event_type), set()).add(e.well_id)
    parts = [f"{len(ws)} offset well{'s' if len(ws) > 1 else ''} recorded {t.lower()}" for t, ws in
             sorted(by_type.items(), key=lambda t: -len(t[1]))]
    text = (f"At current depth ({depth:,.0f} m): " + "; ".join(parts) + f" within {CONTEXT_WINDOW_M:.0f} m of this depth."
            if parts else f"At current depth ({depth:,.0f} m): no offset events recorded within {CONTEXT_WINDOW_M:.0f} m.")
    highlighted: dict[str, list[str]] = {}
    for e in near:
        highlighted.setdefault(e.well_id, [])
        if e.event_type not in highlighted[e.well_id]:
            highlighted[e.well_id].append(e.event_type)
    return dict(text=text, highlighted_wells=[dict(well_id=k, event_types=v) for k, v in highlighted.items()],
                nearby_events=[_cite(ctx, e) for e in sorted(near, key=lambda e: e.depth_start)])


def evaluate(db: Session, well_id: str, depth: float, params: dict | None = None, radius_km: float = 25.0,
             persist: bool = True) -> dict:
    ctx = load_context(db, well_id, radius_km)
    live = simulated_parameters(ctx, depth)
    merged = {**live, **{k: v for k, v in (params or {}).items() if v is not None}}
    assessments = assess(ctx, depth, merged)
    new_alerts = _record_alerts(db, well_id, depth, assessments) if persist else []
    all_alerts = db.scalars(select(Alert).where(Alert.well_id == well_id).order_by(Alert.created_at)).all()

    ahead = []
    for z in ctx.zones:
        sup = _supporting_events(ctx, z)
        if sup:
            start = min(e.depth_start for e in sup)
            if start > depth:
                ahead.append((start, z))
    nxt = None
    if ahead:
        start, z = min(ahead, key=lambda t: t[0])
        nxt = dict(zone_id=z.id, type=z.risk_type, label=RISK_LABELS.get(z.risk_type, z.risk_type), depth=start,
                   distance=round(start - depth, 1), formation=z.formation)
    overall = max((a["severity"] for a in assessments), key=lambda s: SEVERITY_ORDER[s], default="low")
    fm = ctx.formation_at(depth)
    return dict(
        well_id=well_id, depth=depth, radius_km=radius_km, current_formation=fm.name if fm else None,
        parameters=merged, trend=trend(ctx, depth),
        assessments=assessments, alerts=[a for a in assessments if a["severity"] != "low"],
        new_alert_ids=[a.id for a in new_alerts], active_alerts=[alert_dict(a) for a in all_alerts],
        overall_risk_level=overall, next_risk_zone=nxt, context=context_summary(ctx, depth),
        weights=WEIGHTS, thresholds=THRESHOLDS,
    )


def risk_profile(db: Session, well_id: str, radius_km: float, step: float = 10.0) -> dict:
    """Score every zone along the full well depth (no persistence) — drives the scrubber risk ribbon."""
    ctx = load_context(db, well_id, radius_km)
    rows = []
    d = 0.0
    while d <= ctx.well.total_depth_md:
        params = simulated_parameters(ctx, d)
        best = None
        for a in assess(ctx, d, params):
            if best is None or a["score"] > best["score"]:
                best = a
        rows.append(dict(depth=d, score=best["score"] if best else 0.0,
                         risk_type=best["risk_type"] if best else None,
                         severity=best["severity"] if best else "low"))
        d += step
    return dict(well_id=well_id, radius_km=radius_km, step=step, profile=rows)


def event_clusters(db: Session, well_id: str, radius_km: float, gap_m: float = 80.0) -> list[dict]:
    """Group recurring offset events by risk family + formation + depth proximity; surface common mitigations."""
    from services.taxonomy import EVENT_TO_FAMILY

    ctx = load_context(db, well_id, radius_km)
    groups: dict[tuple[str, str], list[DrillingEvent]] = {}
    for e in ctx.events:
        groups.setdefault((EVENT_TO_FAMILY.get(e.event_type, e.event_type), e.formation), []).append(e)
    clusters = []
    for (fam, formation), evs in groups.items():
        evs.sort(key=lambda e: e.depth_start)
        cur: list[DrillingEvent] = []
        for e in evs + [None]:
            if e is not None and (not cur or e.depth_start - max(c.depth_end for c in cur) <= gap_m):
                cur.append(e)
                continue
            if cur:
                wells = sorted({c.well_id for c in cur})
                clusters.append(dict(
                    risk_type=fam, risk_label=RISK_LABELS.get(fam, fam), formation=formation,
                    depth_start=min(c.depth_start for c in cur), depth_end=max(c.depth_end for c in cur),
                    event_count=len(cur), well_count=len(wells), wells=[ctx.offsets[w].name for w in wells],
                    max_severity=max((c.severity for c in cur), key=lambda s: SEVERITY_ORDER[s]),
                    total_npt_hours=sum(c.npt_hours for c in cur),
                    common_mitigations=[f"{ctx.offsets[c.well_id].name}: {c.mitigation_action}" for c in cur][:4],
                    event_ids=[c.id for c in cur],
                ))
            cur = [e] if e is not None else []
    clusters.sort(key=lambda c: (-c["well_count"], -SEVERITY_ORDER[c["max_severity"]]))
    return clusters
