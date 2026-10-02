#!/usr/bin/env python3
"""Spectrograms + metrics for every WAV in a folder.
   audio_analyze.py DIR [--only regex]  -> DIR/<name>.png (waveform + log-freq spectrogram), DIR/metrics.json, DIR/metrics.txt
Metrics: peak dBFS, RMS (active portion), LUFS-ish (K-weighted), attack ms (10->90% of peak envelope), time-to-peak, spectral centroid (first 100 ms),
decay times (-20 / -40 dB from peak), duration above -50 dB."""
import sys, os, re, json, glob
import numpy as np
from scipy import signal
from scipy.io import wavfile
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

def load(p):
    sr, x = wavfile.read(p)
    x = x.astype(np.float32) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim > 1: x = x.mean(axis=1)
    return sr, x

def kweight(x, sr):
    # ITU-R BS.1770 K-weighting (48k coefficients, resampled bilinear approx for other rates)
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / sr); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    y = signal.lfilter(b, a, x)
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / sr); a0 = 1 + K / Q + K * K
    b = [1, -2, 1]; a = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    return signal.lfilter(b, a, y)

def metrics(x, sr):
    m = {}
    pk = float(np.max(np.abs(x)) + 1e-12); m['peak_db'] = 20 * np.log10(pk)
    win = max(1, int(sr * 0.001)); env = np.sqrt(signal.convolve(x * x, np.ones(win) / win, mode='same') + 1e-14)
    e5 = np.sqrt(signal.convolve(x * x, np.ones(int(sr * 0.005)) / int(sr * 0.005), mode='same') + 1e-14)
    ip = int(np.argmax(env)); epk = env[ip]
    on = int(np.argmax(env > epk * 0.02)) if epk > 0 else 0          # onset (-34 dB)
    m['onset_ms'] = on / sr * 1000
    i10 = on + int(np.argmax(env[on:] > epk * 0.1)); i90 = on + int(np.argmax(env[on:] > epk * 0.9))
    m['attack_ms'] = max(0, (i90 - i10) / sr * 1000); m['t_peak_ms'] = (ip - on) / sr * 1000
    for db in (20, 40):
        thr = epk * 10 ** (-db / 20); after = e5[ip:]; idx = np.argmax(after < thr) if np.any(after < thr) else len(after)
        m[f'decay{db}_ms'] = idx / sr * 1000
    act = np.where(e5 > epk * 10 ** (-50 / 20))[0]; m['dur50_ms'] = ((act[-1] - act[0]) / sr * 1000) if len(act) else 0
    seg = x[on:on + int(sr * 0.1)]
    if len(seg) > 64:
        f, P = signal.welch(seg, sr, nperseg=min(1024, len(seg))); m['centroid_hz'] = float((f * P).sum() / (P.sum() + 1e-20))
        cs = np.cumsum(P) / (P.sum() + 1e-20); m['rolloff85_hz'] = float(f[min(len(f) - 1, np.searchsorted(cs, 0.85))])
        lo = P[f < 300].sum() / (P.sum() + 1e-20); m['low_ratio'] = float(lo); m['hi_share'] = float(P[(f >= 1000) & (f < 8000)].sum() / (P.sum() + 1e-20))
    a = act[0] if len(act) else 0; b = act[-1] + 1 if len(act) else len(x)
    rms = np.sqrt(np.mean(x[a:b] ** 2) + 1e-14); m['rms_db'] = float(20 * np.log10(rms)); m['crest_db'] = float(m['peak_db'] - m['rms_db'])
    y = kweight(x, sr); blk = int(sr * 0.4)
    if len(y) >= blk:
        ms = [np.mean(y[i:i + blk] ** 2) for i in range(0, len(y) - blk + 1, blk // 4)]; m['lufs_short_max'] = float(-0.691 + 10 * np.log10(max(ms) + 1e-14))
    m['lufs_int'] = float(-0.691 + 10 * np.log10(np.mean(y[a:b] ** 2) + 1e-14)); m['dur_s'] = len(x) / sr
    return {k: (round(float(v), 2)) for k, v in m.items()}

def plot(x, sr, path, title, m=None, tmax=None):
    fig, ax = plt.subplots(2, 1, figsize=(9, 4.2), gridspec_kw={'height_ratios': [1, 2.4]}, sharex=True)
    t = np.arange(len(x)) / sr; ax[0].plot(t, x, lw=0.4, color='#1f77b4'); ax[0].set_ylim(-1, 1); ax[0].set_ylabel('amp'); ax[0].set_title(title + ('   ' + ' '.join(f'{k}={v}' for k, v in m.items() if k in ('peak_db','rms_db','attack_ms','decay20_ms','centroid_hz','lufs_short_max')) if m else ''), fontsize=7)
    nper = 1024 if sr >= 32000 else 512
    f, tt, S = signal.spectrogram(x, sr, nperseg=nper, noverlap=nper * 7 // 8, window='hann')
    S = 10 * np.log10(S + 1e-14) + 10 * np.log10(nper / 2)   # rough dBFS scale
    ax[1].pcolormesh(tt, f, S, shading='auto', cmap='magma', vmin=-110, vmax=-20); ax[1].set_yscale('symlog', linthresh=500); ax[1].set_ylim(60, min(20000, sr / 2))
    ax[1].set_yticks([100, 500, 1000, 2000, 5000, 10000, 20000]); ax[1].set_yticklabels(['100', '500', '1k', '2k', '5k', '10k', '20k']); ax[1].set_xlabel('s'); ax[1].set_ylabel('Hz')
    if tmax: ax[1].set_xlim(0, tmax)
    fig.tight_layout(); fig.savefig(path, dpi=80); plt.close(fig)

def main():
    d = sys.argv[1]; only = re.compile(sys.argv[sys.argv.index('--only') + 1]) if '--only' in sys.argv else None
    res = {}; jp = os.path.join(d, 'metrics.json')
    if os.path.exists(jp) and only: res = json.load(open(jp))
    for p in sorted(glob.glob(os.path.join(d, '*.wav'))):
        name = os.path.basename(p)[:-4]
        if only and not only.search(name): continue
        sr, x = load(p); m = metrics(x, sr); res[name] = m
        plot(x, sr, os.path.join(d, name + '.png'), name, m, tmax=(len(x) / sr if name.startswith('music') else min(len(x) / sr, 2.5)))
    json.dump(res, open(jp, 'w'), indent=1)
    cols = ['peak_db', 'rms_db', 'lufs_short_max', 'attack_ms', 'decay20_ms', 'dur50_ms', 'centroid_hz', 'rolloff85_hz', 'low_ratio', 'hi_share', 'crest_db']
    lines = ['%-34s' % 'name' + ''.join('%14s' % c for c in cols)]
    for n, m in sorted(res.items()): lines.append('%-34s' % n + ''.join('%14s' % m.get(c, '') for c in cols))
    open(os.path.join(d, 'metrics.txt'), 'w').write('\n'.join(lines))
    print('\n'.join(lines[:1] + [l for l in lines[1:] if not only or only.search(l.split()[0])][:80]))
if __name__ == '__main__': main()
