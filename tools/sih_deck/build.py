r"""NWIS — SIH 2026 idea presentation (6 slides on the official SIH2026-IDEA-Presentation-Format).

    .venv\Scripts\python.exe build.py [--team="…"] [--team-id=…] [--theme="…"] [--video=URL] [--prototype=URL]

Outputs
    docs/NWIS_SIH2026_Idea_Presentation.pdf   vector PDF rendered by Chromium from deck.mjs (the file to upload)
    docs/NWIS_SIH2026_Idea_Presentation.pptx  the official template, its own title/oval/footer, each slide's content
                                              as a 3x transparent overlay + clickable link hotspots + speaker notes
    .render/slide-NN.png                      QA renders of the PDF pages

Pipeline: facts.json (numbers from the live engine, facts.py) + assets -> deck.mjs (HTML/SVG, Playwright) -> PDF/PNG
-> python-pptx. Unfilled fields (team ID, theme, links) stay in the template's red so they cannot be missed.
Setup once: python -m venv .venv; .venv\Scripts\pip install python-pptx lxml "qrcode[pil]" pywin32 pymupdf fonttools;
npm install in tools/ (playwright, react-icons).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
TEMPLATE = ROOT / "docs" / "SIH2026-IDEA-Presentation-Format.pptx"
OUT_PPTX = ROOT / "docs" / "NWIS_SIH2026_Idea_Presentation.pptx"
OUT_PDF = OUT_PPTX.with_suffix(".pdf")
RENDER = HERE / ".render"
ASSETS = RENDER / "assets"
SHOTS = ROOT / "docs" / "screenshots"

CONFIG = {
    "ps_id": "SIH26121",
    "ps_title": "Nearby Wells Intelligence System (NWIS)",
    "theme": None,  # exactly as the SIH portal lists it for SIH26121
    "category": "Software",
    "team_id": None,
    "team_name": "Team Huzzards",
    "prototype_url": None,  # deployed prototype
    "video_url": None,  # YouTube / Drive link of the demo film
    "repo_url": "https://github.com/aryabailur/sih26121",
}
FLAGS = {"--team": "team_name", "--team-id": "team_id", "--theme": "theme", "--title": "ps_title",
         "--video": "video_url", "--prototype": "prototype_url", "--repo": "repo_url"}
for a in sys.argv[1:]:
    k, _, v = a.partition("=")
    if k in FLAGS and v:
        CONFIG[FLAGS[k]] = v

# screenshots used on the slides: (source file, crop box in source px or None, output width px)
SHOT_SPECS = {
    "alert": ("02-mud-loss-alert.png", None, 1200),
    "subsurface": ("17-subsurface-3d.png", (96, 76, 1220, 888), 900),
    "why": ("04-why-explainer.png", None, 900),
    "brief": ("18-look-ahead-brief.png", None, 900),
    "realdata": ("21-real-data-proof.png", None, 900),
}


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def qr_svg(url: str, out: Path) -> None:
    import qrcode
    import qrcode.image.svg

    q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M,
                      image_factory=qrcode.image.svg.SvgPathImage)
    q.add_data(url)
    q.make(fit=True)
    q.make_image().save(str(out))


def export_title_art() -> Path:
    """The template's title-slide artwork (hexagons + SIH bulb + logo) without its text, rendered by PowerPoint."""
    out = ASSETS / "title-art.png"
    if out.exists():
        return out
    from pptx import Presentation

    tmp = RENDER / "title-art.pptx"
    prs = Presentation(TEMPLATE)
    s1 = prs.slides[0]
    for sh in list(s1.shapes):
        if sh.has_text_frame and sh.text_frame.text.strip():
            sh._element.getparent().remove(sh._element)
    prs.save(tmp)
    import win32com.client

    app = win32com.client.Dispatch("PowerPoint.Application")
    try:
        deck = app.Presentations.Open(str(tmp), True, False, False)
        deck.Slides(1).Export(str(out), "PNG", 3840, 2160)
        deck.Close()
    finally:
        app.Quit()
    tmp.unlink(missing_ok=True)
    return out


