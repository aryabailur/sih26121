"""Sample report for the Document Intelligence demo (a DDR not yet in the knowledge base)."""
from __future__ import annotations

from config import SAMPLE_DIR
from services.pdf_writer import write_pdf

SAMPLE_PDF_NAME = "DDR_OIL-AX-22_Day45_SAMPLE.pdf"

SAMPLE_PAGES = [
    [
        "## DAILY DRILLING REPORT - OIL-AX-22 | Report No. 45 | Date: 2022-08-13",
        "Rig: Rig DR-02 | Field: Dikhow East (Demo Field) | Basin: Upper Assam Shelf",
        "Depth 00:00 hrs 3,405 m MD; depth 24:00 hrs 3,478 m MD; 24-hr progress 73 m.",
        "Hole size 8-1/2 in; last casing 9-5/8 in at 3,030 m. Formation at report depth: Kopili Shale.",
        "Mud system: KCl-polymer WBM, mud weight 1.44 sg, ECD 1.49 sg, KCl 6.0%.",
        "24-hr summary: Drilled Kopili Shale 3,405-3,430 m. Pulled out for bit change; tight hole at 3,432 m; "
        "back-reamed. Ran new PDC bit, bit balling at 3,455 m; tripped and changed bit. Drilled to 3,478 m.",
        "Next 24-hr forecast: Drill ahead to planned TD 3,500 m with sweeps every stand.",
    ],
    [
        "## OPERATIONS TIME LOG",
        "00:00-02:00 Drilled 3,420-3,430 m, WOB 16 t, 110 RPM, 1,850 l/min, SPP 4,090 psi.",
        "02:00-06:30 While pulling out of hole for bit change, encountered tight hole at 3,432 m with 245 kN overpull. "
        "Worked through and back-reamed 3,440-3,420 m. Blocky cavings (8% of returns) observed at shakers. "
        "Cause attributed to Kopili shale instability after 60 hours of open-hole exposure. "
        "Mitigation: back-reamed the interval, raised mud weight from 1.44 to 1.46 sg and pumped a 10 m3 high-vis sweep. "
        "NPT 4.5 hrs.",
        "06:30-13:00 Pulled out, changed bit, ran in hole to 3,430 m. Washed last stand to bottom.",
        "13:00-22:00 Drilled 3,430-3,455 m. At 3,455 m ROP dropped from 9 to 2 m/hr due to bit balling in sticky "
        "Kopili claystone. Pumped detergent pill with no improvement. Pulled out, found PDC cutters balled. "
        "NPT 9 hrs. Lesson: use anti-balling nozzle configuration and an ROP enhancer in the Kopili.",
    ],
    [
        "## DRILLING PARAMETERS & REMARKS",
        "22:00-24:00 Drilled 3,455-3,478 m. Torque began rising from 15 kN.m at 3,478 m with intermittent stick-slip; "
        "reduced WOB and increased RPM.",
        "Mud properties at 3,478 m: MW 1.46 sg, PV 21 cP, YP 17 lb/100ft2, API fluid loss 4.4 ml, KCl 6.0%, MBT 11 kg/m3.",
        "Recommendations: maintain KCl at 7% for the remaining Kopili interval; limit open-hole exposure before trips; "
        "ream every stand through 3,420-3,440 m on the next trip.",
        "Prepared by: Night drilling supervisor (synthetic).",
    ],
]


def generate_samples() -> list[str]:
    path = SAMPLE_DIR / SAMPLE_PDF_NAME
    write_pdf(path, SAMPLE_PAGES, title="OIL-AX-22")
    return [path.name]
