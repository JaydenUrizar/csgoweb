// Scripted-input movement harness (owner: move).  node tools/move_test.mjs [--only name,name] [--out shots/move/move_test.json] [--quiet]
// Runs the REAL shared simulate() at 120 Hz against the movement course (src/player/course.js) with scripted input,
// prints stats to compare with CS2 and dumps chart data (speed vs time etc.) to shots/move/move_test.json
// (render with:  python3 tools/move_plot.py).
import * as THREE from 'three';
import fs from 'node:fs';
import { MeshBVH } from 'three-mesh-bvh';
import { buildCourse } from '../src/player/course.js';
import { createSim, TUNE } from '../src/player/simulate.js';
import { createActor } from '../src/core/actor.js';
import { fits, gather, maxPenetration } from '../src/player/geom.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const only = opt('only', '') ? opt('only', '').split(',') : null;
const OUT = opt('out', 'shots/move/move_test.json');
const quiet = args.includes('--quiet');

const DT = 1 / 120;
const course = buildCourse();
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(course.positions, 3));
geo.boundsTree = new MeshBVH(geo);
const collider = { geometry: geo };
const ST = course.stations;
let events = [];
const sim = createSim({ collider: () => collider, emit: (t, d) => events.push({ t, ...d, actor: undefined }), surfaceAt: () => 'stone' });

const RUN = TUNE.runSpeed;
const f2 = (v) => (Math.abs(v) < 1e-9 ? '0.00' : v.toFixed(2));
const f3 = (v) => v.toFixed(3);
const results = {}, charts = {};
const print = (...a) => { if (!quiet) console.log(...a); };
const head = (s) => print('\n=== ' + s + ' ' + '='.repeat(Math.max(0, 70 - s.length)));

function mkActor(x = 0, y = 0, z = 0, yaw = 0) {
  const a = createActor({ name: 't', team: 'ember', isPlayer: true });
  a.pos.set(x, y, z); a.yaw = yaw; a.move = null; return a;
}
function mkAt(name) { const s = ST[name]; return mkActor(s.x, s.y, s.z, s.yaw); }
const cmd0 = () => ({ forward: 0, right: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0 });

// run `seconds` of ticks; fn(t, a, m, cmd, i) mutates cmd each tick; returns samples
function run(a, seconds, fn, opts = {}) {
  const cmd = opts.cmd || cmd0(); cmd.yaw = a.yaw;
  const n = Math.round(seconds / DT), samples = [];
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    fn?.(t, a, a.move, cmd, i);
    sim.simulate(a, cmd, DT);
    const m = a.move;
    samples.push({ t: +(t + DT).toFixed(4), x: a.pos.x, y: a.pos.y, z: a.pos.z, vx: a.vel.x, vy: a.vel.y, vz: a.vel.z, hs: m.speed, g: m.onGround ? 1 : 0, sl: m.sliding ? 1 : 0, cr: m.crouching ? 1 : 0, vs: m.viewStep });
    if (opts.until && opts.until(a, m, samples[samples.length - 1])) break;
  }
  return samples;
}
const timeTo = (s, pred) => { for (const p of s) if (pred(p)) return p.t; return NaN; };
const yawFor = (wx, wz) => Math.atan2(-wx, -wz);        // yaw whose forward vector is (wx,wz)
const thin = (s, every = 2, keys = ['t', 'hs']) => s.filter((_, i) => i % every === 0).map((p) => keys.map((k) => +p[k].toFixed(3)));
function plotAscii(label, s, key, w = 60, h = 8, lo, hi) {
  if (quiet) return;
  const vals = s.map((p) => p[key]); lo = lo ?? Math.min(...vals); hi = hi ?? Math.max(...vals); if (hi - lo < 1e-6) hi = lo + 1;
  const rows = Array.from({ length: h }, () => Array(w).fill(' '));
  for (let x = 0; x < w; x++) { const v = vals[Math.min(vals.length - 1, Math.floor(x / w * vals.length))]; const y = Math.round((v - lo) / (hi - lo) * (h - 1)); rows[h - 1 - y][x] = '*'; }
  print(`  ${label}  [${lo.toFixed(2)} .. ${hi.toFixed(2)}] over ${(s[s.length - 1].t).toFixed(2)}s`);
  for (const r of rows) print('  |' + r.join(''));
}
function should(name) { return !only || only.includes(name); }

