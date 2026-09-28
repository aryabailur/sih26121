"""Drilling-domain vocabulary shared by the risk engine, search and document extractor."""
from __future__ import annotations

EVENT_TYPES = [
    "mud_loss",
    "lost_circulation",
    "stuck_pipe",
    "differential_sticking",
    "kick",
    "overpressure",
    "torque_spike",
    "wellbore_instability",
    "cementing_failure",
    "fishing",
    "NPT",
]

EVENT_LABELS = {
    "mud_loss": "Mud Loss",
    "lost_circulation": "Lost Circulation",
    "stuck_pipe": "Stuck Pipe",
    "differential_sticking": "Differential Sticking",
    "kick": "Kick",
    "overpressure": "Overpressure",
    "torque_spike": "Torque / Drag Anomaly",
    "wellbore_instability": "Wellbore Instability",
    "cementing_failure": "Cementing Failure",
    "fishing": "Fishing Operation",
    "NPT": "NPT Event",
}

# Risk families group raw event types into the risks the engine forecasts.
RISK_FAMILIES: dict[str, list[str]] = {
    "mud_loss": ["mud_loss", "lost_circulation"],
    "stuck_pipe": ["stuck_pipe", "differential_sticking"],
    "kick": ["kick", "overpressure"],
    "torque_spike": ["torque_spike"],
    "wellbore_instability": ["wellbore_instability"],
    "cementing_failure": ["cementing_failure"],
    "NPT": ["NPT", "fishing"],
}

RISK_LABELS = {
    "mud_loss": "Mud Loss",
    "stuck_pipe": "Stuck Pipe",
    "kick": "Kick / Overpressure",
    "torque_spike": "Torque / Drag Anomaly",
    "wellbore_instability": "Wellbore Instability",
    "cementing_failure": "Cementing Risk",
    "NPT": "NPT Risk",
}

EVENT_TO_FAMILY = {t: fam for fam, types in RISK_FAMILIES.items() for t in types}

SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}

FORMATIONS = [
    "Girujan Shale",
    "Tipam Sandstone",
    "Namsang Formation",
    "Barail Group",
    "Kopili Shale",
    "Sylhet Limestone",
]

FORMATION_ALIASES = {
    "girujan": "Girujan Shale",
    "tipam": "Tipam Sandstone",
    "namsang": "Namsang Formation",
    "barail": "Barail Group",
    "kopili": "Kopili Shale",
    "sylhet": "Sylhet Limestone",
}

# Parameters that carry signal for each risk family (used for anomaly scoring).
FAMILY_PARAMETERS: dict[str, list[str]] = {
    "mud_loss": ["ecd", "mud_weight", "standpipe_pressure"],
    "stuck_pipe": ["torque", "hook_load", "standpipe_pressure"],
    "kick": ["standpipe_pressure", "rop", "mud_weight"],
    "torque_spike": ["torque", "rpm"],
    "wellbore_instability": ["torque", "hook_load"],
    "cementing_failure": ["ecd"],
    "NPT": ["rop"],
}

PARAMETER_LABELS = {
    "rop": ("ROP", "m/hr"),
    "wob": ("WOB", "kN"),
    "torque": ("Torque", "kN·m"),
    "rpm": ("RPM", "rpm"),
    "flow_rate": ("Flow rate", "l/min"),
    "standpipe_pressure": ("Standpipe pressure", "psi"),
    "mud_weight": ("Mud weight", "sg"),
    "ecd": ("ECD", "sg"),
    "hook_load": ("Hook load", "kN"),
    "pump_pressure": ("Pump pressure", "psi"),
    "gas_units": ("Background gas", "units"),
}

# Query-side synonym canonicalisation: phrase -> concept token.
CONCEPT_SYNONYMS: dict[str, list[str]] = {
    "concept_mud_loss": [
        "mud loss", "mud losses", "lost circulation", "loss of circulation", "losses", "loss",
        "lost returns", "thief zone", "seepage", "lcm", "losing", "partial returns", "total losses",
    ],
    "concept_stuck_pipe": [
        "stuck pipe", "pipe stuck", "stuck", "sticking", "differential sticking", "overpull",
        "key seat", "key seating", "jarring", "jarred", "free the pipe", "freed", "spotting fluid",
    ],
    "concept_kick": [
        "kick", "influx", "gas kick", "pit gain", "flow check", "shut in", "shut-in", "sidpp",
        "well control", "kill mud", "overpressure", "over-pressure", "pore pressure", "driller's method",
    ],
    "concept_torque": [
        "torque", "torque spike", "stick slip", "stick-slip", "drag", "hole cleaning", "cuttings bed",
    ],
    "concept_instability": [
        "wellbore instability", "tight hole", "tight spot", "cavings", "pack off", "pack-off",
        "swelling", "reaming", "back-ream", "back ream", "unstable",
    ],
    "concept_cement": [
        "cement", "cementing", "cement bond", "cbl", "channeling", "channelling", "squeeze",
        "centralizer", "centralizers", "top of cement", "micro-annulus", "microannulus",
    ],
    "concept_fishing": ["fishing", "fish", "twist off", "twist-off", "junk", "overshot", "lost in hole"],
    "concept_npt": ["npt", "non-productive", "downtime", "failure", "repair", "waiting on"],
    "concept_mitigation": [
        "mitigation", "mitigations", "remedy", "remedial", "cured", "cure", "solution", "fix",
        "action taken", "actions", "what was done", "how was", "controlled",
    ],
    "concept_cause": ["cause", "caused", "root cause", "why", "reason", "due to", "attributed"],
}

