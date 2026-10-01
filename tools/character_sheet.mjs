// Contact sheets of avatar poses/animations from 3 angles.
//   node tools/character_sheet.mjs [--poses run,idle,...] [--out shots/avatars/sheet] [--size 520x640] [--frames N --dt 0.09]
// Writes <out>_<pose>.png (3 angles side by side, ember+tide pair) and, with --frames, <out>_<pose>_anim.png (N time steps, front-3/4).
import { open } from './lib.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [w, h] = opt('size', '420x560').split('x').map(Number); const out = opt('out', 'shots/avatars/sheet');
const frames = +opt('frames', 0), dt = +opt('dt', 0.08);
const g = await open({ params: 'test=1&seed=1&scene=character-gallery&ui=0&layout=pair', size: [w, h] });
const poses = (opt('poses', '') || (await g.eval(() => window.__game.ctx.characters.debug.poses.join(',')))).split(',');
const ANG = [[28, 10], [90, 6], [180, 10]];   // azimuth, elevation (front 3/4, side, back)
fs.mkdirSync(path.dirname(out), { recursive: true });
const tiles = [];
for (const pose of poses) {
  await g.eval((p) => window.__game.ctx.characters.debug.pose(p), pose);
  await g.advance(pose === 'tagout' ? 0.2 : 0.9);
  const files = [];
  for (let i = 0; i < ANG.length; i++) {
    await g.eval(([a, e]) => window.__game.ctx.characters.debug.cam(a, e), ANG[i]);
    const f = `${out}_${pose}_${i}.png`; await g.advance(0.02); await g.shot(f); files.push(f);
  }
  const sheet = `${out}_${pose}.png`; execFileSync('python3', ['tools/sheet.py', 'grid', sheet, ...files]); files.forEach((f) => fs.unlinkSync(f)); tiles.push(sheet);
  if (frames) {
    const fr = [];
    await g.eval(([a, e]) => window.__game.ctx.characters.debug.cam(a, e, 4.2), ANG[0]);
    for (let k = 0; k < frames; k++) { const f = `${out}_${pose}_f${k}.png`; await g.shot(f); fr.push(f); await g.advance(dt); }
    execFileSync('python3', ['tools/sheet.py', 'grid', `${out}_${pose}_anim.png`, ...fr]); fr.forEach((f) => fs.unlinkSync(f));
  }
  console.log('sheet', sheet);
}
const errs = await g.errors(); if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await g.close();