// -----------------------------------------------------------------------------------------------
if (should('accel')) {
  head('1. accelerate from rest (flat, hold W)');
  const a = mkAt('flat'); a.pos.set(0, 0, 25);
  const s = run(a, 1.0, (t, a, m, c) => { c.forward = 1; });
  const t50 = timeTo(s, (p) => p.hs >= 0.5 * RUN), t90 = timeTo(s, (p) => p.hs >= 0.9 * RUN), t99 = timeTo(s, (p) => p.hs >= 0.99 * RUN);
  results.accel = { runSpeed: s[s.length - 1].hs, t50, t90, t99 };
  charts.accel = { title: 'accelerate from rest', series: { speed: thin(s, 1) } };
  print(`  top speed ${f2(s[s.length - 1].hs)} m/s (CS2 ref 4.76 knife) | t50 ${f3(t50)}s  t90 ${f3(t90)}s  t99 ${f3(t99)}s   (CS2: ~0.18 s to full)`);
  plotAscii('speed', s, 'hs', 60, 7, 0, 7);
  // diagonal must not be faster
  const b = mkAt('flat'); b.pos.set(0, 0, 25);
  const sd = run(b, 1.0, (t, a, m, c) => { c.forward = 1; c.right = 1; });
  results.accel.diagonalSpeed = sd[sd.length - 1].hs; print(`  diagonal W+D top speed ${f2(sd[sd.length - 1].hs)} (must equal run)`);
  const w = mkAt('flat'); w.pos.set(0, 0, 25); const sw = run(w, 1.0, (t, a, m, c) => { c.forward = 1; c.walk = true; });
  const cc = mkAt('flat'); cc.pos.set(0, 0, 25); const sc = run(cc, 1.5, (t, a, m, c) => { c.forward = 1; c.crouch = true; });
  results.accel.walk = sw[sw.length - 1].hs; results.accel.crouch = sc[sc.length - 1].hs;
  print(`  walk ${f2(sw[sw.length - 1].hs)} (=${f2(sw[sw.length - 1].hs / RUN)}x, CS2 0.52)   crouch ${f2(sc[sc.length - 1].hs)} (=${f2(sc[sc.length - 1].hs / RUN)}x, CS2 0.34)`);
}

// -----------------------------------------------------------------------------------------------
if (should('stop')) {
  head('2. stopping: counter-strafe vs release');
  const acc = RUN * TUNE.crouchMul + 0.12;
  const scen = (label, fnStop) => {
    const a = mkAt('flat'); a.pos.set(0, 0, 25);
    let tStop = -1;
    const s = run(a, 2.2, (t, a, m, c) => {
      if (t < 1.0) { c.forward = 1; c.right = 0; }
      else { if (tStop < 0) tStop = t; fnStop(t - 1.0, a, m, c); }
    });
    const after = s.filter((p) => p.t > 1.0);
    const tAcc = timeTo(after, (p) => p.hs <= acc) - 1.0, tZero = timeTo(after, (p) => p.hs < 0.05) - 1.0;
    const dist = Math.abs(after[after.length - 1].z - s.find((p) => p.t >= 1.0).z);
    print(`  ${label.padEnd(34)} accurate (<${f2(acc)} m/s) after ${f3(tAcc)}s | full stop ${f3(tZero)}s | slid ${f2(dist)} m`);
    return { label, tAcc, tZero, dist, s };
  };
  const rel = scen('release W (friction only)', (t, a, m, c) => { c.forward = 0; });
  const cs = scen('counter-strafe (S held until slow)', (t, a, m, c) => { c.forward = a.move.speed > acc * 0.9 ? -1 : 0; });
  const cs2 = scen('counter-strafe tap 60ms', (t, a, m, c) => { c.forward = t < 0.06 ? -1 : 0; });
  const cs3 = scen('counter-strafe hold 120ms', (t, a, m, c) => { c.forward = t < 0.12 ? -1 : 0; });
  results.stop = { release: { tAcc: rel.tAcc, tZero: rel.tZero }, counterStrafe: { tAcc: cs.tAcc, tZero: cs.tZero }, tap60: { tAcc: cs2.tAcc, tZero: cs2.tZero }, hold120: { tAcc: cs3.tAcc, tZero: cs3.tZero } };
  charts.stop = { title: 'stopping (t=0 at key change)', series: { release: thin(rel.s.filter((p) => p.t > 0.95), 1).map(([t, h]) => [t - 1, h]), counterStrafe: thin(cs.s.filter((p) => p.t > 0.95), 1).map(([t, h]) => [t - 1, h]) } };
  print('  CS2 reference: counter-strafe stop ~0.06-0.1 s; plain release ~0.3-0.4 s');
}

