"""Mix voiceover + synthesized calm music bed + SFX for the v2 (brand-aligned) reel."""
import numpy as np, soundfile as sf
from scipy.signal import resample_poly, lfilter

SR = 48000
DUR = 33.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
TTS_DIR = "tts"  # v2_0.wav ... v2_8.wav from tts_gen.py


def t_(d):
    return np.arange(int(SR * d)) / SR


def place(buf, x, at, g=1.0):
    i = int(at * SR)
    x = x[: max(0, len(buf) - i)]
    buf[i : i + len(x)] += g * x


def lp(x, a):  # one-pole lowpass
    return lfilter([a], [1, a - 1], x)


# ---------- voiceover
VO_STARTS = [0.35, 1.5, 4.1, 9.5, 13.1, 18.5, 23.1, 26.6, 28.8]
vo = np.zeros(N)
for i, st in enumerate(VO_STARTS):
    x, sr = sf.read(f"{TTS_DIR}/v2_{i}.wav")
    if sr != SR:
        x = resample_poly(x, SR, sr)
    place(vo, x / (np.abs(x).max() + 1e-9) * 0.8, st)

# ---------- calm music bed (84 bpm, soft keys + light pulse)
bpm = 84
beat = 60 / bpm
mus = np.zeros(N)


def keys(f, d):
    t = t_(d)
    env = np.exp(-t * 1.4) * (1 - np.exp(-t * 60))
    return env * (
        np.sin(2 * np.pi * f * t)
        + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)
        + 0.08 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 7)
    )


def pad(f, d):
    t = t_(d)
    env = np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 0.8)
    return env * (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t))


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]]  # Am7 Fmaj7 Cmaj7 G7
bar = 4 * beat
t0, b = 0.0, 0
while t0 < DUR:
    ch = chords[b % 4]
    for n in ch:
        place(mus, pad(midi(n), bar), t0, 0.035)
    for k, n in enumerate(ch):  # gentle arpeggio
        place(mus, keys(midi(n + 12), bar * 0.6), t0 + k * beat, 0.05)
    place(mus, keys(midi(ch[0] - 12), bar), t0, 0.10)
    t0 += bar
    b += 1


def kick():
    t = t_(0.3)
    f = 48 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10)


def hat():
    t = t_(0.05)
    n = rng.standard_normal(len(t))
    return (n - lp(n, 0.35)) * np.exp(-t * 70)


k, h = kick(), hat()
t0, i = 0.0, 0
while t0 < DUR:
    place(mus, h, t0, 0.025 if i % 2 else 0.035)
    if 13.0 <= t0 < 28.6 and i % 4 == 0:  # soft pulse after the reveal
        place(mus, k, t0, 0.35)
    t0 += beat / 2
    i += 1
mus = lp(mus, 0.22)
env = np.ones(N)
env[: int(SR * 0.4)] = np.linspace(0, 1, int(SR * 0.4))
env[-int(SR * 1.5) :] = np.linspace(1, 0, int(SR * 1.5))
mus *= env
# duck under VO
win = int(SR * 0.12)
ve = np.convolve(np.abs(vo), np.ones(win) / win, "same")
mus *= lp(1 - 0.5 * np.clip(ve * 12, 0, 1), 0.0005)

# ---------- sfx
sfx = np.zeros(N)


def pop(f=880):
    t = t_(0.18)
    return np.sin(2 * np.pi * (f + 400 * np.exp(-t * 40)) * t) * np.exp(-t * 28)


def whoosh(d=1.6):
    t = t_(d)
    n = rng.standard_normal(len(t))
    return (lp(n, 0.08) - lp(n, 0.01)) * np.sin(np.pi * t / d) ** 2 * 1.5


def buzz(d=0.8):
    t = t_(d)
    return np.sign(np.sin(2 * np.pi * 150 * t)) * 0.3 * (np.sin(2 * np.pi * 12 * t) > 0) * np.exp(-t * 1.2)


def chime():
    t = t_(0.9)
    return (np.sin(2 * np.pi * 1318 * t) + 0.6 * np.sin(2 * np.pi * 1975 * t)) * np.exp(-t * 5) * 0.5


def tick():
    t = t_(0.07)
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 80)


def tap():
    t = t_(0.05)
    return lp(rng.standard_normal(len(t)), 0.3) * np.exp(-t * 90)


place(sfx, pop(700), 0.05, 0.3)
place(sfx, whoosh(1.9), 2.0, 0.3)
for j in range(10):
    place(sfx, pop(600 + j * 60), 4.15 + j * 0.2, 0.15)
place(sfx, buzz(), 7.0, 0.25)
for j in range(3):
    place(sfx, tick(), 9.6 + j * 0.75 + 0.72, 0.22)
place(sfx, whoosh(0.7), 12.8, 0.25)
place(sfx, chime(), 13.3, 0.25)  # logo
place(sfx, pop(500), 14.7, 0.2)  # task app chip
place(sfx, pop(900), 15.9, 0.2)  # AI project manager chip
place(sfx, chime(), 18.9, 0.25)  # captured
place(sfx, pop(800), 23.35, 0.2)  # DM
place(sfx, tap(), 24.55, 0.5)
place(sfx, pop(1000), 24.9, 0.25)  # reply
for j in range(3):
    place(sfx, tick(), 26.75 + j * 0.5, 0.35)
place(sfx, whoosh(0.8), 28.3, 0.25)
place(sfx, chime(), 28.75, 0.22)

mix = vo + mus * 0.9 + sfx * 0.8
mix /= np.abs(mix).max() / 0.89
sf.write("mix.wav", np.stack([mix, mix], 1), SR)
print("ok")
