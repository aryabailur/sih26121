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
| `node shot.mjs /dashboard out.png [waitMs] [actions-json]` | One screenshot (viewport via `W=` / `H=` env, default 1600×900); actions: `click`, `wait`, `key`, `fill`, `eval` | `out.png` in the cwd |
| `npm run shots` | Full 12-step walkthrough (resets the demo first and after) | `docs/screenshots/01…12-*.png` |
| `node pw_shot.mjs` | Mud-weight window mid-scenario | `docs/screenshots/13-mud-weight-window.png` |
| `npm run video` | Recorded backup walkthrough | `docs/nwis-demo-walkthrough.webm` |
| `npm run verify` | E2E check: pre-raised alert + 50 km radius → scenario must still toast at 3,150 m, pause/resume cleanly, end with exactly 3 alerts at 25 km | JSON to stdout |
| `npm run deck` | Rebuild the 10-slide pitch deck from `docs/screenshots` | `docs/NWIS_Pitch_Deck.pptx` |
| `powershell -File render_pptx.ps1 -Deck <abs .pptx> -OutDir <abs dir>` | Export slides to PNG with the installed PowerPoint (visual QA) | `slide-NN.png` |

Notes

- Git Bash rewrites `/dashboard` into a Windows path — run `export MSYS_NO_PATHCONV=1` first.
- The shots / video / verify scripts call `POST /api/simulation/reset`, which clears alerts and **uploaded documents**.
- Keep only one browser tab on the app while these run: alerts live on the shared backend.
- Deck text lives in `build_deck.js` (content mirrors `docs/PITCH.md`); edit there, rebuild, then re-render with
  `render_pptx.ps1` to check for overflow.
