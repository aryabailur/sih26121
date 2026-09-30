# tools/video — the NWIS demo film pipeline

Produces `docs/video/NWIS_SIH26121_demo.mp4` (3:01, 1080p30): real takes of the running app, motion-graphics
scenes, a voiceover (cloned from the team narrator, AI, or a live recording), an original synthesised score, SFX and captions.

```
script.json ──clone.py──▶ vo/*.wav + durations.json + words.json    (team narrator's cloned voice; or tts.py: edge-tts / --human <dir>)
             ──record.mjs──▶ takes/<take>/frames + markers.json      (live app at 1920×1080, voice-synced actions)
             ──scenes.mjs──▶ scenes/<scene>/frames + timing.json     (scenes.html rendered frame-by-frame, 30 fps)
             ──edit.py──▶ docs/video/*.mp4 · .srt · .wav · timeline.json   (edit, push/wipe, overlays, score, mix)
             ──script_doc.py──▶ docs/VIDEO_SCRIPT.md                 (narrator script with the film's real timecodes)
```

Work files go to `%TEMP%/nwis-video` (several GB; override with `NWIS_VIDEO_BUILD`), not OneDrive.

## Run

```powershell
cd tools/video
py -3 -m venv .venv; .venv\Scripts\pip install numpy scipy pillow edge-tts imageio-ffmpeg   # once
.venv\Scripts\python.exe tts.py            # voice (needs internet for edge-tts)
node record.mjs                            # needs API :8000 + UI :3000; resets the demo; ~4 min
node scenes.mjs                            # ~2 min
.venv\Scripts\python.exe edit.py           # ~5 min; --plan prints the timeline only; --captions re-burns captions only
```

Uses `tools/node_modules` Playwright (hardware GL via `--use-angle=d3d11`) and ffmpeg from `imageio-ffmpeg`.

## Change things

- **Words:** edit `script.json` (`text` = captions/script, `tts` = how the AI should say it), then `tts.py`.
  Takes and scenes are timed from the voice durations — re-run `record.mjs` if a take's lines changed length.
- **Human narrator:** `tts.py --human <folder>` (files `P1.wav`, `P2.wav`, …) — see `docs/VIDEO_SCRIPT.md`.
- **Cloned voice (current):** `clone.py` voices every line from a sample of the narrator (`voice/sample.wav`, git-ignored;
  only with the speaker's consent) using Chatterbox on the local GPU — 3 takes per line, the best by Whisper match,
  word timings by forced alignment (MMS_FA), same outputs as `tts.py`. One-time setup (Python 3.11):
  `py -3.11 -m venv .venv-clone; .venv-clone\Scripts\pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124; .venv-clone\Scripts\pip install chatterbox-tts openai-whisper`,
  then `.venv-clone\Scripts\python.exe clone.py [--only W9,W10] [--tempo 1.03]`. `vo/clone_report.json` lists what
  Whisper heard per line; lines under 0.85 match are flagged for a re-take.
- **Team name on the end card:** add `"team": "Team … · College …"` to `script.json`, then `scenes.mjs impact` + `edit.py`.
- **Edit decisions** (order, trims, speed ramp, overlays, SFX): `build()` in `edit.py`.
- **Graphics** (`scenes.html`): an editorial package — paper, ink, one yellow accent, 3 px rules, hard offset shadows,
  Archivo + IBM Plex Mono, lithology patterns in the figures. All on-screen text (slates, lower-thirds, the demo-field
  disclosure) lives here and in `SPECS` (`scenes.mjs`); the takes carry no text, so copy changes never need a re-record.
- Dev helpers: `node timings.mjs` (voice windows per take), `node peek.mjs <take> W4+2` (frame at a moment),
  `node scenes.mjs --peek <scene> 2 9.5` (half-size stills of a scene → `$NWIS_VIDEO_BUILD/peek/`).
