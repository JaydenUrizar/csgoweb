// node tools/shot.mjs out.png [--params "test=1&seed=1"] [--adv 1.5] [--place x,y,z,yaw,pitch] [--size 1280x720] [--eval "js"]
import { open } from './lib.mjs';
const args = process.argv.slice(2); const out = args[0] || 'shots/shot.png';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [w, h] = opt('size', '1280x720').split('x').map(Number);
const g = await open({ params: opt('params', 'test=1&seed=1'), size: [w, h] });
if (opt('place')) { const [x, y, z, yaw = 0, pitch = 0] = opt('place').split(',').map(Number); await g.eval(([x, y, z, yaw, pitch]) => window.__game.place(x, y, z, yaw, pitch), [x, y, z, yaw, pitch]); }
if (opt('eval')) console.log(JSON.stringify(await g.eval(opt('eval'))));
await g.advance(+opt('adv', '0.5'));
await g.shot(out);
const errs = await g.errors(); if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
console.log('saved', out); await g.close();
