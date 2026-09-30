"""The editor: assembles takes + scenes + overlays into the final NWIS video, with voiceover, score, SFX and captions.

    .venv/Scripts/python.exe edit.py            # full render → docs/video/
    .venv/Scripts/python.exe edit.py --plan     # print the timeline only (fast)

Inputs (under $NWIS_VIDEO_BUILD, default %TEMP%/nwis-video): takes/ (record.mjs), scenes/ (scenes.mjs), vo/ (tts.py).
Outputs: docs/video/NWIS_SIH26121_demo.mp4, …_captioned.mp4, .srt, and timeline.json (for the script doc).
"""
from __future__ import annotations

import bisect
import json
import os
import subprocess
import sys
import tempfile
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image
from scipy.signal import butter, sosfilt

import music

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
BUILD = Path(os.environ.get("NWIS_VIDEO_BUILD", Path(tempfile.gettempdir()) / "nwis-video"))
OUT = ROOT / "docs" / "video"
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS, SR = 1920, 1080, 30, 48000
MUSIC_GAIN = 0.19  # score under the voice (was 0.30: ~4 dB quieter, at the team's request)
SCRIPT = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
DUR = json.loads((BUILD / "vo" / "durations.json").read_text())
WORDS = json.loads((BUILD / "vo" / "words.json").read_text(encoding="utf-8"))
TEXT = {l["id"]: l["text"] for l in SCRIPT["lines"]}
SECTION = {l["id"]: l["section"] for l in SCRIPT["lines"]}


# ------------------------------------------------------------------------------------------------ sources
class TakeSrc:
    def __init__(self, name: str):
        d = BUILD / "takes" / name
        self.dir = d / "frames"
        m = json.loads((d / "markers.json").read_text())
        frames = json.loads((d / "frames.json").read_text())
        t0 = m["marks"]["in"]
        self.times = [f["t"] - t0 for f in frames]
        self.files = [f["f"] for f in frames]
        self.vo = {k: v - t0 for k, v in m["vo"].items()}
        self.marks = {k: v - t0 for k, v in m["marks"].items()}

    def at(self, k: str) -> float:
        return self.vo.get(k, self.marks.get(k))

    def frame(self, s: float) -> Path:
        i = max(0, bisect.bisect_right(self.times, s) - 1)
        return self.dir / self.files[i]


class SceneSrc:
    def __init__(self, name: str):
        self.dir = BUILD / "scenes" / name
        self.t = json.loads((self.dir / "timing.json").read_text())
        self.duration = self.t["duration"]
        self.vo = self.t["vo"]

    def frame(self, s: float) -> Path:
        i = int(min(self.t["frames"] - 1, max(0, round(s * FPS))))
        return self.dir / f"f{i:06d}.{self.t['ext']}"


# ------------------------------------------------------------------------------------------------ timeline
@dataclass
class Clip:
    kind: str  # take | scene
    name: str
    src_in: float = 0.0
    src_out: float | None = None
    pieces: list[tuple[float, float, float]] | None = None  # (src_a, src_b, speed)
    trans: str = "xfade"  # how this clip enters: xfade | push (both move) | wipe (hard edge reveals it) | cut
    tdur: float = 0.4
    overlays: list[tuple[str, str, float]] = field(default_factory=list)  # (overlay scene, anchor key, offset)
    extra_vo: dict[str, float] = field(default_factory=dict)  # voice lines not in the take markers: {id: src time}
    sfx: list[tuple[str, str, float]] = field(default_factory=list)  # (sfx name, anchor key, offset)
    start: float = 0.0
    src: object = None

    def load(self):
        self.src = TakeSrc(self.name) if self.kind == "take" else SceneSrc(self.name)
        if self.src_out is None:
            self.src_out = self.src.marks["out"] if self.kind == "take" else self.src.duration
        if not self.pieces:
            self.pieces = [(self.src_in, self.src_out, 1.0)]
        return self

    @property
    def length(self) -> float:
        return sum((b - a) / s for a, b, s in self.pieces)

    def src_time(self, u: float) -> float:
        """Output-local time → source time."""
        for a, b, s in self.pieces:
            d = (b - a) / s
            if u <= d:
                return a + u * s
            u -= d
        return self.pieces[-1][1]

    def out_time(self, s: float) -> float:
        """Source time → output-local time."""
        u = 0.0
        for a, b, sp in self.pieces:
            if s <= b:
                return u + max(0.0, s - a) / sp
            u += (b - a) / sp
        return u

    def anchor(self, key: str) -> float:
        if self.kind == "take":
            if key in self.extra_vo:
                return self.extra_vo[key]
            v = self.src.at(key)
        else:
            v = self.src.vo.get(key)
        if v is None:
            raise KeyError(f"{self.name}: no anchor {key}")
        return v

    def voice(self) -> dict[str, float]:
        vo = dict(self.src.vo) if self.kind == "scene" else {**self.src.vo, **self.extra_vo}
        return {k: self.start + self.out_time(v) for k, v in vo.items() if self.src_in - 0.01 <= v <= self.src_out}


