#!/usr/bin/env bash
# Re-downloads real Counter-Strike 2 reference imagery/footage from Steam (screenshots + trailer frames).
set -e; cd "$(dirname "$0")/.."; mkdir -p reference/cs2/video reference/cs2/frames
python3 -m pip -q install imageio-ffmpeg pillow >/dev/null 2>&1 || true
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
curl -s "https://store.steampowered.com/api/appdetails?appids=730" | python3 -c "
import json,sys
d=json.load(sys.stdin)['730']['data']
for i,s in enumerate(d['screenshots']): print('SS',i,s['path_full'])
for m in d.get('movies',[]): print('MV',m['hls_h264'])" > /tmp/refs.txt
grep '^SS' /tmp/refs.txt | while read _ i u; do [ -f reference/cs2/ss_$i.jpg ] || curl -s -o reference/cs2/ss_$i.jpg "$u"; done
i=0; grep '^MV' /tmp/refs.txt | while read _ u; do i=$((i+1)); [ -f reference/cs2/video/trailer_$i.mp4 ] || python3 tools/fetch_hls.py "$u" reference/cs2/video/trailer_$i.mp4 || true; [ -f reference/cs2/video/trailer_$i.mp4 ] && "$FF" -loglevel error -y -i reference/cs2/video/trailer_$i.mp4 -vf "fps=1/2,scale=1280:-1" -q:v 3 reference/cs2/frames/t${i}_%03d.jpg || true; done
echo done
