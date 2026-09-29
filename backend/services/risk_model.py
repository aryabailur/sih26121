"""Learned cross-check for the explainable risk score.

The hand-set score (services/risk_engine.py) stays the alert driver. This module *learns* how the
same six factors relate to what actually happened, by backtesting on the offset wells:

    for every completed offset well W (treated as if it were being drilled now):
        for every depth d along W:
            factors = risk_engine.assess(context of W, d)       # evidence = the OTHER wells only
            label   = 1 if W itself recorded that risk family inside [d, d + HORIZON_M]

    model: L2-regularised logistic regression  p = σ(b + Σ βᵢ·factorᵢ), fitted by Newton/IRLS
    validation: leave-one-well-out — each well is scored by a model that never saw it

Everything is pure Python (no numpy/sklearn) so it trains in seconds on any laptop and runs offline.
On synthetic demo data this proves the method; the same pipeline recalibrates on authorised history.
"""
from __future__ import annotations

import math
import threading
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import ACTIVE_WELL_ID
from models import DrillingEvent, Well
from services import risk_engine
from services.taxonomy import EVENT_TO_FAMILY

FEATURES = ["proximity", "frequency", "similarity", "formation", "parameter", "trajectory"]
HORIZON_M = 50.0  # "will this well hit the event within the next 50 m (or is it in it now)?"
STEP_M = 20.0
DEPTH_FROM = 2000.0
L2 = 1.0

_LOCK = threading.Lock()
_STATE: dict = {"model": None, "version": None, "training": False, "error": None}


# ------------------------------------------------------------------------------ tiny linear algebra
def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def _solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Gaussian elimination with partial pivoting (a is small and positive definite here)."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        piv = m[c][c] or 1e-12
        for r in range(c + 1, n):
            f = m[r][c] / piv
            if f:
                for k in range(c, n + 1):
                    m[r][k] -= f * m[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        s = m[r][n] - sum(m[r][k] * x[k] for k in range(r + 1, n))
        x[r] = s / (m[r][r] or 1e-12)
    return x


def fit_logistic(xs: list[list[float]], ys: list[int], l2: float = L2, iters: int = 30) -> list[float]:
    """Newton / IRLS for L2-regularised logistic regression. Returns [intercept, β₁…βₖ]."""
    k = len(xs[0]) + 1
    w = [0.0] * k
    rows = [[1.0] + x for x in xs]
    for _ in range(iters):
        grad = [0.0] * k
        hess = [[0.0] * k for _ in range(k)]
        for r, y in zip(rows, ys):
            p = _sigmoid(sum(wi * ri for wi, ri in zip(w, r)))
            g = p - y
            s = p * (1 - p)
            for i in range(k):
                grad[i] += g * r[i]
                ri_s = r[i] * s
                for j in range(i, k):
                    hess[i][j] += ri_s * r[j]
        for i in range(k):
            for j in range(i):
                hess[i][j] = hess[j][i]
            if i:  # no penalty on the intercept
                grad[i] += l2 * w[i]
                hess[i][i] += l2
            hess[i][i] += 1e-9
        step = _solve(hess, grad)
        w = [wi - si for wi, si in zip(w, step)]
        if max(abs(s) for s in step) < 1e-6:
            break
    return w


def predict(w: list[float], x: list[float]) -> float:
    return _sigmoid(w[0] + sum(wi * xi for wi, xi in zip(w[1:], x)))


def auc(scores: list[float], ys: list[int]) -> float | None:
    """Rank-based ROC AUC (ties count half)."""
    pos = [s for s, y in zip(scores, ys) if y]
    neg = [s for s, y in zip(scores, ys) if not y]
    if not pos or not neg:
        return None
    order = sorted(range(len(scores)), key=lambda i: scores[i])
    ranks = [0.0] * len(scores)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and scores[order[j + 1]] == scores[order[i]]:
            j += 1
        for t in range(i, j + 1):
            ranks[order[t]] = (i + j) / 2 + 1
        i = j + 1
    rp = sum(r for r, y in zip(ranks, ys) if y)
    return (rp - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg))


# ------------------------------------------------------------------------------ dataset
def build_dataset(db: Session, radius_km: float = 25.0) -> list[dict]:
    """Backtest rows: one per (offset well, depth, risk window) the engine would have assessed."""
    wells = db.scalars(select(Well).where(Well.id != ACTIVE_WELL_ID).order_by(Well.id)).all()
    own = {}
    for e in db.scalars(select(DrillingEvent)).all():
        own.setdefault(e.well_id, []).append(e)
    rows = []
    for w in wells:
        ctx = risk_engine.load_context(db, w.id, radius_km)
        if not ctx.offsets or not ctx.samples:
            continue
        mine = own.get(w.id, [])
        d = DEPTH_FROM
        while d <= w.total_depth_md:
            params = risk_engine.simulated_parameters(ctx, d)
            for a in risk_engine.assess(ctx, d, params):
                fam = a["risk_type"]
                hit = any(EVENT_TO_FAMILY.get(e.event_type, e.event_type) == fam and e.depth_end >= d and e.depth_start <= d + HORIZON_M
                          for e in mine)
                fx = {f["factor"]: f["value"] for f in a["factors"]}
                rows.append(dict(well=w.id, depth=d, family=fam, x=[fx[k] for k in FEATURES], score=a["score"], y=int(hit)))
            d += STEP_M
    return rows


