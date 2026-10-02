// Utility use: Haze to cut sightlines at known lineups (map nodes), Strobe ahead of entries / peeks, Pulse to clear corners and punish a defuse.
// Throw solutions are found with the real grenade integrator (ctx.combat.utility.trajectory) from a proxy thrower, one simulation per tick
// across the whole server (cached per thrower cell / target), then thrown standing still so velocity inheritance is zero.
import * as THREE from 'three';
import { K } from './config.js';
import { DEG, clamp, wrapPi, yawTo, shuffle, pick } from './util.js';

const EXEC_TARGETS = {
  A: { long: ['long-top', 'a-ledge'], short: ['terrace-hold', 'a-triple', 'catwalk-hold'] },
  B: { tunnels: ['b-container', 'b-balcony', 'b-bigcrate'], mid: ['b-window-hold', 'b-conn-hold', 'b-boxes'] },
};
const POWERS = ['weak', 'medium', 'strong'];
const TOL = { haze: 3.4, strobe: 4.2, pulse: 3.2 };

export function createThrows(B) {
  const { ctx } = B;
  const cache = new Map();
  const proxy = { yaw: 0, pitch: 0, vel: new THREE.Vector3(), crouching: false, pos: new THREE.Vector3(), ex: 0, ey: 0, ez: 0, eyePos(o) { return o.set(this.ex, this.ey, this.ez); } };
  const out = [];
  const U = () => ctx.combat?.utility;

  const newState = () => ({ state: 'idle', orders: [], cur: null, busy: false, fire: false, aimBtn: false, hold: false, cand: 0, best: null, t: 0, solveKey: '', releaseT: 0, equippedAt: 0, doneAt: -9, yaw: 0, pitch: 0, power: 'strong', thrown: 0, cooldown: 0 });
  const reset = (ai) => { const u = ai.util; if (!u) return; u.state = 'idle'; u.orders.length = 0; u.cur = null; u.busy = false; u.fire = u.aimBtn = false; u.hold = false; };

  // ------------------------------------------------------------------------------------------------ order creation
  function addOrder(bot, type, target, when, o = {}) {
    const u = bot.ai.util; if (!u) return;
    if (u.orders.length > 4) return;
    u.orders.push({ type, target: target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z), when, expires: B.now + (o.ttl ?? 25), site: o.site, delay: o.delay ?? 0, minD: o.minD ?? 7, maxD: o.maxD ?? 27, tries: 0, popUp: o.popUp ?? 0 });
  }
  B.utilOrder = (bot, type, target, when, o) => { if (!bot || !bot.actor.alive) return; if ((ctx.combat?.utility?.count?.(bot.actor, type) || 0) < 1) return; addOrder(bot, type, target, when, o); };

  const node = (id) => ctx.map?.nodes?.byId?.[id];
  /** Called by the team planner when a plan starts. */
  B.utilPlan = (t, kind, S) => {
    const bots = t.bots || [];
    if (kind === 'ember') {
      const lists = EXEC_TARGETS[S] || {};
      let delay = 0;
      for (const b of bots) {
        const ai = b.ai, inv = b.actor.inventory, have = inv?.utility || [];
        if (!have.length || ai.rng() > 0.35 + 0.65 * ai.diff.util) continue;
        const key = ai.routeKey && lists[ai.routeKey] ? ai.routeKey : Object.keys(lists)[0];
        const tg = (lists[key] || []).map(node).filter(Boolean);
        if (!tg.length) continue;
        let i = 0;
        for (const type of new Set(have)) {
          const nd = tg[i++ % tg.length];
          if (type === 'haze') addOrder(b, 'haze', nd.pos, 'exec', { site: S, delay: 0.2 + delay, ttl: 40 });
          else if (type === 'strobe') addOrder(b, 'strobe', nd.pos, 'exec', { site: S, popUp: 2.0, delay: 1.6 + delay, minD: 6, maxD: 24, ttl: 40 });
          else if (type === 'pulse' && ai.rng() < 0.5) addOrder(b, 'pulse', nd.pos, 'exec', { site: S, delay: 2.4 + delay, minD: 6, maxD: 22, ttl: 40 });
          delay += 0.5;
        }
      }
    } else if (kind === 'retake') {
      const bc = ctx.match?.beacon; if (!bc) return;
      const spots = (ctx.map?.nodes?.list || []).filter((n) => n.site === S && ['cover', 'hold', 'angle', 'lurk'].includes(n.type) && n.pos.distanceTo(bc.pos) < 20 && n.pos.distanceTo(bc.pos) > 3);
      for (const b of bots) {
        const ai = b.ai, have = b.actor.inventory?.utility || []; let i = 0;
        for (const type of new Set(have)) {
          if (ai.rng() > 0.3 + 0.7 * ai.diff.util) continue;
          const sp = spots.length ? spots[(i++ + Math.floor(ai.rng() * spots.length)) % spots.length] : null;
          if (type === 'haze' && sp) addOrder(b, 'haze', sp.pos, 'retake', { site: S, ttl: 18, delay: 0.3 });
          else if (type === 'strobe') addOrder(b, 'strobe', bc.pos, 'retake', { site: S, ttl: 18, popUp: 2.2, delay: 1.0, minD: 5, maxD: 24 });
          else if (type === 'pulse') addOrder(b, 'pulse', sp ? sp.pos : bc.pos, 'retake', { site: S, ttl: 18, delay: 1.6, minD: 5, maxD: 22 });
        }
      }
    }
  };

  // ------------------------------------------------------------------------------------------------ solver
  const keyOf = (type, a, tgt) => `${type}|${Math.round(a.pos.x)},${Math.round(a.pos.z)}|${Math.round(tgt.x)},${Math.round(tgt.y)},${Math.round(tgt.z)}`;
  function candidates(d) {
    const pw = d < 11 ? ['weak', 'medium'] : d < 19 ? ['medium', 'strong'] : ['strong'];
    const pitches = []; for (let p = -8; p <= 52; p += 8) pitches.push(p);
    const list = []; for (const w of pw) for (const p of pitches) list.push([w, p]);
    return list;
  }
  function stepSolve(ai, o, now) {
    const u = ai.util, a = ai.actor, T = U(); if (!T) return false;
    if (u.solveKey !== o.key) { u.solveKey = o.key; u.cand = 0; u.best = null; o.cands = null; o.refined = false; }
    if (B.simBudget <= 0) return null;
    const tgt = o.tp;
    const dx = tgt.x - a.pos.x, dz = tgt.z - a.pos.z, d = Math.hypot(dx, dz);
    if (!o.cands) o.cands = candidates(d);
    B.simBudget--;
    const c = o.cands[u.cand++]; if (!c) { u.solveKey = ''; return false; }
    proxy.yaw = yawTo(dx, dz); proxy.ex = a.pos.x; proxy.ey = a.pos.y + (a.eyeHeight || K.eye); proxy.ez = a.pos.z; proxy.pitch = c[1] * DEG; proxy.crouching = false; proxy.vel.set(0, 0, 0);
    const pts = T.trajectory(proxy, o.type, c[0], out); const end = pts[pts.length - 1];
    const err = Math.hypot(end.x - tgt.x, (end.y - tgt.y) * 0.6, end.z - tgt.z);
    if (!u.best || err < u.best.err) u.best = { err, yaw: proxy.yaw, pitch: c[1] * DEG, power: c[0] };
    if (u.cand >= o.cands.length && !o.refined && u.best.err > TOL[o.type] * 0.4) {   // refine around the best coarse pitch
      o.refined = true; const bp = Math.round(u.best.pitch / DEG); for (const dp of [-4, 4, -2, 2, -6, 6]) o.cands.push([u.best.power, bp + dp]);
    }
    if (u.best.err < TOL[o.type] * 0.4 || u.cand >= o.cands.length) {
      const ok = u.best.err < TOL[o.type];
      cache.set(o.key, { ok, ...u.best, t: now }); u.solveKey = '';
      return ok ? true : false;
    }
    return null;
  }

  const tpv = new THREE.Vector3();
  // ------------------------------------------------------------------------------------------------ per-tick state machine
  /** returns true while the bot's weapon/aim is owned by the throw */
  function tick(ai, now, dt) {
    const u = ai.util, a = ai.actor; if (!u) return false;
    const T = U(); if (!T || !u.orders.length && u.state === 'idle') { u.busy = false; u.fire = u.aimBtn = false; return false; }
    const inv = a.inventory;
    // expire / drop orders we can no longer fulfil
    if (u.state === 'idle' || u.state === 'solve') for (let i = u.orders.length - 1; i >= 0; i--) { const o = u.orders[i]; if (now > o.expires || T.count(a, o.type) < 1) { if (u.cur === o) { u.cur = null; u.state = 'idle'; } u.orders.splice(i, 1); } }
    const tgt = ai.target, enemyNear = tgt && tgt.vis && (ai.aim.dist || 99) < 24;
    switch (u.state) {
      case 'idle': {
        u.busy = false; u.fire = u.aimBtn = false;
        if (now < u.cooldown || enemyNear || ai.planting || ai.defusing || ai.blind > 0.3) return false;
        const T_ = B.T?.[a.team]; let pick_ = null;
        for (const o of u.orders) {
          if (o.when === 'exec' && !(T_?.go && now - (T_.goneAt || 0) >= o.delay)) continue;
          if (o.when === 'retake' && !(T_?.retake?.stage === 'push' && now - (T_.retake.pushAt || 0) >= o.delay)) continue;
          const dx = o.target.x - a.pos.x, dz = o.target.z - a.pos.z, d = Math.hypot(dx, dz);
          if (d < o.minD || d > o.maxD) continue;
          pick_ = o; break;
        }
        if (!pick_) return false;
        pick_.tp = tpv.copy(pick_.target); pick_.tp = new THREE.Vector3(pick_.target.x, pick_.target.y + pick_.popUp, pick_.target.z);
        pick_.key = keyOf(pick_.type, a, pick_.tp);
        u.cur = pick_; u.state = 'solve'; u.t = now;
        return false;
      }
      case 'solve': {
        const o = u.cur; if (!o) { u.state = 'idle'; return false; }
        if (enemyNear) { u.state = 'idle'; u.cur = null; return false; }
        const hit = cache.get(o.key);
        let ok = null;
        if (hit && now - hit.t < 30) { ok = hit.ok; if (ok) u.best = hit; }
        else ok = stepSolve(ai, o, now);
        if (ok === null) { if (now - u.t > 3.5) { u.state = 'idle'; u.cur = null; } return false; }
        if (!ok) { o.tries++; if (o.tries >= 2) u.orders.splice(u.orders.indexOf(o), 1); u.cur = null; u.state = 'idle'; u.cooldown = now + 0.8; return false; }
        u.yaw = u.best.yaw; u.pitch = u.best.pitch; u.power = u.best.power;
        inv.utilSel = o.type; ctx.combat.switchTo(a, 4); u.equippedAt = now; u.state = 'equip'; u.busy = true; u.t = now;
        return true;
      }
      case 'equip': {
        u.busy = true; u.hold = true;
        const o = u.cur;
        if (!o || enemyNear || T.count(a, o.type) < 1) { abort(ai, now); return false; }
        if (inv.current !== 4 || inv.utilSel !== o.type) { if (now - u.equippedAt > 0.3) { inv.utilSel = o.type; ctx.combat.switchTo(a, 4); u.equippedAt = now; } if (now - u.t > 3) abort(ai, now); }
        else if (now - u.equippedAt > 0.65) { u.state = 'aim'; u.t = now; }
        aimAt(ai, u); return true;
      }
      case 'aim': {
        u.busy = true; u.hold = true; const o = u.cur;
        if (!o || (enemyNear && now - u.t < 0.5) || inv.current !== 4) { if (!o || inv.current !== 4) { abort(ai, now); return false; } }
        aimAt(ai, u);
        const eyaw = Math.abs(wrapPi(u.yaw - ai.aim.yaw)), epit = Math.abs(u.pitch - ai.aim.pitch), spd = a.move?.speed || 0;
        if ((eyaw < 0.012 && epit < 0.012 && spd < 0.7 && now - u.t > 0.12) || now - u.t > 1.4) {
          // press: strong = fire, weak = aim, medium = both; release after a few ticks -> throw
          u.state = 'press'; u.t = now; u.releaseT = now + 0.06;
          if (B.debugThrows) { const pts = T.trajectory(a, u.cur.type, u.power, []); const e = pts[pts.length - 1]; u.check = { end: [e.x, e.y, e.z].map((v) => +v.toFixed(1)), want: [u.cur.tp.x, u.cur.tp.y, u.cur.tp.z].map((v) => +v.toFixed(1)), yaw: [+u.yaw.toFixed(3), +ai.aim.yaw.toFixed(3)], pit: [+u.pitch.toFixed(3), +ai.aim.pitch.toFixed(3)], pw: u.power, best: u.best.err, vel: a.vel.toArray().map((v) => +v.toFixed(2)) }; }
        }
        return true;
      }
      case 'press': {
        u.busy = true; u.hold = true; aimAt(ai, u);
        u.fire = u.power === 'strong' || u.power === 'medium'; u.aimBtn = u.power === 'weak' || u.power === 'medium';
        if (now >= u.releaseT) { u.fire = u.aimBtn = false; u.state = 'release'; u.t = now; u.cnt0 = T.count(a, u.cur.type); }
        return true;
      }
      case 'release': {
        u.busy = true; u.hold = true; aimAt(ai, u); u.fire = u.aimBtn = false;
        if (T.count(a, u.cur.type) < u.cnt0 || now - u.t > 0.5) {
          if (T.count(a, u.cur.type) < u.cnt0) { u.thrown++; B.tel.throws = (B.tel.throws || 0) + 1; B.tel.throwsBy = B.tel.throwsBy || {}; B.tel.throwsBy[u.cur.type] = (B.tel.throwsBy[u.cur.type] || 0) + 1; B.callout(ai.bot, 'util', u.cur.target, u.cur.type); }
          const i = u.orders.indexOf(u.cur); if (i >= 0) u.orders.splice(i, 1);
          u.cur = null; u.state = 'after'; u.t = now; u.cooldown = now + 1.0;
        }
        return true;
      }
      case 'after': {
        u.busy = true; u.hold = true; u.fire = u.aimBtn = false; if (now - u.t < 0.45) aimAt(ai, u);
        if (now - u.t > 0.9) { u.state = 'idle'; u.busy = false; u.hold = false; ctx.combat.switchTo(a, inv.slots?.[1] ? 1 : 2); ai.slotCool = now + 0.5; return false; }
        return true;
      }
    }
    return false;
  }
  function aimAt(ai, u) { const it = ai.aim.it; it.kind = 3; it.yaw = u.yaw; it.pitch = u.pitch; }
  function abort(ai, now) {
    const u = ai.util, a = ai.actor; u.state = 'idle'; u.busy = false; u.hold = false; u.fire = u.aimBtn = false; u.cur = null; u.cooldown = now + 1.5;
    if (a.inventory.current === 4) { ctx.combat.switchTo(a, a.inventory.slots?.[1] ? 1 : 2); ai.slotCool = now + 0.5; }
  }

  return { newState, reset, tick, cache, addOrder };
}
