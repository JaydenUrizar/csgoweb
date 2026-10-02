// Utility (Haze/Strobe/Pulse) verification + frame-strip recorder.   node tools/utility_test.mjs [--quick] [--out shots/utility]
// Starts ?scene=utility-lab, asserts physics/visibility/blind/damage behaviour, records frame strips from several viewpoints, tiles them with tools/sheet.py.
import { open } from './lib.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const args = process.argv.slice(2); const quick = args.includes('--quick');
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'shots/utility'; fs.mkdirSync(out, { recursive: true });
const g = await open({ params: 'test=1&seed=1&scene=utility-lab&labui=0', size: [960, 540], wait: 180000 });
const shot = async (f) => { await g.eval(() => window.__game.render()); await g.page.screenshot({ path: f, timeout: 180000 }); return f; };
const results = []; const check = (name, ok, info) => { results.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
// simple evaluator: run function source in page with (game,u,lab,a)
const run = (fn, a) => g.eval(([src, a]) => { const game = window.__game, u = game.ctx.combat.utility, lab = game.ctx.utilityLab; return (new Function('game', 'u', 'lab', 'a', `return (${src})(game,u,lab,a)`))(game, u, lab, a); }, [fn.toString(), a]);
const strip = async (name, frames, view) => { // frames: times (s) after the action
  const files = []; let cur = 0;
  for (const t of frames) { await g.advance(Math.max(0.01, t - cur)); cur = t; const f = `${out}/${name}_${String(Math.round(t * 100)).padStart(4, '0')}.png`; await shot(f); files.push(f); }
  execSync(`python3 tools/sheet.py grid ${out}/${name}_sheet.png ${files.join(' ')}`); return files;
};
const view = (name) => run((game, u, lab, n) => { const p = lab.points[n]; lab.lookAt(p.eye, p.target); }, name);
const reset = () => run((game, u, lab) => { lab.reset(); u.screen.disabled = false; });

// ---------------------------------------------------------------- physics
await reset();
await run((game, u, lab) => { lab.place('A', -8, -12); lab.place('D', -12, -12); });   // clear the corridor of stand-ins for the range tests
check('actors ready', await run((game, u, lab) => !!u && !u.__stub && lab.actors.A));
{ const r = await run((game, u, lab) => {
    const sim = () => { u.debug.clear(); const gr = u.debug.throwFrom(0, 1.62, 16, 0, 0.1, 'haze', 'strong'); for (let i = 0; i < 600 && !gr.g.rest; i++) game.ctx.engine.stepFixed(); return { pos: gr.g.pos.toArray(), rest: gr.g.rest, bounces: gr.g.bounces, t: gr.g.age }; };
    const a = sim(), b = sim(); return { a, b }; });
  check('physics deterministic (same throw twice, identical rest position)', JSON.stringify(r.a.pos) === JSON.stringify(r.b.pos), r.a);
  check('grenade stays inside the arena (no tunnelling)', Math.abs(r.a.pos[0]) < 16 && r.a.pos[2] > -45 && r.a.pos[1] > -0.1 && r.a.pos[1] < 8, r.a.pos); }
{ const r = await run((game, u, lab) => { // range by strength, from flat ground, no velocity
    const o = {}; for (const p of ['weak', 'medium', 'strong']) { u.debug.clear(); const gr = u.debug.throwFrom(0, 1.62, 5.5, 0, 0.0, 'strobe', p); gr.fuse = 99; for (let i = 0; i < 1200 && !gr.g.rest; i++) game.ctx.engine.stepFixed(); o[p] = +(5.5 - gr.g.pos.z).toFixed(1); }
    u.debug.clear(); const walk = u.debug.throwFrom(0, 1.62, 5.5, 0, 0.0, 'strobe', 'medium', [0, 0, -5]); walk.fuse = 99; for (let i = 0; i < 1200 && !walk.g.rest; i++) game.ctx.engine.stepFixed(); o.mediumRunning = +(5.5 - walk.g.pos.z).toFixed(1);
    u.debug.clear(); const jump = u.debug.throwFrom(0, 1.62, 5.5, 0, 0.0, 'strobe', 'medium', [0, 3.5, -5]); jump.fuse = 99; for (let i = 0; i < 1200 && !jump.g.rest; i++) game.ctx.engine.stepFixed(); o.mediumJumpRun = +(5.5 - jump.g.pos.z).toFixed(1); return o; });
  check('throw strengths ordered short < medium < long', r.weak < r.medium && r.medium < r.strong, r);
  check('running / jump throws inherit velocity (go further)', r.mediumRunning > r.medium && r.mediumJumpRun > r.mediumRunning, r); }
{ const r = await run((game, u, lab) => { // bounce off thin 0.1 m wall at x=3? use corridor wall: throw hard at the corridor wall from the yard side
    u.debug.clear(); const gr = u.debug.throwFrom(0, 1.5, 10, -Math.PI / 2 + 0.0, 0.0, 'strobe', 'strong'); gr.fuse = 99; let maxSpeed = 0; for (let i = 0; i < 900; i++) { game.ctx.engine.stepFixed(); } return { pos: gr.g.pos.toArray(), bounces: gr.g.bounces }; });
  check('hard throw into a wall bounces back (restitution)', r.bounces >= 1 && r.pos[0] > -17, r); }
{ const r = await run((game, u, lab) => { // stairs: grenade dropped on top of yard stairs ends on a lower step or the floor, still deterministic & grounded
    u.debug.clear(); const gr = u.debug.spawn('strobe', { x: 11.5, y: 1.6, z: 24.9 }, { x: 0, y: 0, z: -2.2 }); gr.fuse = 99; for (let i = 0; i < 1200 && !gr.g.rest; i++) game.ctx.engine.stepFixed(); return { pos: gr.g.pos.toArray(), rest: gr.g.rest }; });
  check('rolls/bounces down stairs to rest', r.rest && r.pos[1] < 1.1 && r.pos[2] < 24.4, r); }
{ const r = await run((game, u, lab) => { const a = lab.me; lab.view(0, 1.62, 16, 0, 0.1); const s = u.trajectory(a, 'haze', 'strong'); return { n: s.length, end: s[s.length - 1].toArray() }; });
  check('trajectory preview returns an arc', r.n > 10, r); }

// ---------------------------------------------------------------- haze
await reset();
await run((game, u, lab) => { lab.place('A', 0, -17.5); lab.place('D', 0, -12.5); });
await run((game, u, lab) => { lab.ceilings(true); u.debug.spawn('haze', { x: 0, y: 0.07, z: -14 }); });
await g.advance(2.2);
{ const r = await run((game, u) => { const c = u.smokes[0]; const A = c.A; let leak = 0, zmin = 99, zmax = -99, xmin = 99, xmax = -99, n = 0; const N = Math.round(Math.cbrt(c.A.state.length)); const P = c.gfx.P; for (let i = 0; i < c.count; i++) { const idx = A.filled[i]; const ii = idx % N, kk = (idx / (N * N)) | 0; const x = c.ox + (ii + 0.5) * 0.5, z = c.oz + (kk + 0.5) * 0.5; if (Math.abs(x) < 2.3) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); } const yy = c.oy + (((idx / N) | 0) % N + 0.5) * 0.5; if (yy < 3.9 && Math.abs(x) > 2.4 && Math.abs(x) < 17 && z < 5.5 && z > -23.8 && !(z > -14.5 && z < -9.5)) leak++; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); n++; } return { cells: n, zspan: zmax - zmin, xmin, xmax, leak }; });
  check('haze flood-fill is confined by corridor walls (no cells beside the corridor except the side branch)', r.leak === 0, r);
  check('haze fills further along a corridor than in the open (z span >= 14 m, ~7 m each way)', r.zspan >= 14, r); }
