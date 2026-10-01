#!/usr/bin/env python3
"""plot_spray.py spray.json outdir — spray-pattern point clouds (from tools/combat_test.mjs) as PNG.
One image per tagger (stand / crouch / run / jump panels, points coloured by shot index, mean path + fixed recoil pattern drawn),
plus spray_all.png contact sheet. Axes are degrees off the aim point at the test distance; the dashed circle is a head at that range."""
import json, math, sys, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

src, out = sys.argv[1], sys.argv[2]
data = json.load(open(src))
files = []
STANCES = [('stand', 'standing'), ('crouch', 'crouched'), ('run', 'running (full speed)'), ('jump', 'jumping')]
for id, d in data.items():
    fig, axs = plt.subplots(1, 4, figsize=(17, 5.2), facecolor='#101418')
    dist = d['dist']; head = math.degrees(math.atan(0.17 / dist))
    allp = [p for st in d['stances'].values() for t in st for p in t]
    n = max(p[2] for p in allp) + 1 if allp else 30
    for ax, (key, label) in zip(axs, STANCES):
        ax.set_facecolor('#181e25'); trials = d['stances'][key]
        xs = [p[0] for t in trials for p in t]; ys = [p[1] for t in trials for p in t]; cs = [p[2] for t in trials for p in t]
        sc = ax.scatter(xs, ys, c=cs, cmap='turbo', s=9, alpha=0.75, vmin=0, vmax=max(cs) if cs else 1, linewidths=0)
        if key == 'stand' or key == 'crouch':
            ml = []
            for k in range(min(len(t) for t in trials)):
                ml.append((sum(t[k][0] for t in trials) / len(trials), sum(t[k][1] for t in trials) / len(trials)))
            ax.plot([m[0] for m in ml], [m[1] for m in ml], color='white', lw=1.0, alpha=0.9)
        pat = d['pattern']; ax.plot([p[0] for p in pat], [p[1] for p in pat], color='#ffd23f', lw=1.4, ls=':', label='fixed recoil pattern')
        ax.add_patch(plt.Circle((0, 0), head, fill=False, ec='#8899aa', ls='--', lw=1))
        ax.axhline(0, color='#334', lw=0.6); ax.axvline(0, color='#334', lw=0.6)
        ax.set_aspect('equal', adjustable='datalim'); ax.set_title(label, color='w', fontsize=11)
        ax.tick_params(colors='#9ab'); [s.set_color('#456') for s in ax.spines.values()]
        ax.set_xlabel('yaw (deg, + right)', color='#9ab'); ax.set_ylabel('pitch (deg, + up)', color='#9ab')
    fig.suptitle(f"{d['name']} ({d['cs']})  — spray at {dist:.0f} m, {len(d['stances']['stand'])} trials/panel; white = mean, yellow dotted = recoil pattern, dashed circle = head", color='w', fontsize=12)
    axs[-1].legend(loc='lower right', facecolor='#181e25', edgecolor='#456', labelcolor='w', fontsize=8)
    f = os.path.join(out, f'spray_{id}.png'); fig.tight_layout(rect=(0, 0, 1, 0.94)); fig.savefig(f, dpi=70, facecolor=fig.get_facecolor()); plt.close(fig); files.append(f)

# contact sheet: standing panel of every tagger
ids = list(data.keys()); cols = 4; rows = (len(ids) + cols - 1) // cols
fig, axs = plt.subplots(rows, cols, figsize=(cols * 4.4, rows * 4.4), facecolor='#101418')
for ax in axs.flat: ax.axis('off')
for ax, id in zip(axs.flat, ids):
    d = data[id]; ax.axis('on'); ax.set_facecolor('#181e25'); trials = d['stances']['stand']
    ax.scatter([p[0] for t in trials for p in t], [p[1] for t in trials for p in t], c=[p[2] for t in trials for p in t], cmap='turbo', s=6, alpha=0.7, linewidths=0)
    pat = d['pattern']; ax.plot([p[0] for p in pat], [p[1] for p in pat], color='#ffd23f', lw=1.2, ls=':')
    ax.set_aspect('equal', adjustable='datalim'); ax.set_title(f"{d['name']}  ({d['cs']})", color='w', fontsize=10); ax.tick_params(colors='#9ab', labelsize=7)
    [s.set_color('#456') for s in ax.spines.values()]
fig.suptitle('Tagger spray patterns (standing, uncompensated)', color='w'); fig.tight_layout(rect=(0, 0, 1, 0.96))
f = os.path.join(out, 'spray_all.png'); fig.savefig(f, dpi=60, facecolor=fig.get_facecolor()); plt.close(fig); files.append(f)
print('wrote', len(files), 'PNGs')