def build() -> list[Clip]:
    cmd = TakeSrc("command")
    w8end = cmd.vo["W8"] + DUR["W8"]
    def end(take: str, line: str, pad: float) -> float:
        """Cut `pad` s after the line — or after the take's last action ("done" mark), whichever is later."""
        src = TakeSrc(take)
        return max(src.vo[line] + DUR[line], src.marks.get("done", 0.0)) + pad
    clips = [
        Clip("scene", "intro", trans="cut"),  # team + problem statement, over black
        Clip("scene", "problem", trans="push", tdur=0.5, sfx=[("whoosh", "@start", -0.1)]),
        Clip("scene", "ch02", trans="push", tdur=0.5, sfx=[("whoosh", "@start", -0.1)]),
        Clip("take", "welcome", src_out=end("welcome", "G3", 0.5), trans="push", tdur=0.5, overlays=[("statement", "G3", -0.15)], sfx=[("whoosh", "@start", -0.1)]),
        Clip("scene", "ch03", trans="push", tdur=0.5, sfx=[("whoosh", "@start", -0.1)]),
        Clip("take", "innovation", trans="push", tdur=0.5, extra_vo={"I1": 0.55}, overlays=[("lt_innov", "I1", 0.35)], sfx=[("whoosh", "@start", -0.1)]),
        Clip("scene", "explain", trans="wipe", tdur=0.45),
        Clip("scene", "ch04", trans="push", tdur=0.5, sfx=[("whoosh", "@start", -0.1)]),
        Clip("take", "command", src_out=w8end + 0.55, trans="push", tdur=0.5,
             pieces=[(0, cmd.vo["W3"] + DUR["W3"] + 0.1, 1.0), (cmd.vo["W3"] + DUR["W3"] + 0.1, cmd.marks["mudAlert"] - 0.3, 3.2), (cmd.marks["mudAlert"] - 0.3, w8end + 0.55, 1.0)],
             overlays=[("lt_cc", "W1", 0.35), ("lt_alert", "mudAlert", 0.4), ("lt_sub", "W6", 1.0)],
             sfx=[("whoosh", "@start", -0.1), ("chime", "mudAlert", 0.0), ("chime", "stuckAlert", 0.0)]),
        # features: hard-edged wipes; chapters: pushes
        Clip("take", "wellintel", src_out=end("wellintel", "W9", 0.45), trans="wipe", overlays=[("lt_well", "W9", 0.25)]),
        Clip("take", "compare", src_out=end("compare", "W10", 0.45), trans="wipe", overlays=[("lt_compare", "W10", 0.25)]),
        Clip("take", "ask", src_out=end("ask", "W11", 1.5), trans="wipe", overlays=[("lt_ask", "W11", 0.25)]),
        Clip("take", "brief", src_out=end("brief", "W13", 0.6), trans="wipe", overlays=[("lt_brief", "W12", 3.2)]),
        Clip("take", "docs", src_out=TakeSrc("docs").marks["out"] - 1.0, trans="wipe", overlays=[("lt_docs", "W14", 0.3)]),
        Clip("take", "realdata", src_out=end("realdata", "W16", 1.7), trans="wipe", overlays=[("lt_real", "W15", 0.3)]),
        Clip("scene", "ch05", trans="push", tdur=0.5, sfx=[("whoosh", "@start", -0.1)]),
        Clip("scene", "impact", trans="push", tdur=0.5, sfx=[("whoosh", "@start", -0.1), ("boom", "V3", -0.12)]),
    ]
    t = 0.0
    for i, c in enumerate(clips):
        c.load()
        c.start = t if i == 0 or c.trans == "cut" else t - c.tdur
        t = c.start + c.length
    return clips


