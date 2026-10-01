// Event -> sound wiring so the whole game is sonified without other pieces calling audio directly.
// Also: room probing (reverb selection), beacon state sonification, timers, shot impact prediction.
import * as THREE from 'three';
import { clamp } from './dsp.js';
import { MATCH } from '../core/config.js';

const HIT_CROWN = (g) => g === 'crown' || g === 'head' || g === 'crowned';
const tagId = (t) => (typeof t === 'string' ? t : t?.id ?? t?.def?.id ?? null);

export function wireEvents(ctx, audio) {
  const on = (type, fn) => ctx.events.on(type, (e) => { try { fn(e || {}); } catch (err) { console.error('[audio]', type, err); (window.__errors ||= []).push(`audio:${type}: ${err?.stack || err}`); } });
  const offs = [];
  const bind = (type, fn) => offs.push(on(type, fn));
  const isLocal = audio.isLocal;
  const local = () => ctx.localActor;
  const A = new WeakMap();                      // per-actor scratch (foot alternation)
  const st = (a) => { let s = A.get(a); if (!s) A.set(a, s = { foot: 0, last: 0 }); return s; };
  const surfaceAtPos = (p) => { try { return ctx.map?.surfaceAt?.(p) || 'stone'; } catch { return 'stone'; } };
  let clock = 0;

  // ---------------- weapons ----------------
  const pending = [];                            // predicted world impacts, cancelled if the shot tagged someone nearer
  const LOUD = { judge: 0.65, lance: 0.4, scatter: 0.6, arc: 0.85, storm: 0.85 };
  const _rd = { x: 0, y: 0, z: 0 }, v = { o: new THREE.Vector3(), d: new THREE.Vector3() };
  bind('weapon:fire', (e) => {
    const id = tagId(e.tagger), a = e.actor; if (!id) return;
    const name = `tagger.${id}.fire`; if (!audio.sounds[name]) return;
    const org = e.origin || a?.pos; if (!org) return;
    const isL = isLocal(a);
    audio.play(name, { actor: a, pos: isL ? null : org });
    if (isL && LOUD[id]) audio.duck('music', LOUD[id], 0.005, 0.12, 0.6);
    if (id === 'lance') audio.play('tagger.lance.bolt', { actor: a, delay: isL ? 0.62 : 0.66, pos: isL ? null : org });
    else if (id === 'scatter') audio.play('tagger.scatter.pump', { actor: a, delay: isL ? 0.42 : 0.46, pos: isL ? null : org });
    if (e.hitscan === false || !e.dir) return;
    // near-miss zip for shots passing the listener
    const L = audio.mixer?.listener; if (!L) return;
    const rx = L.x - org.x, ry = L.y - org.y, rz = L.z - org.z, t = rx * e.dir.x + ry * e.dir.y + rz * e.dir.z;
    if (!isL && t > 3 && t < 70) {
      const px = org.x + e.dir.x * t, py = org.y + e.dir.y * t, pz = org.z + e.dir.z * t, d = Math.hypot(L.x - px, L.y - py, L.z - pz);
      if (d < 2.4) { _rd.x = px; _rd.y = py; _rd.z = pz; audio.play('tag.whiz', { pos: { x: px, y: py, z: pz }, gain: 1.4 - d * 0.4, delay: t / 900 }); }
    }
    // predicted world impact (one ray; a few for shotgun)
    const map = ctx.map; if (!map?.raycast || ctx.events.__impactEvents) return;
    const dd = Math.hypot(org.x - L.x, org.z - L.z); if (dd > 95) return;
    const n = id === 'scatter' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      let dx = e.dir.x, dy = e.dir.y, dz = e.dir.z;
      if (i > 0) { dx += (Math.random() - 0.5) * 0.06; dy += (Math.random() - 0.5) * 0.06; dz += (Math.random() - 0.5) * 0.06; }
      v.o.set(org.x, org.y, org.z); v.d.set(dx, dy, dz).normalize();
      let h = null; try { h = map.raycast(v.o, v.d, 200); } catch { return; }
      if (!h) continue;
      pending.push({ due: clock + 0.035 + i * 0.012, a, ox: org.x, oy: org.y, oz: org.z, x: h.point.x, y: h.point.y, z: h.point.z, dist: h.distance, s: i === 0 ? 1 : 0.7, nx: h.normal?.x ?? 0, ny: h.normal?.y ?? 1, nz: h.normal?.z ?? 0, id });
      if (pending.length > 32) pending.shift();
    }
  });
  function flushImpacts() {
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i]; if (p.due > clock) continue; pending.splice(i, 1);
      const pos = { x: p.x + p.nx * 0.05, y: p.y + p.ny * 0.05, z: p.z + p.nz * 0.05 };
      const surf = surfaceAtPos(pos);
      audio.play(`impact.${surf}`, { pos, intensity: p.s * (p.id === 'lance' ? 1.3 : p.id === 'zip' || p.id === 'twin' ? 0.8 : 1) });
    }
  }
  bind('impact', (e) => {   // if any piece emits explicit impacts, prefer those
    ctx.events.__impactEvents = true; if (!e.point) return; audio.play(`impact.${e.surface || surfaceAtPos(e.point)}`, { pos: e.point, intensity: e.intensity ?? 1 });
  });
  const stageName = (s) => { if (s === 1 || s === 'out' || s === 'start' || s === 'reload1' || s === 'begin') return 'reload1'; if (s === 2 || s === 'in' || s === 'mid' || s === 'reload2') return 'reload2'; if (s === 3 || s === 'end' || s === 'chamber' || s === 'done' || s === 'reload3') return 'reload3'; return null; };
  bind('weapon:reload', (e) => { const id = tagId(e.tagger), n = stageName(e.stage); if (id && n) audio.play(`tagger.${id}.${n}`, { actor: e.actor }); });
  bind('weapon:switch', (e) => { const id = tagId(e.tagger); if (id && audio.sounds[`tagger.${id}.draw`]) audio.play(`tagger.${id}.draw`, { actor: e.actor }); });
  bind('weapon:empty', (e) => { const id = tagId(e.tagger) || ctx.combat?.equipped?.(e.actor || local())?.def?.id; if (id) audio.play(`tagger.${id}.empty`, { actor: e.actor || local() }); });
  bind('weapon:inspect', (e) => { const id = tagId(e.tagger); if (id) audio.play(`tagger.${id}.inspect`, { actor: e.actor }); });
  bind('weapon:scope', (e) => { audio.play(e.scoped === false || e.scope === false ? 'tagger.scope.out' : 'tagger.scope.in', { actor: e.actor }); });
  bind('weapon:melee', (e) => { audio.play('tagger.tap.fire', { actor: e.actor }); });
  bind('weapon:pickup', (e) => { audio.play('tagger.pickup', { actor: e.actor, pos: e.pos }); });
  bind('weapon:drop', (e) => { audio.play('tagger.drop', { actor: e.actor, pos: e.pos }); });

  // ---------------- hits / tag-outs ----------------
  bind('tag:hit', (e) => {
    const at = e.attacker, vi = e.victim, crown = HIT_CROWN(e.hitgroup), armor = (e.armorAbsorbed || 0) > 0;
    if (at && e.point) for (let i = pending.length - 1; i >= 0; i--) { const p = pending[i]; if (p.a === at) { const hd = Math.hypot(e.point.x - p.ox, e.point.y - p.oy, e.point.z - p.oz); if (p.dist > hd + 0.35) pending.splice(i, 1); } }
    const group = crown ? 'crown' : (e.hitgroup === 'leg' || e.hitgroup === 'arm' || e.hitgroup === 'limb' || e.hitgroup === 'legs' || e.hitgroup === 'arms') ? 'limb' : e.hitgroup === 'stomach' ? 'stomach' : 'chest';
    if (isLocal(at) && at !== vi) audio.play(crown ? 'hit.crown' : 'hit.tick', { group, damage: e.damage, armor, fp: true });
    if (id_is_tap(e.tagger)) audio.play('tagger.tap.hit', { pos: e.point, actor: at });
    if (isLocal(vi)) {
      let pan = 0; const L = audio.mixer?.listener;
      if (L && at?.pos) { const dx = at.pos.x - L.x, dz = at.pos.z - L.z, l = Math.hypot(dx, dz) || 1; pan = clamp((dx * L.rx + dz * L.rz) / l, -1, 1) * 0.85; }
      audio.play('dmg.taken', { group, damage: e.damage, armor, pan, fp: true });
      audio.duck('music', 0.5, 0.01, 0.25, 0.7);
    } else if (e.point && !isLocal(at)) audio.play('impact.body', { pos: e.point, gain: crown ? 1.15 : 0.9 });
    else if (e.point && isLocal(at)) audio.play('impact.body', { pos: e.point, gain: 0.6 });
  });
  const id_is_tap = (t) => tagId(t) === 'tap';
  bind('tag:out', (e) => {
    const vi = e.victim, at = e.attacker; if (!vi) return;
    if (isLocal(vi)) { audio.play('tag.out.self', { fp: true }); audio.duck('music', 0.45, 0.02, 0.8, 1.2); }
    else audio.play('tag.out.shatter', { pos: { x: vi.pos.x, y: vi.pos.y + 1.0, z: vi.pos.z }, actor: vi });
    if (isLocal(at) && at !== vi) audio.play('hit.kill', { crown: HIT_CROWN(e.hitgroup), fp: true, delay: 0.03 });
  });

  // ---------------- movement ----------------
  bind('footstep', (e) => {
    const a = e.actor; if (!a) return; const isL = isLocal(a);
    if (!isL && (e.crouch || e.walk || (e.speed ?? 6) < 1.4)) return;              // silent-walk & crouch-walk: CS rules
    if (a.alive === false) return;
    const s = st(a); s.foot ^= 1;
    const p = e.pos || a.pos, surface = e.surface || surfaceAtPos(p);
    audio.play(`step.${surface}`, { actor: a, pos: isL ? null : p, speed: e.speed, crouch: e.crouch, walk: e.walk, foot: s.foot });
  });
  bind('land', (e) => { const a = e.actor; if (!a) return; audio.play('move.land', { actor: a, speed: e.speed ?? 6, surface: surfaceAtPos(a.pos) }); });
  bind('jump', (e) => { const a = e.actor; if (!a) return; audio.play('move.jump', { actor: a, surface: surfaceAtPos(a.pos) }); });
  bind('slide', (e) => { const a = e.actor; if (a) audio.play('move.slide', { actor: a }); });

  // ---------------- utility ----------------
  bind('util:throw', (e) => { const t = e.type || 'haze'; audio.play('util.pin', { actor: e.actor }); audio.play(`util.throw.${t}`, { actor: e.actor, delay: 0.09 }); });
  bind('util:bounce', (e) => { if (e.pos) audio.play('util.bounce', { pos: e.pos, speed: e.speed }); });
  bind('util:detonate', (e) => {
    const p = e.pos; if (!p) return; const L = audio.mixer?.listener, d = L ? Math.hypot(L.x - p.x, L.y - p.y, L.z - p.z) : 99;
    if (e.type === 'haze') { audio.play('util.haze.pop', { pos: p }); audio.play('util.haze.hiss', { pos: p, delay: 0.12 }); }
    else if (e.type === 'strobe') audio.play('util.strobe.pop', { pos: p });
    else if (e.type === 'pulse') { audio.play('util.pulse.boom', { pos: p }); if (d < 14) { audio.deafen(0.3 * (1 - d / 14), 1.6); } audio.duck('music', 0.5, 0.01, 0.4, 1.0); }
  });
  bind('util:blind', (e) => { if (!isLocal(e.actor)) return; const a = clamp(e.amount ?? 1, 0, 1); if (a < 0.1) return; audio.play('util.strobe.ring', { amount: a, fp: true }); audio.deafen(a * 0.95, 1.5 + 3.5 * a); });

  // ---------------- UI / economy ----------------
  const uiMap = { 'ui:click': 'ui.click', 'ui:hover': 'ui.hover', 'ui:open': 'ui.open', 'ui:close': 'ui.close', 'ui:back': 'ui.back', 'ui:error': 'ui.error', 'ui:tab': 'ui.tab', 'ui:toggle': 'ui.toggle', 'ui:notify': 'ui.notify', 'buy:fail': 'ui.error' };
  let lastHover = 0;
  for (const [ev, snd] of Object.entries(uiMap)) bind(ev, () => { if (snd === 'ui.hover') { if (clock - lastHover < 0.03) return; lastHover = clock; } audio.play(snd, { fp: true }); });
  bind('ui:scoreboard', () => audio.play('ui.scoreboard', { fp: true }));
  bind('buy', (e) => { if (isLocal(e.actor)) audio.play('ui.buy', { fp: true }); });
  let lastMoney = -9;
  bind('credits', (e) => { if (isLocal(e.actor) && (e.delta ?? 0) > 0 && e.reason !== 'buy' && clock - lastMoney > 0.2) { lastMoney = clock; audio.play('ui.money', { fp: true, delay: 0.2 }); } });
  bind('announce', (e) => { if (e.id) audio.announce(e.id, e.delay ? { delay: e.delay } : {}); });
  bind('ping', (e) => { if (e.pos) audio.play('ui.ping', { pos: e.pos }); });

  // ---------------- round flow ----------------
  let phase = null, phaseSeen = false, lastTick = -1, said30 = false, said10 = false, hornT = -9;
  const myTeam = () => ctx.match?.playerTeam || local()?.team;
  function horn() { if (clock - hornT < 2) return; hornT = clock; audio.play('ui.roundstart.horn', { fp: true }); audio.announce('roundStart', { delay: 0.35 }); }
  function onPhase(p) {
    if (p === phase) return; const prev = phase; phase = p; lastTick = -1; phaseSeen = true;
    if (p === 'warmup') audio.music.set('menu');
    else if (p === 'buy' || p === 'freeze') { audio.music.set('buy'); said30 = said10 = false; if (p === 'buy' || prev === 'roundEnd') matchPointCheck(); }
    else if (p === 'live') { audio.music.set('live'); horn(); }
    else if (p === 'armed') { audio.music.set('armed'); }
    else if (p === 'halftime') { audio.announce('halftime'); audio.music.set('menu'); }
  }
  function matchPointCheck() {
    const sc = ctx.match?.scores; if (!sc) return; const need = MATCH.roundsToWin - 1;
    if (sc.ember >= MATCH.roundsToWin - 1 && sc.tide >= MATCH.roundsToWin - 1) audio.announce('lastRound', { delay: 1.6 });
    else if (sc.ember >= need || sc.tide >= need) audio.announce('matchPoint', { delay: 1.6 });
  }
  bind('round:phase', (e) => onPhase(e.phase));
  bind('round:start', () => { if (!phaseSeen) horn(); });
  bind('round:end', (e) => {
    phaseSeen = false; const w = e.winner, my = myTeam();
    if (!w || w === 'draw') { audio.play('ui.round.lose', { fp: true }); audio.announce('roundDraw', { delay: 0.7 }); audio.music.set('lose'); return; }
    const win = w === my;
    audio.play(win ? 'ui.round.win' : 'ui.round.lose', { fp: true }); audio.music.set(win ? 'win' : 'lose');
    audio.announce(w === 'ember' ? 'emberWin' : 'tideWin', { delay: 0.8 });
  });
  bind('match:end', (e) => { const win = e.winner === myTeam(); audio.play(win ? 'ui.match.win' : 'ui.match.lose', { fp: true }); audio.announce(win ? 'victory' : 'defeat', { delay: 1.0 }); audio.music.set(win ? 'win' : 'lose'); });
  bind('halftime', () => { audio.announce('halftime'); });

  // ---------------- beacon ----------------
  let bState = null, drone = null, beepClock = 0, hasPoll = false;
  const bpos = (b) => (b?.pos ? { x: b.pos.x, y: b.pos.y + 0.3, z: b.pos.z } : null);
  function stopDrone() { drone?.stop(); drone = null; }
  function onBeacon(prev, next, b) {
    const pos = bpos(b);
    if (next === 'dropped' && prev === 'carried') audio.play('beacon.drop', { pos });
    else if (next === 'carried' && prev === 'dropped') audio.play('beacon.pickup', { fp: true });
    if (next === 'arming') { stopDrone(); drone = audio.drone('arm'); audio.play('beacon.arm.start', { pos }); }
    else if (next === 'disarming') { stopDrone(); drone = audio.drone('disarm'); audio.play('beacon.disarm.start', { pos }); }
    else if (prev === 'arming' || prev === 'disarming') stopDrone();
    if ((prev === 'arming' && (next === 'carried' || next === 'dropped')) || (prev === 'disarming' && next === 'armed')) audio.play('beacon.cancel', { pos });
    if (next === 'armed' && prev !== 'disarming') { audio.play('beacon.armed', { fp: true }); audio.announce('beaconArmed', { delay: 0.55 }); audio.music.set('armed'); beepClock = 0.9; }
    if (next === 'armed' && prev === 'disarming') beepClock = 0.3;
    if (next === 'disarmed') { audio.play('beacon.disarm.done', { fp: true }); audio.announce('beaconDisarmed', { delay: 0.5 }); }
    if (next === 'complete') { audio.play('beacon.complete', { fp: true }); audio.announce('beaconCharged', { delay: 1.9 }); }
  }
  function beaconUpdate(dt) {
    const b = ctx.match?.beacon; hasPoll = !!b; if (!b) return;
    if (b.state !== bState) { const prev = bState; bState = b.state; onBeacon(prev, bState, b); }
    const L = audio.mixer?.listener;
    if (drone && (bState === 'arming' || bState === 'disarming')) {
      const p = bpos(b), d = L && p ? Math.hypot(L.x - p.x, L.z - p.z) : 0, near = clamp(1.2 - d / 16, 0.15, 1);
      drone.set(clamp(b.progress ?? 0, 0, 1), near);
    }
    if (bState === 'armed') {
      const fuse = b.fuseLeft ?? MATCH.beaconFuse, frac = clamp(fuse / MATCH.beaconFuse, 0, 1), iv = clamp(0.1 + 0.9 * Math.pow(frac, 1.4), 0.1, 1);
      audio.music.setIntensity(1 - frac);
      beepClock -= dt;
      if (beepClock <= 0) { audio.play('beacon.arm.beep', { pos: bpos(b), urgency: 1 - frac, last: fuse < 1.2 }); beepClock += iv; if (beepClock < 0) beepClock = iv; }
    } else if (bState !== 'armed') { /* intensity resets when not armed */ }
  }
  const bev = (ev, fn) => bind(ev, (e) => { if (ctx.match?.beacon) return; fn(e); });   // fallback when match isn't publishing state
  bev('beacon:pickup', () => audio.play('beacon.pickup', { fp: true }));
  bev('beacon:drop', (e) => audio.play('beacon.drop', { pos: e.pos }));
  bev('beacon:arm', () => audio.play('beacon.arm.start', { fp: true }));
  bev('beacon:armed', () => { audio.play('beacon.armed', { fp: true }); audio.announce('beaconArmed', { delay: 0.55 }); audio.music.set('armed'); });
  bev('beacon:disarm', () => { audio.play('beacon.disarm.done', { fp: true }); audio.announce('beaconDisarmed', { delay: 0.5 }); });
  bev('beacon:complete', () => { audio.play('beacon.complete', { fp: true }); audio.announce('beaconCharged', { delay: 1.9 }); });

  // ---------------- timers & phase polling ----------------
  function timerUpdate() {
    const m = ctx.match; if (!m) return;
    if (m.phase && m.phase !== phase) onPhase(m.phase);
    const tl = m.timeLeft; if (typeof tl !== 'number') return;
    if (phase === 'freeze' && tl > 0 && tl <= 3) { const n = Math.ceil(tl); if (n !== lastTick) { lastTick = n; audio.play('ui.countdown.tick', { fp: true }); } }
    else if (phase === 'live' && tl > 0) {
      if (tl <= 10) { const n = Math.ceil(tl); if (n !== lastTick) { lastTick = n; audio.play('ui.timer.warn', { fp: true, n }); if (n === 10 && !said10) { said10 = true; audio.announce('tenSeconds'); } } }
      else if (tl <= 30 && !said30) { said30 = true; audio.announce('thirtySeconds'); }
    }
  }

  // ---------------- room probing (reverb) ----------------
  const room = { open: 1, tunnel: 0, room: 0, indoor: false, H: 30, up: 60, elong: 1 };
  const DIRS = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; DIRS.push([Math.sin(a), 0, -Math.cos(a)]); }
  DIRS.push([0, 1, 0], [0.7, 0.7, 0], [-0.5, 0.7, 0.5]);
  const dists = new Float32Array(DIRS.length).fill(40); let probeI = 0, probeAcc = 0;
  function probe(dt) {
    probeAcc += dt; if (probeAcc < 0.09) return; probeAcc = 0;
    const L = audio.mixer?.listener; if (!L || !ctx.map?.raycast) return;
    const d = DIRS[probeI]; dists[probeI] = Math.min(60, audio.world.ray(L.x, L.y, L.z, d[0], d[1], d[2], 60)); probeI = (probeI + 1) % DIRS.length;
    if (probeI !== 0) return;
    let H = 0; for (let i = 0; i < 8; i++) H += dists[i]; H /= 8;
    const up = Math.min(dists[8], Math.min(dists[9] * 0.7, dists[10] * 0.7) + 0);
    const upClear = Math.min(dists[8], 60);
    const pair = []; for (let i = 0; i < 4; i++) pair.push(dists[i] + dists[i + 4]);
    const mn = Math.min(...pair), mx = Math.max(...pair), elong = mx / Math.max(mn, 1);
    const open = clamp((Math.min(upClear, up * 1.4 + 6) - 6) / 14, 0, 1);
    const indoor = 1 - open;
    const tunnelBase = clamp((elong - 1.8) / 1.4, 0, 1) * (mn < 14 ? 1 : 0.5);
    const size = clamp((H - 3) / 15, 0, 1);
    const tunnel = indoor * (tunnelBase + (1 - tunnelBase) * size * 0.6);
    const rm = indoor * (1 - tunnelBase) * (1 - size * 0.6);
    room.open = open; room.tunnel = tunnel; room.room = rm; room.indoor = indoor > 0.5; room.H = H; room.up = upClear; room.elong = elong;
    audio.mixer.setRoom({ open: open * 0.8 + 0.1 * (1 - open), tunnel, room: rm });
  }

  // ---------------- per-frame ----------------
  return {
    room,
    update(dt) {
      clock += dt; flushImpacts(); probe(dt); beaconUpdate(dt); timerUpdate();
    },
    dispose() { for (const o of offs) o?.(); stopDrone(); },
  };
}
