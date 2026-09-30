"""Voiceover in a cloned voice, from a sample recording (Chatterbox, local GPU). Same outputs as tts.py, so everything
downstream — take recording, scene timing, the edit — is unchanged.

    .venv-clone/Scripts/python.exe clone.py [--sample PATH] [--takes 3] [--only P1,W9] [--tempo 1.0]

Per line: generate `--takes` candidates, transcribe each with Whisper and keep the one closest to the script, then
force-align it to the script words (torchaudio MMS_FA) for word timings, trim, level and resample to 48 kHz.
Only clone a voice whose owner agreed to it. The sample and the clips stay on this machine (git-ignored).
Setup (once): py 3.11 venv → torch/torchaudio 2.6 cu124, chatterbox-tts, openai-whisper (see README).
"""
from __future__ import annotations

import difflib
import json
import os
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
import torch
import torchaudio

HERE = Path(__file__).parent
BUILD = Path(os.environ.get("NWIS_VIDEO_BUILD", Path(tempfile.gettempdir()) / "nwis-video"))
OUT = BUILD / "vo"
SR_OUT = 48000
DEV = "cuda" if torch.cuda.is_available() else "cpu"


def ffmpeg() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:  # the main venv has it; reuse that binary
        return next((HERE / ".venv" / "Lib" / "site-packages" / "imageio_ffmpeg" / "binaries").glob("ffmpeg*.exe")).as_posix()


FF = ffmpeg()


