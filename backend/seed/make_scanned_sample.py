"""Dev tool: render the scanned-report sample (an image-only PDF with no text layer).

    python -m seed.make_scanned_sample      # needs Pillow and a monospace TrueType font

The output is committed at seed/assets/ and copied into the samples folder by seed_data.py, so seeding
never depends on Pillow or on fonts being installed. The events sit outside every tuned risk window
(Barail 2,655 m differential sticking; 2,690 m pump NPT), so saving the sample cannot move the demo
scenario's alert depths.
"""
from __future__ import annotations

import random
import textwrap
from pathlib import Path

ASSET = Path(__file__).parent / "assets" / "DDR_OIL-AX-44_Day38_SCANNED.pdf"

PAGES = [
    [
        "DAILY DRILLING REPORT - OIL-AX-44 | Report No. 38 | Date: 2021-11-19",
        "Rig: Rig DR-05 | Field: Dikhow East | Basin: Upper Assam Shelf",
        "SCANNED COPY - field office archive",
        "",
        "Depth 00:00 hrs 2,610 m MD; depth 24:00 hrs 2,702 m MD; 24-hr progress 92 m.",
        "Hole size 12-1/4 in; last casing 13-3/8 in at 2,395 m. Formation at report depth: Barail Group.",
        "Mud system: KCl-polymer WBM, mud weight 1.38 sg, ECD 1.43 sg, KCl 5.0%.",
        "",
        "24-hr summary: Drilled Barail sandstone 2,610-2,655 m. Pipe became differentially stuck at 2,655 m "
        "during a survey connection; spotted a pill and jarred free. Mud pump no. 2 failure at 2,690 m; repaired.",
        "",
        "Next 24-hr forecast: Drill ahead to 2,800 m and circulate bottoms up before the wiper trip.",
    ],
    [
        "OPERATIONS TIME LOG",
        "",
        "00:00-04:30 Drilled 2,610-2,655 m, WOB 14 t, 120 RPM, 3,200 l/min, SPP 3,150 psi.",
        "04:30-11:00 Stopped for a survey at 2,655 m with the string stationary for 12 minutes. "
        "Pipe was differentially stuck at 2,655 m across permeable Barail sandstone; could not rotate, 90 kN overpull. "
        "Cause attributed to high overbalance of the 1.38 sg mud against the depleted sand and a thick filter cake. "
        "Mitigation: spotted 8 m3 of diesel-based pipe-release pill, soaked 2 hrs, jarred down and worked the pipe free. "
        "NPT 6 hrs.",
        "11:00-18:00 Circulated and conditioned mud, reduced mud weight to 1.36 sg, drilled 2,655-2,690 m.",
        "18:00-21:30 Mud pump no. 2 failure at 2,690 m (liner washout); repaired the pump and replaced the liner. "
        "NPT 3.5 hrs.",
        "21:30-24:00 Drilled 2,690-2,702 m.",
        "",
        "Lesson: minimise stationary time during surveys in the Barail sands and keep the pipe moving; "
        "take surveys while circulating on the last stand.",
        "",
        "Prepared by: Night drilling supervisor.",
    ],
]

FONTS = ["C:/Windows/Fonts/cour.ttf", "/System/Library/Fonts/Courier.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"]


def render() -> Path:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    font_path = next((f for f in FONTS if Path(f).exists()), None)
    font = ImageFont.truetype(font_path, 25) if font_path else ImageFont.load_default(size=25)
    bold = ImageFont.truetype(font_path.replace("cour.ttf", "courbd.ttf"), 27) if font_path and Path(font_path.replace("cour.ttf", "courbd.ttf")).exists() else font
    rng = random.Random(38)
    images = []
    for n, lines in enumerate(PAGES, start=1):
        w, h = 1240, 1754  # A4 at 150 dpi
        img = Image.new("L", (w, h), 244)
        d = ImageDraw.Draw(img)
        # paper grain + scanner speckle
        for _ in range(9000):
            x, y = rng.randrange(w), rng.randrange(h)
            d.point((x, y), fill=rng.randrange(205, 240))
        for _ in range(45):
            x, y = rng.randrange(w), rng.randrange(h)
            d.ellipse((x, y, x + rng.randrange(1, 3), y + rng.randrange(1, 3)), fill=rng.randrange(90, 160))
        y = 110
        for i, raw in enumerate(lines):
            if not raw:
                y += 22
                continue
            f = bold if (i == 0) else font
            for part in textwrap.wrap(raw, 70) or [""]:
                d.text((95, y), part, fill=rng.randrange(20, 45), font=f)
                y += 38
            y += 8
        d.text((95, h - 90), f"Page {n} of {len(PAGES)}   OIL-AX-44 DDR 38   [scanned]", fill=90, font=font)
        img = img.rotate(0.45 if n == 1 else -0.35, resample=Image.BICUBIC, fillcolor=236, expand=False)
        img = img.filter(ImageFilter.GaussianBlur(0.4))
        images.append(img.convert("RGB"))
    ASSET.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(ASSET, "PDF", resolution=150, save_all=True, append_images=images[1:], quality=82)
    return ASSET


if __name__ == "__main__":
    print("wrote", render())
