// Captures a handful of representative frames of the running game into shots/showcase/
import { open } from './lib.mjs';
const g = await open({ params: 'test=1&seed=3&match=1&phase=live', size: [1280, 720] });
await g.advance(1.5);
const views = [['A-site', 'a-door'], ['mid', 'mid'], ['b-tunnel', 'b-tunnel'], ['hub', 'hub-arches']];
for (const [n, v] of views) { await g.eval((v) => window.__game.ctx.map.debug?.setView?.(v), v); await g.advance(0.4); await g.shot(`shots/showcase/map_${n}.png`); }
// player POV: hud + viewmodel
await g.eval(() => { const G = window.__game; G.place(0, 0, 25, 0, 0); });
await g.advance(1); await g.shot('shots/showcase/pov_spawn.png');
await g.eval(() => { const c = window.__game.ctx; c.combat.give?.(c.localActor, 'arc'); });
await g.advance(1); await g.shot('shots/showcase/pov_arc.png');
console.log(JSON.stringify(await g.errors()));
await g.close();
