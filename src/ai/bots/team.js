// Team-level tactics. One planner per team; writes `ai.order` for each bot.
//  Ember: default/split/rush/mid executes timed with utility, a lurker, a Beacon carrier that plants with cover, post-plant crossfire.
//  Tide : site holds on hand-placed angles, info-driven rotations, retakes (gather -> strobe/haze -> push -> disarm), saves when outgunned.
import * as THREE from 'three';
import { K } from './config.js';
import { shuffle, pick } from './util.js';

const ROUTES = {
  A: {
    long: { stage: ['long-outer', 'long-doors', 'long-cargo'], hold: 0, entry: ['long-ramp-entry'] },
    short: { stage: ['ember-mid-gate', 'mid-lane-hold', 'mid-doors', 'short-ramp-mid', 'catwalk-top'], hold: 1, entry: ['catwalk-stairs'] },
  },
  B: {
    tunnels: { stage: ['tun-approach', 'tun-corner-1', 'tun-bend', 'tun-upper'], hold: 1, entry: ['tun-mouth', 'tun-mouth-in'] },
    mid: { stage: ['ember-mid-gate', 'mid-lane-hold', 'mid-doors', 'hub-pillar-w'], hold: 1, entry: ['hub-arch-w', 'b-conn-entry'] },
  },
};
const TIDE_ANCHORS = {
  A: ['long-top', 'a-ledge', 'a-triple', 'terrace-hold', 'a-default-boxes', 'a-stall', 'a-container'],
  B: ['b-window-hold', 'b-balcony', 'b-conn-hold', 'b-boxes', 'b-container', 'tun-upper', 'b-bigcrate'],
  MID: ['tide-mid-hold', 'hub-arch-w', 'hub-arch-e', 'hub-ledge', 'mid-door-peek-w'],
};
const TIDE_STAGING = {
  A: ['a-door', 'terrace-hold', 'tide-east-room', 'a-triple', 'long-top'],
  B: ['b-tide-door', 'b-conn-hold', 'tun-mouth', 'b-window-hold', 'tide-window-room'],
};
const FORWARD = { A: ['long-corner'], B: ['tun-upper', 'b-conn-hold'], MID: ['mid-door-peek-w', 'mid-door-peek-e', 'hub-pillar-w'] };
const SETUPS = [[2, 2, 1], [3, 2, 0], [2, 3, 0], [3, 1, 1], [2, 1, 2], [1, 3, 1]];
const TIDE_ENTRIES = { A: ['a-door', 'long-top', 'terrace-hold', 'catwalk-stairs'], B: ['b-tide-door', 'b-conn-hold', 'tun-mouth', 'b-window-hold'] };