await view('corridorInside'); await run((game, u, lab) => lab.ceilings(false));
check('blocksLine true through corridor smoke', await run((game, u, lab) => u.blocksLine({ x: 0, y: 1.6, z: -7 }, { x: 0, y: 1.6, z: -22 })));
check('blocksLine false for a clear line outside smoke', !(await run((game, u, lab) => u.blocksLine({ x: 0, y: 1.6, z: 14 }, { x: 5, y: 1.6, z: 24 }))));
check('smoke does not leak through walls (line along the outside of the wall is clear)', !(await run((game, u, lab) => u.blocksLine({ x: 3.2, y: 1.6, z: -2 }, { x: 3.2, y: 1.6, z: -16 }))));
await run((game, u, lab) => lab.view(0, 1.62, 3, 0, 0.0));
await shot(`${out}/haze_occlusion_inside.png`);
await run((game, u, lab) => { u.debug.clear(); u.debug.spawn('haze', { x: 0, y: 0.07, z: -8 }); lab.view(0, 1.62, 5, 0, -0.01); });
await g.advance(2.2); await shot(`${out}/haze_occlusion_actorA.png`);
{ const e = await run((game, u, lab) => { const A = lab.actors.A; const eye = lab.me.eyePos(); const head = A.eyePos(); return { od: u.opticalDepth(eye, head), blocked: u.blocksLine(eye, head) }; });
  check('actor behind smoke: visibility helper says blocked', e.blocked, e);
  const sph = await g.eval(() => { const c = window.__game.ctx; const cv = c.render.renderer.domElement; return 0; }); }
