r"""Cut static instances of the Archivo variable font (OFL) so Chromium embeds TrueType, not Type 3, in the PDF.

    .venv\Scripts\python.exe make_fonts.py      -> fonts/static/*.ttf (git-ignored; build.py runs this when missing)
"""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = Path(__file__).parent
SRC = HERE / "fonts" / "Archivo[wdth,wght].ttf"
OUT = HERE / "fonts" / "static"
# (file name, family, weight, width %) — width 100 = normal, 87.5 = semi-condensed
INSTANCES = [
    ("Archivo-Regular", "Archivo", 400, 100), ("Archivo-Medium", "Archivo", 500, 100),
    ("Archivo-SemiBold", "Archivo", 600, 100), ("Archivo-Bold", "Archivo", 700, 100),
    ("Archivo-ExtraBold", "Archivo", 800, 100),
    ("ArchivoSC-SemiBold", "Archivo SC", 600, 87.5), ("ArchivoSC-Bold", "Archivo SC", 700, 87.5),
    ("ArchivoSC-ExtraBold", "Archivo SC", 800, 87.5), ("ArchivoSC-Black", "Archivo SC", 900, 87.5),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, family, wght, wdth in INSTANCES:
        dst = OUT / f"{name}.ttf"
        if dst.exists():
            continue
        f = instantiateVariableFont(TTFont(SRC), {"wght": wght, "wdth": wdth}, updateFontNames=False)
        style = name.split("-", 1)[1]
        for rec in f["name"].names:  # unique names so Chromium/PowerPoint never merge instances
            if rec.nameID in (1, 16):
                rec.string = family
            elif rec.nameID in (2, 17):
                rec.string = style
            elif rec.nameID in (4,):
                rec.string = f"{family} {style}"
            elif rec.nameID == 6:
                rec.string = name
        f.save(dst)
        print("wrote", dst.name)


if __name__ == "__main__":
    main()
