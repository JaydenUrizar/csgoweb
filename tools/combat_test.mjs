// Headless tagger test (no browser): node tools/combat_test.mjs [--out shots/tagger] [--trials 40] [--dist 20]
// Drives the real combat core (src/combat/core.js) with a mock map + actors and writes:
//   shots/tagger/spray.json     spray-pattern point clouds (stand / crouch / run / jump) per tagger  -> plot_spray.py makes PNGs
//   shots/tagger/ttk.md         time-to-kill tables (shots-to-kill, TTK, dmg per shot) by range / armour / hitgroup
//   shots/tagger/accuracy.md    inaccuracy (deg / cm at 20 m) by stance & speed, counter-strafe curve
//   stdout                      PASS/FAIL checks against CS2 reference numbers + functional inventory/fire tests
// Exit code 1 when a check fails.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createEvents } from '../src/core/events.js';
import { createActor } from '../src/core/actor.js';
import { createCore } from '../src/combat/core.js';
import { TAGGERS, patternAt, FALLOFF_UNIT } from '../src/combat/taggers.js';
import { rawDamage, armourSplit, inaccuracyDeg, moveFrac } from '../src/combat/ballistics.js';
import { mulberry32 } from '../src/core/rng.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(here, '..', opt('out', 'shots/tagger')); fs.mkdirSync(OUT, { recursive: true });
const TRIALS = +opt('trials', 40), DIST = +opt('dist', 20), DT = 1 / 120;
let fails = 0; const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); if (!ok) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------------------------------------------- mock world
function makeWorld() {
  const boxes = [];   // {min,max,thin,surface}
  const add = (x0, y0, z0, x1, y1, z1, o = {}) => boxes.push({ min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1, z1), ...o });
  const map = {
    boxes, thinWalls: [], add,
    raycast(o, d, far = 500) {          // front-face-only slab test, like a single-sided BVH mesh
      let best = null;
      for (const b of boxes) {
        if (o.x > b.min.x && o.x < b.max.x && o.y > b.min.y && o.y < b.max.y && o.z > b.min.z && o.z < b.max.z) continue;   // inside: no front face
        let t0 = 0, t1 = far, axis = -1, sgn = 0, ok = true;
        for (const [ax, a0, a1, oo, dd] of [[0, b.min.x, b.max.x, o.x, d.x], [1, b.min.y, b.max.y, o.y, d.y], [2, b.min.z, b.max.z, o.z, d.z]]) {
          if (Math.abs(dd) < 1e-9) { if (oo < a0 || oo > a1) { ok = false; break; } continue; }
          let ta = (a0 - oo) / dd, tb = (a1 - oo) / dd, s = dd > 0 ? -1 : 1; if (ta > tb) { const q = ta; ta = tb; tb = q; }
          if (ta > t0) { t0 = ta; axis = ax; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; }
        }
        if (!ok || axis < 0 || t0 <= 0 || t0 > far) continue;
        if (!best || t0 < best.distance) { const n = new THREE.Vector3(); n.setComponent(axis, sgn); best = { distance: t0, point: o.clone().addScaledVector(d, t0), normal: n, thin: !!b.thin, surface: b.surface }; }
      }
      return best;
    },
    surfaceAt(p) { for (const b of boxes) if (p.x >= b.min.x - 0.01 && p.x <= b.max.x + 0.01 && p.y >= b.min.y - 0.01 && p.y <= b.max.y + 0.01 && p.z >= b.min.z - 0.01 && p.z <= b.max.z + 0.01) return b.surface || 'stone'; return 'stone'; },
  };
  return map;
}
function makeCtx(dist = DIST) {
  const map = makeWorld();
  map.add(-200, -1, -400, 200, 0, 50, { surface: 'stone' });            // floor
  map.add(-200, 0, -dist - 1, 200, 40, -dist, { surface: 'stone' });     // backstop wall
  const ctx = { actors: [], events: createEvents(), map, log: { fire: [], hit: [], out: [], impacts: [] } };
  ctx.events.on('weapon:fire', (e) => ctx.log.fire.push(e)); ctx.events.on('tag:hit', (e) => ctx.log.hit.push(e)); ctx.events.on('tag:out', (e) => ctx.log.out.push(e));
  const core = createCore(ctx); ctx.combat = core;
  return { ctx, core };
}
const RUN = (def) => 7.2 * def.moveSpeedU / 250;   // movement piece: runSpeed 7.2 x weapon speed mult
const mkActor = (ctx, name, team, x = 0, z = 0, ai = true) => {
  const a = createActor({ name, team }); a.pos.set(x, 0, z); a.vel.set(0, 0, 0); if (ai) a.ai = { cmd: { fire: false, aim: false, reload: false, drop: false, use: false, last: false, inspect: false, slot: 0, dir: null } };
  ctx.actors.push(a); return a;
};
const step = (core, n) => { for (let i = 0; i < n; i++) core.fixedUpdate(DT); };
const secs = (core, s) => step(core, Math.round(s * 120));
const eq = (core, a) => core.equipped(a);
function readyWeapon(core, a, id, o = {}) {
  core.reset(a, { keep: false }); core.give(a, id, o); core.switchTo(a, TAGGERS[id].slot);
  secs(core, 1.6);      // finish draw
  a.ai.cmd.fire = false; step(core, 2);
}