def prepare_assets() -> dict:
    ASSETS.mkdir(parents=True, exist_ok=True)
    # SIH logo from the template (12222 px wide original -> 4x of its 236 px slot)
    logo = ASSETS / "sih-logo.png"
    if not logo.exists():
        import zipfile

        with zipfile.ZipFile(TEMPLATE) as z, z.open("ppt/media/image2.png") as f:
            im = Image.open(f)
            im.load()
        im.thumbnail((944, 944 * im.height // im.width), Image.LANCZOS)
        im.save(logo, optimize=True)
    export_title_art()
    shutil.copy(ROOT / "frontend" / "app" / "icon.svg", ASSETS / "nwis-logo.svg")
    for key, (src, crop, width) in SHOT_SPECS.items():
        out = ASSETS / f"shot-{key}.jpg"
        if out.exists() and out.stat().st_mtime > (SHOTS / src).stat().st_mtime:
            continue
        im = Image.open(SHOTS / src).convert("RGB")
        if crop:
            im = im.crop(crop)
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(out, quality=90, optimize=True, progressive=True)
    qr = {}
    for key in ("repo_url", "video_url", "prototype_url"):
        if CONFIG[key]:
            p = ASSETS / f"qr-{key.split('_')[0]}.svg"
            qr_svg(CONFIG[key], p)
            qr[key] = p.name
    return qr


# ---------------------------------------------------------------------------------------------------- PPTX
EMU_PX = 9525  # 914400 EMU per inch / 96 px per inch


def build_pptx(links: dict, notes: list[str]) -> None:
    from lxml import etree
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.oxml.ns import qn
    from pptx.util import Emu, Pt

    prs = Presentation(TEMPLATE)
    ids = prs.slides._sldIdLst  # drop the "Important instructions" slide
    last = ids[-1]
    prs.part.drop_rel(last.get(qn("r:id")))
    ids.remove(last)
    S = list(prs.slides)
    RED = RGBColor(0xC0, 0x00, 0x00)

    def px(v):
        return Emu(int(round(v * EMU_PX)))

    def clear_runs(p):
        for r in list(p.runs)[1:]:
            r._r.getparent().remove(r._r)

    # ---- 1 · title page: fill the template's own text box, keep its artwork
    from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
    from pptx.util import Inches

    tb = next(sh for sh in S[0].shapes if sh.name.startswith("TextBox 9"))
    rows = [
        ("Problem Statement ID – ", CONFIG["ps_id"]),
        ("Problem Statement Title – ", CONFIG["ps_title"]),
        ("Theme – ", CONFIG["theme"] or "‹as listed on the SIH portal›"),
        ("PS Category – ", CONFIG["category"]),
        ("Team ID – ", CONFIG["team_id"] or "‹Team ID›"),
        ("Team Name – ", CONFIG["team_name"] or "‹Team name›"),
    ]
    missing = {2: not CONFIG["theme"], 4: not CONFIG["team_id"], 5: not CONFIG["team_name"]}
    tb.top = Inches(1.95)
    ps = tb.text_frame.paragraphs
    for i, (p, (label, value)) in enumerate(zip(ps[1:], rows)):
        clear_runs(p)
        p.runs[0].text = label
        p.runs[0].font.size = Pt(22)
        r = p.add_run()
        r.text = value
        r.font.bold = False
        r.font.size = Pt(21)
        r.font.name = "Arial"
        if missing.get(i):
            r.font.color.rgb = RED
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = 1.7
    ps[2].line_spacing = 1.12  # the two-line title
    ps[2].space_before = Pt(12)
    ps[2].space_after = Pt(14)

    def set_oval(sh):
        """Team name inside the template's oval: one word per line, no mid-word breaks."""
        tf = sh.text_frame
        name = CONFIG["team_name"] or "Team name"
        lines = name.split(" ", 1) if len(name) > 9 else [name]
        p0 = tf.paragraphs[0]
        clear_runs(p0)
        for p in tf.paragraphs[1:]:
            p._p.getparent().remove(p._p)
        p0.runs[0].text = lines[0]
        for extra in lines[1:]:
            np_ = deepcopy(p0._p)
            p0._p.addnext(np_)
            np_.findall(qn("a:r"))[0].find(qn("a:t")).text = extra
        for p in tf.paragraphs:
            p.alignment = PP_ALIGN.CENTER
            for r in p.runs:
                r.font.size = Pt(16)
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf._txBody.find(qn("a:bodyPr")).set("wrap", "none")
    # ---- slides 2–6: native title + team oval + footer, content as a transparent overlay
    titles = ["NWIS — Nearby Wells Intelligence System", "TECHNICAL APPROACH", "FEASIBILITY AND VIABILITY",
              "IMPACT AND BENEFITS", "RESEARCH AND REFERENCES"]
    for k, sl in enumerate(S):
        n = k + 1
        if k:
            for sh in list(sl.shapes):
                if sh.name.startswith("TextBox 8"):
                    sh._element.getparent().remove(sh._element)
                elif sh.name.startswith("Oval"):
                    set_oval(sh)
            t = sl.shapes.title
            p = t.text_frame.paragraphs[0]
            clear_runs(p)
            p.runs[0].text = titles[k - 1]
            if k == 1:
                p.runs[0].font.size = Pt(30)
        overlay = RENDER / "bare" / f"slide-{n:02d}.png"
        pic = sl.shapes.add_picture(str(overlay), 0, 0, prs.slide_width, prs.slide_height)
        pic.name = f"NWIS content {n}"
        # clickable hotspots where the PDF has links
        for ln in links.get(str(n), []):
            hs = sl.shapes.add_shape(1, px(ln["x"]), px(ln["y"]), px(ln["w"]), px(ln["h"]))
            hs.fill.background()
            hs.line.fill.background()
            st = hs._element.find(qn("p:style"))
            if st is not None:
                hs._element.remove(st)
            hs.name = "link"
            hs.click_action.hyperlink.address = ln["href"]
        if k < len(notes):
            sl.notes_slide.notes_text_frame.text = notes[k]
    prs.save(OUT_PPTX)
    print("saved", OUT_PPTX)


def main() -> None:
    RENDER.mkdir(exist_ok=True)
    if not (HERE / "fonts" / "static" / "ArchivoSC-Black.ttf").exists():
        run([sys.executable, HERE / "make_fonts.py"])
    qr = prepare_assets()
    cfg = dict(CONFIG, qr=qr, out_pdf=str(OUT_PDF))
    (RENDER / "config.json").write_text(json.dumps(cfg, indent=1, ensure_ascii=False), encoding="utf-8")
    if "--no-render" not in sys.argv:
        run(["node", HERE / "deck.mjs"], cwd=HERE)
    meta = json.loads((RENDER / "meta.json").read_text(encoding="utf-8"))
    if "--no-pptx" not in sys.argv:
        build_pptx(meta["links"], meta["notes"])
    print("saved", OUT_PDF)


if __name__ == "__main__":
    main()