// -----------------------------------------------------------------------------------------------
function airStrafeBot(mode) {
  // mode: 'perfect' | 'w' | 'none'.  Returns per-tick controller.
  let side = 1, lastFlip = 0;
  return (t, a, m, c) => {
    c.jump = true;                                              // jump buffered by the sim (edge every ~ hop)
    if (m && m.onGround) { c.jump = ((Math.floor(t / DT) % 2) === 0); }   // pulse to generate a fresh edge on landing
    const v = a.vel; const hs = Math.hypot(v.x, v.z);
    if (!m || m.onGround) { c.forward = 1; c.right = 0; if (hs > 0.5) c.yaw = Math.atan2(-v.x, -v.z); return; }
    if (mode === 'w') { c.forward = 1; c.right = 0; return; }
    if (mode === 'none') { c.forward = 0; c.right = 0; return; }
    // optimal wish angle relative to velocity: cos φ = cap / hs  (gain per tick maximal)
    const cap = TUNE.airCap;
    const as = TUNE.airAccel * TUNE.runSpeed * DT; const phi = hs > cap ? Math.acos(Math.max(0, Math.min(1, (cap - as) / hs))) : 0;
    // sweep side every 0.5 s of air so the path zig-zags instead of curving off
    if (t - lastFlip > 0.30) { side = -side; lastFlip = t; }
    const ang = Math.atan2(-v.x, -v.z) + side * phi; // yaw of velocity dir + offset
    c.yaw = ang; c.forward = 1; c.right = 0;
  };
}
if (should('bhop')) {
  head('3. bunny-hop chain (jump buffered, 12 hops)');
  for (const mode of ['perfect', 'w', 'none']) {
    const a = mkAt('lane'); a.pos.set(56, 0, 58); a.yaw = 0;
    const takeoffs = [];
    events = [];
    const s = run(a, 9, (t, a, m, c) => { airStrafeBot(mode)(t, a, m, c); if (t < 0.6) { c.jump = false; c.yaw = 0; c.forward = 1; } }, { cmd: cmd0() });
    const jumps = events.filter((e) => e.t === 'jump').map((e) => +e.speed.toFixed(2));
    const peak = Math.max(...s.map((p) => p.hs));
    results['bhop_' + mode] = { jumps, peak, final: s[s.length - 1].hs };
    charts['bhop_' + mode] = { title: 'bhop ' + mode, series: { speed: thin(s, 2), z: thin(s, 4, ['t', 'z']) } };
    print(`  ${mode.padEnd(8)} hops ${jumps.length}  takeoff speeds: ${jumps.map((v) => f2(v)).join(' ')}  | peak ${f2(peak)} m/s (${f2(peak / RUN)}x run)`);
  }
  print(`  soft cap: takeoff cap ${TUNE.bhopCap} (keep ${TUNE.bhopKeep} of excess), air gain fades ${TUNE.softStart}→${TUNE.softEnd} m/s, hard max ${TUNE.hardMax}`);
}

// -----------------------------------------------------------------------------------------------
if (should('airturn')) {
  head('4. air-strafe turn (jump at run speed, curve 90°)');
  const a = mkAt('flat'); a.pos.set(-30, 0, 25); a.yaw = 0;
  let yaw = 0, jumped = false;
  const s = run(a, 1.2, (t, a, m, c) => {
    if (t < 0.5) { c.forward = 1; return; }
    if (m && m.onGround && jumped) { c.forward = 0; c.yaw = a.yaw; return; }
    if (!jumped) { c.jump = true; jumped = true; return; } c.jump = false;
    // W + A, turning yaw left at a rate that follows the ideal strafe
    const v = a.vel; const hs = Math.hypot(v.x, v.z);
    const phi = Math.acos(Math.max(0, Math.min(1, (TUNE.airCap - TUNE.airAccel * TUNE.runSpeed * DT) / hs)));
    c.forward = 1; c.right = 0; c.yaw = Math.atan2(-v.x, -v.z) + phi;
  });
  const iLand = s.findIndex((p, i) => p.t > 0.7 && p.g); const last = iLand > 0 ? s[iLand - 1] : s[s.length - 1];
  const a0 = Math.atan2(s[Math.round(0.45 / DT)].vx, s[Math.round(0.45 / DT)].vz), a1 = Math.atan2(last.vx, last.vz);
  let dAng = (a1 - a0) * 180 / Math.PI; while (dAng > 180) dAng -= 360; while (dAng < -180) dAng += 360;
  results.airturn = { speedIn: s[Math.round(0.45 / DT)].hs, speedOut: last.hs, turnDeg: Math.abs(dAng) };
  print(`  in ${f2(results.airturn.speedIn)} m/s → out ${f2(last.hs)} m/s after ${f2(last.t - 0.5)}s, heading changed ${f2(Math.abs(dAng))}°  (perfect strafe GAINS speed while turning)`);
  charts.airturn = { title: 'air-strafe turn', series: { speed: thin(s, 2) } };
}

