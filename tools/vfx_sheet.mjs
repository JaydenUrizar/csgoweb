// Capture frame strips of VFX effects in the neutral lab arena and tile them into contact sheets.
//   node tools/vfx_sheet.mjs [effect ...] [--out shots/vfx] [--times 0.017,0.05,0.1,0.2,0.35,0.6] [--size 640x360] [--list] [--cols 3]
// Effects are names from ctx.vfx.debug.list() (e.g. impact-metal tracer-beam muzzle-view shards-shatter pulse beacon-armed).
// With no effect names a default gallery is captured. Sheets are written to <out>/sheet_<effect>.png (needs python3 + PIL, tools/sheet.py).
import { open } from './lib.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flagVals = new Set(['--out', '--times', '--size', '--cols', '--params']);
const names = args.filter((a, i) => !a.startsWith('--') && !flagVals.has(args[i - 1]));
const out = opt('out', 'shots/vfx');
const times = opt('times', '0.017,0.05,0.1,0.2,0.35,0.6').split(',').map(Number);
const [w, h] = opt('size', '640x360').split('x').map(Number);
const DEFAULT = ['tracer-beam', 'tracer-comet', 'muzzle-world', 'muzzle-view', 'impact-stone', 'impact-metal', 'impact-wood', 'impact-sand', 'impact-glass', 'impact-water',
  'shards-shatter', 'shards-confetti', 'shards-pixelate', 'shards-fireworks', 'shards-petals', 'shards-stars', 'hitping-crown', 'land-hard', 'pulse', 'strobe', 'haze', 'beacon-armed'];
const g = await open({ params: opt('params', 'test=1&seed=1&scene=vfx-lab&panel=0'), size: [w, h] });
if (args.includes('--list')) { console.log((await g.eval(() => window.__game.ctx.vfx.debug.list())).join('\n')); await g.close(); process.exit(0); }
fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
const list = names.length ? names : DEFAULT;
for (const name of list) {
  await g.eval((n) => { const v = window.__game.ctx.vfx; v.clear(); v.beacon.hide?.(); v.debug.fire(n); }, name);
  const files = []; let prev = 0;
  for (let i = 0; i < times.length; i++) {
    let dt = times[i] - prev; prev = times[i];
    dt = Math.max(1 / 60, Math.round(dt * 60) / 60);
    await g.advance(dt);
    const f = path.join(out, 'frames', `${name}_${i}.png`); await g.shot(f); files.push(f);
  }
  const sheet = path.join(out, `sheet_${name}.png`);
  execFileSync('python3', ['tools/sheet.py', 'grid', sheet, ...files]);
  console.log('wrote', sheet);
  await g.advance(1 / 30);
}
const errs = await g.errors(); if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); }
console.log(JSON.stringify(await g.eval(() => window.__game.ctx.vfx.debug.stats())));
await g.close(); process.exit(errs.length ? 1 : 0);
