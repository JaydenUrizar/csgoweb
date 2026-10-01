// Headless test harness for the match flow: sandbox ctx, a scripted "round director" (no AI/physics needed) and an invariant checker.
// Used by ?scene=match-lab (autoplay), ctx.match.debug.simulate(n) and tools/match_test.mjs.
import * as THREE from 'three';
import { createEvents } from '../core/events.js';
import { mulberry32 } from '../core/rng.js';
import { MATCH, TEAMS } from '../core/config.js';
import { ECON, lossBonus } from './economy.js';
import { createMatch } from './flow.js';

export function createSandbox({ seed = 1 } = {}) {
  if (typeof window === 'undefined') globalThis.window = globalThis;
  const rand = mulberry32(seed);
  const ctx = { params: new URLSearchParams(''), actors: [], localActor: null, events: createEvents(), errors: [], debugScenes: {} };
  const match = createMatch(ctx, { random: rand });
  return { ctx, match, rand };
}

const TAGGERS = ['arc', 'rail', 'zip', 'hum', 'lance', 'scatter', 'pip', 'judge', 'tap', 'pulse', 'storm', 'halo', 'twin'];
export const SCENARIOS = [
  ['ember_elim', 14], ['tide_elim', 14], ['time', 7], ['plant_explode', 15], ['plant_disarm', 15], ['plant_disarm_kit', 6],
  ['plant_ember_wiped_disarm', 5], ['plant_ember_wiped_explode', 4], ['plant_tide_wiped', 5], ['both_wiped', 3], ['carrier_drop_plant', 5], ['plant_at_expiry', 3], ['disarm_too_late', 4],
];