// -----------------------------------------------------------------------------------------------
if (should('slide')) {
  head('5. slide (run 1 s then crouch)');
  events = [];
  const a = mkAt('lane'); a.pos.set(56, 0, 58);
  let tC = 1.0;
  const s = run(a, 2.6, (t, a, m, c) => { c.forward = 1; c.crouch = t >= tC && t < tC + 1.2; });
  const sl = s.filter((p) => p.sl), t0 = sl[0]?.t ?? NaN, t1 = sl[sl.length - 1]?.t ?? NaN;
  const peak = Math.max(...s.map((p) => p.hs));
  results.slide = { start: t0, duration: t1 - t0, peakSpeed: peak, endSpeed: sl.length ? sl[sl.length - 1].hs : NaN, distance: sl.length ? Math.abs(sl[sl.length - 1].z - sl[0].z) : 0 };
  print(`  slide starts ${f3(t0)}s, lasts ${f3(t1 - t0)}s, peak ${f2(peak)} m/s, ends at ${f2(results.slide.endSpeed)} m/s, distance ${f2(results.slide.distance)} m`);
  charts.slide = { title: 'slide', series: { speed: thin(s, 1) , sliding: thin(s.map((p) => ({ t: p.t, v: p.sl })), 2, ['t', 'v']) } };
  plotAscii('speed', s, 'hs', 60, 7, 0, 9.5);
  // slide down slope
  const b = mkAt('slideSlope'); b.pos.set(46, 3, 57);
  const s2 = run(b, 4.0, (t, a, m, c) => { c.forward = 1; c.crouch = t >= 0.9 && t < 3.2; });
  const sl2 = s2.filter((p) => p.sl);
  results.slideSlope = { peak: Math.max(...s2.map((p) => p.hs)), duration: sl2.length ? sl2[sl2.length - 1].t - sl2[0].t : 0 };
  print(`  slide down 10° decline: peak ${f2(results.slideSlope.peak)} m/s, slide lasted ${f2(results.slideSlope.duration)} s`);
  charts.slideSlope = { title: 'slide on decline', series: { speed: thin(s2, 2) } };
  // slide-jump chain: does jumping out of a slide keep speed
  const c = mkAt('lane'); c.pos.set(56, 0, 58); events = [];
  const s3 = run(c, 2.2, (t, a, m, cm) => { cm.forward = 1; cm.crouch = t >= 1 && t < 1.5; cm.jump = t >= 1.25 && t < 1.28; });
  print(`  slide→jump: speed before jump ${f2(s3.find((p) => p.t >= 1.25).hs)} → after ${f2(s3.find((p) => p.t >= 1.5).hs)} m/s`);
}

// -----------------------------------------------------------------------------------------------
if (should('jump')) {
  head('6. jump arc');
  events = [];
  const a = mkAt('flat'); a.pos.set(0, 0, 25);
  const s = run(a, 1.2, (t, a, m, c) => { c.jump = t > 0.1 && t < 0.12; });
  const peak = Math.max(...s.map((p) => p.y)), ta = s.find((p) => p.t > 0.12 && p.g), air = ta ? ta.t - 0.11 : NaN;
  results.jump = { peak, hang: air };
  print(`  standing jump peak ${f3(peak)} m (target 1.05), hang ${f3(air)} s.  CS2: 66u@800 → 1.25 m (0.01905 m/u) hang 0.755 s; ours is crisper.`);
  charts.jump = { title: 'standing jump height', series: { y: thin(s.map((p) => ({ t: p.t, v: p.y })), 1, ['t', 'v']) } };
  const b = mkAt('lane'); b.pos.set(56, 0, 58);
  const s2 = run(b, 2.2, (t, a, m, c) => { c.forward = 1; c.jump = t > 1.0 && t < 1.02; });
  const j = s2.find((p) => p.t > 1.02 && !p.g), l = s2.find((p) => p.t > 1.1 && p.g);
  const dist = l ? Math.hypot(l.x - j.x, l.z - j.z) : NaN;
  results.jump.runDistance = dist; results.jump.runPeak = Math.max(...s2.map((p) => p.y));
  print(`  run-jump: peak ${f3(results.jump.runPeak)} m, distance ${f2(dist)} m at ${f2(RUN)} m/s (hang ${f3(l.t - j.t)} s)`);
  const c = mkAt('lane'); c.pos.set(56, 0, 58);
  const s3 = run(c, 1.6, (t, a, m, cm) => { cm.jump = t > 0.1 && t < 0.12; cm.crouch = t > 0.3; });
  print(`  crouch-jump peak ${f3(Math.max(...s3.map((p) => p.y)))} m (hull shrinks in the air, feet unchanged)`);
  // jump buffer: press jump 90 ms before landing
  const d = mkAt('flat'); d.pos.set(0, 0, 25);
  let landedAt = null;
  const s4 = run(d, 2.0, (t, a, m, cm) => {
    cm.jump = (t > 0.1 && t < 0.12);
    if (landedAt === null && m && m.airTime > 0.45) { landedAt = t; }
  });
  events = [];
  const e = mkAt('flat'); e.pos.set(0, 0, 25);
  // time the second press ~90 ms before touchdown (hang 0.60 s → press at 0.1+0.5 = 0.6)
  const s5 = run(e, 1.6, (t, a, m, cm) => { cm.jump = (t > 0.1 && t < 0.12) || (t > 0.72 && t < 0.74); });
  const jumps = events.filter((x) => x.t === 'jump').length;
  print(`  jump buffer (press ~0.11 s before landing) → ${jumps} jumps registered (expect 2)`);
  // coyote: walk off the crest ledge and press jump 50 ms later
  const f = mkAt('crest'); f.pos.set(8, 0, 44); events = [];
  let offT = -1;
  run(f, 3.0, (t, a, m, cm) => { cm.forward = 1; if (offT < 0 && m && !m.onGround) offT = t; cm.jump = offT >= 0 && t > offT + 0.05 && t < offT + 0.07; });
  print(`  coyote: jump pressed 50 ms after leaving a ledge → jumps=${events.filter((x) => x.t === 'jump').length} (expect 1 if it left ground without a jump)`);
}

