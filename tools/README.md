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
| `npm run video` | Recorded backup walkthrough | `docs/nwis-demo-walkthrough.webm` |
| `node audit_text.mjs [--detail]` | Legibility audit of every screen: text under 12 px and below 4.5:1 contrast (`THEME=dark`, `MIN_PX=`) | report to stdout |
| `npm run verify` | E2E check: pre-raised alert + 50 km radius → scenario must still toast at 3,150 m, pause/resume cleanly, end with exactly 3 alerts at 25 km | JSON to stdout |
| `npm run deck` | Rebuild the 10-slide pitch deck from `docs/screenshots` | `docs/NWIS_Pitch_Deck.pptx` |
| `powershell -File render_pptx.ps1 -Deck <abs .pptx> -OutDir <abs dir>` | Export slides to PNG with the installed PowerPoint (visual QA) | `slide-NN.png` |

Notes

- Git Bash rewrites `/dashboard` into a Windows path — run `export MSYS_NO_PATHCONV=1` first.
- All scripts launch Chromium with hardware GL (`--use-angle=d3d11`). The software rasteriser draws the 3D map at
  ~3 fps, which starves animations and makes toasts/transitions look stuck in captures.
- The shots / video / verify scripts call `POST /api/simulation/reset`, which clears alerts and **uploaded documents**.
- Keep only one browser tab on the app while these run: alerts live on the shared backend.
- Deck text lives in `build_deck.js` (content mirrors `docs/PITCH.md`); edit there, rebuild, then re-render with
  `render_pptx.ps1` to check for overflow.