export function createDriver(ctx, match, { rand, speed = 1, moveSpeed = 9 } = {}) {
  const ev = ctx.events;
  const D = { enabled: false, scenario: null, forced: null, t: 0, goals: [], timeline: [], afterArm: [], holds: new Map(), log: [], moveSpeed, speed };
  const alive = (team) => match.teams[team].filter((a) => a.alive);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const rr = (a, b) => a + rand() * (b - a);

  function tagOut(victim, attacker, tagger) {
    if (!victim.alive) return;
    if (attacker === undefined) { const en = alive(victim.team === 'ember' ? 'tide' : 'ember'); attacker = en.length ? pick(en) : null; }
    victim.alive = false; victim.tagged = true; victim.hp = 0;
    ev.emit('tag:out', { attacker, victim, tagger: tagger || pick(TAGGERS), hitgroup: 'chest', assist: null });
  }
  D.tagOut = tagOut;
  function wipe(team, at, span) {
    const vs = match.teams[team].slice();
    vs.forEach((v, i) => D.timeline.push({ at: at + (vs.length > 1 ? (span * i) / (vs.length - 1) : 0), run: () => tagOut(v) }));
  }
  function killSome(team, n, from, to) {
    const vs = match.teams[team].slice().sort(() => rand() - 0.5).slice(0, n);
    for (const v of vs) D.timeline.push({ at: rr(from, to), run: () => tagOut(v) });
  }
  function hold(a, secs) { D.holds.set(a, D.t + secs); }
  function moveTo(a, tx, tz, dt, instant) {
    const dx = tx - a.pos.x, dz = tz - a.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05 || instant || !isFinite(D.moveSpeed) || d <= D.moveSpeed * dt) { a.pos.x = tx; a.pos.z = tz; a.vel.set(0, 0, 0); return true; }
    const k = D.moveSpeed / d; a.pos.x += dx * k * dt; a.pos.z += dz * k * dt; a.vel.set(dx * k, 0, dz * k); a.yaw = Math.atan2(-dx, -dz); return false;
  }
  const siteCenter = (id) => { const s = match.beaconApi.sites()[id]; return s.center || s.pos; };

  // ---- goals (stateful behaviours)
  function plantGoal(g, dt) {
    const B = match.beacon;
    if (B.state === 'dropped') {
      const c = alive('ember')[0]; if (!c) return true;
      if (moveTo(c, B.pos.x, B.pos.z, dt)) { /* pickup happens in tick */ }
      return false;
    }
    if (B.state === 'carried' || B.state === 'arming') {
      const c = B.carrier; if (!c || !c.alive) return false;
      const ctr = siteCenter(g.site);
      if (!g.arrived) { g.arrived = moveTo(c, ctr.x + g.ox, ctr.z + g.oz, dt, g.teleport); c.pos.y = ctr.y; if (!g.arrived) return false; }
      hold(c, 0.5); return false;
    }
    return true;   // armed or later
  }
  function disarmGoal(g, dt) {
    const B = match.beacon;
    if ((B.state === 'armed' || B.state === 'disarming') && B.fuse - B.fuseLeft < g.delay) return false;
    if (B.state !== 'armed' && B.state !== 'disarming') return B.state === 'disarmed' || B.state === 'complete';
    if (!g.who || !g.who.alive) {
      const ts = alive('tide'); if (!ts.length) return false;
      g.who = (g.kit ? ts.find((a) => a.hasKit) : null) || pick(ts); g.arrived = false;
      if (g.kit) g.who.hasKit = true;
    }
    if (!g.arrived) { g.arrived = moveTo(g.who, B.pos.x + 0.8, B.pos.z, dt, g.teleport); g.who.pos.y = B.pos.y; if (!g.arrived) return false; }
    hold(g.who, 0.5); return false;
  }

  function plan() {
    D.timeline.length = 0; D.goals.length = 0; D.afterArm.length = 0; D.holds.clear(); D.t = 0;
    let name = D.forced;
    if (!name) { let tot = SCENARIOS.reduce((s, x) => s + x[1], 0), r = rand() * tot; for (const [n, w] of SCENARIOS) { if ((r -= w) <= 0) { name = n; break; } } }
    D.scenario = name || 'time';
    const S = D.speed, T = (x) => x / S;
    const site = rand() < 0.5 ? 'A' : 'B', ox = rr(-1.5, 1.5), oz = rr(-1.5, 1.5);
    const plant = (at) => D.goals.push({ at: T(at), kind: 'plant', site, ox, oz, fn: plantGoal });
    // disarm `delay` seconds after the beacon armed (kit: fast disarm)
    const disarm = (delay, kit) => D.goals.push({ at: 0, kind: 'disarm', kit, delay: T(delay), fn: disarmGoal, teleport: false });
    const afterArm = (delay, run) => D.afterArm.push({ delay: T(delay), run });
    const wipeAfter = (team, delay, span) => afterArm(delay, () => { match.teams[team].forEach((v, i, arr) => D.timeline.push({ at: D.t + (arr.length > 1 ? (T(span) * i) / (arr.length - 1) : 0), run: () => tagOut(v) })); D.timeline.sort((a, b) => a.at - b.at); });
    switch (D.scenario) {
      case 'ember_elim': killSome('ember', rand() < 0.5 ? 2 : 4, 15, 60); wipe('tide', T(rr(30, 85)), T(rr(4, 14))); break;
      case 'tide_elim': killSome('tide', rand() < 0.5 ? 2 : 4, 15, 60); wipe('ember', T(rr(30, 85)), T(rr(4, 14))); break;
      case 'time': killSome('ember', 2, 10, 60); killSome('tide', 1, 10, 60); break;
      case 'plant_explode': plant(rr(20, 55)); killSome('ember', 2, 20, 80); killSome('tide', 2, 60, 90); break;
      case 'plant_disarm': plant(rr(20, 50)); disarm(rr(4, 25), false); killSome('ember', 2, 20, 80); break;
      case 'plant_disarm_kit': plant(rr(20, 50)); disarm(rr(4, 28), true); break;
      case 'plant_ember_wiped_disarm': plant(rr(20, 40)); wipeAfter('ember', rr(2, 8), 3); disarm(rr(10, 22), rand() < 0.5); break;
      case 'plant_ember_wiped_explode': plant(rr(20, 40)); wipeAfter('ember', rr(3, 10), 3); break;
      case 'plant_tide_wiped': plant(rr(20, 40)); killSome('ember', 1, 30, 50); wipeAfter('tide', rr(4, 20), 3); break;
      case 'both_wiped': { const at = T(rr(30, 80)); for (const t of ['ember', 'tide']) match.teams[t].forEach((v) => D.timeline.push({ at, run: () => tagOut(v, null) })); break; }
      case 'carrier_drop_plant': D.timeline.push({ at: T(rr(8, 14)), run: () => { const c = match.beacon.carrier; if (c) tagOut(c); } }); plant(rr(30, 55)); disarm(rr(6, 22), false); break;
      case 'plant_at_expiry': D.goals.push({ at: T(MATCH.roundTime - MATCH.beaconArmTime + 1.4), kind: 'plant', site, ox, oz, fn: plantGoal, teleport: true }); break;
      case 'disarm_too_late': plant(rr(20, 35)); disarm(33, false); killSome('ember', 3, 20, 60); break;
      default: break;
    }
    D.timeline.sort((a, b) => a.at - b.at);
    D.log.push(D.scenario);
  }
  D.plan = plan;
  ev.on('beacon:armed', () => { if (!D.enabled) return; for (const x of D.afterArm.splice(0)) D.timeline.push({ at: D.t + x.delay, run: x.run }); D.timeline.sort((a, b) => a.at - b.at); });

  ev.on('round:phase', ({ phase }) => { if (D.enabled && phase === 'live') plan(); if (phase === 'buy') { D.holds.clear(); } });

  D.step = (dt) => {
    if (!D.enabled) return;
    if (match.phase !== 'live' && match.phase !== 'armed') return;
    D.t += dt;
    while (D.timeline.length && D.timeline[0].at <= D.t) D.timeline.shift().run();
    for (let i = D.goals.length - 1; i >= 0; i--) { const g = D.goals[i]; if (g.at <= D.t && g.fn(g, dt)) D.goals.splice(i, 1); }
    for (const [a, until] of D.holds) { if (until > D.t && a.alive) match.interact(a, true); else { match.interact(a, false); D.holds.delete(a); } }
  };
  return D;
}