export function createTeam(B) {
  const { ctx } = B;
  const M = () => ctx.match;
  const nodeOf = (id) => ctx.map?.nodes?.byId?.[id] || null;
  const siteC = (s) => ctx.map?.sites?.[s]?.center;
  const R = () => B.rng();
  const T = { ember: mkT('ember'), tide: mkT('tide') };
  function mkT(team) { return { team, round: -1, phase: '', style: '', site: null, goAt: 0, liveStart: 0, go: false, stage: 'idle', bots: [], lurker: null, retake: null, post: false, setup: null, nextThink: 0, tideSite: null, saveMode: false, util: [], lastSite: null }; }
  B.T = T;

  const alive = (team) => B.bots.filter((b) => b.actor.alive && b.team === team);
  const set = (b, o) => { b.ai.order = o; b.ai.mv.arrived = false; b.ai.seq = null; b.ai.lookAt = null; };
  const posOf = (id) => nodeOf(id)?.pos || null;
  function holdOrder(b, pos, yaw, o = {}) { set(b, { kind: 'hold', pos, yaw, peek: true, ...o }); }
  const dist2 = (a, p) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z);

  // ------------------------------------------------------------------------------------------------------------ sequences (staging routes)
  function setSeq(b, ids, holdIdx, extra = {}) {
    const pts = ids.map(posOf).filter(Boolean);
    if (!pts.length) return false;
    const es = extra.entryStart ?? pts.length;
    b.ai.order = { kind: 'goto', pos: pts[0], r: 1.1, seqIdx: 0, seq: pts, holdIdx: Math.min(holdIdx, pts.length - 1), stackIdx: Math.max(Math.min(holdIdx, pts.length - 1), Math.min(es - 1, pts.length - 1)), ...extra };
    b.ai.mv.arrived = false; return true;
  }
  /** advance bots that finished a route step */
  function seqTick(T_, now) {
    for (const b of T_.bots) {
      const o = b.ai.order; if (!o || !o.seq || !b.actor.alive) continue;
      if (!b.ai.mv.arrived) continue;
      if (o.seqIdx >= o.seq.length - 1) { o.seq = null; o.done = true; continue; }
      if (o.seqIdx >= o.holdIdx && !T_.go) { o.waiting = true; continue; }     // wait for the execute call
      if (o.seqIdx >= o.stackIdx && o.seqIdx >= o.holdIdx && T_.go && !T_.entryGo && !o.lurk) { o.waiting = true; o.stacked = true; continue; }   // stack up until the utility is down
      o.waiting = false; o.seqIdx++; o.pos = o.seq[o.seqIdx]; b.ai.mv.arrived = false;
    }
  }

  // ------------------------------------------------------------------------------------------------------------ Ember
  function planEmber(t, now) {
    const m = M(), bots = alive('ember'); if (!bots.length) return;
    const df = bots.reduce((s, b) => s + b.ai.diff.tactics, 0) / bots.length;
    t.round = m.round; t.go = false; t.entryGo = false; t.post = false; t.stage = 'approach'; t.util = []; t.siteSafeSince = 0; t.carrierReady = false;
    const r = R();
    t.style = df < 0.5 ? (r < 0.65 ? 'rush' : 'default') : r < 0.28 ? 'rush' : r < 0.54 ? 'default' : r < 0.78 ? 'split' : r < 0.92 ? 'late' : 'stall';
    t.site = R() < 0.5 ? 'A' : 'B';
    if (t.lastSite && R() < 0.35) t.site = t.lastSite === 'A' ? 'B' : 'A';
    t.lastSite = t.site;
    const execT = { rush: 0, default: 29 + R() * 15, split: 27 + R() * 14, late: 50 + R() * 12, stall: 62 + R() * 10 }[t.style];
    t.goAt = t.liveStart + execT * (0.75 + 0.25 * df) + (t.style === 'rush' ? 0 : 0);
    t.bots = bots.slice(); t.probed = false; t.probeAt = t.liveStart + 9 + R() * 12;
    const carrier = m.beacon?.carrier && bots.includes(m.beacon.carrier.ai?.bot) ? m.beacon.carrier.ai.bot : bots.find((b) => b.actor.hasBeacon) || null;
    t.carrier = carrier;
    const S = t.site, routes = ROUTES[S], keys = Object.keys(routes);
    // groups
    const pool = shuffle(R, bots.filter((b) => b !== carrier));
    let lurker = null;
    if (t.style !== 'rush' && pool.length >= 3 && df > 0.5 && R() < 0.8) lurker = pool.pop();
    t.lurker = lurker;
    const groups = (t.style === 'rush') ? [keys[R() < 0.5 ? 0 : 1]] : (t.style === 'split' || t.style === 'late' ? keys : [keys[R() < 0.5 ? 0 : 1]]);
    let gi = 0;
    for (const b of pool) { const key = groups[gi++ % groups.length]; b.ai.routeKey = key; const rt = routes[key]; setSeq(b, rt.stage.concat(rt.entry), rt.hold, { role: 'exec', site: S, route: key, entryStart: rt.stage.length }); b.ai.role = 'exec'; }
    if (carrier) {
      const key = groups[gi++ % groups.length]; carrier.ai.routeKey = key; const rt = routes[key];
      setSeq(carrier, rt.stage.concat(rt.entry), Math.max(0, rt.hold - 1), { role: 'carrier', site: S, route: key, entryStart: rt.stage.length }); carrier.ai.role = 'carrier';
    }
    if (lurker) {
      const other = S === 'A' ? 'B' : 'A', rts = ROUTES[other], k = Object.keys(rts)[R() < 0.5 ? 0 : 1], rt = rts[k];
      lurker.ai.role = 'lurk'; setSeq(lurker, rt.stage, rt.stage.length - 1, { role: 'lurk', site: other, route: k, lurk: true });
    }
    t.entryGo = false;
    B.utilPlan?.(t, 'ember', S);
    // utility throwers stack at the first route node that is within throwing range of their target
    for (const b of bots) {
      const o = b.ai.order, uo = b.ai.util?.orders?.[0]; if (!o || !o.seq || !uo) continue;
      for (let i = o.holdIdx; i < o.seq.length; i++) { const d = Math.hypot(o.seq[i].x - uo.target.x, o.seq[i].z - uo.target.z); if (d >= uo.minD && d <= uo.maxD - 1) { o.stackIdx = Math.max(o.holdIdx, i); break; } }
    }
  }

  function siteAssign(t, S, now) {
    // everyone not planting spreads over the site: cover/hold/angle nodes belonging to that site
    const list = (ctx.map?.nodes?.list || []).filter((n) => n.site === S && ['cover', 'hold', 'angle', 'lurk', 'choke'].includes(n.type));
    const sc = siteC(S);
    const spots = shuffle(R, list.slice()).sort((a, b) => Math.hypot(a.pos.x - sc.x, a.pos.z - sc.z) - Math.hypot(b.pos.x - sc.x, b.pos.z - sc.z)).slice(0, 8);
    let i = 0;
    for (const b of t.bots) {
      if (!b.actor.alive || b === t.carrier || b === t.lurker) continue;
      const n = spots[i++ % Math.max(1, spots.length)];
      if (n) set(b, { kind: 'push', pos: n.pos, yaw: n.yaw, r: 1.3, role: 'site', site: S, walk: false });
    }
  }

  /** facing for a planter: toward the farthest Tide entry that has a line to the spot (never stare at a crate) */
  function threatYaw(S, p) {
    let best = null, bd = 0;
    for (const id of TIDE_ENTRIES[S] || []) { const q = posOf(id); if (!q) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d > bd && d < 45 && ctx.nav.visible(p, q, { ignoreSmoke: true })) { bd = d; best = q; } }
    if (!best) best = posOf((TIDE_ENTRIES[S] || [])[0]);
    return best ? Math.atan2(-(best.x - p.x), -(best.z - p.z)) : undefined;
  }
  function plantPos(S) {
    const inSite = (p) => ctx.match?.beaconApi?.siteAt?.(p) === S;
    const list = (ctx.map?.nodes?.list || []).filter((n) => n.type === 'plant' && n.site === S && inSite(n.pos));
    if (!list.length) return siteC(S);
    const w = list.map((n) => (/default/.test(n.id) ? 2.2 : 0.7));
    let r = R() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i].pos; }
    return list[0].pos;
  }

  function tickEmber(t, now) {
    const m = M(), bc = m.beacon, S = t.site, live = m.phase === 'live', armed = m.phase === 'armed';
    t.bots = alive('ember');
    if (!t.bots.length) return;
    const df = t.bots.reduce((s, b) => s + b.ai.diff.tactics, 0) / t.bots.length;
    // carrier may have changed (death/pickup)
    const car = bc?.carrier ? bc.carrier.ai?.bot || null : null;
    if (live) {
      if (!t.go && now >= t.goAt) { t.go = true; t.goneAt = now; B.callout(t.bots[0], 'execute', null, 'Ember executes ' + S); for (const b of t.bots) if (b.ai.order?.waiting) b.ai.order.waiting = false; }
      // intel-triggered early go: contact with a lot of enemy info on our route does not abort; but if 2+ teammates already dead switch to a faster exec
      if (!t.go && t.bots.length <= 3 && now - t.liveStart > 20) t.go = true;
      if (t.go && !t.entryGo) {
        const pend = t.bots.some((b) => b.ai.util && (b.ai.util.busy || b.ai.util.orders.some((u) => u.when === 'exec')));
        if (!pend || now - (t.goneAt || now) > 6.5) { t.entryGo = true; t.entryAt = now; for (const b of t.bots) { b.ai.util?.orders.forEach((u) => { if (u.when === 'exec') u.expires = Math.min(u.expires, now + 3); }); } }
      }
      if (!t.go && !t.probed && now >= t.probeAt) {   // map-control probe: one player per lane takes the next position for info
        t.probed = true; const seen = new Set();
        for (const b of t.bots) { const o = b.ai.order; if (!o || !o.seq || b === t.carrier || b === t.lurker || seen.has(o.route)) continue; seen.add(o.route); o.holdIdx = Math.min(o.seq.length - 2, o.holdIdx + 1); o.waiting = false; }
      }
      seqTick(t, now);
      // beacon dropped -> nearest pick it up
      if (bc.state === 'dropped') {
        let best = null, bd = 1e9; for (const b of t.bots) { const d = dist2(b.actor, bc.pos); if (d < bd) { bd = d; best = b; } }
        for (const b of t.bots) if (b === best && (!b.ai.order || b.ai.order.kind !== 'goto' || b.ai.order.pickup !== true)) { set(b, { kind: 'goto', pos: bc.pos, r: 0.7, pickup: true, role: 'pickup' }); }
      } else if (car && car !== t.carrier) {
        // new carrier: heads to the site entry too
        t.carrier = car; const rt = ROUTES[S][pick(R, Object.keys(ROUTES[S]))];
        if (t.go) set(car, { kind: 'goto', pos: posOf(rt.entry[rt.entry.length - 1]) || siteC(S), r: 1.5, role: 'carrier', site: S }); else setSeq(car, rt.stage.concat(rt.entry), rt.hold, { role: 'carrier', site: S, entryStart: rt.stage.length });
        car.ai.role = 'carrier';
      }
      // go: for everyone whose sequence finished -> site assignment
      if (t.go) {
        const lurkGo = now - t.goneAt > 9 * (1.2 - 0.5 * df);
        for (const b of t.bots) {
          const o = b.ai.order;
          if (b === t.lurker && !o?.lurkDone) {
            if (lurkGo && o && !o.seq && o.done && !o.moved) { const other = o.site, rt = ROUTES[other]; const k = Object.keys(rt)[R() < 0.5 ? 0 : 1]; setSeq(b, rt[k].entry, 0, { role: 'lurk', site: other, moved: true, lurkDone: true }); T.ember.go = true; }
            continue;
          }
          if (o && o.seq && !o.waiting) continue;
          if (o && (o.kind === 'plant' || o.kind === 'push' && o.role === 'site')) continue;
          if (o && o.role === 'pickup') continue;
          if (b === t.carrier) continue;
        }
        const needSite = t.bots.some((b) => b !== t.carrier && b !== t.lurker && b.ai.order && b.ai.order.done && b.ai.order.role === 'exec');
        if (needSite && !t.siteAssigned) { t.siteAssigned = true; siteAssign(t, S, now); }
        if (t.go && now - t.goneAt > 14 && !t.siteAssigned) { t.siteAssigned = true; siteAssign(t, S, now); }
        // carrier: plant when somebody secured the site (no enemy seen there for a bit) or time pressure
        if (t.carrier && t.carrier.actor.alive && bc.state === 'carried') {
          const co = t.carrier.ai.order;
          if (t.bots.length === 1 && alive('tide').length >= 2 && (m.timeLeft ?? 60) > 38 && !t.stalling && !t.planting) { t.stalling = true; set(t.carrier, { kind: 'hold', pos: t.carrier.actor.pos.clone(), yaw: undefined, role: 'carrier', site: S, r: 1, stall: true }); }
          if (t.stalling && (m.timeLeft ?? 60) <= 36) t.stalling = false;
          if (t.stalling) return;
          const atEntry = co && (co.done || (!co.seq && t.carrier.ai.mv.arrived));
          const enemySeen = B.enemyKnownNear(t.team, siteC(S), 14, 5, now);
          const mates = t.bots.filter((b) => b !== t.carrier && b.actor.alive && dist2(b.actor, siteC(S)) < 14).length;
          const tleft = m.timeLeft ?? 60;
          if (!t.planting && now > (t.plantBlock || 0) && (tleft < 30 || (atEntry && !enemySeen && (mates >= 1 || t.bots.length === 1)) || (tleft < 28 && atEntry) || (atEntry && now - (co.doneAt ||= now) > 12 / (0.5 + df)))) {
            t.planting = true; t.plantPos = plantPos(S);
            set(t.carrier, { kind: 'plant', pos: t.plantPos, role: 'carrier', site: S, yaw: threatYaw(S, t.plantPos) });
          }
          if (t.planting && t.carrier.ai.order?.kind !== 'plant') t.planting = false;
          if (t.planting && bc.state === 'carried' && !t.carrier.ai.mv.arrived && B.enemyKnownNear(t.team, t.plantPos || siteC(S), 14, 1.5, now) && tleft > 25) { t.planting = false; t.plantBlock = now + 4; const co2 = { kind: 'hold', pos: t.carrier.actor.pos.clone(), yaw: threatYaw(S, t.carrier.actor.pos), role: 'carrier', site: S, r: 1 }; set(t.carrier, co2); co2.done = true; }
          if (t.planting && t.carrier.ai.mv.arrived) { t.plantArrivedAt = t.plantArrivedAt || now; if (now - t.plantArrivedAt > 4.5 && bc.state === 'carried') { t.plantArrivedAt = 0; const c = siteC(S); const p = ctx.nav.randomPointNear(c, 4.5, { dy: 2 }); t.plantPos = p || c; set(t.carrier, { kind: 'plant', pos: t.plantPos, role: 'carrier', site: S, yaw: threatYaw(S, t.plantPos) }); } } else if (!t.planting) t.plantArrivedAt = 0;
        }
        if (t.planting && bc.state === 'carried' && B.visibleEnemies(t.carrier) > 0 && t.carrier.actor.hp < 100 && false) { /* fight handled by brain */ }
      }
    }
    if (armed) {
      if (!t.post) { t.post = true; postPlant(t, now); }
      // defuse started -> push the defuser
      if (bc.state === 'disarming' && now > (t.pushT || 0)) {
        t.pushT = now + 3;
        const near = t.bots.slice().sort((a, b) => dist2(a.actor, bc.pos) - dist2(b.actor, bc.pos)).slice(0, 2);
        for (const b of near) if (!b.ai.order || b.ai.order.kind !== 'push' || !b.ai.order.defuseCounter) set(b, { kind: 'push', pos: bc.pos, r: 3, role: 'counter', defuseCounter: true });
        B.utilOrder?.(near[0], 'pulse', bc.pos, 'now');
      }
    }
  }

  function postPlant(t, now) {
    const bc = M().beacon, S = bc.site || t.site, bp = bc.pos;
    const list = (ctx.map?.nodes?.list || []).filter((n) => n.site === S && ['cover', 'hold', 'angle', 'lurk', 'choke'].includes(n.type) && n.pos.distanceTo(bp) < 28 && n.pos.distanceTo(bp) > 5);
    const good = list.filter((n) => ctx.nav.visible(n.pos, bp, { ignoreSmoke: true }));
    const spots = shuffle(R, (good.length >= t.bots.length ? good : list).slice());
    let i = 0;
    for (const b of t.bots) {
      if (!b.actor.alive) continue;
      const n = spots[i++ % Math.max(1, spots.length)];
      // face the most likely retake direction (a Tide entry we can see) else the beacon
      let yaw = null;
      if (n) {
        let best = 1e9; for (const id of TIDE_ENTRIES[S] || []) { const p = posOf(id); if (!p) continue; const d = p.distanceTo(n.pos); if (d > 5 && d < best && ctx.nav.visible(n.pos, p, { ignoreSmoke: true })) { best = d; yaw = Math.atan2(-(p.x - n.pos.x), -(p.z - n.pos.z)); } }
        if (yaw === null) yaw = Math.atan2(-(bp.x - n.pos.x), -(bp.z - n.pos.z));
        set(b, { kind: 'hold', pos: n.pos, yaw, peek: false, role: 'post', site: S, sneak: true });
      } else set(b, { kind: 'hold', pos: bp, yaw: null, r: 4, role: 'post', site: S });
    }
  }

  // ------------------------------------------------------------------------------------------------------------ Tide
  function planTide(t, now) {
    const bots = alive('tide'); if (!bots.length) return;
    t.round = M().round; t.stage = 'hold'; t.retake = null; t.saveMode = false; t.bots = bots.slice(); t.util = [];
    const df = bots.reduce((s, b) => s + b.ai.diff.tactics, 0) / bots.length;
    let setup = pick(R, SETUPS); let [na, nb, nm] = setup;
    const n = bots.length; while (na + nb + nm > n) { if (nm > 0) nm--; else if (na >= nb) na--; else nb--; }
    while (na + nb + nm < n) { if (R() < 0.5) na++; else nb++; }
    const want = { A: na, B: nb, MID: nm };
    t.setup = want;
    const pool = shuffle(R, bots.slice());
    for (const key of ['A', 'B', 'MID']) {
      const anchors = TIDE_ANCHORS[key].slice(); if (key !== 'MID' && df > 0.6) shuffle(R, anchors.slice(2)).forEach((v, i) => (anchors[i + 2] = v));
      for (let i = 0; i < want[key] && pool.length; i++) {
        const b = pool.pop(), id = anchors[i % anchors.length], nd = nodeOf(id);
        b.ai.role = 'anchor'; b.ai.anchorSite = key;
        if (nd) holdOrder(b, nd.pos, nd.yaw, { role: 'anchor', site: key, nodeId: id, crouch: nd.elevated ? false : undefined });
      }
    }
    // early aggression: some rounds a defender or two take a forward angle for info / a pick, then fall back
    if (df > 0.5 && R() < 0.3 + 0.1 * df) {
      const cand = shuffle(R, bots.filter((b) => b.ai.order?.role === 'anchor' && b.actor.inventory?.slots?.[1]?.id !== 'lance'));
      const n = Math.min(cand.length - 1, R() < 0.3 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const b = cand[i], key = b.ai.order.site, ids = FORWARD[key] || FORWARD.MID, id = pick(R, ids), nd = nodeOf(id);
        if (nd) { holdOrder(b, nd.pos, nd.yaw, { role: 'anchor', site: key, nodeId: id, forward: true, retreatAt: t.liveStart + 26 + R() * 14 }); }
      }
    }
    B.utilPlan?.(t, 'tide');
  }

  function siteOf(p) {
    const A = siteC('A'), Bs = siteC('B'); if (!A || !Bs) return 'MID';
    const dA = Math.hypot(p.x - A.x, p.z - A.z), dB = Math.hypot(p.x - Bs.x, p.z - Bs.z);
    if (dA < 22 || (p.x > 22 && p.z < 20)) return 'A';
    if (dB < 22 || (p.x < -22 && p.z < 20)) return 'B';
    if (p.x > 14 && p.z < 30) return 'A';
    if (p.x < -14 && p.z < 30) return 'B';
    return 'MID';
  }
  B.siteOf = siteOf;

  function tickTide(t, now) {
    const m = M(), bc = m.beacon, armed = m.phase === 'armed' || bc?.state === 'armed' || bc?.state === 'disarming';
    t.bots = alive('tide');
    if (!t.bots.length) return;
    const emberAlive = alive('ember').length;
    if (!armed) {
      // info-based rotation
      const th = { A: 0, B: 0, MID: 0 };
      const intel = B.teamIntel('tide');
      for (const it of intel.values()) { const age = now - it.t; if (age > 12) continue; const s = siteOf(it.pos); th[s] += 1 + (it.src === 'vis' ? 0.5 : 0); }
      if (now > (t.rotateAt || 0)) {
        for (const S of ['A', 'B']) {
          const def = t.bots.filter((b) => b.ai.order?.site === S && b.ai.order?.role === 'anchor');
          if (th[S] >= 2 && def.length < 3 && now - t.liveStart > 8) {
            const from = t.bots.filter((b) => b.ai.order?.role === 'anchor' && b.ai.order.site !== S).sort((a, b) => dist2(a.actor, siteC(S)) - dist2(b.actor, siteC(S)));
            const other = S === 'A' ? 'B' : 'A';
            const donors = from.filter((b) => b.ai.order.site === 'MID').concat(from.filter((b) => b.ai.order.site === other));
            const donorCount = t.bots.filter((b) => b.ai.order?.site === other && b.ai.order?.role === 'anchor').length;
            const take = donors.find((b) => b.ai.order.site === 'MID' || donorCount > 1);
            if (take) {
              const used = new Set(t.bots.map((b) => b.ai.order?.nodeId)); const id = TIDE_ANCHORS[S].find((x) => !used.has(x) && nodeOf(x)) || TIDE_ANCHORS[S][0], nd = nodeOf(id);
              if (nd) { holdOrder(take, nd.pos, nd.yaw, { role: 'anchor', site: S, nodeId: id, rotated: true }); B.callout(take, 'rotate', nd.pos, 'rotating ' + S); t.rotateAt = now + 6; }
            }
          }
        }
      }
      // forward players fall back to a site hold after their info window (unless in contact)
      for (const b of t.bots) {
        const o = b.ai.order; if (!o || !o.forward || now < o.retreatAt || B.visibleEnemies(b) > 0) continue;
        const cnt = { A: 0, B: 0 }; for (const x of t.bots) { const k = x.ai.order; if (k && k.role === 'anchor' && !k.forward && cnt[k.site] !== undefined) cnt[k.site]++; }
        const S = cnt.A <= cnt.B ? 'A' : 'B', used = new Set(t.bots.map((x) => x.ai.order?.nodeId)), id = TIDE_ANCHORS[S].find((x) => !used.has(x) && nodeOf(x)) || TIDE_ANCHORS[S][0], nd = nodeOf(id);
        if (nd) holdOrder(b, nd.pos, nd.yaw, { role: 'anchor', site: S, nodeId: id });
      }
    } else {
      if (!t.retake) startRetake(t, now);
      tickRetake(t, now, emberAlive);
    }
  }

  function startRetake(t, now) {
    const bc = M().beacon, S = bc.site || 'A';
    t.retake = { site: S, stage: 'gather', t0: now, defuser: null };
    t.stage = 'retake';
    const ids = TIDE_STAGING[S].filter(nodeOf), bots = t.bots.slice().sort((a, b) => dist2(a.actor, bc.pos) - dist2(b.actor, bc.pos));
    // distinct staging spots, nearest first
    const used = new Set();
    for (const b of bots) {
      let best = null, bd = 1e9; for (const id of ids) { if (used.has(id)) continue; const p = posOf(id), d = dist2(b.actor, p); if (d < bd) { bd = d; best = id; } }
      if (!best) best = ids[0]; used.add(best);
      const nd = nodeOf(best);
      set(b, { kind: 'goto', pos: nd.pos, yaw: nd.yaw, r: 1.4, role: 'retake', site: S });
      b.ai.role = 'retake';
    }
    B.callout(bots[0], 'retake', bc.pos, 'retake ' + S);
    B.utilPlan?.(t, 'retake', S);
  }

  function tickRetake(t, now, emberAlive) {
    const m = M(), bc = m.beacon, rt = t.retake, S = rt.site, fuse = bc.fuseLeft ?? 30;
    const bots = t.bots, df = bots.reduce((s, b) => s + b.ai.diff.tactics, 0) / bots.length;
    // save only when the defuse cannot be made in time (travel + disarm); a lone defender goes if he can
    const eta = (b) => (ctx.nav.eta ? ctx.nav.eta(b.actor.pos, bc.pos, 6.3) : dist2(b.actor, bc.pos) / 6.3) + (b.actor.hasKit ? 2.6 : 5.2) + 1.2;
    const can = bots.filter((b) => eta(b) < fuse);
    if (!can.length) {
      if (!t.saveMode) { t.saveMode = true; for (const b of bots) { const sp = ctx.map?.spawns?.tide?.[0]; if (sp) set(b, { kind: 'hold', pos: sp.pos, yaw: 0, r: 5, role: 'save' }); } }
      return;
    }
    if (t.saveMode) { t.saveMode = false; }
    for (const b of bots) if (!can.includes(b) && b.ai.order?.role !== 'save') { const sp = ctx.map?.spawns?.tide?.[0]; if (sp) set(b, { kind: 'hold', pos: sp.pos, yaw: 0, r: 5, role: 'save' }); }
    const arrived = bots.filter((b) => b.ai.mv.arrived || dist2(b.actor, b.ai.order?.pos || b.actor.pos) < 3).length;
    if (rt.stage === 'gather') {
      const need = Math.min(bots.length, 3);
      const etaMax = Math.max(...can.map(eta));
      if ((arrived >= need && now - rt.t0 > 3) || fuse < etaMax + 8 || now - rt.t0 > 12 - 3 * df) {
        rt.stage = 'push'; rt.pushAt = now;
        // defuser: kit first, then closest to the beacon with most hp
        const d = bots.slice().sort((a, b) => ((b.actor.hasKit ? 1 : 0) - (a.actor.hasKit ? 1 : 0)) || (dist2(a.actor, bc.pos) - dist2(b.actor, bc.pos)))[0];
        rt.defuser = d;
        const sc = siteC(S), list = (ctx.map?.nodes?.list || []).filter((n) => n.site === S && ['cover', 'hold', 'angle', 'lurk', 'choke'].includes(n.type) && n.pos.distanceTo(bc.pos) < 24);
        const spots = shuffle(R, list.slice()).slice(0, 8); let i = 0;
        for (const b of bots) {
          if (b === d) continue;
          const nd = spots[i++ % Math.max(1, spots.length)];
          set(b, { kind: 'push', pos: nd ? nd.pos : bc.pos, yaw: nd ? nd.yaw : null, r: 1.5, role: 'retake', site: S, sneak: true });
        }
        if (d) set(d, { kind: 'goto', pos: posOf(TIDE_STAGING[S][0]) || sc, r: 2.5, role: 'defuser', site: S });
        B.callout(bots[0], 'push', bc.pos, 'pushing ' + S);
      }
    } else if (rt.stage === 'push') {
      const d = rt.defuser;
      if (!d || !d.actor.alive) { rt.defuser = bots.slice().sort((a, b) => dist2(a.actor, bc.pos) - dist2(b.actor, bc.pos))[0]; }
      const df2 = rt.defuser;
      if (df2 && df2.ai.order?.kind !== 'defuse') {
        const safe = !B.enemyKnownNear('tide', bc.pos, 14, 3.5, now);
        const dk = df2.actor.hasKit;
        if (safe && now - rt.pushAt > 2.2 || fuse < (dk ? 9 : 13) + 2 || now - rt.pushAt > 14) set(df2, { kind: 'defuse', pos: bc.pos, role: 'defuser', site: S });
      }
      // defuser interrupted by an enemy: brain fights, order stays; if beacon isn't being disarmed and enemy visible, nothing else to do
    }
  }

  // ------------------------------------------------------------------------------------------------------------ warm-up / free play
  function roamTick(now) {
    for (const b of B.bots) {
      if (!b.actor.alive) continue;
      const o = b.ai.order;
      if (!o || o.kind !== 'roam' || (b.ai.mv.arrived && now > (b.ai.roamT || 0)) || b.ai.mv.unreachable) {
        const p = ctx.nav.randomPoint(); if (!p) continue; b.ai.roamT = now + 1 + R() * 3; set(b, { kind: 'roam', pos: p.clone(), r: 1.5 });
      }
    }
  }

  function clearOrders() { for (const b of B.bots) { b.ai.order = null; } }

  // ------------------------------------------------------------------------------------------------------------ driver
  function update(now) {
    const m = M();
    const phase = m?.phase;
    if (!m || !m.active && !m.teams) { roamTick(now); return; }
    if (phase === 'warmup' || (m.active === false)) { roamTick(now); return; }
    if (phase !== 'live' && phase !== 'armed') return;
    for (const team of ['ember', 'tide']) {
      const t = T[team];
      if (t.round !== m.round || t.needPlan) {
        if (!t.liveStart || t.round !== m.round) t.liveStart = now - (m.phase === 'live' ? m.phaseTime || 0 : 0);
        t.needPlan = false; t.siteAssigned = false; t.planting = false;
        (team === 'ember' ? planEmber : planTide)(t, now);
      }
      if (team === 'ember') tickEmber(t, now); else tickTide(t, now);
    }
  }
  /** called when the round (re)starts, so planning happens with fresh freeze-time positions */
  function onRound() { for (const k of ['ember', 'tide']) { T[k].round = -1; T[k].needPlan = true; T[k].retake = null; T[k].post = false; T[k].go = false; T[k].entryGo = false; T[k].saveMode = false; T[k].goneAt = 0; T[k].lurker = null; T[k].stalling = false; T[k].plantBlock = 0; T[k].planting = false; } clearOrders(); }

  return { update, onRound, planEmber, planTide, siteOf, T };
}