# ------------------------------------------------------------------------------------------------ plan
def plan(clips: list[Clip]) -> dict:
    total = clips[-1].start + clips[-1].length
    voice = {}
    for c in clips:
        voice.update(c.voice())
    order = [l["id"] for l in SCRIPT["lines"]]
    missing = [k for k in order if k not in voice]
    if missing:
        raise SystemExit(f"voice lines not placed: {missing}")
    overlays, sfx = [], []
    for i, c in enumerate(clips):
        for name, key, off in c.overlays:
            s = SceneSrc(name)
            overlays.append(dict(name=name, start=c.start + c.out_time(c.anchor(key)) + off, duration=s.duration, clip=s.t["clip"], owner=i))
        for name, key, off in c.sfx:
            base = c.start if key == "@start" else c.start + c.out_time(c.anchor(key))
            sfx.append(dict(name=name, t=base + off))
    sections = {}
    for k in order:
        sections.setdefault(SECTION[k], voice[k])
    chap = {c.name: c.start for c in clips if c.name.startswith("ch")}
    return dict(total=total, clips=[dict(kind=c.kind, name=c.name, start=round(c.start, 3), length=round(c.length, 3), trans=c.trans) for c in clips],
                voice={k: round(voice[k], 3) for k in order}, overlays=overlays, sfx=sfx, sections=sections, chapters=chap)


def check(p: dict) -> None:
    order = list(p["voice"])
    for a, b in zip(order, order[1:]):
        gap = p["voice"][b] - (p["voice"][a] + DUR[a])
        if gap < 0.2:
            print(f"  ! tight gap {a}→{b}: {gap:.2f}s")


# ------------------------------------------------------------------------------------------------ video
class Cache:
    def __init__(self, size: int = 12):
        self.d: dict[Path, Image.Image] = {}
        self.order: list[Path] = []
        self.size = size

    def get(self, p: Path, rgba: bool = False) -> Image.Image:
        im = self.d.get(p)
        if im is None:
            im = Image.open(p)
            im = im.convert("RGBA" if rgba else "RGB")
            if not rgba and im.size != (W, H):
                im = im.resize((W, H), Image.LANCZOS)
            self.d[p] = im
            self.order.append(p)
            if len(self.order) > self.size:
                self.d.pop(self.order.pop(0), None)
        return im