// -----------------------------------------------------------------------------------------------
if (should('stairs')) {
  head('7. stairs');
  results.stairs = {};
  for (const name of ['stairs18', 'stairs30', 'stairs44', 'stairs50', 'stairsFine']) {
    const a = mkAt(name); a.pos.z -= 4;
    const s = run(a, 5.0, (t, a, m, c) => { c.forward = 1; });
    const top = Math.max(...s.map((p) => p.y));
    let minSp = 99; for (const p of s) if (p.t > 0.6 && p.z > -100) minSp = Math.min(minSp, p.hs);
    // camera height = y + viewStep smoothing: worst per-tick change
    let maxJump = 0, maxCam = 0; for (let i = 1; i < s.length; i++) { maxJump = Math.max(maxJump, Math.abs(s[i].y - s[i - 1].y)); maxCam = Math.max(maxCam, Math.abs((s[i].y + s[i].vs) - (s[i - 1].y + s[i - 1].vs))); }
    results.stairs[name] = { top, minSpeed: minSp, maxPosJump: maxJump, maxCamJump: maxCam };
    print(`  ${name.padEnd(11)} top reached ${f2(top)} m | min speed while climbing ${f2(minSp)} | max Δy/tick physics ${f3(maxJump)} → camera ${f3(maxCam)} m/tick (${f2(maxCam * 120)} m/s)`);
    if (name === 'stairs18') charts.stairs18 = { title: 'stairs18 y / camera y', series: { y: thin(s.map((p) => ({ t: p.t, v: p.y })), 1, ['t', 'v']), cam: thin(s.map((p) => ({ t: p.t, v: p.y + p.vs })), 1, ['t', 'v']), speed: thin(s, 1) } };
  }
}

// -----------------------------------------------------------------------------------------------
if (should('ramps')) {
  head('8. ramps (run up from 6 m out)');
  results.ramps = {};
  for (const deg of [8, 15, 25, 35, 44, 50, 60]) {
    const a = mkAt('ramp' + deg);
    const s = run(a, 4.5, (t, a, m, c) => { c.forward = 1; });
    const top = Math.max(...s.map((p) => p.y)); const climbed = top > 2.9;
    const mid = s.filter((p) => p.y > 0.5 && p.g); const avgSp = mid.length ? mid.reduce((q, p) => q + p.hs, 0) / mid.length : 0;
    // downhill: from plateau run back
    results.ramps[deg] = { climbed, top, avgSpeed: avgSp };
    print(`  ${String(deg).padStart(2)}°  ${climbed ? 'CLIMBS' : 'blocked'}  top ${f2(top)} m  avg speed on ramp ${f2(avgSp)} m/s`);
  }
  // downhill stays grounded?
  for (const deg of [15, 35, 44]) {
    const st = ST['ramp' + deg]; const h = 3, run_ = h / Math.tan(deg * Math.PI / 180);
    const a = mkActor(st.x, h, st.z - 6 - run_ - 3, Math.PI);          // on plateau facing +z (toward ramp bottom)
    let air = 0, first = true;
    const s = run(a, 3.5, (t, a, m, c) => { c.forward = 1; c.yaw = Math.PI; if (m && !m.onGround) air++; });
    print(`  downhill ${deg}°: airborne ticks ${air} (run off plateau edge then down slope), end y ${f2(s[s.length - 1].y)}`);
  }
  // crest launch
  const cst = mkAt('crest'); events = [];
  const s = run(cst, 3.0, (t, a, m, c) => { c.forward = 1; });
  print(`  crest run at ${f2(RUN)} m/s: ${events.some((e) => e.t === 'land') ? 'launched then landed' : 'stayed glued'}, max airtime ${f3(Math.max(...s.map((p, i) => (p.g ? 0 : 1))) * 1)}`);
}

