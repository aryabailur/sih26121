"""Writes docs/VIDEO_SCRIPT.md — the narrator's script — from script.json and the rendered timeline.

    .venv/Scripts/python.exe script_doc.py        (after edit.py; uses docs/video/timeline.json + vo/durations.json)

Timecodes and each line's time budget ("Max") come from the actual edit, so the page never drifts from the film.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
BUILD = Path(os.environ.get("NWIS_VIDEO_BUILD", Path(tempfile.gettempdir()) / "nwis-video"))

# what the picture shows under each line (keep in step with edit.py / record.mjs / scenes.html)
ON_SCREEN = {
    "T1": 'Black title card: "Team Huzzards", "Problem statement SIH26121 · Oil India Limited"',
    "P1": 'Lithology cross-section; the bit drills to 3,100 m. "At the bit, you have minutes to decide."',
    "P2": "Nearby wells draw in; incidents stamp in at depth; report sheets bury them",
    "P3": 'Black wipe to "10–20%" and a well-time bar; "The same trouble, well after well."; source line',
    "G1": "Welcome screen, spinning globe",
    "G2": 'Click "Enter"; the globe dives into Upper Assam',
    "G3": 'Paper panel over the Command Center: "dashboard" and "chatbot" struck through',
    "I1": 'Subsurface 3D builds itself; lower-third "The depth-aware link"',
    "I2": "Bit steps into the Barail; evidence links stream to it",
    "I3": 'Score taken apart to 0.83 vs the 0.75 threshold; cited DDR sentence; learned model 0.86 vs 0.76, "Advisory only"',
    "W1": "Command Center, 3D satellite map; lower-third with the demo-field disclosure",
    "W2": "Cursor tours the panels",
    "W3": 'Click "Run historical risk scenario" (3× time-lapse)',
    "W4": "Mud-loss alert toast; zoom in; lower-third",
    "W5": "Pause; ECD tile flagged",
    "W6": "Map flips to the 3D block; resume; lower-third",
    "W7": "Stuck-pipe alert; the camera flies to the evidence",
    "W8": "Why? dialog, scrolls",
    "W9": "Well Intelligence (night-shift theme): parameters vs depth, Lessons tab",
    "W10": "Compare (night-shift theme): correlated cross-section, ECD tab",
    "W11": "Question typed; cited answer; report page opens",
    "W12": 'Ctrl K → "brief"',
    "W13": "Brief; zoom on expected NPT",
    "W14": "Scanned PDF → OCR pipeline → review",
    "W15": "Real-data page",
    "W16": "Scan re-runs live; depth chart",
    "V1": "110 h builds from three hazard-striped windows; “Flagged at …” stamps",
    "V2": "eRTMAC + OIL archive → NWIS → every rig / handover / new engineer; facts row",
    "V3": 'End card on black; "before you drill it." swept in yellow; Team Huzzards',
}
SAY = {  # pronunciation notes, shown once in the guide
    "NWIS": "En-wiss", "eRTMAC": "E-R-T-MAC", "OIL-AX-102": "oil A-X one-oh-two", "NPT": "N-P-T", "ECD": "E-C-D",
    "OCR": "O-C-R", "SIH26121": "S-I-H two-six-one-two-one", "Barail": "ba-RAIL", "Kopili": "ko-PEE-lee", "Huzzards": "HUZ-zards",
}
SECTION_TITLE = {"intro": "00 · TEAM & PROBLEM STATEMENT", "problem": "01 · PROBLEM", "gamechanger": "02 · GAME-CHANGER",
                 "innovation": "03 · CORE INNOVATION", "walkthrough": "04 · PROTOTYPE WALKTHROUGH (live app)", "impact": "05 · LONG-TERM IMPACT"}


def tc(s: float) -> str:
    return f"{int(s // 60)}:{s % 60:04.1f}"


def main() -> None:
    script = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    tl = json.loads((ROOT / "docs" / "video" / "timeline.json").read_text())
    dur = json.loads((BUILD / "vo" / "durations.json").read_text())
    voice, total = tl["voice"], tl["total"]
    lines = script["lines"]
    ids = [l["id"] for l in lines]
    # a line may run until the next one starts (minus a breath), capped at +25 %
    nxt = {a: voice[b] for a, b in zip(ids, ids[1:])}
    words = sum(len(l["text"].split()) for l in lines)
    speech = sum(dur[i] for i in ids)
    sec_start = {}
    for l in lines:
        sec_start.setdefault(l["section"], voice[l["id"]])
    out = [
        f"# NWIS — {tc(total)} demo video · voiceover script", "",
        "**Video:** `docs/video/NWIS_SIH26121_demo.mp4` (1080p30), `…_captioned.mp4` (burned-in captions),",
        "`NWIS_SIH26121_demo.srt` (captions), `NWIS_score.wav` (the background music alone). The MP4s are not in git",
        "(over GitHub's 100 MB limit) — rebuild with `tools/video/`.",
        "The voice is **Team Huzzards' own narrator, cloned** from a sample recording (`tools/video/clone.py`, Chatterbox on",
        "the local GPU). This page is the same script for reading it live instead.", "",
        "**Structure (SIH brief):** " + " · ".join(
            f"{SECTION_TITLE[s].split(' · ')[1].title()} ({tc(t)})" for s, t in sec_start.items()) + f" · end {tc(total)}.", "",
        "## Reading guide", "",
        "- **Tone:** calm and confident, like a senior engineer briefing a rig team — not a salesperson.",
        "- **Pace:** brisk, about 180 words a minute. Each line has a **max** length (right column); finish inside it,",
        "  because the picture is timed to it.",
        "- **Pronunciation:** " + " · ".join(f"{k} = **\"{v}\"**" for k, v in SAY.items()) + " · depths as spoken numbers.",
        "",
        "| # | Time | Max | Line (say this) | On screen |", "|---|---|---|---|---|",
    ]
    cur = None
    for l in lines:
        i = l["id"]
        if l["section"] != cur:
            cur = l["section"]
            out.append(f"| **{SECTION_TITLE[cur]}** |||||")
        mx = min(dur[i] * 1.25, (nxt[i] - voice[i] - 0.25) if i in nxt else dur[i] + 1.5)
        out.append(f"| {i} | {tc(voice[i])} | {max(dur[i], mx):.1f} s | {l['text']} | {ON_SCREEN.get(i, '')} |")
    out += [
        "", f"*About {words} words in {speech:.0f} s of speech.*", "",
        "## Recording it live instead", "",
        "1. Record each line as its own file named by its ID (`T1.wav`, `P1.wav`, … `V3.wav`), in a quiet room, 48 kHz.",
        "   Don't add silence at the ends; the tool trims it.",
        "2. `cd tools/video && .venv\\Scripts\\python.exe tts.py --human <folder>` — replaces the clips and updates the timings.",
        "3. Every take and scene is timed from those durations, so re-run the pipeline:",
        "   `node record.mjs` (needs the app running) → `node scenes.mjs` → `.venv\\Scripts\\python.exe edit.py`.",
        "",
        "## Claims in the video, and where they come from", "",
        "| Claim | Source |", "|---|---|",
        "| Unplanned events can take 10–20 % of well time, led by stuck pipe and lost circulation | Elsevier ScienceDirect Topics, \"Loss of Circulation\" (shown on screen) |",
        "| 110 h NPT in the three windows ahead; alerts at 3,150 / 3,380 / 3,580 m | NWIS demo field (illustrative data), `tests.scenario_sweep` |",
        "| 8.8 h expected NPT ≈ ₹11 lakh; ₹1.4 crore for 110 h | Look-ahead brief at an **assumed** ₹30 lakh/day spread rate |",
        "| Learned model AUC 0.86 vs 0.76 hand-set | `GET /api/risk/model` (leave-one-well-out backtest on the demo offsets) |",
        "| 1,970 real histories, 611 problems found in 2.5 s, 94 % held-out precision | `GET /api/opendata/summary` — Sodir FactPages (NLOD 2.0), hand-checked sample of 50 |",
        "| 100 % of alerts cite a source page | By design: every alert carries its offset evidence with document, page, well and depth |",
        "| 20/20 requirements | `python -m tests.requirements_check` |", "",
    ]
    (ROOT / "docs" / "VIDEO_SCRIPT.md").write_text("\n".join(out), encoding="utf-8")
    print(f"docs/VIDEO_SCRIPT.md — {len(lines)} lines, {tc(total)}")


if __name__ == "__main__":
    main()