def ease(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return 4 * x * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def render_video(clips: list[Clip], p: dict, path: Path) -> None:
    total = p["total"]
    n = int(round(total * FPS))
    cache = Cache()
    ov = [dict(o, src=SceneSrc(o["name"])) for o in p["overlays"]]
    proc = subprocess.Popen(
        [FF, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", str(path)],
        stdin=subprocess.PIPE,
    )
    seam = Image.new("RGB", (10, H), (17, 17, 17))  # ink edge, as in the graphics package

    def clip_frame(i: int, T: float) -> Image.Image:
        """The clip's own frame with its overlays on it, so overlays travel with their clip through a transition."""
        c = clips[i]
        img = cache.get(c.src.frame(c.src_time(T - c.start)))
        mine = [o for o in ov if o["owner"] == i and 0 <= T - o["start"] < o["duration"]]
        if mine:
            img = img.copy()
            for o in mine:
                layer = cache.get(o["src"].frame(T - o["start"]), rgba=True)
                x, y = (o["clip"]["x"], o["clip"]["y"]) if o["clip"] else (0, 0)
                img.paste(layer, (x, y), layer)
        return img

    t_start = time.time()
    for f in range(n):
        T = f / FPS
        active = [i for i, c in enumerate(clips) if c.start - 1e-6 <= T < c.start + c.length]
        if len(active) >= 2:
            ia, ib = clip_frame(active[-2], T), clip_frame(active[-1], T)
            b = clips[active[-1]]
            k = ease((T - b.start) / b.tdur)
            if b.trans == "push":
                img = Image.new("RGB", (W, H))
                dx = int(k * W)
                img.paste(ia, (-dx, 0))
                img.paste(ib, (W - dx, 0))
                if 0 < dx < W:
                    img.paste(seam, (W - dx - 5, 0))
            elif b.trans == "wipe":
                dx = int(k * W)
                img = ia.copy()
                if dx > 0:
                    img.paste(ib.crop((W - dx, 0, W, H)), (W - dx, 0))
                    if dx < W:
                        img.paste(seam, (W - dx - 5, 0))
            else:
                img = Image.blend(ia, ib, k)
        elif active:
            img = clip_frame(active[-1], T)
        else:
            img = Image.new("RGB", (W, H), (10, 11, 17))
        if T < 0.5:  # fade in from black
            img = Image.blend(Image.new("RGB", (W, H)), img, ease(T / 0.5))
        proc.stdin.write(img.tobytes())
        if f % 300 == 0:
            el = time.time() - t_start
            print(f"  frame {f}/{n}  {el:.0f}s  ({(f + 1) / max(el, 1e-3):.1f} fps)", flush=True)
    proc.stdin.close()
    proc.wait()


# ------------------------------------------------------------------------------------------------ audio
def read_wav(p: Path) -> np.ndarray:
    with wave.open(str(p)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def sfx_whoosh(rng) -> np.ndarray:
    n = int(0.75 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    env = np.interp(t, [0, 0.42, 0.75], [0, 1, 0]) ** 2
    lo = sosfilt(butter(2, [300, 1800], "band", fs=SR, output="sos"), noise)
    hi = sosfilt(butter(2, [1800, 7000], "band", fs=SR, output="sos"), noise)
    sweep = np.clip(t / 0.5, 0, 1)
    mono = (lo * (1 - sweep) + hi * sweep) * env
    pan = np.clip(t / 0.75, 0, 1)
    return np.stack([mono * (1 - pan * 0.7), mono * (0.3 + pan * 0.7)], 1) * 0.5


def sfx_chime() -> np.ndarray:
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f, d, g in ((987.77, 0.0, 1.0), (1318.5, 0.12, 0.8)):
        tt = np.clip(t - d, 0, None)
        e = np.exp(-tt / 0.5) * (t >= d) * np.minimum(1, tt / 0.006)
        out += g * e * (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt))
    return np.stack([out, out], 1) * 0.22


def sfx_boom(rng) -> np.ndarray:
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    f = 42 + 30 * np.exp(-t / 0.08)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    air = sosfilt(butter(2, 900, "low", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / 0.35) * 0.4
    m = (body + air) * np.minimum(1, t / 0.01)
    return np.stack([m, m], 1) * 0.5


def mix_audio(p: dict, path: Path) -> None:
    total = p["total"]
    n = int(total * SR) + SR
    rng = np.random.default_rng(3)
    voice = np.zeros(n, np.float32)
    for k, t in p["voice"].items():
        v = read_wav(BUILD / "vo" / f"{k}.wav")
        i = int(t * SR)
        voice[i:i + len(v)] += v[: n - i]
    voice = sosfilt(butter(2, 85, "high", fs=SR, output="sos"), voice).astype(np.float32)
    # score, arranged to the chapters
    ch = p["chapters"]
    marks = dict(game=ch["ch02"] + 0.3, walk=ch["ch04"] + 0.4, impact=ch["ch05"] + 0.4, end=p["voice"]["V3"] - 0.1)
    m = music.score(total, marks)
    mus = np.zeros((n, 2), np.float32)
    mus[: len(m)] = m
    # ducking: music dips under the voice (fast attack, slow release)
    env = np.sqrt(np.convolve(voice ** 2, np.ones(1200) / 1200, mode="same"))
    env = np.clip(env / 0.05, 0, 1)
    sm = np.zeros_like(env)
    a_att, a_rel = np.exp(-1 / (0.05 * SR)), np.exp(-1 / (0.45 * SR))
    acc = 0.0
    for i in range(0, n, 48):  # 1 ms control rate
        x = env[i]
        acc = x + (acc - x) * (a_att ** 48 if x > acc else a_rel ** 48)
        sm[i:i + 48] = acc
    duck = 1 - 0.70 * sm
    sfx = np.zeros((n, 2), np.float32)
    lib = {"whoosh": lambda: sfx_whoosh(rng), "chime": sfx_chime, "boom": lambda: sfx_boom(rng)}
    for s in p["sfx"]:
        clip = lib[s["name"]]()
        i = max(0, int(s["t"] * SR))
        j = min(n, i + len(clip))
        sfx[i:j] += clip[: j - i]
    out = voice[:, None] * 1.0 + mus * (MUSIC_GAIN * duck)[:, None] + sfx * 0.55
    out = out[: int(total * SR)]
    tmp = path.with_suffix(".pre.wav")
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(out / (np.max(np.abs(out)) + 1e-9) * 0.89, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), str(path)], check=True)
    tmp.unlink()
    # score alone (for re-use / a human re-edit)
    with wave.open(str(OUT / "NWIS_score.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(m, -1, 1) * 32767).astype(np.int16).tobytes())


# ------------------------------------------------------------------------------------------------ captions
def caption_cues(p: dict) -> list[tuple[float, float, str]]:
    """(start, end, text) per caption; long lines are split in two, timed by the words."""
    cues = []
    for k, t0 in p["voice"].items():
        text, d = TEXT[k], DUR[k]
        parts = [text]
        if len(text) > 84:  # split long lines at a natural break, timed by the words
            cut = max((text.rfind(s, 0, len(text) // 2 + 20) for s in (" — ", ", ", ": ")), default=-1)
            if cut > 20:
                parts = [text[: cut + 1].strip(" —"), text[cut + 1:].strip(" —")]
        if len(parts) == 1:
            cues.append((t0, t0 + d, text))
        else:
            frac = len(parts[0]) / len(text)
            wl = WORDS.get(k) or []
            first_words = len(parts[0].split())
            split = wl[first_words][1] if len(wl) > first_words else d * frac
            cues.append((t0, t0 + split - 0.05, parts[0]))
            cues.append((t0 + split, t0 + d, parts[1]))
    # hold each cue 0.25 s past the voice, but never into the next one: overlapping cues make libass stack the
    # later one above the first, and it stays raised for its whole duration
    return [(a, b + 0.25 if i == len(cues) - 1 else min(b + 0.25, cues[i + 1][0] - 0.04), text) for i, (a, b, text) in enumerate(cues)]


def srt(p: dict, path: Path) -> None:
    def ts(x: float) -> str:
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    lines = []
    for i, (a, b, text) in enumerate(caption_cues(p), 1):
        lines += [str(i), f"{ts(a)} --> {ts(b)}", text, ""]
    path.write_text("\n".join(lines), encoding="utf-8")


# burned-in caption style (libass units: PlayRes 384×288, as for an SRT); "Raised" clears the lower-thirds
ASS_STYLE = "Segoe UI Semibold,17,&H00F0F1F3,&H00F0F1F3,&H10111111,&H10111111,0,0,0,0,100,100,0,0,4,0,0,2,10,10,{mv},1"


def ass(p: dict, path: Path) -> None:
    """Captions for the burned-in version: a cue that shares the screen with a lower-third sits above it."""
    def ts(x: float) -> str:
        cs = int(round(x * 100))
        return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"

    lts = [(o["start"], o["start"] + o["duration"]) for o in p["overlays"] if o["name"].startswith("lt_")]
    out = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 384", "PlayResY: 288", "WrapStyle: 0", "",
           "[V4+ Styles]",
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
           "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
           "MarginR, MarginV, Encoding",
           "Style: Default," + ASS_STYLE.format(mv=34), "Style: Raised," + ASS_STYLE.format(mv=66), "",
           "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for a, b, text in caption_cues(p):
        style = "Raised" if any(a < e and b > s for s, e in lts) else "Default"
        out.append(f"Dialogue: 0,{ts(a)},{ts(b)},{style},,0,0,0,,{text}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    clips = build()
    p = plan(clips)
    print(f"total {p['total']:.1f}s  ({int(p['total'] // 60)}:{p['total'] % 60:04.1f})")
    for c in p["clips"]:
        print(f"  {c['start']:7.2f}  {c['length']:6.2f}  {c['trans']:5}  {c['kind']:5} {c['name']}")
    print("  sections:", {k: round(v, 1) for k, v in p["sections"].items()})
    check(p)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "timeline.json").write_text(json.dumps({k: v for k, v in p.items() if k != "overlays"} | {"overlays": [{"name": o["name"], "start": round(o["start"], 2)} for o in p["overlays"]]}, indent=1))
    if "--plan" in sys.argv:
        return
    base = OUT / "NWIS_SIH26121_demo"
    t0 = time.time()
    srt(p, base.with_suffix(".srt"))
    video = base.with_name(base.name + ".video.mp4")
    if "--audio" in sys.argv:  # --audio: re-mix the soundtrack and swap it into the existing master (picture untouched)
        print("audio…")
        mix_audio(p, base.with_suffix(".wav"))
        swapped = base.with_name(base.name + ".remux.mp4")
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(base.with_suffix(".mp4")), "-i", str(base.with_suffix(".wav")), "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(swapped)], check=True)
        swapped.replace(base.with_suffix(".mp4"))
    elif "--captions" not in sys.argv:  # --captions: only re-burn the captioned copy from the existing master
        print("audio…")
        mix_audio(p, base.with_suffix(".wav"))
        print("video…")
        render_video(clips, p, video)
        print("mux…")
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(video), "-i", str(base.with_suffix(".wav")), "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                        "-shortest", "-movflags", "+faststart", str(base.with_suffix(".mp4"))], check=True)
        video.unlink()
    print("captions…")
    burn = BUILD / "captions.ass"
    ass(p, burn)
    ass_path = str(burn).replace("\\", "/").replace(":", "\\:")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(base.with_suffix(".mp4")), "-vf", f"subtitles='{ass_path}'",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart",
                    str(base.with_name(base.name + "_captioned.mp4"))], check=True)
    print(f"done in {time.time() - t0:.0f}s → {base.with_suffix('.mp4')}")


if __name__ == "__main__":
    main()