// -----------------------------------------------------------------------------------------------
if (should('ledges')) {
  head('9. ledges / mantle (run + jump into each box, and walk-only)');
  results.ledges = {};
  const rows = [];
  for (const h of [0.3, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2.0]) {
    const walk = (() => { const a = mkAt('ledge' + h); const s = run(a, 2.0, (t, a, m, c) => { c.forward = 1; }); return Math.max(...s.map((p) => p.y)) > h - 0.02; })();
    events = [];
    const a = mkAt('ledge' + h); a.pos.z += 2.5;
    let tj = -1;
    const s = run(a, 2.0, (t, a, m, c) => { c.forward = 1; c.jump = (a.pos.z < -9 + 2 + 1.9 && a.pos.z > -9 + 2 + 1.4); });
    const on = s[s.length - 1].y > h - 0.05;
    const mantles = events.filter((e) => e.t === 'mantle').length;
    results.ledges[h] = { walkUp: walk, jumpUp: on, mantles };
    rows.push(`${h.toFixed(2)}m: walk ${walk ? 'YES' : ' no'} | jump ${on ? 'YES' : ' no'}${mantles ? ' (mantle)' : ''}`);
  }
  for (let i = 0; i < rows.length; i += 2) print('  ' + rows[i].padEnd(38) + (rows[i + 1] || ''));
}

// -----------------------------------------------------------------------------------------------
if (should('tight')) {
  head('10. tight spaces & corners (hold W the whole way)');
  const pass = (name, secs, endPred, opts = {}) => {
    const a = mkAt(name); if (opts.start) a.pos.set(...opts.start);
    let minSp = 99, pen = 0;
    const s = run(a, secs, (t, a, m, c) => { c.forward = 1; if (opts.crouch) c.crouch = true; if (opts.yawFn) c.yaw = opts.yawFn(t); });
    const ok = endPred(s[s.length - 1]);
    return { ok, s };
  };
  const R2 = {};
  for (const w of [0.75, 0.9, 1.2]) { const st = ST['corridor' + w]; const r = pass('corridor' + w, 4.0, (p) => p.z < -36.5); R2['corridor' + w] = r.ok; print(`  straight corridor ${w} m: ${r.ok ? 'passes' : 'STUCK'} (end z ${f2(r.s[r.s.length - 1].z)})`); }
  { const r = pass('zigzag', 8, (p) => p.z < -38, { yawFn: (t) => 0 }); print(`  zigzag (W only, no steering): ${r.ok ? 'passes' : 'stops at ' + f2(r.s[r.s.length - 1].z)} (walls guide you around the bends: expected to slide/stop)`); }
  for (const w of [0.9, 0.78, 0.7]) { const r = pass('door' + w, 2.0, (p) => p.z < -13.5); R2['door' + w] = r.ok; print(`  doorway ${w} m: ${r.ok ? 'passes' : 'blocked'} (capsule width 0.72)`); }
  for (const g of [0.8, 0.74, 0.68]) { const r = pass('squeeze' + g, 2.2, (p) => p.z < -38); R2['squeeze' + g] = r.ok; print(`  pillar gap ${g} m: ${r.ok ? 'passes' : 'blocked'}`); }
  for (const hgt of [1.5, 1.3, 1.15]) { const r = pass('tunnel' + hgt, 9.0, (p) => p.z < -31, { crouch: true }); R2['tunnel' + hgt] = r.ok; print(`  crawl tunnel ceiling ${hgt} m while crouched: ${r.ok ? 'passes' : 'blocked'}`); }
  { const a = mkAt('tunnel1.5'); const s = run(a, 3.0, (t, a, m, c) => { c.forward = 1; c.crouch = t < 0.7; }); print(`  tunnel 1.5 m: crouch released inside → stays crouched? end crouching=${a.move.crouching} (auto-crouch under low ceiling) z ${f2(a.pos.z)}`); }
  results.tight = R2;
}

