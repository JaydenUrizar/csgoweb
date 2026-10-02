// node tools/hud_sheet.mjs [--size 1280x720] [--states a,b,c] [--bg sun]
// Captures every HUD state from ?scene=hud-gallery into shots/hud/sheet/<size>/<state>.png and tiles them (sheet.py grid) into shots/hud/sheet_<size>_<n>.png.
import { open } from './lib.mjs';
import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const size = opt('size', '1280x720'); const [w, h] = size.split('x').map(Number);
const g = await open({ params: `test=1&seed=1&scene=hud-gallery&bg=${opt('bg', 'sun')}`, size: [w, h] });
const all = await g.eval(() => window.__game.ctx.hud.debug.states());
const states = opt('states') ? opt('states').split(',') : ['live', ...all.filter((s) => s !== 'live')];
const dir = `shots/hud/sheet/${size}`; fs.mkdirSync(dir, { recursive: true }); const files = [];
// per-state settle time so transient markers (hit/crown/tagout/dmg/banners) are caught mid-animation
const settle = { hit: 0.05, crown: 0.07, tagout: 0.1, dmg: 0.3, 'banner-round': 0.8, 'banner-win': 0.8, 'banner-lose': 0.8, 'banner-mp': 0.8, 'banner-half': 0.8, 'banner-end': 0.8, blind: 0.15, buy: 0.4, scoreboard: 0.4, spectator: 0.4, scope: 0.3, halo: 0.3, live: 0.6, death: 0.5, 'death-late': 2.0 };
for (const s of states) {
  await g.eval(([s, t]) => { const d = window.__game.ctx.hud.debug; d.state(s); d.step(t); }, [s, settle[s] ?? 0.4]);
  const f = `${dir}/${s}.png`; await g.shot(f); files.push(f);
}
const errs = await g.errors(); if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
for (let i = 0, n = 0; i < files.length; i += 6, n++) execFileSync('python3', ['tools/sheet.py', 'grid', `shots/hud/sheet_${size}_${n}.png`, ...files.slice(i, i + 6)]);
console.log('states:', states.join(' ')); await g.close();
