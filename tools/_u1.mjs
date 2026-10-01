import { open } from './lib.mjs';
const type = process.argv[2] || 'haze';
const g = await open({ params: 'test=1&seed=1&scene=utility-lab&labui=0', size: [1280, 720] });
await g.game((game) => { const lab = game.ctx.utilityLab; lab.view(-6, 1.62, 20, -0.3, 0.05); });
await g.game((game, t) => { game.ctx.combat.utility.debug.spawn(t, { x: 0, y: 0.07, z: 12 }); }, type);
const frames = [];
for (const t of [0.15, 0.3, 0.5, 0.8, 1.2, 2.0]) { await g.advance(t - (frames.length ? frames.t : 0)); frames.t = t; const f = `shots/utility/u1_${type}_${String(t).replace('.', '')}.png`; await g.shot(f); frames.push(f); }
console.log(JSON.stringify(await g.game((game) => game.ctx.combat.utility.debug.state())));
console.log(await g.errors());
await g.close();
import { execSync } from 'node:child_process'; execSync(`python3 tools/sheet.py grid shots/utility/u1_${type}_sheet.png ${frames.join(' ')}`);
