// Contact sheets of every tagger x animation through the real render pipeline (?scene=viewmodel-gallery).
//   node tools/viewmodel_sheet.mjs [--taggers arc,pip|all] [--anims draw,fire,reload,inspect|all] [--frames 6] [--out shots/viewmodel/sheets]
//        [--size 960x540] [--bg mid|sand|light|dark] [--skin 0] [--full] [--cols 3]
// One PNG per tagger x anim (frames tiled left->right, top->bottom) + one overview per tagger. Crops to the viewmodel region unless --full.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { open } from './lib.mjs';
const A = process.argv.slice(2); const opt = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? A[i + 1] : d; }; const flag = (k) => A.includes('--' + k);
const [W, H] = opt('size', '960x540').split('x').map(Number); const out = opt('out', 'shots/viewmodel/sheets'); const frames = +opt('frames', 6); const cols = +opt('cols', 3);
const DUR = { idle: 1.2, draw: 0.7, holster: 0.2, fire: 0.45, burst: 0.7, reload: 2.4, inspect: 3.4, empty: 0.3, melee: 1.0, throw: 2.4, plant: 2.8, scope: 1.4, walk: 1.2, run: 1.0, sprint: 1.0, jump: 0.9, look: 1.2 };
const g = await open({ params: `test=1&seed=1&scene=viewmodel-gallery&bg=${opt('bg', 'mid')}`, size: [W, H], wait: 400000 });
await g.eval(async () => { const m = await import('/src/combat/viewmodel/index.js'); const ctx = window.__game.ctx; const vm = m.createViewmodel(ctx); await ctx.debugScenes['viewmodel-gallery'](ctx); window.__game.ctx.localActor.pitch = 0; });
const info = await g.eval(() => ({ ids: window.__vmGallery.list, cls: Object.fromEntries(window.__vmGallery.list.map((id) => [id, null])) }));
let ids = opt('taggers', 'all') === 'all' ? info.ids : opt('taggers').split(',');
const clsOf = {};
for (const id of ids) clsOf[id] = await g.eval((id) => { window.__vmGallery.show(id); return window.__vmGallery.vm.debug.model().meta.cls; }, id);
const defaultAnims = (id) => { const c = clsOf[id]; const base = ['draw', 'fire', 'reload', 'inspect', 'empty', 'sprint']; if (c === 'melee') return ['draw', 'melee', 'inspect', 'sprint']; if (c === 'grenade') return ['draw', 'throw', 'inspect', 'sprint']; if (c === 'gear') return ['draw', 'plant', 'inspect', 'sprint']; if (c === 'sniper' || id === 'halo') return [...base, 'scope']; return base; };
fs.mkdirSync(out, { recursive: true });
const clip = flag('full') ? undefined : { x: Math.round(W * 0.28), y: Math.round(H * 0.22), width: Math.round(W * 0.72), height: Math.round(H * 0.78) };
const STEP = 1 / 30;
for (const id of ids) {
  const anims = opt('anims', 'default') === 'default' ? defaultAnims(id) : opt('anims') === 'all' ? Object.keys(DUR) : opt('anims').split(',');
  const sheets = [];
  for (const an of anims) {
    await g.eval(([id, an, skin]) => { const G = window.__vmGallery; G.paused = false; G.show(id, skin); }, [id, an, +opt('skin', 0)]);
    if (an !== 'draw') await g.advance(0.9);               // let the draw settle
    await g.eval((an) => window.__vmGallery.play(an), an);
    const total = DUR[an] || 1.5, files = []; let t = 0;
    for (let f = 0; f < frames; f++) {
      const target = (total * f) / Math.max(1, frames - 1); const d = Math.max(0, target - t); if (d > 0) { await g.advance(d); t += d; }
      const file = path.join(out, `${id}_${an}_${String(f).padStart(2, '0')}.png`); await g.shot(file, { clip }); files.push(file);
    }
    const sheet = path.join(out, `${id}_${an}.png`); execFileSync('python3', ['tools/sheet.py', 'grid', sheet, ...files]); files.forEach((f) => fs.unlinkSync(f)); sheets.push(sheet);
  }
  console.log(id, '->', sheets.join(' '));
}
const errs = await g.errors(); if (errs.length) console.log('ERRORS:\n' + errs.join('\n')); await g.close();
