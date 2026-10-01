#!/usr/bin/env python3
"""Real-CS2 audio reference helper (trailer audio via tools/audio_ref_fetch.py).
  audio_ref.py scan N [--top 24] [--band 1500 9000]   -> shots/audio/ref/scan_N.png : contact sheet of the strongest broadband transients
                                                          (video frame at onset + 0.7 s spectrogram) and scan_N.json with times/metrics
  audio_ref.py cut N T0 DUR NAME                        -> shots/audio/ref/NAME.wav + NAME.png (+ frame) ; use to save a chosen gunshot/footstep/UI segment
  audio_ref.py compare OURS.wav REF.wav [OUT.png]       -> side-by-side spectrograms + metric table (LUFS-ish, attack, decay, centroid)"""
import sys, os, json, subprocess, glob
import numpy as np
from scipy import signal
from scipy.io import wavfile
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
sys.path.insert(0, os.path.dirname(__file__)); import audio_analyze as A
REF = 'shots/audio/ref'
import imageio_ffmpeg; FF = imageio_ffmpeg.get_ffmpeg_exe()

def frame(n, t, out):
    subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', f'reference/cs2/video/trailer_{n}.mp4', '-frames:v', '1', '-vf', 'scale=480:-1', out], check=False)

def onsets(x, sr, band=(1500, 9000), top=24, min_gap=0.4):
    sos = signal.butter(4, band, 'bandpass', fs=sr, output='sos'); y = signal.sosfilt(sos, x)
    hop = int(sr * 0.002); env = np.sqrt(np.convolve(y * y, np.ones(hop) / hop, mode='same') + 1e-14)[::hop]
    # local contrast: transient rises 12+ dB above the preceding 60 ms
    db = 20 * np.log10(env + 1e-9); out = []
    pre = 30
    for i in range(pre, len(db) - 10):
        base = np.median(db[i - pre:i - 3]);
        if db[i] - base > 14 and db[i] == db[max(0, i - 6):i + 6].max(): out.append((i * hop / sr, db[i], db[i] - base))
    out.sort(key=lambda o: -o[2]); sel = []
    for t, lv, c in out:
        if all(abs(t - s[0]) > min_gap for s in sel): sel.append((t, lv, c))
        if len(sel) >= top: break
    return sorted(sel)

def scan(n, top=24, band=(1500, 9000)):
    sr, x = A.load(f'{REF}/trailer_{n}.wav'); ons = onsets(x, sr, band, top)
    cols = 4; rows = (len(ons) + cols - 1) // cols
    fig, axs = plt.subplots(rows * 2, cols, figsize=(4.2 * cols, 3.6 * rows), squeeze=False)
    meta = []
    for k, (t, lv, c) in enumerate(ons):
        r, cc = (k // cols) * 2, k % cols; fp = f'{REF}/_f{n}_{k}.jpg'; frame(n, t, fp)
        try: axs[r][cc].imshow(plt.imread(fp))
        except Exception: pass
        axs[r][cc].axis('off'); axs[r][cc].set_title(f'#{k} t={t:.2f}s contrast={c:.0f}dB', fontsize=8)
        seg = x[max(0, int((t - 0.05) * sr)):int((t + 0.65) * sr)]
        f, tt, S = signal.spectrogram(seg, sr, nperseg=512, noverlap=448); S = 10 * np.log10(S + 1e-14) + 27
        axs[r + 1][cc].pcolormesh(tt, f, S, shading='auto', cmap='magma', vmin=-110, vmax=-20); axs[r + 1][cc].set_yscale('symlog', linthresh=500); axs[r + 1][cc].set_ylim(60, 16000); axs[r + 1][cc].tick_params(labelsize=6)
        meta.append({'k': k, 't': round(float(t), 3), 'contrast_db': round(float(c), 1)})
        os.remove(fp) if os.path.exists(fp) else None
    for ax in axs.flat: 
        if not ax.has_data() and not ax.images: ax.axis('off')
    fig.tight_layout(); fig.savefig(f'{REF}/scan_{n}.png', dpi=70); json.dump(meta, open(f'{REF}/scan_{n}.json', 'w'), indent=1); print('saved', f'{REF}/scan_{n}.png', len(ons))

def cut(n, t0, dur, name):
    sr, x = A.load(f'{REF}/trailer_{n}.wav'); seg = x[int(t0 * sr):int((t0 + dur) * sr)]
    wavfile.write(f'{REF}/{name}.wav', sr, (np.clip(seg, -1, 1) * 32767).astype(np.int16)); m = A.metrics(seg, sr)
    A.plot(seg, sr, f'{REF}/{name}.png', name, m); frame(n, t0 + 0.02, f'{REF}/{name}.jpg'); print(name, m)

def compare(ours, ref, out=None):
    (s1, a), (s2, b) = A.load(ours), A.load(ref); ma, mb = A.metrics(a, s1), A.metrics(b, s2)
    fig, axs = plt.subplots(2, 2, figsize=(12, 6), gridspec_kw={'height_ratios': [1, 2.2]})
    tmax = min(2.0, max(len(a) / s1, len(b) / s2))
    for j, (x, sr, m, nm) in enumerate([(a, s1, ma, 'OURS ' + os.path.basename(ours)), (b, s2, mb, 'REAL ' + os.path.basename(ref))]):
        t = np.arange(len(x)) / sr; axs[0][j].plot(t, x, lw=0.4); axs[0][j].set_ylim(-1, 1); axs[0][j].set_xlim(0, tmax); axs[0][j].set_title(nm, fontsize=8)
        f, tt, S = signal.spectrogram(x, sr, nperseg=1024, noverlap=896); S = 10 * np.log10(S + 1e-14) + 27
        axs[1][j].pcolormesh(tt, f, S, shading='auto', cmap='magma', vmin=-110, vmax=-20); axs[1][j].set_yscale('symlog', linthresh=500); axs[1][j].set_ylim(60, 20000); axs[1][j].set_xlim(0, tmax)
    fig.tight_layout(); fig.savefig(out or 'shots/audio/compare.png', dpi=75)
    keys = ['peak_db', 'rms_db', 'lufs_short_max', 'attack_ms', 'decay20_ms', 'dur50_ms', 'centroid_hz', 'rolloff85_hz', 'low_ratio']
    print('%-16s %12s %12s' % ('metric', 'ours', 'real'));
    for k in keys: print('%-16s %12s %12s' % (k, ma.get(k), mb.get(k)))

if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'scan':
        top = int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 24
        band = tuple(map(float, sys.argv[sys.argv.index('--band') + 1:sys.argv.index('--band') + 3])) if '--band' in sys.argv else (1500, 9000)
        scan(int(sys.argv[2]), top, band)
    elif c == 'cut': cut(int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5])
    elif c == 'compare': compare(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