def train(db: Session, radius_km: float = 25.0) -> dict:
    t0 = time.perf_counter()
    rows = build_dataset(db, radius_km)
    xs, ys = [r["x"] for r in rows], [r["y"] for r in rows]
    if len(rows) < 20 or sum(ys) < 3 or sum(ys) == len(ys):
        raise ValueError("not enough backtest rows to fit a model")
    w = fit_logistic(xs, ys)

    # Leave-one-well-out: every row is scored by a model that never saw its well.
    oof = [0.0] * len(rows)
    for g in sorted({r["well"] for r in rows}):
        tr = [i for i, r in enumerate(rows) if r["well"] != g]
        te = [i for i, r in enumerate(rows) if r["well"] == g]
        if not te or sum(ys[i] for i in tr) == 0:
            continue
        wg = fit_logistic([xs[i] for i in tr], [ys[i] for i in tr])
        for i in te:
            oof[i] = predict(wg, xs[i])
    rule = [r["score"] for r in rows]

    # Precision / recall of each ranking at the operating points the UI uses.
    def pr(scores: list[float], thr: float) -> dict:
        tp = sum(1 for s, y in zip(scores, ys) if s >= thr and y)
        fp = sum(1 for s, y in zip(scores, ys) if s >= thr and not y)
        fn = sum(1 for s, y in zip(scores, ys) if s < thr and y)
        return dict(precision=round(tp / (tp + fp), 3) if tp + fp else None, recall=round(tp / (tp + fn), 3) if tp + fn else None)

    coef = dict(zip(FEATURES, w[1:]))
    pos = {k: max(v, 0.0) for k, v in coef.items()}
    total = sum(pos.values()) or 1.0
    per_family = {}
    for fam in sorted({r["family"] for r in rows}):
        idx = [i for i, r in enumerate(rows) if r["family"] == fam]
        per_family[fam] = dict(rows=len(idx), positives=sum(ys[i] for i in idx),
                               auc_model=_r(auc([oof[i] for i in idx], [ys[i] for i in idx])),
                               auc_rule=_r(auc([rule[i] for i in idx], [ys[i] for i in idx])))
    return dict(
        weights=w,
        intercept=round(w[0], 3),
        coefficients={k: round(v, 3) for k, v in coef.items()},
        learned_weights={k: round(v / total, 3) for k, v in pos.items()},
        hand_weights=dict(risk_engine.WEIGHTS),
        rows=len(rows), positives=sum(ys), wells=len({r["well"] for r in rows}), base_rate=round(sum(ys) / len(ys), 4),
        auc_model=_r(auc(oof, ys)), auc_rule=_r(auc(rule, ys)),
        at_alert=dict(model=pr(oof, 0.5), rule=pr(rule, risk_engine.THRESHOLDS["high"])),
        per_family=per_family,
        horizon_m=HORIZON_M, step_m=STEP_M, l2=L2, radius_km=radius_km,
        seconds=round(time.perf_counter() - t0, 2),
    )


def _r(v: float | None) -> float | None:
    return None if v is None else round(v, 3)


# ------------------------------------------------------------------------------ lifecycle
def ensure_trained(db: Session) -> dict | None:
    """Train synchronously if no model exists for the current knowledge-base version."""
    version = risk_engine._KB_VERSION[0]
    with _LOCK:
        if _STATE["model"] is not None and _STATE["version"] == version:
            return _STATE["model"]
        try:
            _STATE["model"] = train(db)
            _STATE["version"] = version
            _STATE["error"] = None
        except Exception as exc:  # never break evaluation because the cross-check could not train
            _STATE["error"] = str(exc)
        return _STATE["model"]


def retrain_in_background(session_factory) -> None:
    """After the knowledge base changes: refit off the request path; keep serving the previous model."""
    if _STATE["training"]:
        return
    _STATE["training"] = True

    def run() -> None:
        db = session_factory()
        try:
            ensure_trained(db)
        finally:
            db.close()
            _STATE["training"] = False

    threading.Thread(target=run, daemon=True).start()


def current() -> dict | None:
    return _STATE["model"]


ELEVATED_LIFT = 2.0  # the model calls a window "elevated" at ≥2× the field base rate


def annotate(assessments: list[dict]) -> None:
    """Attach the learned probability to each assessment (no effect on scores or alerts).

    Real events are rare (a few % of backtest points), so the probability is also expressed as a
    lift over the field base rate; the verdict compares that with the rule's alert decision."""
    m = _STATE["model"]
    if m is None:
        return
    base = m["base_rate"]
    for a in assessments:
        fx = {f["factor"]: f["value"] for f in a["factors"]}
        p = predict(m["weights"], [fx[k] for k in FEATURES])
        lift = p / base if base else 0.0
        elevated = lift >= ELEVATED_LIFT
        alert = bool(a["alert_eligible"])
        verdict = "agrees" if elevated == alert else ("more_concerned" if elevated else "less_sure")
        a["ml"] = dict(probability=round(p, 3), base_rate=round(base, 3), lift=round(lift, 1), elevated=elevated,
                       verdict=verdict, horizon_m=HORIZON_M)


def card() -> dict:
    m = _STATE["model"]
    base = dict(method="L2-regularised logistic regression on the six risk factors (Newton/IRLS, pure Python)",
                target=f"offset well recorded the risk family within {HORIZON_M:.0f} m ahead of the bit (or at the bit)",
                validation="leave-one-well-out backtest over completed offset wells",
                caveat="Trained on the synthetic demo field — it demonstrates the calibration method; retrain on "
                       "authorised OIL history before operational use. The hand-set score remains the alert driver.",
                status="training" if _STATE["training"] else ("ready" if m else "unavailable"), error=_STATE["error"])
    if m:
        base |= {k: v for k, v in m.items() if k != "weights"}
    return base
