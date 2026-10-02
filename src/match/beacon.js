// The Beacon objective: carrier, pickup/drop, arming (hold E), fuse, disarming, win conditions and edge cases.
import * as THREE from 'three';
import { TIMING as MATCH } from './timing.js';
import { ECON } from './economy.js';

const FALLBACK_SITES = {
  A: { center: new THREE.Vector3(-18, 0, 0), radius: 6, height: 4 },
  B: { center: new THREE.Vector3(18, 0, 0), radius: 6, height: 4 },
};
const EPS = 1e-6;

/** Seconds between beeps for a given fuse time left: ~1 s early, accelerating to a near-continuous chirp. */
export function beepInterval(fuseLeft, fuse = MATCH.beaconFuse) {
  const k = Math.min(1, Math.max(0, (fuseLeft - 1) / Math.max(1, fuse - 1)));
  return 0.11 + 0.89 * Math.pow(k, 1.35);
}

export function installBeacon(env) {
  const { ctx, M, emit, ms, C, TUNE, announce, addCredits, useHeld, aliveOf, safe } = env;
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0);

  const B = {
    state: 'carried', site: null, pos: new THREE.Vector3(), carrier: null, progress: 0, fuseLeft: 0,
    actor: null, planter: null, disarmer: null, duration: 0, kit: false, t: 0, beepT: 0, beeps: 0, interval: 1, noPickup: null, warn: 0, timeWarn: 0,
    armTime: MATCH.beaconArmTime, disarmTime: MATCH.beaconDisarmTime, fuse: MATCH.beaconFuse,
  };

  const sites = () => { const s = ctx.map?.sites; return s && (s.A || s.B) ? s : FALLBACK_SITES; };
  function siteAt(pos) {
    const all = sites();
    for (const id of ['A', 'B']) {
      const s = all[id]; if (!s) continue;
      const c = s.center || s.pos; if (!c) continue;
      if (s.box?.containsPoint) { if (s.box.containsPoint(pos)) return id; continue; }
      const dx = pos.x - c.x, dz = pos.z - c.z, r = s.radius ?? 6;
      if (dx * dx + dz * dz <= r * r && Math.abs(pos.y - c.y) <= (s.height ?? 4)) return id;
    }
    return null;
  }
  /** Drop onto the floor below with an unbounded ray; if nothing is below (void), fall back to the carrier's last grounded spot. */
  function snap(p, fallback) {
    if (!ctx.map?.raycast) return;
    const r = safe('map.raycast', () => { _o.set(p.x, p.y + 0.6, p.z); return ctx.map.raycast(_o, _d, 400); });
    if (r?.point) p.y = r.point.y;
    else if (fallback) p.copy(fallback);
  }
  const lastGround = new THREE.Vector3();
  const standing = (a) => a.onGround !== false && Math.hypot(a.vel.x, a.vel.z) <= TUNE.plantSpeedMax;
  const horiz = (a, p) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z);

  function reset() {
    lastGround.set(0, 0, 0);
    B.state = 'carried'; B.site = null; B.carrier = null; B.progress = 0; B.fuseLeft = 0; B.actor = null; B.planter = null; B.disarmer = null;
    B.duration = 0; B.kit = false; B.t = 0; B.beepT = 0; B.beeps = 0; B.interval = 1; B.noPickup = null; B.warn = 0; B.timeWarn = 0; B.pos.set(0, 0, 0);
  }

  function giveTo(a, initial = false) {
    B.carrier = a; B.state = 'carried'; a.hasBeacon = true; B.pos.copy(a.pos); lastGround.copy(a.pos);
    safe('combat.give', () => C()?.give?.(a, 'beacon'));
    emit('beacon:pickup', { actor: a, site: B.site, initial });
    if (!initial) announce('beacon_picked_up', { actor: a, teams: ['ember'] });
  }
  function assignCarrier() {
    const pool = M.teams.ember.filter((a) => a.alive);
    if (!pool.length) { B.state = 'dropped'; B.carrier = null; const l = M.spawnList('ember'); B.pos.copy(l[0].pos); return; }
    giveTo(pool[Math.floor(env.R() * pool.length)], true);
  }

  function cancelArm(why = 'cancel') {
    if (B.state !== 'arming') return;
    const a = B.actor, site = B.site;
    B.state = 'carried'; B.progress = 0; B.t = 0; B.actor = null; B.site = null;
    emit('beacon:armCancel', { actor: a, site, why });
  }
  function cancelDisarm(why = 'cancel') {
    if (B.state !== 'disarming') return;
    const a = B.actor;
    B.state = 'armed'; B.progress = 0; B.t = 0; B.actor = null;
    emit('beacon:disarmCancel', { actor: a, site: B.site, why });
  }

  function drop(a, why = 'manual') {
    if (B.state === 'arming') cancelArm('drop');
    if (B.state !== 'carried' || !B.carrier || (a && B.carrier !== a)) return false;
    const c = B.carrier;
    B.state = 'dropped'; B.carrier = null; c.hasBeacon = false; B.pos.copy(c.pos); snap(B.pos, lastGround);
    if (why === 'manual') { B.noPickup = { actor: c, until: M.clock + 1.2 }; safe('combat.remove', () => C()?.remove?.(c, 'beacon')); }
    emit('beacon:drop', { actor: c, site: null, pos: B.pos, why });
    announce('beacon_dropped', { actor: c, teams: ['ember'] });
    return true;
  }
  function pickup(a) {
    if (B.state !== 'dropped' || !a.alive || a.team !== 'ember') return false;
    if (B.noPickup && B.noPickup.actor === a && M.clock < B.noPickup.until) return false;
    giveTo(a); return true;
  }

  function finishArm(c) {
    const site = B.site;
    B.state = 'armed'; B.pos.copy(c.pos); snap(B.pos, lastGround); B.planter = c; B.carrier = null; c.hasBeacon = false;
    B.progress = 0; B.t = 0; B.actor = null; B.fuseLeft = B.fuse; B.beeps = 1; B.warn = 0; B.interval = beepInterval(B.fuse, B.fuse); B.beepT = B.interval;
    safe('combat.remove', () => C()?.remove?.(c, 'beacon'));
    M.armedThisRound = true; ms(c).round.objective++; ms(c).total.plants++;
    for (const a of M.teams.ember) { addCredits(a, ECON.plant, 'plant'); }
    M.roundEcon.ember.plant += ECON.plant;
    env.setPhase('armed', B.fuse);
    emit('beacon:armed', { actor: c, site, pos: B.pos });
    emit('beacon:beep', { site, pos: B.pos, interval: B.interval, fuseLeft: B.fuse, n: 1, disarming: false });
    announce('beacon_armed', { site });
  }

  function finishDisarm(d) {
    B.state = 'disarmed'; B.disarmer = d; B.progress = 1; B.actor = null;
    addCredits(d, ECON.disarm, 'disarm'); M.roundEcon.tide.disarm += ECON.disarm;
    ms(d).round.objective++; ms(d).total.disarms++;
    emit('beacon:disarmed', { actor: d, site: B.site, pos: B.pos, kit: B.kit });
    announce('beacon_disarmed', { site: B.site });
    env.endRound('tide', 'disarmed');
  }

  function complete() {
    B.state = 'complete'; B.fuseLeft = 0; B.progress = 1;
    emit('beacon:complete', { actor: B.planter, site: B.site, pos: B.pos });
    env.endRound('ember', 'beacon');
  }

  // ---- per-tick pieces
  function tickArming(dt) {
    const c = B.carrier;
    if (B.state !== 'carried' && B.state !== 'arming') return;
    const site = c && c.alive ? siteAt(c.pos) : null;
    const ok = c && c.alive && site && useHeld(c) && standing(c);
    if (B.state === 'arming') {
      if (!ok || site !== B.site) { cancelArm(!c?.alive ? 'dead' : !useHeld(c) ? 'released' : 'moved'); return; }
      B.t += dt; B.progress = Math.min(1, B.t / B.armTime);
      if (B.t >= B.armTime - EPS) finishArm(c);
    } else if (ok && M.phase === 'live') {
      B.state = 'arming'; B.site = site; B.actor = c; B.t = 0; B.progress = 0; B.duration = B.armTime;
      emit('beacon:arm', { actor: c, site, pos: c.pos });
    }
  }

  const canDisarm = (a) => a.alive && a.team === 'tide' && useHeld(a) && horiz(a, B.pos) <= TUNE.disarmRange && Math.abs(a.pos.y - B.pos.y) <= 2.2 && standing(a);
  function tickDisarm(dt) {
    let d = B.state === 'disarming' && B.actor && canDisarm(B.actor) ? B.actor : null;
    if (!d) {
      let bd = 1e9;
      for (const a of M.teams.tide) if (canDisarm(a)) { const dd = horiz(a, B.pos); if (dd < bd) { bd = dd; d = a; } }
    }
    if (!d) { if (B.state === 'disarming') cancelDisarm(B.actor?.alive ? 'released' : 'dead'); return; }
    if (B.state === 'armed' || d !== B.actor) {
      if (B.state === 'disarming') cancelDisarm('switch');
      B.state = 'disarming'; B.actor = d; B.t = 0; B.progress = 0; B.kit = !!d.hasKit; B.duration = B.kit ? TUNE.kitDisarmTime : B.disarmTime;
      emit('beacon:disarm', { actor: d, site: B.site, pos: B.pos, kit: B.kit, duration: B.duration });
    }
    B.t += dt; B.progress = Math.min(1, B.t / B.duration);
    if (B.t >= B.duration - EPS) finishDisarm(d);
  }

  function tickArmed(dt) {
    B.fuseLeft -= dt;
    B.beepT -= dt;
    if (B.beepT <= 0) {
      B.interval = beepInterval(B.fuseLeft, B.fuse); B.beeps++;
      emit('beacon:beep', { site: B.site, pos: B.pos, interval: B.interval, fuseLeft: B.fuseLeft, n: B.beeps, disarming: B.state === 'disarming' });
      B.beepT += B.interval; if (B.beepT <= 0) B.beepT = B.interval;
    }
    if (B.warn < 1 && B.fuseLeft <= 10) { B.warn = 1; announce('beacon_10', { site: B.site }); }
    if (B.warn < 2 && B.fuseLeft <= 5) { B.warn = 2; announce('beacon_5', { site: B.site }); }
    if (B.fuseLeft <= EPS) { complete(); return; }
    tickDisarm(dt);
    if (M.phase !== 'armed') return;
    if (aliveOf('tide') === 0 && aliveOf('ember') > 0) env.endRound('ember', 'elimination');
  }

  function tickLive(dt) {
    if ((B.state === 'carried' || B.state === 'arming') && (!B.carrier || !B.carrier.alive)) { if (B.carrier) drop(B.carrier, 'tagged'); }
    if (B.state === 'carried' || B.state === 'arming') { if (B.carrier) { B.pos.copy(B.carrier.pos); if (B.carrier.onGround !== false) lastGround.copy(B.carrier.pos); } }
    // human manual drop (G) while the beacon is the equipped item
    const me = ctx.localActor;
    if (B.state === 'carried' && B.carrier === me && ctx.input?.pressed?.('drop') && ctx.combat?.equipped?.(me)?.def?.id === 'beacon') drop(me, 'manual');
    if (B.state === 'dropped') { for (const a of M.teams.ember) if (a.alive && horiz(a, B.pos) <= TUNE.pickupRange && Math.abs(a.pos.y - B.pos.y) <= 2.2 && pickup(a)) break; }
    tickArming(dt);
    if (M.phase !== 'live') return;
    const tl = M.phaseDuration - M.phaseTime;
    if (B.timeWarn < 1 && tl <= 30) { B.timeWarn = 1; announce('time_30'); }
    if (B.timeWarn < 2 && tl <= 10) { B.timeWarn = 2; announce('time_10'); }
    const ea = aliveOf('ember'), ta = aliveOf('tide');
    env.clutchCheck();
    if (ea === 0) env.endRound('tide', 'elimination');          // includes simultaneous wipe: defenders take the tie
    else if (ta === 0) env.endRound('ember', 'elimination');
    else if (M.phaseTime >= M.phaseDuration - EPS) { if (B.state === 'arming') cancelArm('time'); env.endRound('tide', 'time'); }   // 0:00 ends the round, even mid-arm (DESIGN: Tide wins on time with no beacon armed)
  }

  function tick(dt) {
    if (M.phase === 'live') tickLive(dt);
    else if (M.phase === 'armed') tickArmed(dt);
  }

  /** Debug/lab: arm right now at a site with the given (or first alive) ember. */
  function forceArm(siteId = 'A', who = null) {
    const c = who || B.carrier || M.teams.ember.find((a) => a.alive); if (!c) return false;
    if (B.state === 'dropped') pickup(c);
    if (!B.carrier) giveTo(c);
    const s = sites()[siteId] || sites().A; const ctr = s.center || s.pos;
    c.pos.set(ctr.x, ctr.y, ctr.z); c.vel.set(0, 0, 0); B.site = siteId;
    if (B.state === 'arming') cancelArm();
    B.carrier = c; B.state = 'carried'; finishArm(c);
    return true;
  }

  return {
    state: B, reset, assignCarrier, tick, drop, pickup, forceArm, siteAt, sites, beepInterval, cancelArm, cancelDisarm,
    canArm: (a) => !!(B.carrier === a && a.alive && siteAt(a.pos) && M.phase === 'live'),
    canDisarm,
  };
}
