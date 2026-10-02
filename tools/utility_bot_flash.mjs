import { open } from './lib.mjs';
const seed = process.argv[2] || '2', rounds = +(process.argv[3] || 4);
const g = await open({ params: `test=1&seed=${seed}&scene=bot-lab&view=none&ui=0&draw=0`, size: [640, 360], wait: 240000 });
await g.eval(() => { const c = window.__game.ctx; window.__ev = []; const nm = (a) => a?.name; c.events.on('util:blind', (e) => window.__ev.push({ k: 'blind', actor: e.actor.name, team: e.actor.team, amt: +e.amount.toFixed(2), by: nm(e.thrower), byTeam: e.thrower?.team })); c.events.on('util:throw', (e) => window.__ev.push({ k: 'throw', type: e.type, by: e.actor.name, team: e.actor.team, round: c.match?.round })); c.events.on('util:detonate', (e) => window.__ev.push({ k: 'det', type: e.type, by: e.thrower?.name, team: e.thrower?.team, p: [e.pos.x|0, e.pos.z|0] })); for (const a of c.actors) a.credits = 9000; });
let last = -1;
for (let i = 0; i < rounds * 4; i++) { await g.eval(() => { for (const a of window.__game.ctx.actors) a.credits = Math.max(a.credits, 9000); }); await g.advance(30, { render: false }); const r = await g.eval(() => window.__game.ctx.match?.round); if (r !== last) { last = r; } if (r > rounds) break; }
const ev = await g.eval(() => window.__ev); if (process.argv[4]) console.log(JSON.stringify(ev.filter(e => e.k !== "throw" || e.type === "strobe")));
const throws = ev.filter(e => e.k === 'throw'), dets = ev.filter(e => e.k === 'det');
const strobes = dets.filter(e => e.type === 'strobe'); let ally = 0, enemy = 0, self = 0;
for (const b of ev.filter(e => e.k === 'blind' && e.amt >= 0.5)) { if (b.byTeam && b.team === b.byTeam) { ally++; if (b.actor === b.by) self++; } else enemy++; }
const hz = dets.filter(e => e.type === 'haze');
console.log(JSON.stringify({ seed, round: last, throws: throws.length, byType: throws.reduce((m, e) => (m[e.type] = (m[e.type] || 0) + 1, m), {}), strobes: strobes.length, allyBlind: ally, selfBlind: self, enemyBlind: enemy, hazeSpots: hz.map(h => h.team + ':' + h.p.join(',')) }));
console.log((await g.errors()).filter(e => !/ERR_CERT/.test(e)).slice(0, 4));
await g.close();