def load(path: Path, sr: int) -> np.ndarray:
    """Any audio file → float32 mono at `sr` (via ffmpeg)."""
    raw = subprocess.run([FF, "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def pick_reference(sample: Path, dst: Path, want: float = 12.0) -> tuple[float, float]:
    """The cleanest ~`want` s of continuous speech in the sample, cut at pauses. Returns (start, end) seconds."""
    sr = 24000
    x = load(sample, sr)
    hop = sr // 50  # 20 ms
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, mode="same")[::hop] + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    speech = db > (np.percentile(db, 95) - 28)
    n = int(want * 50)
    best, best_i = -1.0, 0
    for i in range(0, len(speech) - n, 5):  # 100 ms steps
        s = speech[i:i + n].mean()
        # prefer windows that start and end in a pause, so no word is cut
        edge = (not speech[max(0, i - 3):i + 1].any()) + (not speech[i + n - 1:i + n + 4].any())
        score = s + 0.08 * edge
        if score > best:
            best, best_i = score, i
    a, b = best_i / 50, (best_i + n) / 50
    seg = x[int(a * sr):int(b * sr)]
    seg = seg / (np.max(np.abs(seg)) + 1e-9) * 0.9
    write_wav(dst, seg, sr)
    return a, b


def write_wav(path: Path, x: np.ndarray, sr: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def letters(s: str) -> str:
    return re.sub(r"[^a-z' ]+", " ", s.lower().replace("-", " ")).strip()


def similarity(heard: str, want: str) -> float:
    a, b = letters(heard).split(), letters(want).split()
    return difflib.SequenceMatcher(None, a, b).ratio()


def trim_level(x: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    """Trim edge silence (keep a short tail), level speech to about -20 dBFS RMS, fade the ends. Returns (clip, head)."""
    env = np.convolve(np.abs(x), np.ones(sr // 100) / (sr // 100), mode="same")
    idx = np.where(env > 0.02 * np.max(env))[0]
    a, b = (max(0, idx[0] - sr // 20), min(len(x), idx[-1] + sr // 10)) if len(idx) else (0, len(x))
    y = x[a:b].copy()
    act = y[env[a:b] > 0.05 * np.max(env)]
    rms = np.sqrt(np.mean(act ** 2)) if len(act) else 1e-3
    y *= 0.1 / (rms + 1e-9)
    peak = np.max(np.abs(y))
    if peak > 0.89:
        y *= 0.89 / peak
    f = min(sr // 50, len(y) // 4)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y, a / sr


class Aligner:
    """Forced alignment of known words (MMS_FA): start time of every script word. Runs on the CPU (the GPU holds the
    voice model; a clip aligns in about a second)."""

    def __init__(self, device: str = "cpu"):
        b = torchaudio.pipelines.MMS_FA
        self.dev = device
        self.model = b.get_model(with_star=False).to(device)
        self.tok = b.get_tokenizer()
        self.align = b.get_aligner()

    def words(self, x16: np.ndarray, tts: str) -> list[list]:
        toks = [t for t in re.split(r"\s+", tts) if re.sub(r"[^a-z']", "", t.lower().replace("-", ""))]
        clean = [re.sub(r"[^a-z']", "", t.lower().replace("-", "")) for t in toks]
        wav = torch.from_numpy(x16).unsqueeze(0).to(self.dev)
        with torch.inference_mode():
            em, _ = self.model(wav)
        spans = self.align(em[0], self.tok(clean))
        ratio = wav.size(1) / em.size(1) / 16000
        return [[re.sub(r"[^\w'-]", "", t), round(sp[0].start * ratio, 3)] for t, sp in zip(toks, spans)]


def main(args: list[str]) -> None:
    from chatterbox.tts import ChatterboxTTS
    import whisper

    script = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    cfg = script.get("clone", {})
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d  # noqa: E731
    sample = Path(opt("--sample", HERE / cfg.get("sample", "voice/sample.wav")))
    n_takes = int(opt("--takes", 3))
    only = set(opt("--only", "").split(",")) - {""}
    tempo = float(opt("--tempo", cfg.get("tempo", 1.0)))
    exag, cfgw = float(cfg.get("exaggeration", 0.5)), float(cfg.get("cfg_weight", 0.5))
    OUT.mkdir(parents=True, exist_ok=True)
    cand_dir = OUT / "clone_candidates"
    cand_dir.mkdir(exist_ok=True)

    ref = OUT / "clone_reference.wav"
    a, b = pick_reference(sample, ref)
    print(f"reference: {sample.name} {a:.1f}–{b:.1f}s → {ref}")
    # Build the modules and load the weights straight onto the GPU: staging the 2 GB checkpoint in RAM first needs
    # more commit memory than a busy laptop has ("paging file is too small").
    import chatterbox.tts as cbt
    from safetensors.torch import load_file

    cbt.load_file = lambda f, device=None: load_file(f, device=DEV)
    with torch.device(DEV):
        tts = ChatterboxTTS.from_pretrained(device=DEV)
    tts.prepare_conditionals(str(ref), exaggeration=exag)
    asr = whisper.load_model("base.en", device=DEV)  # QA only: is every word there?
    fa = Aligner()

    dur_file, words_file = OUT / "durations.json", OUT / "words.json"
    durations = json.loads(dur_file.read_text()) if dur_file.exists() else {}
    words = json.loads(words_file.read_text(encoding="utf-8")) if words_file.exists() else {}
    rep_file = OUT / "clone_report.json"
    report = json.loads(rep_file.read_text(encoding="utf-8")) if rep_file.exists() else {}
    for line in script["lines"]:
        lid = line["id"]
        if only and lid not in only:
            continue
        say = line.get("tts", line["text"])
        best = None
        for k in range(n_takes):
            torch.manual_seed(1000 + k)
            wav = tts.generate(say, exaggeration=exag, cfg_weight=cfgw, temperature=0.75)
            x = wav.squeeze(0).cpu().numpy().astype(np.float32)
            p = cand_dir / f"{lid}_{k}.wav"
            write_wav(p, x / (np.max(np.abs(x)) + 1e-9) * 0.9, tts.sr)
            x16 = torchaudio.functional.resample(torch.from_numpy(x), tts.sr, 16000).numpy()  # Whisper wants 16 kHz arrays (no ffmpeg on PATH)
            heard = asr.transcribe(x16, language="en", fp16=DEV == "cuda")["text"]
            # Whisper writes numbers as digits ("SIH26121", "3,150"): score against the spoken and the written form
            sc = max(similarity(heard, say), similarity(heard, line["text"]))
            # "expect": words that must be heard ("field", "drill"; "a|b" = either) — a take that drops one loses
            exp_ok = all(any(a in heard.lower() for a in e.split("|")) for e in line.get("expect", []))
            # among near-equal matches, prefer the shorter take (less drawl, fewer artefacts)
            key = sc + (0.5 if exp_ok else 0.0) - 0.004 * len(x) / tts.sr
            if best is None or key > best[0]:
                best = (key, sc, x, heard, exp_ok)
        _, sc, x, heard, exp_ok = best
        y, _ = trim_level(x, tts.sr)
        y48 = np.asarray(torchaudio.functional.resample(torch.from_numpy(y), tts.sr, SR_OUT))
        if abs(tempo - 1.0) > 1e-3:  # gentle, pitch-preserving speed change
            tmp = OUT / f"{lid}.tmp.wav"
            write_wav(tmp, y48, SR_OUT)
            y48 = load_tempo(tmp, tempo)
            tmp.unlink()
        write_wav(OUT / f"{lid}.wav", y48, SR_OUT)
        y16 = np.asarray(torchaudio.functional.resample(torch.from_numpy(y48.astype(np.float32)), SR_OUT, 16000))
        durations[lid] = round(len(y48) / SR_OUT, 3)
        words[lid] = fa.words(y16, say)
        report[lid] = {"match": round(sc, 3), "expect_ok": exp_ok, "heard": heard.strip()}
        flag = "" if sc >= 0.85 and exp_ok else "   <-- check" + ("" if exp_ok else " (expected word missing)")
        print(f"{lid:>4}  {durations[lid]:5.2f}s  match {sc:.2f}{flag}  {heard.strip()[:70]}", flush=True)
    dur_file.write_text(json.dumps(durations, indent=1))
    words_file.write_text(json.dumps(words, ensure_ascii=False, indent=0), encoding="utf-8")
    (OUT / "clone_report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    total = sum(durations[l["id"]] for l in script["lines"] if l["id"] in durations)
    print(f"total speech {total:.1f}s over {len(script['lines'])} lines")


def load_tempo(path: Path, tempo: float) -> np.ndarray:
    raw = subprocess.run([FF, "-v", "error", "-i", str(path), "-af", f"atempo={tempo:.4f}", "-ac", "1", "-ar", str(SR_OUT), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