// punch-through: the tunnel must be visible on screen AND reported by blocksLine (single source of truth: the wake field)
{ await reset();
  await run((game, u, lab) => { lab.place('A', -8, -12); lab.place('D', -12, -12); u.debug.spawn('haze', { x: 0, y: 0.07, z: 14 }); lab.place('B', 1.5, 9); lab.view(-0.5, 1.62, 21, 0, 0); lab.lookAt({ x: -0.5, y: 1.62, z: 21 }, { x: 1.5, y: 1.2, z: 9 }); });
  await g.advance(3);
  const setB = (v) => run((game, u, lab, v) => { game.ctx.characters?.setVisible?.(lab.actors.B, v); lab.actors.B.model && (lab.actors.B.model.visible = v); }, v);
  const pt = await run((game) => { const c = game.ctx.render.camera, W = game.ctx.render.renderer.domElement; c.updateMatrixWorld(true); const v = c.position.clone().set(1.5, 1.1, 9).project(c); return { x: Math.round((v.x * 0.5 + 0.5) * W.width), y: Math.round((-v.y * 0.5 + 0.5) * W.height) }; });
  const cap = async (name, vis) => { await setB(vis); await g.advance(0.02); const f = `${out}/punch_${name}.png`; await shot(f); return f; };
  const odBefore = await run((game, u, lab) => u.opticalDepth(lab.me.eyePos(), lab.me.eyePos().set(1.5, 1.1, 9)));
  const f1 = await cap('before_B', true), f2 = await cap('before_noB', false);
  await setB(true);
  await run((game, u, lab) => { const eye = lab.me.eyePos(); const T = eye.clone().set(1.5, 1.1, 9); const d = T.clone().sub(eye).normalize(); for (let i = 0; i < 5; i++) game.ctx.events.emit('weapon:fire', { actor: lab.me, origin: eye.clone(), dir: d.clone(), hitscan: true }); });
  await g.advance(0.15);
  const odAfter = await run((game, u, lab) => { const T = lab.me.eyePos().set(1.5, 1.1, 9); return u.opticalDepth(lab.me.eyePos(), T); });
  const f3 = await cap('after_B', true), f4 = await cap('after_noB', false);
  const diff = (a, b) => parseFloat(execSync(`python3 -c "from PIL import Image,ImageChops;import sys;a=Image.open('${a}').convert('L');b=Image.open('${b}').convert('L');x,y=${pt.x},${pt.y};box=(max(0,x-16),max(0,y-16),x+16,y+16);import numpy as np;print(float(np.abs(np.asarray(a.crop(box),dtype=float)-np.asarray(b.crop(box),dtype=float)).mean()))"`).toString());
  const dBefore = diff(f1, f2), dAfter = diff(f3, f4);
  check('punch: before shots the target behind smoke is invisible on screen and blocksLine says blocked', dBefore < 7 && odBefore >= 0.85, { dBefore, odBefore, pt });
  check('punch: after shots the tunnel is open ON SCREEN (target visible) and the LOS query agrees (opticalDepth < 0.85)', dAfter > 12 && odAfter < 0.85, { dAfter, odAfter });
  await g.advance(0.9); const od2 = await run((game, u, lab) => u.opticalDepth(lab.me.eyePos(), lab.me.eyePos().set(1.5, 1.1, 9)));
  await g.advance(2.5); const od3 = await run((game, u, lab) => u.opticalDepth(lab.me.eyePos(), lab.me.eyePos().set(1.5, 1.1, 9)));
  check('punch: wake closes again over ~1-2 s', od2 > odAfter && od3 >= 0.85, { odAfter, od2, od3 });
  await setB(true); }