// -----------------------------------------------------------------------------------------------
if (should('walls')) {
  head('11. walls: snagging, sticking, tunnelling');
  // A: run diagonally into a wall at several angles; speed retained along the wall (should slide, not stick)
  const rows = [];
  for (const deg of [5, 15, 30, 45, 70]) {
    const a = mkActor(-0.7, 0, -45.5, 0);          // thin wall at z=-49.98 spans x∈[-10,0]; run toward −x at `deg` off the wall normal
    const s = run(a, 1.5, (t, a, m, c) => { c.forward = 1; c.yaw = deg * Math.PI / 180; });
    const last = s[s.length - 1];
    rows.push({ deg, hs: last.hs, z: last.z, x: last.x });
  }
  print('  angle into thin wall  → speed along wall after 1.5 s (glide expected ≈ run·sin(angle) hs)');
  rows.forEach((r) => print(`    ${String(r.deg).padStart(2)}° : ${f2(r.hs)} m/s at (${f2(r.x)}, ${f2(r.z)})`));
  // B: tunnelling: 14 m/s straight at 2 cm wall from many angles, both directions, all frame sizes
  let leaks = 0, trials = 0;
  for (let ang = -80; ang <= 80; ang += 10) for (const dtm of [DT, 1 / 60, 1 / 30]) for (const dir of [1, -1]) {
    const a = mkActor(-5 + Math.sin(ang * Math.PI / 180) * 4, 0, dir > 0 ? -44 : -56, 0);
    a.vel.set(0, 0, 0);
    a.pos.z = dir > 0 ? -45 : -55; a.pos.x = -5;
    a.yaw = dir > 0 ? ang * Math.PI / 180 : Math.PI + ang * Math.PI / 180;
    const cm = cmd0(); cm.forward = 1; cm.yaw = a.yaw;
    a.move = null;
    for (let i = 0; i < 240; i++) {
      sim.simulate(a, cm, dtm);
      if (i === 30 && a.move) { const k = 14 / Math.max(0.01, Math.hypot(a.vel.x, a.vel.z)); a.vel.x *= k; a.vel.z *= k; }   // fast entry
    }
    trials++;
    const crossed = dir > 0 ? a.pos.z < -50.2 : a.pos.z > -49.8;
    if (crossed && a.pos.x > -10 && a.pos.x < 0) leaks++;
  }
  print(`  tunnelling test (14 m/s at a 2 cm wall, ±80°, dt 8/16/33 ms, both sides): ${leaks}/${trials} leaks`);
  results.walls = { leaks, trials };
  // C: V crease: press into it, measure jitter
  {
    const a = mkAt('vcrease'); a.pos.z = -46;
    const s = run(a, 3.0, (t, a, m, c) => { c.forward = 1; c.right = 0.4; });
    const tail = s.filter((p) => p.t > 1.5); let jit = 0; for (let i = 1; i < tail.length; i++) jit = Math.max(jit, Math.hypot(tail[i].x - tail[i - 1].x, tail[i].z - tail[i - 1].z));
    print(`  V-crease pressed for 3 s: final speed ${f2(s[s.length - 1].hs)} m/s, max motion/tick after settling ${f3(jit)} m, y ${f3(s[s.length - 1].y)}`);
  }
  // D: standing still on flat: zero drift; standing on a box edge: no jitter
  {
    const a = mkAt('flat'); a.pos.set(0, 0, 25); const s = run(a, 1.0, () => {});
    let dz = 0; for (const p of s) dz = Math.max(dz, Math.abs(p.z - 25), Math.abs(p.y - s[0].y));
    print(`  idle on flat 1 s: max drift ${f3(dz)} m (should be ≈0)`);
    const e = mkActor(-5, 0.9 + 0.001, -8 - 0.95 - 0.30, 0); // near the 0.9 box's front edge, standing on top of it? (box x -20…) fall back: use ledge0.9 station box edge
    const st = ST['ledge0.9']; const b = mkActor(st.x, 0.9, -9 + 2 - 0.0 + 0.0, 0); b.pos.z = -8 + 0.95;          // box spans z -9..-7; stand near the back edge
    const s2 = run(b, 1.0, () => {});
    let dd = 0; for (let i = 1; i < s2.length; i++) dd = Math.max(dd, Math.abs(s2[i].y - s2[i - 1].y), Math.abs(s2[i].z - s2[i - 1].z));
    print(`  idle on a box edge (centre 0.05 m past the edge): max motion/tick ${f3(dd)} m, onGround=${s2[s2.length - 1].g}`);
  }
  // E: convex corner: run at a 4 m block corner, slide around — direction stability
  {
    const a = mkAt('block'); a.pos.set(20.6, 0, -44);
    const s = run(a, 2.0, (t, a, m, c) => { c.forward = 1; c.yaw = -0.35; });
    let minS = 99; for (const p of s) if (p.t > 0.2) minS = Math.min(minS, p.hs);
    print(`  running into a block corner at 20°: slides; min speed after contact ${f2(minS)} m/s, end (${f2(s[s.length - 1].x)}, ${f2(s[s.length - 1].z)})`);
  }
}