// ---------------------------------------------------------------------------------------------------- 1. spray point clouds
function sprayRun(id, stance, trial) {
  const { ctx, core } = makeCtx(); core.seed = 1000 + trial;
  const a = mkActor(ctx, 'a', 'ember'); a.brain = null;
  readyWeapon(core, a, id);
  const def = TAGGERS[id]; a.cb.rng = mulberry32(7919 * (trial + 1) + id.length * 131);
  a.crouching = stance === 'crouch'; a.onGround = stance !== 'jump';
  if (stance === 'run') a.vel.set(RUN(def), 0, 0); if (stance === 'jump') a.vel.set(RUN(def) * 0.6, 2.5, 0);
  a.yaw = 0; a.pitch = 0; a.eyeHeight = a.crouching ? 1.12 : 1.62;
  const pts = []; const off = core.hooks.shot.push((s) => { if (s.actor === a) pts.push([Math.atan2(s.end.x - s.origin.x, DIST) / Math.PI * 180, Math.atan2(s.end.y - s.origin.y, DIST) / Math.PI * 180, s.shot, s.inacc]); });
  const n = Math.min(def.mag, def.id === 'storm' ? 45 : 30);
  a.ai.cmd.fire = true; let guard = 0;
  while (pts.length < n * (def.pellets || 1) && guard++ < 120 * 30) { if (stance === 'run') a.vel.set(RUN(def), 0, 0); if (stance === 'jump') { a.onGround = false; a.vel.y = 2.5; } core.fixedUpdate(DT); }
  a.ai.cmd.fire = false; core.hooks.shot.length = 0;
  return pts;
}
function sprayAll() {
  const out = {};
  for (const id of Object.keys(TAGGERS)) {
    if (id === 'tap') continue;
    out[id] = { dist: DIST, name: TAGGERS[id].name, cs: TAGGERS[id].cs, stances: {} };
    for (const st of ['stand', 'crouch', 'run', 'jump']) {
      const trials = st === 'stand' || st === 'crouch' ? TRIALS : Math.max(8, TRIALS >> 2);
      out[id].stances[st] = []; for (let t = 0; t < trials; t++) out[id].stances[st].push(sprayRun(id, st, t));
    }
    // deterministic pattern (bullet offset from recoil only)
    const def = TAGGERS[id], p = { yaw: 0, pitch: 0 }, pat = []; for (let k = 0; k < Math.min(30, Math.max(def.mag, 8)); k++) { patternAt(def, k, p); pat.push([p.yaw, p.pitch]); }
    out[id].pattern = pat;
  }
  fs.writeFileSync(path.join(OUT, 'spray.json'), JSON.stringify(out));
  return out;
}

