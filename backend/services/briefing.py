"""Look-ahead brief: everything the offsets say about the next N metres, as one citable handover document.

Built for the two moments a rig crew plans ahead — the 12-hour shift handover and the "drill the well on paper"
(DWOP) session before an interval. For every historical hazard window the bit will reach inside the horizon:

* projected severity when the bit gets there, scored from offset history only (no future parameters are used),
* how many offsets that reached the depth hit it, the NPT they lost and an expected-NPT estimate,
* what worked (mitigations ranked by the NPT they took), lessons, the numbers the offsets recorded,
* the offset-calibrated mud-weight window across the interval, casing points and programme breaches,
* every statement cited to a report page.

Pure function over the session; it never records alerts.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from services import pressure, risk_engine
from services.taxonomy import RISK_LABELS

# event_params keys → how the brief states them.
PARAM_FACTS: dict[str, tuple[str, str]] = {
    "ecd": ("ECD at loss onset", "sg"),
    "mud_weight": ("Mud weight at the event", "sg"),
    "cure_mud_weight": ("Mud weight that cured the losses", "sg"),
    "loss_volume_m3": ("Mud lost", "m³"),
    "overpull_kn": ("Overpull", "kN"),
    "kcl_pct": ("KCl in the mud", "%"),
    "static_minutes": ("Static time before sticking", "min"),
    "torque_before": ("Torque before the event", "kN·m"),
    "torque_peak": ("Peak torque", "kN·m"),
    "dogleg_deg_30m": ("Dogleg at the stuck point", "°/30 m"),
    "inclination": ("Inclination", "°"),
    "flow_after": ("Flow rate that cleaned the hole", "l/min"),
    "pit_gain_m3": ("Pit gain at detection", "m³"),
    "sidpp_psi": ("SIDPP", "psi"),
    "kill_mud_weight": ("Kill mud weight", "sg"),
    "post_kick_mud_weight": ("Mud weight that controlled the well", "sg"),
    "mud_weight_before": ("Mud weight before", "sg"),
    "mud_weight_after": ("Mud weight after", "sg"),
}

ECD_MARGIN_SG = 0.05  # same margin the pressure window uses for "planned ECD"


def _rows_in(rows: list[dict], start: float, end: float) -> list[dict]:
    return [r for r in rows if start <= r["md"] <= end]


def _mud_window(rows: list[dict], start: float, end: float) -> dict | None:
    sel = _rows_in(rows, start, end)
    if not sel:
        return None
    pores = [r["pore_calibrated"] for r in sel if r["pore_calibrated"] is not None]
    fracs = [r["frac_calibrated"] for r in sel if r["frac_calibrated"] is not None]
    plans = sorted({r["mw_plan"] for r in sel if r["mw_plan"] is not None})
    pore_max = max(pores) if pores else None
    frac_min = min(fracs) if fracs else None
    out = dict(pore_max=pore_max, frac_min=frac_min, mw_plan=plans, ecd_limit=None, mw_min=None, margin=None, note="")
    if pore_max is not None and frac_min is not None:
        out["mw_min"] = round(pore_max + 0.02, 2)
        out["ecd_limit"] = round(frac_min - 0.01, 2)
        out["margin"] = round(frac_min - pore_max, 3)
        out["note"] = (f"Offset-calibrated window {pore_max:.2f}–{frac_min:.2f} sg: keep mud weight ≥ {out['mw_min']:.2f} sg "
                       f"and ECD ≤ {out['ecd_limit']:.2f} sg.")
    return out


def look_ahead_brief(db: Session, well_id: str, depth: float, horizon_m: float = 300.0,
                     radius_km: float = 25.0) -> dict:
    ctx = risk_engine.load_context(db, well_id, radius_km)
    well = ctx.well
    end = min(well.total_depth_md, depth + horizon_m)
    live = risk_engine.simulated_parameters(ctx, depth)
    pw = pressure.pressure_window(db, well_id, radius_km, step=10.0)
    rows = pw["rows"]

    hazards = []
    for zone in ctx.zones:
        support = risk_engine._supporting_events(ctx, zone)
        if not support:
            continue
        env_start = min(e.depth_start for e in support)
        env_end = max(e.depth_end for e in support)
        if env_end < depth or env_start > end:
            continue
        projected = risk_engine.assess_zone(ctx, zone, env_start, {})  # history only, bit at the window top
        now = risk_engine.assess_zone(ctx, zone, depth, live)
        if projected is None:
            continue

        per_well: dict[str, float] = {}
        for e in support:
            per_well[e.well_id] = per_well.get(e.well_id, 0.0) + e.npt_hours
        reached = [w for w, o in ctx.offsets.items() if o.total_depth_md >= env_start]
        hit = len(per_well)
        likelihood = hit / max(len(reached), hit, 1)
        mean_hit = sum(per_well.values()) / hit
        cites = projected["evidence"]
        by_id = {c["event_id"]: c for c in cites}

        worked = sorted(
            (dict(well_name=c["well_name"], text=c["mitigation"], npt_hours=c["npt_hours"], event_id=c["event_id"],
                  document_id=c["document_id"], document_title=c["document_title"], page=c["page"])
             for c in cites if c["mitigation"]),
            key=lambda m: m["npt_hours"],
        )
        lessons = [dict(well_name=c["well_name"], text=c["lessons"], event_id=c["event_id"],
                        document_id=c["document_id"], document_title=c["document_title"], page=c["page"])
                   for c in cites if c["lessons"]]
        numbers = []
        for e in sorted(support, key=lambda e: e.depth_start):
            for k, v in (e.event_params or {}).items():
                if k in PARAM_FACTS and isinstance(v, (int, float)):
                    label, unit = PARAM_FACTS[k]
                    numbers.append(dict(key=k, label=label, value=v, unit=unit, well_name=by_id[e.id]["well_name"],
                                        event_id=e.id))

        mw = _mud_window(rows, env_start, env_end)
        breaches = [b for b in pw["breaches"] if b["end"] >= env_start and b["start"] <= env_end]
        hazards.append(dict(
            zone_id=zone.id, risk_type=zone.risk_type, risk_label=RISK_LABELS.get(zone.risk_type, zone.risk_type),
            formation=zone.formation, window=dict(start=env_start, end=env_end),
            distance_m=round(max(0.0, env_start - depth), 1), position="inside" if env_start <= depth else "ahead",
            historical_severity=zone.severity,
            projected=dict(score=projected["score"], severity=projected["severity"],
                           alert_eligible=projected["alert_eligible"], alert_threshold=projected["alert_threshold"],
                           confidence=projected["confidence"], factors=projected["factors"]),
            now=dict(score=now["score"], severity=now["severity"], status=now["status"]) if now else None,
            offsets_hit=hit, offsets_reached=len(reached), likelihood=round(likelihood, 3),
            npt=dict(total=round(sum(per_well.values()), 1), mean_per_well=round(mean_hit, 1),
                     worst=round(max(per_well.values()), 1), expected=round(likelihood * mean_hit, 1)),
            reasons=projected["reasons"][1:3], evidence=cites, what_worked=worked, lessons=lessons,
            checks=projected["recommended_checks"], offset_numbers=numbers, mud_window=mw, breaches=breaches,
        ))
    hazards.sort(key=lambda h: h["window"]["start"])

    formations = []
    for f in ctx.formations:
        if f.base_md < depth or f.top_md > end:
            continue
        formations.append(dict(
            name=f.name, top_md=f.top_md, base_md=f.base_md, lithology=f.lithology, risk_tags=f.risk_tags or [],
            prognosed=bool(f.is_prognosed), pore_pressure_sg=f.pore_pressure_sg, frac_gradient_sg=f.frac_gradient_sg,
            mw_plan=(well.mud_program or {}).get(f.name), enters_in_window=depth < f.top_md <= end,
        ))
    casing = [dict(c, in_window=depth <= c["shoe_md"] <= end) for c in pw["casing"]]

    # Distinct cited source pages across the brief.
    sources: dict[str, dict] = {}
    for h in hazards:
        for c in h["evidence"]:
            if not c["document_id"]:
                continue
            s = sources.setdefault(c["document_id"], dict(document_id=c["document_id"], title=c["document_title"],
                                                          doc_type=c["document_type"], well_name=c["well_name"], pages=[]))
            if c["page"] and c["page"] not in s["pages"]:
                s["pages"].append(c["page"])
    for s in sources.values():
        s["pages"].sort()

    fm = ctx.formation_at(depth)
    alert_grade = [h for h in hazards if h["projected"]["alert_eligible"]]
    if hazards:
        parts = [f"{h['risk_label'].lower()} at {h['window']['start']:,.0f} m ({h['offsets_hit']} of "
                 f"{h['offsets_reached']} offsets)" for h in hazards]
        headline = (f"Next {end - depth:,.0f} m: {len(hazards)} hazard window{'s' if len(hazards) != 1 else ''} with offset "
                    f"history — {'; '.join(parts)}. {len(alert_grade)} would reach alert level on history alone.")
    else:
        headline = f"Next {end - depth:,.0f} m: no offset-well hazard windows recorded within {radius_km:g} km."
    entering = [f for f in formations if f["enters_in_window"]]
    if entering:
        headline += " Formation tops ahead: " + ", ".join(f"{f['name']} {f['top_md']:,.0f} m" for f in entering) + "."

    return dict(
        well=dict(id=well.id, name=well.name, rig=well.rig, field=well.field, total_depth_md=well.total_depth_md),
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        depth=depth, horizon_m=horizon_m, window=dict(start=depth, end=end), radius_km=radius_km,
        offsets_in_radius=len(ctx.offsets), current_formation=fm.name if fm else None,
        headline=headline, hazards=hazards, formations=formations, casing=casing,
        npt=dict(expected_hours=round(sum(h["npt"]["expected"] for h in hazards), 1),
                 worst_case_hours=round(sum(h["npt"]["worst"] for h in hazards), 1),
                 offset_total_hours=round(sum(h["npt"]["total"] for h in hazards), 1)),
        sources=sorted(sources.values(), key=lambda s: s["title"] or ""),
        method=("Projected severity scores each window with the bit at its top from offset history only (live-parameter "
                "factor = 0); likelihood = offsets that hit the window ÷ offsets drilled to that depth; expected NPT = "
                "likelihood × mean NPT per affected offset."),
    )
