#!/usr/bin/env python3
"""Download the AUDIO track of the real CS2 Steam trailers (the reference/cs2/video/*.mp4 files are video-only) and decode to 48 kHz mono WAV.
   audio_ref_fetch.py            -> shots/audio/ref/trailer_N.wav (N=1..4)"""
import re, os, sys, json, subprocess, urllib.request, urllib.parse
OUT = 'shots/audio/ref'; os.makedirs(OUT, exist_ok=True)
get = lambda u: urllib.request.urlopen(u, timeout=60).read()
import imageio_ffmpeg; FF = imageio_ffmpeg.get_ffmpeg_exe()
d = json.loads(get('https://store.steampowered.com/api/appdetails?appids=730'))['730']['data']
for i, mv in enumerate(d.get('movies', []), 1):
    wav = f'{OUT}/trailer_{i}.wav'
    if os.path.exists(wav): continue
    m = mv['hls_h264']; master = get(m).decode()
    au = re.search(r'TYPE=AUDIO.*?URI="([^"]+)"', master).group(1); aurl = urllib.parse.urljoin(m, au)
    pl = get(aurl).decode(); init = re.search(r'#EXT-X-MAP:URI="([^"]+)"', pl)
    raw = f'{OUT}/trailer_{i}.m4a'
    with open(raw, 'wb') as f:
        if init: f.write(get(urllib.parse.urljoin(aurl, init.group(1))))
        for l in pl.splitlines():
            if l and not l.startswith('#'): f.write(get(urllib.parse.urljoin(aurl, l)))
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', raw, '-ac', '1', '-ar', '48000', wav], check=True); os.remove(raw)
    print(wav, os.path.getsize(wav))
