"""Voiceover clips — AI (edge-tts neural voice) or a human recording — trimmed of edge silence, with durations and
word timings. Everything downstream (take recording, scene timing, the edit) is driven by vo/durations.json.

    .venv/Scripts/python.exe tts.py                  # generate missing AI clips
    .venv/Scripts/python.exe tts.py --force          # regenerate every AI clip (e.g. after changing the voice)
    .venv/Scripts/python.exe tts.py --human <dir>    # use a human narrator: <dir>/<ID>.wav|mp3|m4a per line (P1.wav …)

Output: $NWIS_VIDEO_BUILD/vo/<id>.wav (48 kHz mono), vo/durations.json {id: s}, vo/words.json {id: [[word, t], …]}
(default build dir: %TEMP%/nwis-video). Human clips get no word timings; scenes then fall back to even spacing.
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import edge_tts
import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).parent
# Outside OneDrive (see record.mjs); override with NWIS_VIDEO_BUILD.
BUILD = Path(os.environ.get("NWIS_VIDEO_BUILD", Path(tempfile.gettempdir()) / "nwis-video"))
OUT = BUILD / "vo"
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000


async def synth(text: str, voice: str, rate: str, mp3: Path) -> list[tuple[str, float]]:
    """Write the clip to `mp3`; return word boundaries [(word, seconds from clip start)]."""
    words: list[tuple[str, float]] = []
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append((chunk["text"], chunk["offset"] / 1e7))
    return words


def to_trimmed_wav(src: Path, wav: Path) -> tuple[float, float]:
    """Decode `src`, trim leading/trailing silence, short fades → 48 kHz mono wav. Returns (duration, head trimmed)."""
    raw = wav.with_suffix(".raw.wav")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", str(SR), str(raw)], check=True)
    with wave.open(str(raw)) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
    raw.unlink()
    env = np.convolve(np.abs(data), np.ones(480) / 480, mode="same")
    idx = np.where(env > 0.012 * 32768)[0]
    a, b = (max(0, idx[0] - 2400), min(len(data), idx[-1] + 4800)) if len(idx) else (0, len(data))
    clip = data[a:b].copy()
    fade = min(960, len(clip) // 4)
    clip[:fade] *= np.linspace(0, 1, fade)
    clip[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.clip(clip, -32768, 32767).astype(np.int16).tobytes())
    return len(clip) / SR, a / SR


def main(args: list[str]) -> None:
    script = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    force = "--force" in args
    human = Path(args[args.index("--human") + 1]) if "--human" in args else None
    dur_file, words_file = OUT / "durations.json", OUT / "words.json"
    durations = json.loads(dur_file.read_text()) if dur_file.exists() else {}
    words = json.loads(words_file.read_text(encoding="utf-8")) if words_file.exists() else {}
    for line in script["lines"]:
        lid = line["id"]
        wav = OUT / f"{lid}.wav"
        if human:
            src = next((human / f"{lid}{ext}" for ext in (".wav", ".mp3", ".m4a", ".flac") if (human / f"{lid}{ext}").exists()), None)
            if src is None:
                print(f"{lid:>4}  missing in {human} — keeping the current clip")
                continue
            durations[lid], _ = to_trimmed_wav(src, wav)
            words.pop(lid, None)
        else:
            if wav.exists() and lid in durations and lid in words and not force:
                continue
            mp3 = OUT / f"{lid}.mp3"
            wb = asyncio.run(synth(line.get("tts", line["text"]), script["voice"], script["rate"], mp3))
            durations[lid], head = to_trimmed_wav(mp3, wav)
            words[lid] = [[w, round(max(0.0, t - head), 3)] for w, t in wb]
            mp3.unlink()
        durations[lid] = round(durations[lid], 3)
        print(f"{lid:>4}  {durations[lid]:5.2f}s  {line['text'][:70]}")
    dur_file.write_text(json.dumps(durations, indent=1))
    words_file.write_text(json.dumps(words, ensure_ascii=False, indent=0), encoding="utf-8")
    total = sum(durations[l["id"]] for l in script["lines"] if l["id"] in durations)
    print(f"total speech {total:.1f}s over {len(script['lines'])} lines")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