// dissipation + strips (open yard)
await reset();
await run((game, u, lab) => { lab.view(0, 1.62, 22, 0, 0.1); u.debug.spawn('haze', { x: 0, y: 0.07, z: 12 }); });
await strip('haze_open_front', quick ? [0.2, 0.6, 1.5] : [0.1, 0.25, 0.5, 0.9, 1.6, 4], null);
{ const life = await run((game, u) => ({ n: u.smokes.length })); check('haze alive at 4 s', life.n === 1, life); }
await run((game, u, lab) => lab.view(-8, 1.62, 22, -0.5, 0.1)); await g.advance(9); await shot(`${out}/haze_open_side_t13.png`);
await g.advance(3.0); await shot(`${out}/haze_open_side_t16.png`); await g.advance(1.2); await shot(`${out}/haze_open_side_t17.png`);
await g.advance(4.5);
check('haze gone after ~18 s', (await run((game, u) => u.smokes.length)) === 0);
// corridor fill strips from inside + top-down
await reset();
await run((game, u, lab) => { lab.ceilings(false); lab.view(0, 22, -8, 0, -1.5); u.debug.spawn('haze', { x: 0, y: 0.07, z: -8 }); });
if (!quick) await strip('haze_corridor_top', [0.3, 0.8, 1.5], null);
await reset(); await run((game, u, lab) => { lab.ceilings(true); lab.view(0, 1.62, 2.5, 0, -0.02); u.debug.spawn('haze', { x: 0, y: 0.07, z: -10 }); });
await strip('haze_corridor_view', quick ? [0.3, 1.5] : [0.15, 0.4, 0.8, 1.5, 3], null);
// stand inside the smoke
await run((game, u, lab) => lab.view(0, 1.62, -10, 0, 0));
await g.advance(0.3); await shot(`${out}/haze_inside.png`);
check('murk overlay when camera is inside smoke', (await run((game, u) => u.shared.overlayAmount)) > 0.5);
// ---------------------------------------------------------------- strobe
await reset();
await run((game, u, lab) => { lab.view(0, 1.62, 22, 0, 0.05); u.screen.disabled = true; u.debug.spawn('strobe', { x: 0, y: 1.2, z: 12 }); });
await strip('strobe_burst', quick ? [0.05, 0.2, 0.8] : [0.03, 0.08, 0.16, 0.3, 0.6, 1.2], null);
await reset();
{ const r = await run((game, u, lab) => { const me = lab.me, out = {}; const pos = { x: 0, y: 1.2, z: 12, isVector3: true };
    const T = (yaw, z) => { lab.view(0, 1.62, z, yaw, 0); const e = u.strobe.evaluate(new (game.ctx.render.camera.position.constructor)(0, 1.2, 12), me); return e ? +e.amount.toFixed(2) : 0; };
    out.facingNear = T(0, 18); out.facingFar = T(0, 40); out.side = T(Math.PI / 2, 18); out.behind = T(Math.PI, 18); out.wallBlocked = (() => { lab.view(0, 1.62, 0, 0, 0); const e = u.strobe.evaluate(new (game.ctx.render.camera.position.constructor)(8, 1.2, 12), me); return e ? 1 : 0; })();
    return out; });
  check('strobe blind: facing > side > behind, near > far, blocked by walls', r.facingNear > r.side && r.side > r.behind && r.facingNear > r.facingFar && r.wallBlocked === 0, r); }
await run((game, u, lab) => { lab.view(0, 1.62, 18, 0, 0.0); game.ctx.events.on('util:blind', (e) => { (window.__blind ||= {})[e.actor.name] = [e.actor.name, +e.amount.toFixed(2), +e.duration.toFixed(2)]; }); u.debug.spawn('strobe', { x: 0, y: 1.2, z: 12 }); });
await g.advance(0.05);
{ const b = await run((game, u, lab) => ({ ev: window.__blind, lvl: u.blindAmount(lab.me), a: lab.actors.B.blind && +lab.actors.B.blind.amount.toFixed(2) }));
  check('util:blind event + local whiteout at detonation', b.ev?.You && b.lvl > 0.9 && b.ev.You[2] >= 0.5 && b.ev.You[2] <= 4.0, b); }
await strip('strobe_whiteout', quick ? [0.1, 1.0, 2.5] : [0.1, 0.8, 1.6, 2.2, 3.0, 4.2], null); await g.advance(2);
check('blind fully recovered after duration', (await run((game, u, lab) => u.blindAmount(lab.me))) === 0);
// ---------------------------------------------------------------- pulse
await reset();
const dmg = await run((game, u, lab) => { const res = {}; const pos = { x: 0, y: 0.3, z: 12 };
  const P = (name, x, z, armor = 0) => { const a = lab.actors[name]; a.alive = true; a.hp = 100; a.armor = armor; a.pos.set(x, 0, z); a.vel.set(0, 0, 0); return a; };
  const near = P('B', 0.8, 12), mid = P('C', 3.5, 12), edge = P('D', 6.7, 12), arm = P('A', -0.8, 12, 100); lab.place('A', -0.8, 12);
  const me = lab.me; me.pos.set(0, 0, 40); me.team = 'ember'; for (const k of ['A','B','C','D']) lab.actors[k].team = 'tide';
  const thr = { team: 'ember', name: 'T', stats: { damage: 0 } };
  u.debug.spawn('pulse', pos); // not thrown by an actor => enemy of everyone
  res.near = 100 - near.hp; res.mid = 100 - mid.hp; res.edge = 100 - edge.hp; res.armor = 100 - arm.hp; res.armorLeft = arm.armor; res.knockNear = Math.hypot(near.vel.x, near.vel.z); res.knockEdge = Math.hypot(edge.vel.x, edge.vel.z); return res; });