// -----------------------------------------------------------------------------------------------
if (should('fuzz')) {
  head('12. fuzz: random inputs everywhere (penetration, NaN, escapes, determinism)');
  let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let worstPen = 0, nan = 0, escapes = 0, ticks = 0, maxSp = 0, maxDy = 0, stuck = 0;
  const names = Object.keys(ST);
  const t0 = performance.now();
  for (let trial = 0; trial < 60; trial++) {
    const nm = names[Math.floor(rnd() * names.length)];
    const a = mkAt(nm); a.pos.x += (rnd() - 0.5) * 2; a.pos.z += (rnd() - 0.5) * 2; a.yaw = rnd() * 6.28;
    const cm = cmd0(); let hold = 0;
    let lastPos = a.pos.clone(), still = 0;
    for (let i = 0; i < 1200; i++) {
      if (hold-- <= 0) {
        hold = 10 + Math.floor(rnd() * 90);
        cm.forward = [-1, 0, 1, 1][Math.floor(rnd() * 4)]; cm.right = [-1, 0, 1][Math.floor(rnd() * 3)];
        cm.jump = rnd() < 0.5; cm.crouch = rnd() < 0.25; cm.walk = rnd() < 0.1; cm.yaw = a.yaw + (rnd() - 0.5) * 3;
      }
      if (rnd() < 0.02) cm.yaw += (rnd() - 0.5) * 1.5;
      const dtm = rnd() < 0.05 ? 1 / 60 : DT;
      sim.simulate(a, cm, dtm); ticks++;
      if (!Number.isFinite(a.pos.x + a.pos.y + a.pos.z + a.vel.x + a.vel.y + a.vel.z)) { nan++; break; }
      if (a.pos.y < -35 || Math.abs(a.pos.x) > 150 || Math.abs(a.pos.z) > 150) { escapes++; break; }
      // penetration check (fresh gather around actor)
      if (i % 5 === 0 && a.pos.y > -1) {
        const hull = a.move.crouching ? 1.25 : 1.8;
        gather(geo.boundsTree, a.pos.x - 1.5, a.pos.y - 1, a.pos.z - 1.5, a.pos.x + 1.5, a.pos.y + 3, a.pos.z + 1.5);
        const pen = maxPenetration(a.pos, hull, 0.36); if (pen > worstPen) worstPen = pen;
      }
      maxSp = Math.max(maxSp, a.move.speed);
    }
  }
  const ms = performance.now() - t0;
  print(`  ${ticks} ticks: worst penetration ${f3(worstPen)} m | NaN ${nan} | escapes ${escapes} | max speed ${f2(maxSp)} m/s | ${(ms / ticks * 1000).toFixed(1)} µs/tick (incl. checks)`);
  results.fuzz = { ticks, worstPen, nan, escapes, maxSpeed: maxSp, usPerTick: ms / ticks * 1000 };
}

// -----------------------------------------------------------------------------------------------
if (should('determinism')) {
  head('13. determinism');
  const runOnce = () => {
    const a = mkAt('lane'); a.pos.set(56, 0, 58); const cm = cmd0(); const log = [];
    for (let i = 0; i < 1200; i++) {
      const t = i * DT; cm.forward = 1; cm.right = Math.sin(t * 2.3) > 0 ? 1 : -1; cm.yaw = Math.sin(t) * 0.7; cm.jump = Math.floor(t * 1.7) % 2 === 0; cm.crouch = Math.floor(t * 0.9) % 3 === 2;
      sim.simulate(a, cm, DT); if (i % 60 === 0) log.push(a.pos.x.toFixed(9) + ',' + a.pos.y.toFixed(9) + ',' + a.pos.z.toFixed(9));
    }
    return log.join('|');
  };
  const A = runOnce(), B = runOnce();
  print(`  two identical 10 s runs: ${A === B ? 'IDENTICAL' : 'DIFFER'}`);
  results.determinism = A === B;
}

if (should('perf')) {
  head('14. performance');
  const acts = Array.from({ length: 10 }, (_, i) => mkAt('pillars'));
  acts.forEach((a, i) => { a.pos.x += i * 0.6; });
  const cm = cmd0(); const t0 = performance.now(); let n = 0;
  for (let i = 0; i < 1200; i++) { for (const a of acts) { cm.forward = 1; cm.right = Math.sin(i * 0.02 + a.id); cm.yaw = i * 0.01 + a.id; cm.jump = i % 90 < 3; sim.simulate(a, cm, DT); n++; } }
  const ms = performance.now() - t0;
  print(`  ${n} simulate() calls in a pillar field: ${(ms / n * 1000).toFixed(1)} µs each → 10 actors @120 Hz = ${(ms / n * 10 * 120).toFixed(1)} ms of CPU per second`);
  results.perf = { usPerCall: ms / n * 1000 };
}

fs.mkdirSync(OUT.replace(/[^/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tune: { ...TUNE }, results, charts }, null, 1));
print(`\nwrote ${OUT}`);
