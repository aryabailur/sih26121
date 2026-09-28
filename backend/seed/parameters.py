"""Deterministic drilling-parameter generator (simulated eRTMAC / mud-logging records).

Every value is a pure function of (well, measured depth) so the demo is reproducible.
Offset wells carry anomaly signatures around their recorded events; the active well
carries designed precursors ahead of the historical risk windows:

* ECD climb + mud-weight fluctuation from ~3,145 m (Barail loss window)
* progressive torque rise from 3,350 m and overpull from ~3,395 m (Kopili stuck-pipe window)
* standpipe-pressure drop, drilling break and gas from ~3,578 m (Sylhet kick window)
"""
from __future__ import annotations

import hashlib
import math
import random
from datetime import datetime, timedelta

from seed.field import EVENTS, WELLS, formation_at

_WELL = {w["id"]: w for w in WELLS}

# Mud weight programme (sg) by formation, per well where it differed.
_BASE_MW = {
    "Girujan Shale": 1.12,
    "Tipam Sandstone": 1.20,
    "Namsang Formation": 1.30,
    "Barail Group": 1.40,
    "Kopili Shale": 1.44,
    "Sylhet Limestone": 1.50,
}
_MW_OVERRIDES = {
    ("W002", "Barail Group"): 1.42,
    ("W008", "Sylhet Limestone"): 1.52,  # after the kill
    ("W003", "Kopili Shale"): 1.43,
    ("W001", "Sylhet Limestone"): 1.44,  # active plan carries Kopili weight unless the engineer acts
}
_BASE_ROP = {
    "Girujan Shale": 34.0,
    "Tipam Sandstone": 27.0,
    "Namsang Formation": 19.0,
    "Barail Group": 12.5,
    "Kopili Shale": 8.5,
    "Sylhet Limestone": 7.0,
}

_EVENTS_BY_WELL: dict[str, list[dict]] = {}
for _ev in EVENTS:
    _EVENTS_BY_WELL.setdefault(_ev["well_id"], []).append(_ev)


def _rng(well_id: str, md: float) -> random.Random:
    h = hashlib.md5(f"{well_id}:{md:.1f}".encode()).hexdigest()
    return random.Random(int(h[:12], 16))


def _smooth(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def _bump(md: float, start: float, end: float, ramp: float = 20.0) -> float:
    """0 → 1 plateau between start and end with smooth ramps either side."""
    if md < start - ramp or md > end + ramp:
        return 0.0
    if md < start:
        return _smooth((md - (start - ramp)) / ramp)
    if md > end:
        return _smooth(((end + ramp) - md) / ramp)
    return 1.0


def _mud_weight(well_id: str, formation: str) -> float:
    return _MW_OVERRIDES.get((well_id, formation), _BASE_MW[formation])


def mud_program(well_id: str) -> dict[str, float]:
    """Planned mud weight (sg) per formation — the drilling-programme baseline."""
    return {f: _mud_weight(well_id, f) for f in _BASE_MW}


def parameters_at(well_id: str, md: float) -> dict:
    w = _WELL[well_id]
    r = _rng(well_id, md)
    formation = formation_at(well_id, md)
    n = lambda s: 1.0 + r.uniform(-s, s)  # noqa: E731

    mw = _mud_weight(well_id, formation)
    rop = _BASE_ROP[formation] * n(0.10)
    wob = (80 + md * 0.03) * n(0.04)
    rpm = (120 if formation != "Kopili Shale" else 110) * n(0.02)
    torque = (4.0 + md * 0.0038) * n(0.02)
    flow = (2400 if md < 800 else 2100 if md < 3000 else 1900) * n(0.012)
    spp = (1200 + md * 0.85) * n(0.012)
    ecd = mw + 0.05 + r.uniform(-0.004, 0.004)
    hook = (380 + md * 0.24) * n(0.008)
    gas = 20 + r.uniform(0, 15)

    if well_id == "W001":
        # --- Barail loss window precursors ---
        ecd_ramp = _smooth((md - 3140) / 25) * (1.0 - _smooth((md - 3215) / 30))
        ecd += 0.075 * ecd_ramp
        if 3155 <= md <= 3205:
            wobble = 0.025 * math.sin((md - 3155) / 50 * math.pi * 3)
            mw += wobble
            ecd += wobble
        spp *= 1.0 - 0.07 * _bump(md, 3170, 3210, 8)
        # --- Kopili stuck-pipe precursors ---
        tq = _smooth((md - 3350) / 50) * (1.0 - _smooth((md - 3430) / 30))
        torque *= 1.0 + 0.45 * tq
        hook *= 1.0 + 0.08 * _bump(md, 3398, 3430, 6)
        # --- lower Kopili: mild torque drift, below alarm threshold ---
        torque *= 1.0 + 0.08 * _bump(md, 3490, 3540, 15)
        # --- Sylhet kick precursors ---
        kick = _bump(md, 3579, 3615, 3)
        spp *= 1.0 - 0.09 * kick
        rop *= 1.0 + 1.1 * kick
        gas += 380 * kick
    else:
        for ev in _EVENTS_BY_WELL.get(well_id, []):
            s, e, t = ev["depth_start"], ev["depth_end"], ev["event_type"]
            b = _bump(md, s, e, 15)
            if b <= 0:
                continue
            if t in ("mud_loss", "lost_circulation"):
                ecd += 0.06 * b
                spp *= 1.0 - 0.06 * b
            elif t in ("stuck_pipe", "differential_sticking"):
                torque *= 1.0 + 0.9 * b
                hook *= 1.0 + 0.10 * b
            elif t in ("kick", "overpressure"):
                spp *= 1.0 - 0.08 * b
                rop *= 1.0 + 0.9 * b
                gas += 350 * b
            elif t == "torque_spike":
                torque *= 1.0 + 0.9 * b + 0.15 * b * math.sin(md / 3.0)
                rpm *= 1.0 + 0.12 * b * math.sin(md / 2.0)
            elif t == "wellbore_instability":
                torque *= 1.0 + 0.25 * b
                hook *= 1.0 + 0.05 * b

    return dict(
        md=round(md, 1),
        rop=round(rop, 2),
        wob=round(wob, 1),
        torque=round(torque, 2),
        rpm=round(rpm, 1),
        flow_rate=round(flow, 0),
        standpipe_pressure=round(spp, 0),
        mud_weight=round(mw, 3),
        ecd=round(ecd, 3),
        hook_load=round(hook, 1),
        pump_pressure=round(spp * 1.02, 0),
        gas_units=round(gas, 0),
        formation=formation,
    )


def timestamp_at(well_id: str, md: float) -> datetime:
    w = _WELL[well_id]
    total_days = ((w["comp"] or w["spud"] + timedelta(days=95)) - w["spud"]).days
    frac = md / max(w["td"], 1)
    return datetime.combine(w["spud"], datetime.min.time()) + timedelta(days=total_days * 0.88 * frac, hours=6)


def sample_depths(well_id: str) -> list[float]:
    w = _WELL[well_id]
    if well_id == "W001":
        coarse = [float(d) for d in range(0, 3000, 10)]
        fine = [3000 + i * 2.5 for i in range(int((w["td"] - 3000) / 2.5) + 1)]
        return coarse + fine
    return [float(d) for d in range(0, int(w["td"]) + 1, 10)]