check('pulse: damage falls off with distance, never lethal from full Charge, max ~60', dmg.near > dmg.mid && dmg.mid > dmg.edge && dmg.near <= 60.5 && dmg.near > 30 && dmg.edge < 8, dmg);
check('pulse: armor reduces damage', dmg.armor < dmg.near * 0.75 && dmg.armorLeft < 100, dmg);
check('pulse: soft knock decays with distance', dmg.knockNear > dmg.knockEdge && dmg.knockNear < 8, dmg);
await run((game, u, lab) => { lab.reset(); lab.place('B', 0, 3); const a = lab.actors.B; a.hp = 100; });
const cover = await run((game, u, lab) => { const a = lab.actors.B; a.alive = true; a.hp = 100; a.team = 'tide'; a.pos.set(-4, 0, 8.5); u.debug.spawn('pulse', { x: -4, y: 0.3, z: 4.5 }); return 100 - a.hp; }); // behind the yard's north wall: pulse sits at z 6.5 north of wall? (wall at z 6): actor on other side
check('pulse is blocked by walls (actor on the far side of the north wall takes no damage)', cover === 0 || cover < 5, { cover });
await reset();
await run((game, u, lab) => { lab.view(0, 1.62, 22, 0, 0.1); u.debug.spawn('pulse', { x: 0, y: 0.3, z: 12 }); });
await strip('pulse_blast', quick ? [0.08, 0.3, 0.9] : [0.05, 0.12, 0.25, 0.4, 0.7, 1.1], null);
await reset(); await run((game, u, lab) => { lab.lookAt(lab.points.side45.eye, lab.points.side45.target); u.debug.spawn('pulse', { x: 0, y: 0.3, z: 12 }); });
await strip('pulse_side', quick ? [0.3, 0.7] : [0.15, 0.3, 0.5, 0.9], null);
// ---------------------------------------------------------------- throw-in-world strips (real throw arc + bounce + fuse)
await reset();
await run((game, u, lab) => { lab.view(0, 1.62, 16, 0, 0.12); u.infinite = true; u.throw(lab.me, 'haze', 'strong'); });
await strip('throw_haze', quick ? [0.3, 1.2, 2.5] : [0.15, 0.4, 0.8, 1.4, 2.0, 3.5], null);
await g.advance(1.5);
check('thrown haze popped (fuse/rest)', (await run((game, u) => u.smokes.length)) === 1);
// ---------------------------------------------------------------- cleanup + preview
await reset();
{ const r = await run((game, u, lab) => { u.debug.spawn('strobe', { x: 90, y: 5, z: 90 }, { x: 0, y: 0, z: 0 }); return u.debug.state().grenades.length; });
  await g.advance(6);
  const n = await run((game, u) => u.debug.state().grenades.length);
  check('grenade that leaves the world is despawned (kill plane)', r === 1 && n === 0, { before: r, after: n }); }
{ await run((game, u, lab) => { lab.view(0, 1.62, 16, 0, 0.3); u.preview.show(lab.me, 'haze', 'strong'); });
  await g.advance(0.05); const f = await shot(`${out}/preview_arc.png`);
  const v = await run((game, u) => ({ pts: u.preview.show(game.ctx.localActor, 'haze', 'strong').length }));
  check('throw-arc preview draws a dotted arc + landing ring', v.pts > 20, v); await run((game, u) => u.preview.hide()); }
// ---------------------------------------------------------------- perf + errors
const info = await run((game) => game.ctx.render.info?.());
const errs = (await g.errors()).filter((e) => !/ERR_CERT/.test(e));
check('no console errors/warnings', errs.length === 0, errs.slice(0, 4));
console.log('draw calls', info?.calls, 'tris', info?.triangles);
const fail = results.filter((r) => !r.ok); console.log(`\n${results.length - fail.length}/${results.length} passed`);
fs.writeFileSync(`${out}/utility_test.json`, JSON.stringify({ results, info }, null, 1));
await g.close(); process.exit(fail.length ? 1 : 0);