CONCEPT_TO_FAMILY = {
    "concept_mud_loss": "mud_loss",
    "concept_stuck_pipe": "stuck_pipe",
    "concept_kick": "kick",
    "concept_torque": "torque_spike",
    "concept_instability": "wellbore_instability",
    "concept_cement": "cementing_failure",
    "concept_fishing": "NPT",
    "concept_npt": "NPT",
}

FAMILY_CONCEPT = {
    "mud_loss": "concept_mud_loss",
    "stuck_pipe": "concept_stuck_pipe",
    "kick": "concept_kick",
    "torque_spike": "concept_torque",
    "wellbore_instability": "concept_instability",
    "cementing_failure": "concept_cement",
    "NPT": "concept_npt",
}

# Engineering checklists — surfaced with every alert. Offset-derived specifics are
# appended at runtime from the supporting events' mitigation records.
RECOMMENDED_CHECKS: dict[str, list[str]] = {
    "mud_loss": [
        "Monitor pit volume and flow-out continuously; tighten PVT alarm to ±1 m³.",
        "Keep ECD below the offset loss-onset value — manage pump rate and ROP through the interval.",
        "Pre-mix an LCM pill (sized CaCO₃ + graphite) and keep it on standby at the rig floor.",
        "Review mud weight against the offset cure weight before entering the loss window.",
        "Minimise surge pressures: control tripping and connection speeds.",
    ],
    "stuck_pipe": [
        "Verify KCl / inhibitor concentration before entering the Kopili Shale.",
        "Minimise static time on connections — keep pipe moving; never leave hole open without circulation.",
        "Ream/back-ream every stand through doglegs above 5°/30 m.",
        "Track torque & drag against the broomstick model; flag overpull above 50 kN.",
        "Confirm jar placement and have spotting fluid available.",
    ],
    "kick": [
        "Confirm mud weight is at or above the offset post-kick weight before the formation top.",
        "Flow-check on every drilling break; watch pit gain and flow-out trend.",
        "Verify BOP/choke manifold test status and update the kill sheet.",
        "Monitor background and connection gas; watch for SPP decline.",
        "Control ROP through the Kopili–Sylhet boundary.",
    ],
    "torque_spike": [
        "Raise flow rate for hole cleaning at inclinations above 30°.",
        "Pump high-viscosity sweeps; rotate off-bottom at 120 RPM every 2 stands.",
        "Monitor stick-slip severity; adjust WOB/RPM to stay out of the unstable window.",
        "Check cuttings returns at shakers vs. expected volume.",
    ],
    "wellbore_instability": [
        "Check mud weight against the collapse gradient for the formation.",
        "Monitor cavings shape/volume at the shakers.",
        "Limit trip speed and swab/surge through shale intervals.",
        "Maintain inhibition (KCl, polymer) within program.",
    ],
    "cementing_failure": [
        "Run centralizers every 2 joints across deviated sections.",
        "Pump spacer at turbulent flow; verify displacement rate against the design.",
        "Condition mud (lower YP/PV) before cementing to improve mud removal.",
        "Plan a CBL/USIT evaluation and a squeeze contingency.",
    ],
    "NPT": [
        "Inspect BHA/connections at the next trip.",
        "Verify spares for critical rig equipment are on location.",
        "Review offset NPT causes for this interval in the pre-job meeting.",
    ],
}

RECOMMENDATION_HEADLINE: dict[str, str] = {
    "mud_loss": "Prepare loss-prevention measures before entering the historical loss window.",
    "stuck_pipe": "Apply stuck-pipe prevention practices through the Kopili interval.",
    "kick": "Verify well-control readiness and mud-weight margin before the formation top.",
    "torque_spike": "Improve hole cleaning and manage drilling dynamics.",
    "wellbore_instability": "Manage wellbore stability through the shale interval.",
    "cementing_failure": "Adopt offset cementing lessons for the next casing job.",
    "NPT": "Review offset NPT causes for this interval.",
}
