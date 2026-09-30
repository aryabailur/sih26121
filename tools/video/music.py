"""Original background score, synthesised in numpy — no samples, no licensing questions.

D minor, 92 BPM, two-bar chords. The arrangement follows the video's chapters:
problem (dark pad) → game-changer (the progression lifts, plucked arpeggio enters) → walkthrough (soft pulse) →
impact (brighter voicing, fuller pulse) → end card (final chord rings out).
"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
BPM = 92
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORD = 2 * BAR

NOTE = {n: i for i, n in enumerate("C C# D D# E F F# G G# A A# B".split())}
NOTE.update({"Db": 1, "Eb": 3, "Gb": 6, "Ab": 8, "Bb": 10})


def hz(name: str, octave: int) -> float:
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)


# chord = (root, [voicing notes (name, octave)])
CH = {
    "Dm": ("D", [("D", 3), ("A", 3), ("D", 4), ("F", 4), ("A", 4)]),
    "Bb": ("Bb", [("Bb", 2), ("F", 3), ("Bb", 3), ("D", 4), ("F", 4)]),
    "Gm": ("G", [("G", 2), ("D", 3), ("G", 3), ("Bb", 3), ("D", 4)]),
    "A": ("A", [("A", 2), ("E", 3), ("A", 3), ("C#", 4), ("E", 4)]),
    "F": ("F", [("F", 2), ("C", 3), ("F", 3), ("A", 3), ("C", 4)]),
    "C": ("C", [("C", 3), ("G", 3), ("C", 4), ("E", 4), ("G", 4)]),
    "Dm9": ("D", [("D", 3), ("A", 3), ("E", 4), ("F", 4), ("A", 4), ("C", 5)]),
    "Bbmaj7": ("Bb", [("Bb", 2), ("F", 3), ("A", 3), ("D", 4), ("F", 4)]),
    "Fadd9": ("F", [("F", 2), ("C", 3), ("G", 3), ("A", 3), ("C", 4), ("F", 4)]),
    "Csus": ("C", [("C", 3), ("G", 3), ("D", 4), ("F", 4), ("G", 4)]),
}
PROG = {
    "dark": ["Dm", "Bb", "Gm", "A"],
    "lift": ["Dm", "Bb", "F", "C"],
    "bright": ["Dm9", "Bbmaj7", "Fadd9", "Csus"],
}


def _lp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def _hp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def _saw(f: float, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    return 2 * ((t * f + phase) % 1.0) - 1


def _env(n: int, a: float, r: float) -> np.ndarray:
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 1.6
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.4
    return e


def _pluck(f: float, dur: float = 0.9) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.exp(-t / 0.22) * np.minimum(1, t / 0.004)
    return env * (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t))


def _kick() -> np.ndarray:
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) * np.minimum(1, t / 0.002)


def _hat(rng: np.random.Generator) -> np.ndarray:
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return _hp(rng.standard_normal(n), 7000) * np.exp(-t / 0.018)


def score(total: float, marks: dict[str, float], seed: int = 7) -> np.ndarray:
    """Stereo float32 (n, 2). `marks`: game (lift + arp), walk (pulse), impact (bright), end (final chord)."""
    rng = np.random.default_rng(seed)
    n = int((total + 4) * SR)
    pad = np.zeros((n, 2))
    sub = np.zeros(n)
    arp = np.zeros((n, 2))
    drums = np.zeros(n)
    game, walk, imp, end = marks["game"], marks["walk"], marks["impact"], marks["end"]

    def section(t: float) -> str:
        return "bright" if t >= imp else "lift" if t >= game - 0.2 else "dark"

    # ---- pad + sub on a two-bar chord grid; the final chord starts at `end` and rings out
    starts = list(np.arange(0, end, CHORD)) + [end]
    for k, t0 in enumerate(starts):
        final = k == len(starts) - 1
        name = "Fadd9" if final else PROG[section(t0)][k % 4]
        root, notes = CH[name]
        length = (total + 3.5 - t0) if final else (min(starts[k + 1], end) - t0 + 1.8)
        m = int(length * SR)
        i0 = int(t0 * SR)
        m = min(m, n - i0)
        env = _env(m, 1.1 if k else 2.5, 1.8 if not final else min(3.5, length * 0.6))
        for j, (nn, octv) in enumerate(notes):
            f = hz(nn, octv)
            for side, det in ((0, -0.0045), (1, 0.0045)):
                v = _saw(f * (1 + det), m, phase=(j * 0.13 + side * 0.37))
                v += 0.6 * _saw(f * (1 - det * 0.5), m, phase=(j * 0.29 + side * 0.11))
                pad[i0:i0 + m, side] += v * env * (0.9 if octv >= 4 else 1.0)
        f0 = hz(root, 1)
        tt = np.arange(m) / SR
        sub[i0:i0 + m] += np.sin(2 * np.pi * f0 * tt) * env

    # brightness: dark → lift → bright via a crossfade of two filtered versions
    t = np.arange(n) / SR
    dark = np.stack([_lp(pad[:, c], 750, 3) for c in range(2)], 1)
    brt = np.stack([_lp(pad[:, c], 2300, 3) for c in range(2)], 1)
    mix = np.clip((t - (game - 1.0)) / 3.0, 0, 1)
    mix = np.maximum(mix, np.clip((t - imp) / 2.0, 0, 1) * 1.0)
    pad = dark * (1 - mix)[:, None] + brt * mix[:, None]

    # ---- arpeggio from the game-changer onward
    step = BEAT / 2
    pattern = [0, 2, 3, 4, 3, 2, 1, 2]
    k = 0
    tt = game
    while tt < end + BAR:
        ci = int(tt // CHORD)
        root, notes = CH[PROG[section(tt)][ci % 4]]
        tones = [hz(nn, o + 1) for nn, o in notes[1:]]
        f = tones[pattern[k % 8] % len(tones)]
        p = _pluck(f)
        i0 = int(tt * SR)
        m = min(len(p), n - i0)
        pan = 0.5 + (0.28 if k % 2 else -0.28)
        g = 0.55 if tt < walk else 0.7
        if tt > end:
            g *= max(0.0, 1 - (tt - end) / BAR)
        arp[i0:i0 + m, 0] += p[:m] * (1 - pan) * g
        arp[i0:i0 + m, 1] += p[:m] * pan * g
        k += 1
        tt += step

    # ---- soft pulse in the walkthrough and impact
    kick, tb = _kick(), walk
    while tb < end:
        beat = int(round((tb - walk) / BEAT))
        if beat % 2 == 0 or tb >= imp:
            i0 = int(tb * SR)
            m = min(len(kick), n - i0)
            drums[i0:i0 + m] += kick[:m] * (0.75 if beat % 4 == 0 else 0.5)
        th = tb + BEAT / 2
        h = _hat(rng)
        i1 = int(th * SR)
        m = min(len(h), n - i1)
        drums[i1:i1 + m] += h[:m] * 0.22
        tb += BEAT

    # ---- reverb on pad + arp
    ir_n = int(2.4 * SR)
    irt = np.arange(ir_n) / SR
    ir = _lp(rng.standard_normal(ir_n), 4500) * np.exp(-irt / 0.55)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet_src = pad * 0.35 + arp
    wet = np.stack([fftconvolve(wet_src[:, c], ir)[:n] for c in range(2)], 1)

    out = pad * 0.5 + arp * 0.42 + wet * 0.38
    out += (_lp(sub, 180) * 0.55)[:, None]
    out += drums[:, None] * 0.55
    # gentle overall shape: fade in, and fade the tail after the end card
    shape = np.clip(t / 2.5, 0, 1) * np.clip((total + 0.2 - t) / 3.2, 0, 1)
    out *= shape[:, None]
    out = out[: int(total * SR)]
    out /= np.max(np.abs(out)) + 1e-9
    return (out * 0.5).astype(np.float32)
