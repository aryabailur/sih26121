# tools/ — NWIS dev tooling

Not needed to run the app. These scripts drive the running app (backend on :8000, UI on :3000) to produce the
demo assets in `docs/` and to verify the judge scenario end-to-end.

```bash
cd tools
npm install
npx playwright install chromium   # once per machine
```

| Command | What it does | Output |
|---|---|---|
| `node shot.mjs /dashboard out.png [waitMs] [actions-json]` | One screenshot. Env: `W=` / `H=` viewport (default 1600×900), `THEME=dark`, `INTRO=1` (play the globe fly-in), `SOFTWARE_GL=1`. Actions: `click`, `wait`, `key`, `fill`, `eval`, `hover`, `mouse`, `shot` | `out.png` in the cwd |
| `npm run shots` | Welcome + full walkthrough + scanned-report OCR + learned model + night-shift theme (resets the demo first and after) | `docs/screenshots/00…12, 14–16-*.png` |
| `node pw_shot.mjs` | Mud-weight window mid-scenario | `docs/screenshots/13-mud-weight-window.png` |
| `npm run video` | Old silent backup walkthrough (superseded by `tools/video/`) | `docs/nwis-demo-walkthrough.webm` |
| `tools/video/` | **The demo film**: `tts.py` (AI or human voice) → `record.mjs` (live-app takes, voice-synced) → `scenes.mjs` (motion graphics) → `edit.py` (edit, score, SFX, captions). See `tools/video/README.md` | `docs/video/*.mp4` |
| `node audit_text.mjs [--detail]` | Legibility audit of every screen: text under 12 px and below 4.5:1 contrast (`THEME=dark`, `MIN_PX=`) | report to stdout |
| `npm run verify` | E2E check: pre-raised alert + 50 km radius → scenario must still toast at 3,150 m, pause/resume cleanly, end with exactly 3 alerts at 25 km | JSON to stdout |
| `npm run deck` | Rebuild the 13-slide pitch deck from `docs/screenshots` | `docs/NWIS_Pitch_Deck.pptx` |
| `cd sih_deck && python build.py --pdf [--team="…" --team-id=… --theme="…" --video=URL --prototype=URL]` | **SIH 2026 idea submission**: 6 slides on the official `docs/SIH2026-IDEA-Presentation-Format.pptx` (instructions slide removed), PDF via PowerPoint. Unfilled fields stay red; a filled video/prototype URL gets a QR code. Needs `pip install python-pptx lxml "qrcode[pil]" pywin32` | `docs/NWIS_SIH2026_Idea_Presentation.pptx` + `.pdf` |
| `powershell -File render_pptx.ps1 -Deck <abs .pptx> -OutDir <abs dir> [-Pdf <abs .pdf>]` | Export slides to PNG with the installed PowerPoint (visual QA); optionally save a PDF | `slide-NN.png` |

Notes

- Git Bash rewrites `/dashboard` into a Windows path — run `export MSYS_NO_PATHCONV=1` first.
- All scripts launch Chromium with hardware GL (`--use-angle=d3d11`). The software rasteriser draws the 3D map at
  ~3 fps, which starves animations and makes toasts/transitions look stuck in captures.
- The shots / video / verify scripts call `POST /api/simulation/reset`, which clears alerts and **uploaded documents**.
- Keep only one browser tab on the app while these run: alerts live on the shared backend.
- Deck text lives in `build_deck.js` (content mirrors `docs/PITCH.md`); edit there, rebuild, then re-render with
  `render_pptx.ps1` to check for overflow.
- SIH idea deck: slide code in `sih_deck/build.py`, drawing helpers in `sih_deck/lib.py`, references in
  `sih_deck/refs.py` (every entry was opened/confirmed). The hero cross-section, laptop mockup and architecture are
  HTML/SVG in `sih_deck/diagrams.mjs`, rendered at 4× by Playwright into `sih_deck/.render/gen/` on every build
  (`--no-render` reuses them); they are drawn 1:1 at 96 px = 1 in, so CSS px sizes map straight to slide size. Numbers on the slides come from the live API and test runs
  (tests, requirements check, real-data spot-check, learned-model AUC, brief NPT) — re-check them if those change.
  Display font is Franklin Gothic Demi Cond (Bahnschrift is a variable font and does not embed in PowerPoint PDFs).
