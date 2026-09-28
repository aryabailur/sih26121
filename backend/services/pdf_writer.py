"""Minimal text-only PDF writer (Helvetica, WinAnsi) — no third-party dependency.

Used to produce the sample report for the Document Intelligence demo so the upload →
text extraction → event extraction path runs on a genuine PDF.
"""
from __future__ import annotations

import textwrap
from pathlib import Path


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def write_pdf(path: Path, pages: list[list[str]], title: str = "") -> Path:
    objects: list[bytes] = []

    def add(obj: bytes) -> int:
        objects.append(obj)
        return len(objects)

    catalog_id = add(b"")  # placeholder, filled later
    pages_id = add(b"")
    font_id = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    bold_id = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    page_ids = []
    for page_no, lines in enumerate(pages, start=1):
        wrapped: list[tuple[str, bool]] = []
        for i, line in enumerate(lines):
            bold = line.startswith("## ")
            text = line[3:] if bold else line
            for w in textwrap.wrap(text, 92) or [""]:
                wrapped.append((w, bold))
        ops = ["BT", "50 800 Td", "14 TL"]
        for text, bold in wrapped:
            ops.append(f"/{'F2' if bold else 'F1'} {11 if bold else 9.5} Tf")
            ops.append(f"({_esc(text)}) Tj T*")
        ops.append("/F1 8 Tf")
        ops.append(f"(Page {page_no} of {len(pages)}  -  SYNTHETIC DEMO DOCUMENT {title}) Tj")
        ops.append("ET")
        stream = "\n".join(ops).encode("cp1252", errors="replace")
        content_id = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        page_ids.append(add(
            (f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 595 842] "
             f"/Resources << /Font << /F1 {font_id} 0 R /F2 {bold_id} 0 R >> >> /Contents {content_id} 0 R >>").encode()
        ))
    objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
    kids = " ".join(f"{i} 0 R" for i in page_ids)
    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    path.write_bytes(bytes(out))
    return path