// ---------------------------------------------------------------------------------------------------- 2. TTK
function shotTimes(def, n) {
  const t = []; let now = 0;
  if (def.burst) { let left = 0; for (let k = 0; k < n; k++) { if (left === 0) left = def.burst.count; t.push(now); left--; now += left > 0 ? def.burst.interval : def.burst.cooldown; } }
  else for (let k = 0; k < n; k++) { t.push(now); now += def.cycle; }
  return t;
}
function killShots(def, group, dist, armor, helmet) {
  let hp = 100, ar = armor, n = 0, dmgFirst = 0;
  while (hp > 0 && n < 200) {
    const raw = rawDamage(def, group, dist) * (def.pellets || 1) / (def.pellets || 1);
    const per = def.pellets > 1 ? raw * def.pellets : raw;            // all pellets on target (best case)
    const s = armourSplit(def, per, group, ar, helmet); hp -= Math.min(s.health, hp); ar = Math.max(0, ar - s.armorLoss); n++; if (n === 1) dmgFirst = s.health;
  }
  return { n, dmgFirst };
}
function ttkTables() {
  let md = '# Tagger TTK tables\n\nShots-to-kill (STK) and time-to-kill (TTK, first shot to last shot, best case: every pellet/bullet lands) for 100 hp.\nDamage model = CS2: hitgroup mult (head x4, stomach x1.25, leg x0.75), range falloff `rangeMod ^ (d / 12.7 m)`, armour pen ratio, helmet only covers head.\n\n';
  for (const [label, armor, helmet] of [['unarmoured', 0, false], ['vest + helmet (armour 100)', 100, true]]) {
    md += `## ${label}\n\n| tagger (CS2 archetype) | dmg | rpm | dist | body STK | body TTK | head STK | head TTK | leg STK | first-hit dmg body / head |\n|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const id of Object.keys(TAGGERS)) {
      const d = TAGGERS[id]; if (d.melee) continue;
      for (const dist of [3, 15, 30]) {
        const b = killShots(d, 'chest', dist, armor, helmet), h = killShots(d, 'head', dist, armor, helmet), l = killShots(d, 'leg', dist, armor, helmet);
        const tb = shotTimes(d, b.n), th = shotTimes(d, h.n);
        md += `| ${d.name} (${d.cs}) | ${d.damage}${d.pellets > 1 ? 'x' + d.pellets : ''} | ${Math.round(d.rpm)} | ${dist} m | ${b.n} | ${(tb[tb.length - 1]).toFixed(2)} s | ${h.n} | ${(th[th.length - 1]).toFixed(2)} s | ${l.n} | ${b.dmgFirst} / ${h.dmgFirst} |\n`;
      }
    }
    md += '\n';
  }
  fs.writeFileSync(path.join(OUT, 'ttk.md'), md);
}

// ---------------------------------------------------------------------------------------------------- 3. accuracy
function accuracyTables() {
  let md = '# Inaccuracy (half-angle degrees; cm radius at 20 m in brackets)\n\n| tagger | stand | crouch | walk (34 % speed) | run | jump | run + 10 shots | spray cap |\n|---|---|---|---|---|---|---|---|\n';
  const cm = (deg) => `${deg.toFixed(2)} (${(Math.tan(deg * Math.PI / 180) * 2000).toFixed(0)})`;
  for (const id of Object.keys(TAGGERS)) {
    const d = TAGGERS[id]; if (d.melee) continue;
    const base = { onGround: true, crouch: false, vy: 0, fire: 0, land: 0, scopeLevel: d.scope && id === 'lance' ? 1 : 0, speed: 0 };
    const f = (o) => inaccuracyDeg(d, { ...base, ...o });
    md += `| ${d.name}${id === 'lance' ? ' (scoped)' : ''} | ${cm(f({}))} | ${cm(f({ crouch: true }))} | ${cm(f({ speed: d.moveSpeed * 0.34 }))} | ${cm(f({ speed: d.moveSpeed }))} | ${cm(f({ onGround: false, vy: 2.5, speed: d.moveSpeed * 0.5 }))} | ${cm(f({ speed: d.moveSpeed, fire: d.inacc.fire * 10 }))} | ${cm(f({ fire: d.inacc.fireMax }))} |\n`;
  }
  md += '\n## Counter-strafe curve (AK-like: max 5.46 m/s)\n\n| speed m/s | % max | move penalty deg |\n|---|---|---|\n';
  for (let f = 0; f <= 1.0001; f += 0.1) md += `| ${(f * 5.46).toFixed(2)} | ${(f * 100).toFixed(0)} | ${(TAGGERS.arc.inacc.move * moveFrac(f * 5.46, 5.46)).toFixed(2)} |\n`;
  fs.writeFileSync(path.join(OUT, 'accuracy.md'), md);
}

// ---------------------------------------------------------------------------------------------------- 4. CS2 numeric checks
function csChecks() {
  console.log('\n== CS2 damage reference checks ==');
  const dmg = (id, group, dist, armor = 0, helmet = false) => { const d = TAGGERS[id]; const s = armourSplit(d, rawDamage(d, group, dist), group, armor, helmet); return s.health; };
  check('AK-47 (arc) body 0 m unarmoured = 36', dmg('arc', 'chest', 0) === 36);
  check('AK-47 (arc) head 0 m unarmoured >= 143 (one-tag)', dmg('arc', 'head', 0) >= 143);
  check('AK-47 (arc) head vs helmet 0 m = 111 (CS2 111)', dmg('arc', 'head', 0, 100, true) === 111, String(dmg('arc', 'head', 0, 100, true)));
  check('AK-47 (arc) armoured chest = 27/28 (4 to kill)', near(dmg('arc', 'chest', 0, 100, true), 27.5, 1) && killShots(TAGGERS.arc, 'chest', 0, 100, true).n === 4, `${dmg('arc', 'chest', 0, 100, true)} dmg, ${killShots(TAGGERS.arc, 'chest', 0, 100, true).n} shots`);
  check('AK-47 (arc) unarmoured chest kills in 3', killShots(TAGGERS.arc, 'chest', 0, 0, false).n === 3);
  check('AK-47 (arc) leg = 27', dmg('arc', 'leg', 0) === 27);
  check('AK-47 (arc) stomach = 45', dmg('arc', 'stomach', 0) === 45);
  check('M4A4 (rail) head unarmoured 132', near(dmg('rail', 'head', 0), 131, 1.5), String(dmg('rail', 'head', 0)));
  check('M4A4 (rail) chest armoured ≈ 23 (33 x 0.70)', near(dmg('rail', 'chest', 0, 100, true), 23, 1), String(dmg('rail', 'chest', 0, 100, true)));
  check('AWP (lance) chest 0 m kills unarmoured & armoured', dmg('lance', 'chest', 0) >= 100 && dmg('lance', 'chest', 0, 100, true) >= 100, `${dmg('lance', 'chest', 0)} / ${dmg('lance', 'chest', 0, 100, true)}`);
  check('AWP (lance) leg does not kill (86)', dmg('lance', 'leg', 0) === 86, String(dmg('lance', 'leg', 0)));
  check('Deagle (judge) head vs helmet kills', dmg('judge', 'head', 5, 100, true) >= 100, String(dmg('judge', 'head', 5, 100, true)));
  check('USP (pip) unarmoured head = 140', dmg('pip', 'head', 0) === 140);
  check('USP (pip) chest armoured ~ 17', near(dmg('pip', 'chest', 0, 100, true), 17, 1.5), String(dmg('pip', 'chest', 0, 100, true)));
  check('Falloff: AK at 25.4 m = 36 x 0.98^2 = 34', near(dmg('arc', 'chest', 25.4), 34, 0.6), String(dmg('arc', 'chest', 25.4)));
  check('Falloff: MP9 (zip) 15 m body < 22', dmg('zip', 'chest', 15) < 22, String(dmg('zip', 'chest', 15)));
  check('XM1014 (scatter) 6 pellets x 20 (close, all pellets = 120)', TAGGERS.scatter.pellets === 6 && TAGGERS.scatter.damage === 20);
  check('Negev (storm) mag 150, speed 3.8 m/s', TAGGERS.storm.mag === 150 && near(TAGGERS.storm.moveSpeed, 3.81, 0.05));
  check('rate: AK 600 rpm / M4 666 rpm / MP9 857 rpm', near(TAGGERS.arc.rpm, 600, 1) && near(TAGGERS.rail.rpm, 666, 2) && near(TAGGERS.zip.rpm, 857, 2));
  check('AK movement speed = 215 u/s = 5.46 m/s; knife 6.35 m/s', near(TAGGERS.arc.moveSpeed, 5.461, 0.01) && near(TAGGERS.tap.moveSpeed, 6.35, 0.01));
  // counter-strafe
  const d = TAGGERS.arc, s = { onGround: true, crouch: false, vy: 0, fire: 0, land: 0, scopeLevel: 0, speed: 0 };
  check('accuracy: perfectly accurate below 34 % speed (shift-walk)', inaccuracyDeg(d, { ...s, speed: d.moveSpeed * 0.34 }) === inaccuracyDeg(d, { ...s, speed: 0 }));
  const rs = RUN(d), runI = inaccuracyDeg(d, { ...s, speed: rs, maxSpeed: rs });
  check('accuracy: AK standing first shot ~0.4° (CS2)', near(inaccuracyDeg(d, s), 0.4, 0.05), inaccuracyDeg(d, s).toFixed(2));
  check('accuracy: AK full-speed run ~10° (CS2)', near(runI, 10.4, 1.5), runI.toFixed(2));
  check('Pip one-taps an unarmoured head at 30 m (CS2 USP-S)', dmg('pip', 'head', 30) >= 100, String(dmg('pip', 'head', 30)));
  check('AK recovery_time_stand 0.43 s', TAGGERS.arc.recover.stand === 0.43);
  check('Negev tightens when sustained', inaccuracyDeg(TAGGERS.storm, { ...s, shots: 12 }) < 0.4 * inaccuracyDeg(TAGGERS.storm, { ...s, shots: 0 }));
  check('accuracy: crouched tighter than standing', inaccuracyDeg(d, { ...s, crouch: true }) < inaccuracyDeg(d, s));
  check('accuracy: AWP unscoped >> scoped (>100x)', inaccuracyDeg(TAGGERS.lance, { ...s, speed: 0, scopeLevel: 0 }) > 100 * inaccuracyDeg(TAGGERS.lance, { ...s, speed: 0, scopeLevel: 1 }));
  check('spray patterns start at (0,0) = first shot accurate', Object.values(TAGGERS).every((t) => t.pattern[0] === 0 && t.pattern[1] === 0));
}

// ---------------------------------------------------------------------------------------------------- 5. functional tests
function functional() {
  console.log('\n== functional ==');
  { // first shot lands exactly where aimed (standing, no penalty), spray climbs, pattern deterministic
    const r1 = sprayRun('arc', 'stand', 0), r2 = sprayRun('arc', 'stand', 0), r3 = sprayRun('arc', 'stand', 1);
    check('AK: first shot within 1.0° of aim standing still (0.4° cone)', Math.hypot(r1[0][0], r1[0][1]) < 1.0, `${r1[0][0].toFixed(3)}, ${r1[0][1].toFixed(3)}`);
    check('AK: identical seed -> identical spray (deterministic)', JSON.stringify(r1) === JSON.stringify(r2));
    check('AK: spray climbs > 9° by shot 15', r1[15][1] > 9, r1[15][1].toFixed(1));
    const dev = r1.map((p, i) => Math.hypot(p[0] - r3[i][0], p[1] - r3[i][1]));
    check('AK: two different spreads follow the same pattern (mean dev < 1.6°)', dev.reduce((a, b) => a + b) / dev.length < 1.6, (dev.reduce((a, b) => a + b) / dev.length).toFixed(2));
    const rr = sprayRun('arc', 'run', 0); check('AK: running spread is huge (first shot > 1.5°)', rr[0][3] > 7, `inacc ${rr[0][3].toFixed(2)}`);
  }
  { // inventory: buy / give / drop / pickup / switch / Q
    const { ctx, core } = makeCtx(); const a = mkActor(ctx, 'a', 'ember'); a.credits = 5000;
    step(core, 2);
    check('default loadout: knife + pip, pip equipped', a.inventory.slots[3]?.id === 'tap' && eq(core, a).id === 'pip');
    let r = core.buy(a, 'arc'); check('buy arc (2700) ok, credits 2300, equipped', r.ok && a.credits === 2300 && eq(core, a).id === 'arc', JSON.stringify(r));
    r = core.buy(a, 'rail'); check('buy rail rejected for ember (team-locked)', !r.ok && r.reason === 'team');
    r = core.buy(a, 'lance'); check('buy lance rejected (credits)', !r.ok && r.reason === 'credits');
    r = core.buy(a, 'vest'); check('buy vest -> armour 100 + helmet', r.ok && a.armor === 100 && a.helmet);
    secs(core, 1.2);
    core.switchTo(a, 2); check('slot 2 -> pip', eq(core, a).id === 'pip');
    a.ai.cmd.slot = 1; step(core, 2); a.ai.cmd.slot = 0; check('slot 1 -> arc', eq(core, a).id === 'arc');
    a.ai.cmd.last = true; step(core, 2); a.ai.cmd.last = false; check('Q -> last weapon (pip)', eq(core, a).id === 'pip');
    a.ai.cmd.slot = 3; step(core, 2); a.ai.cmd.slot = 0; check('slot 3 -> tap', eq(core, a).id === 'tap');
    core.switchTo(a, 1); secs(core, 1);
    a.pos.set(0, 0, 0); a.ai.cmd.drop = true; step(core, 2); a.ai.cmd.drop = false;
    check('G drops arc -> pickup entity, slot 1 empty, falls back to pip', !a.inventory.slots[1] && core.drops.length === 1 && eq(core, a).id === 'pip');
    secs(core, 1.5); const b = mkActor(ctx, 'b', 'ember'); b.pos.copy(core.drops[0].pos); b.pos.y = 0; step(core, 4);
    check('teammate walking over drop auto-picks it up (empty slot 1)', b.inventory.slots[1]?.id === 'arc' && core.drops.length === 0);
    // ammo preserved through drop/pickup
  }
  { // reload, cancel by switch, ammo model
    const { ctx, core } = makeCtx(); const a = mkActor(ctx, 'a', 'ember'); readyWeapon(core, a, 'arc');
    a.ai.cmd.fire = true; secs(core, 0.5); a.ai.cmd.fire = false;
    const w = eq(core, a); const fired = 30 - w.mag; check('AK: 0.5 s hold-fire = ~6 shots at 600 rpm', fired >= 5 && fired <= 6, String(fired));
    a.ai.cmd.reload = true; step(core, 2); a.ai.cmd.reload = false; check('reload starts', w.state === 'reload');
    secs(core, 1.0); a.ai.cmd.slot = 2; step(core, 2); a.ai.cmd.slot = 0; check('switching cancels reload (mag unchanged)', w.mag === 30 - fired && w.state !== 'reload', `${w.mag}`);
    core.switchTo(a, 1); secs(core, 1.0); a.ai.cmd.reload = true; step(core, 2); a.ai.cmd.reload = false; secs(core, 2.5);
    check('reload completes in 2.43 s: mag 30, reserve 90 - fired', w.mag === 30 && w.reserve === 90 - fired, `${w.mag}/${w.reserve}`);
  }
  { // magazine empty -> auto reload; dry click event
    const { ctx, core } = makeCtx(); const a = mkActor(ctx, 'a', 'ember'); readyWeapon(core, a, 'pip'); const w = eq(core, a); let empties = 0; ctx.events.on('weapon:empty', () => empties++);
    a.ai.cmd.fire = true; secs(core, 3); check('pip empties 12 rounds, auto-reloads', w.mag > 0 || w.state === 'reload', `${w.mag}/${w.reserve} ${w.state}`); a.ai.cmd.fire = false;
  }
  { // burst weapons + bolt/scope + shotgun shell reload + melee
    const { ctx, core } = makeCtx(); const a = mkActor(ctx, 'a', 'ember'); readyWeapon(core, a, 'halo'); const w = eq(core, a);
    a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false; secs(core, 0.3);
    check('halo: one trigger pull = 3-round burst', 30 - w.mag === 3, String(30 - w.mag));
    readyWeapon(core, a, 'twin'); const t = eq(core, a); a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false; secs(core, 0.3); check('twin: burst of 2', 30 - t.mag === 2, String(30 - t.mag));
    readyWeapon(core, a, 'lance'); const l = eq(core, a); a.ai.cmd.aim = true; step(core, 2); a.ai.cmd.aim = false; step(core, 2);
    check('lance: RMB scopes (level 1) then again (level 2) then off', l.scopeLevel === 1 && (a.ai.cmd.aim = true, step(core, 2), a.ai.cmd.aim = false, step(core, 2), l.scopeLevel === 2) && (a.ai.cmd.aim = true, step(core, 2), a.ai.cmd.aim = false, step(core, 2), l.scopeLevel === 0));
    a.ai.cmd.aim = true; step(core, 2); a.ai.cmd.aim = false; step(core, 2); a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false;
    check('lance: firing unscopes; bolt cycle blocks second shot for 1.45 s', l.scopeLevel === 0 && l.mag === 4, `mag ${l.mag}`);
    a.ai.cmd.fire = true; secs(core, 1.0); a.ai.cmd.fire = false; check('lance: no shot at +1.0 s', l.mag === 4, `mag ${l.mag}`);
    secs(core, 0.5); check('lance: scope resumes after bolt cycle', l.scopeLevel === 1, `level ${l.scopeLevel}`);
    readyWeapon(core, a, 'scatter'); const s = eq(core, a); a.ai.cmd.fire = true; secs(core, 0.4); a.ai.cmd.fire = false; check('scatter: fires 1 shell per 0.35 s (cycle)', s.mag === 5, String(s.mag));
    a.ai.cmd.reload = true; step(core, 2); a.ai.cmd.reload = false; secs(core, 0.45 + 0.5 * 2 + 0.05); check('scatter: shell-by-shell reload (+1 per 0.5 s after 0.45 s)', s.mag >= 6, String(s.mag));
    a.ai.cmd.fire = true; step(core, 2); a.ai.cmd.fire = false; check('scatter: firing interrupts the reload', s.state !== 'reload');
  }
  { // hits, events, friendly fire, wallbang
    const { ctx, core } = makeCtx(); const a = mkActor(ctx, 'a', 'ember'); const v = mkActor(ctx, 'v', 'tide', 0, -12, false); const mate = mkActor(ctx, 'm', 'ember', 0, -6, false);
    readyWeapon(core, a, 'arc'); a.pitch = -0.03; const ev = { hit: [], out: [] }; ctx.events.on('tag:hit', (e) => ev.hit.push(e)); ctx.events.on('tag:out', (e) => ev.out.push(e));
    a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false;
    check('friendly-fire off: teammate in front is shot through, victim behind hit', ev.hit.length === 1 && ev.hit[0].victim === v && mate.hp === 100, ev.hit.length + ' hits');
    const e0 = ev.hit[0]; check('tag:hit payload keys', ['attacker', 'victim', 'damage', 'hitgroup', 'point', 'dir', 'tagger', 'armorAbsorbed'].every((k) => k in e0));
    secs(core, 1); a.ai.cmd.fire = true; secs(core, 0.6); a.ai.cmd.fire = false;
    check('AK kills unarmoured in 3 body hits ~ (tag:out fired once, payload keys)', ev.out.length === 1 && ['attacker', 'victim', 'tagger', 'hitgroup', 'assist', 'wallbang', 'through'].every((k) => k in ev.out[0]), `out=${ev.out.length} hp=${v.hp} hits=${ev.hit.map((h) => h.hitgroup + ':' + h.damage).join(',')}`);
    check('victim alive=false/tagged after tag:out; stats updated', v.alive === false && v.tagged && a.stats.tags === 1 && v.stats.outs === 1);
    // wallbang
    const v2 = mkActor(ctx, 'v2', 'tide', 0, -14, false); ctx.map.add(-3, 0, -8.12, 3, 3, -8, { thin: true, surface: 'wood' }); ctx.map.thinWalls.push(new THREE.Box3(new THREE.Vector3(-3, 0, -8.12), new THREE.Vector3(3, 3, -8)));
    ev.hit.length = 0; ev.out.length = 0; core.reset(a, { keep: true, revive: false }); readyWeapon(core, a, 'arc'); a.pitch = -0.012; a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false;
    const wb = ev.hit[0]; check('wallbang through thin wood wall: hit, wallbang flag, reduced damage', !!wb && wb.wallbang && wb.through === 'wood' && wb.damage < 36 && wb.damage > 15, wb ? `${wb.damage} dmg through ${wb.through}` : 'no hit');
    ctx.map.add(-3, 0, -10, 3, 3, -9, { surface: 'stone' }); ev.hit.length = 0; secs(core, 0.3); a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false;
    check('1 m stone wall blocks the shot', ev.hit.length === 0);
    // melee
    const v3 = mkActor(ctx, 'v3', 'tide', 5, -1, false); const m = mkActor(ctx, 'm2', 'ember', 5, 0.5, true); m.yaw = 0; v3.yaw = 0;
    readyWeapon(core, m, 'pip'); core.switchTo(m, 3); secs(core, 0.7); ev.hit.length = 0; m.ai.cmd.fire = true; step(core, 1); m.ai.cmd.fire = false; secs(core, 0.2);
    check('tap slash from behind (victim facing away) = 90', ev.hit[0] && ev.hit[0].damage === 90, ev.hit[0] ? String(ev.hit[0].damage) : 'miss');
  }
  { // held fire through a draw fires when ready; scope event on rescope; no damage after the round is decided
    const { ctx, core } = makeCtx(); const a = mkActor(ctx, 'a', 'ember'); step(core, 2); core.switchTo(a, 3); secs(core, 0.8);
    core.switchTo(a, 2); a.ai.cmd.fire = true; secs(core, 1.0); a.ai.cmd.fire = false; check('semi-auto: fire held through draw shoots once ready', eq(core, a).mag < 12, `mag ${eq(core, a).mag}`);
    readyWeapon(core, a, 'lance'); const sc = []; ctx.events.on('weapon:scope', (e) => sc.push(e.scoped)); const l = eq(core, a);
    a.ai.cmd.aim = true; step(core, 2); a.ai.cmd.aim = false; step(core, 2); a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false; secs(core, 1.6);
    check('weapon:scope events: in, out (bolt), in (resume)', JSON.stringify(sc) === '[true,false,true]', JSON.stringify(sc));
    const v = mkActor(ctx, 'v', 'tide', 0, -12, false); readyWeapon(core, a, 'arc'); a.pitch = -0.03; ctx.match = { phase: 'roundEnd' }; a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false;
    check('no tags during roundEnd (damage refused)', v.hp === 100 && ctx.log.hit.length === 0);
    ctx.match = { phase: 'live' }; secs(core, 0.3); a.ai.cmd.fire = true; step(core, 1); a.ai.cmd.fire = false; check('tags resume when live', v.hp < 100);
  }
  { // human path (ctx.input): semi-auto held through draw fires exactly once; releasing and clicking fires again
    const { ctx, core } = makeCtx(); const held = new Set(); ctx.input = { locked: true, down: (k) => held.has(k), pressed: () => false, released: () => false };
    const h = mkActor(ctx, 'h', 'ember', 0, 0, false); ctx.localActor = h; step(core, 2); core.switchTo(h, 3); secs(core, 0.8);
    held.add('slot2'); step(core, 2); held.delete('slot2'); held.add('fire'); secs(core, 1.2);
    check('human: LMB held through Pip draw -> one shot (semi-auto)', eq(core, h).mag === 11, `mag ${eq(core, h).mag}`);
    held.delete('fire'); secs(core, 0.3); held.add('fire'); step(core, 2); held.delete('fire'); check('human: click fires again', eq(core, h).mag === 10, `mag ${eq(core, h).mag}`);
    core.brain(h).wheel = 1; step(core, 2); check('mouse wheel cycles weapon', eq(core, h).id === 'tap', eq(core, h).id);
  }
  { // punch + crosshair
    const { ctx, core } = makeCtx(); const a = mkActor(ctx, 'a', 'ember'); readyWeapon(core, a, 'arc');
    const x0 = core.crosshairSpread(a); a.ai.cmd.fire = true; secs(core, 0.6); const x1 = core.crosshairSpread(a); const ap = core.aimPunch(a, {}); a.ai.cmd.fire = false;
    check('crosshairSpread grows while spraying', x1 > x0, `${x0.toFixed(3)} -> ${x1.toFixed(3)}`); check('aim punch (view) climbs while spraying', ap.pitch > 0.03, `${(ap.pitch * 57.3).toFixed(2)}°`);
    secs(core, 1.2); check('recoil recovers after 1.2 s', core.aimPunch(a, {}).pitch < 0.003 && a.cb.recoilIdx < 0.2, `idx ${a.cb.recoilIdx.toFixed(2)}`);
  }
}

// ---------------------------------------------------------------------------------------------------- run
console.log('combat test — trials', TRIALS, 'dist', DIST, 'm');
csChecks(); functional();
ttkTables(); accuracyTables();
const spray = sprayAll();
// summary of measured clouds
console.log('\n== measured spray (stand): mean offset of shot 10 / 20, mean cone at shot 10 (deg) ==');
for (const id of Object.keys(spray)) {
  const st = spray[id].stances.stand, n = Math.min(...st.map((t) => t.length)); if (n < 3) continue;
  const at = (k) => { const xs = st.map((t) => t[Math.min(k, n - 1)]); return [xs.reduce((a, p) => a + p[0], 0) / xs.length, xs.reduce((a, p) => a + p[1], 0) / xs.length]; };
  const a10 = at(9), a20 = at(19); const r10 = Math.sqrt(st.reduce((s, t) => s + (t[Math.min(9, n - 1)][0] - a10[0]) ** 2 + (t[Math.min(9, n - 1)][1] - a10[1]) ** 2, 0) / st.length);
  console.log(`${id.padEnd(8)} shots ${String(n).padStart(2)}  #10 (${a10[0].toFixed(2)}, ${a10[1].toFixed(2)})  #20 (${a20[0].toFixed(2)}, ${a20[1].toFixed(2)})  scatter rms ${r10.toFixed(2)}°`);
}
const py = spawnSync('python3', [path.join(here, 'plot_spray.py'), path.join(OUT, 'spray.json'), OUT], { encoding: 'utf8' });
console.log(py.stdout.trim() || py.stderr.trim());
console.log(`\n${fails ? fails + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'}   -> ${path.relative(process.cwd(), OUT)}/{spray_*.png,spray_all.png,ttk.md,accuracy.md}`);
process.exit(fails ? 1 : 0);
