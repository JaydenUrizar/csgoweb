#!/usr/bin/env python3
"""Render shots/move/move_test.json (from tools/move_test.mjs) to shots/move/charts.png.  python3 tools/move_plot.py [json] [png]"""
import json, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
src = sys.argv[1] if len(sys.argv) > 1 else 'shots/move/move_test.json'
out = sys.argv[2] if len(sys.argv) > 2 else 'shots/move/charts.png'
d = json.load(open(src)); ch = d['charts']; run = d['tune']['runSpeed']
keys = [k for k in ch]
cols = 3; rows = (len(keys) + cols - 1) // cols
fig, axs = plt.subplots(rows, cols, figsize=(6 * cols, 3.1 * rows))
axs = axs.flatten() if hasattr(axs, 'flatten') else [axs]
for ax, k in zip(axs, keys):
    c = ch[k]
    for name, pts in c['series'].items():
        if not pts: continue
        ax.plot([p[0] for p in pts], [p[1] for p in pts], label=name, lw=1.3)
    ax.set_title(c['title'], fontsize=10); ax.grid(alpha=.3); ax.legend(fontsize=7)
    if 'speed' in c['series'] or k.startswith('bhop'): ax.axhline(run, color='gray', ls='--', lw=.7)
for ax in axs[len(keys):]: ax.axis('off')
plt.tight_layout(); plt.savefig(out, dpi=70); print('wrote', out)