/** Independent re-implementation of the rules, watching events; records violations + measurements for the conformance table. */
export function createChecker(ctx, match) {
  const ev = ctx.events, K = { violations: [], measure: {}, rounds: [], halftimes: [], overtime: [], matchEnds: 0, phaseLog: [], lvl: { ember: 0, tide: 0 }, wins: { A: 0, B: 0 }, swapped: false, shadow: new Map(), tagRewards: new Set() };
  const bad = (m) => { if (K.violations.length < 200) K.violations.push(`[r${match.round} ${match.phase} t=${match.clock.toFixed(2)}] ${m}`); };
  K.bad = bad;
  let lastPhase = null, lastAt = 0;
  ev.on('round:phase', ({ phase, prev }) => {
    if (lastPhase) { (K.measure[lastPhase] ||= []).push(match.clock - lastAt); }
    K.phaseLog.push(phase); lastPhase = phase; lastAt = match.clock;
  });
  ev.on('credits', (e) => {
    const a = e.actor;
    if (e.total !== a.credits) bad(`credits event total ${e.total} != actor ${a.credits} (${a.name})`);
    if (a.credits < 0 || a.credits > ECON.cap) bad(`credits out of range ${a.credits} (${a.name})`);
    if (!Number.isInteger(a.credits)) bad('non-integer credits');
    if (e.reason === 'win' && e.want !== ECON.win) bad(`win award ${e.want}`);
    if (e.reason === 'loss') { const exp = 1400 + 500 * Math.min(K.lvl[a.team], 4); if (e.want !== exp) bad(`loss award ${e.want} != ${exp} (level ${K.lvl[a.team]})`); (K.measure.lossAwards ||= []).push(e.want); }
    if (e.reason === 'plant' && e.want !== 300) bad('plant bonus');
    if (e.reason === 'disarm' && e.want !== 300) bad('disarm bonus');
    if (e.reason === 'tag') K.tagRewards.add(e.want);
  });
  ev.on('beacon:arm', () => { K.armStart = match.clock; });
  ev.on('beacon:armed', () => { (K.measure.arm ||= []).push(match.clock - K.armStart); });
  ev.on('beacon:armCancel', () => {});
  ev.on('beacon:disarm', (e) => { K.disarmStart = match.clock; K.disarmKit = e.kit; });
  ev.on('beacon:disarmed', (e) => { (K.measure[e.kit ? 'disarmKit' : 'disarm'] ||= []).push(match.clock - K.disarmStart); });
  ev.on('round:end', (e) => {
    const n = e.n;
    // loss level model
    const w = e.winner, l = w === 'ember' ? 'tide' : 'ember';
    K.lvl[w] = Math.max(0, K.lvl[w] - 1); K.lvl[l] = Math.min(4, K.lvl[l] + 1);
    if (match.lossStreak.ember !== K.lvl.ember || match.lossStreak.tide !== K.lvl.tide) bad(`lossStreak ${JSON.stringify(match.lossStreak)} != model ${JSON.stringify(K.lvl)}`);
    const sq = (K.swapped ? (w === 'ember' ? 'B' : 'A') : (w === 'ember' ? 'A' : 'B'));
    K.wins[sq]++;
    const eSq = K.swapped ? 'B' : 'A', tSq = K.swapped ? 'A' : 'B';
    if (e.scores.ember !== K.wins[eSq] || e.scores.tide !== K.wins[tSq]) bad(`scores ${JSON.stringify(e.scores)} != model ${K.wins.A}/${K.wins.B} swapped=${K.swapped}`);
    if (e.scores.ember + e.scores.tide !== n) bad('score sum != round number');
    if (!['elimination', 'time', 'disarmed', 'beacon'].includes(e.reason) && e.reason !== 'forced') bad('bad reason ' + e.reason);
    if (e.reason === 'time' && w !== 'tide') bad('time win must be Tide');
    if (e.reason === 'disarmed' && w !== 'tide') bad('disarm win must be Tide');
    if (e.reason === 'beacon' && w !== 'ember') bad('beacon win must be Ember');
    for (const a of ctx.actors) if (TEAMS[a.team] && (a.credits < 0 || a.credits > ECON.cap)) bad('credits range at round end');
    if (!e.mvp || e.mvp.team !== w) bad('MVP missing or not on winning team');
    K.rounds.push({ n, winner: w, reason: e.reason, next: e.next, ot: e.ot });
  });
  ev.on('halftime', (e) => {
    K.halftimes.push({ ...e, at: match.history.length });
    if (e.swapped) K.swapped = !K.swapped;
    K.lvl.ember = K.lvl.tide = 0;
    if (e.kind === 'half' && match.history.length !== 7) bad('halftime not after round 7: ' + match.history.length);
    if (e.kind === 'ot' && match.history.length !== 14) bad('OT must start after round 14');
    if (e.kind === 'otHalf' && (match.history.length - 14) % 3 !== 0) bad('OT half not on multiple of 3');
    K.expectReset = true;
  });
  ev.on('round:start', (e) => {
    if (K.expectReset) {
      const start = K.halftimes.length && K.halftimes[K.halftimes.length - 1].kind === 'half' ? ECON.start : ECON.otStart;
      for (const a of ctx.actors) if (TEAMS[a.team]) {
        if (a.credits !== start) bad(`credits not reset after ${K.halftimes.at(-1).kind}: ${a.credits}`);
        if (a.match.owned.primary || a.armor) bad('loadout not wiped at half');
      }
      K.expectReset = false;
    }
    if (e.n === 1) for (const a of ctx.actors) if (TEAMS[a.team] && a.credits !== ECON.start) bad('round 1 credits != 800');
  });
  ev.on('match:end', (e) => {
    K.matchEnds++;
    const s = match.scores, hi = Math.max(s.ember, s.tide);
    if (!match.ot && hi !== 8) bad(`regulation winner has ${hi} != 8`);
    if (match.ot && hi !== match.otTarget) bad(`OT winner ${hi} != target ${match.otTarget}`);
    if (e.winner !== (s.ember > s.tide ? 'ember' : 'tide')) bad('match winner mismatch');
    if (!e.mvp) bad('no match MVP');
  });
  K.check = () => {
    // per-tick cheap checks
    for (const a of ctx.actors) if (TEAMS[a.team] && (a.credits < 0 || a.credits > ECON.cap)) { bad('credits range'); break; }
  };
  return K;
}

/** Run a whole match headless with the scripted director. Returns {ok, violations, rounds, ...}. */
export function runMatch({ seed = 1, dt = 1 / 30, maxSeconds = 20000, playerTeam = 'ember', forced = null, onStep = null } = {}) {
  const sb = createSandbox({ seed }); const { ctx, match } = sb;
  const drv = createDriver(ctx, match, { rand: sb.rand, moveSpeed: 9 }); drv.enabled = true; drv.forced = forced;
  const chk = createChecker(ctx, match);
  match.startMatch({ playerTeam, dummies: true, bots: true });
  let steps = 0; const max = maxSeconds / dt;
  while (match.phase !== 'matchEnd' && steps++ < max) { drv.step(dt); match.fixedUpdate(dt); if (onStep?.(match)) break; if ((steps & 63) === 0) chk.check(); }
  const finished = match.phase === 'matchEnd';
  if (!finished && !onStep) chk.bad('match did not finish');
  return { sb, match, ctx, drv, chk, finished, ok: chk.violations.length === 0, steps };
}
