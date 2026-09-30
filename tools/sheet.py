#!/usr/bin/env python3
"""Contact sheet / side-by-side / blind compare helper (PIL).
  sheet.py grid out.png a.png b.png c.png ...            -> tiled grid (motion strips, multiple angles)
  sheet.py blind out.png ours.png ref.png [--key key.json] -> A|B composite in random order; writes the answer key to key.json (do NOT read the key until you have picked)
"""
import sys, json, random
from PIL import Image
def load(p, w):
    im = Image.open(p).convert('RGB'); h = round(im.height * w / im.width); return im.resize((w, h), Image.LANCZOS)
def main():
    cmd, out, *rest = sys.argv[1:]
    if cmd == 'grid':
        w = 640; ims = [load(p, w) for p in rest]; cols = 2 if len(ims) <= 4 else 3
        rows = (len(ims) + cols - 1) // cols; h = max(i.height for i in ims)
        sheet = Image.new('RGB', (cols * w, rows * h), (0, 0, 0))
        for k, im in enumerate(ims): sheet.paste(im, ((k % cols) * w, (k // cols) * h))
        sheet.save(out)
    elif cmd == 'blind':
        key = 'shots/blind_key.json'
        if '--key' in rest: key = rest[rest.index('--key') + 1]; rest = [r for r in rest if r not in ('--key', key)]
        ours, ref = rest[:2]; order = ['ours', 'ref']; random.shuffle(order)
        m = {'ours': ours, 'ref': ref}; w = 960
        a, b = load(m[order[0]], w), load(m[order[1]], w); h = max(a.height, b.height)
        sheet = Image.new('RGB', (w * 2 + 8, h), (255, 255, 255)); sheet.paste(a, (0, 0)); sheet.paste(b, (w + 8, 0)); sheet.save(out)
        json.dump({'A': order[0], 'B': order[1]}, open(key, 'w'))
        print('wrote', out, '(A left, B right). Key stored in', key)
main()
