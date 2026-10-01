// Combat core: inventory, fire loop, recoil/spread, hitscan + penetration, damage, pickups.  Owner: `tagger` piece.
// Pure of DOM (runs in Node for tools/combat_test.mjs).  index.js wraps this and wires viewmodel + utility.
import * as THREE from 'three';
import { TAGGERS, GEAR, UTILITY_IDS, SLOT_OF, DEFAULT_LOADOUT, patternAt, VIEW_TRACK } from './taggers.js';
import { DEG, MATERIALS, inaccuracyDeg, crosshairFrac, rawDamage, armourSplit, normGroup, matOf, hitActorBuiltin } from './ballistics.js';
import { mulberry32 } from '../core/rng.js';

const UTIL_PRICE = { haze: 300, strobe: 200, pulse: 300 };
const SCORE_PHASES = new Set(['warmup', 'live', 'armed', 'roundEnd', 'practice']);
const NO_FIRE_PHASES = new Set(['freeze', 'halftime', 'matchEnd']);
const TWO_PI = Math.PI * 2;
const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _ray = new THREE.Ray();
const _hit = { t: 0, group: '' };
const _pat = { yaw: 0, pitch: 0 };
const _box = new THREE.Box3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let UID = 1;

export function createCore(ctx) {
  const core = {
    time: 0, taggers: TAGGERS, gear: GEAR, targets: [], drops: [], debugLast: null,
    hooks: { impact: [], shot: [], hit: [] },     // debug/scene callbacks (range decals, tests)
    seed: 1,
  };
  const emit = (t, d) => ctx.events?.emit?.(t, d);
  const vm = () => ctx.combat?.viewmodel;
  const isLocal = (a) => a === ctx.localActor;
  const phase = () => ctx.match?.phase;

  // ------------------------------------------------------------------------------------------------ per-actor state
  function brain(actor) {
    let cb = actor.cb;
    if (cb) return cb;
    cb = actor.cb = {
      rng: mulberry32((core.seed * 2654435761 + actor.id * 40503) >>> 0), arng: mulberry32(actor.id * 977 + 13),
      inaccFire: 0, recoilIdx: 0, peakIdx: 0, lastShotT: -9, shots: 0, burstLeft: 0, fireBuf: 0,
      landT: 0, prevGround: true, hitSlow: 1, hitSlowT: 0, dmgBy: new Map(), melee: null, dropT: -9, lastSlotDropped: 0,
      pvYaw: 0, pvPitch: 0, flYaw: 0, flPitch: 0, xhair: 0, inacc: 0, prev: Object.create(null), cmd: null, ext: null, yawPrev: actor.yaw, pitchPrev: actor.pitch,
      lookX: 0, lookY: 0, spawnT: core.time,
    };
    return cb;
  }
  const inv = (actor) => {
    const i = actor.inventory;
    if (!i.slots) i.slots = {};
    if (!i.utility) i.utility = [];
    if (i.current === undefined) i.current = null;
    return i;
  };
  const cur = (actor) => {
    const i = actor.inventory, c = i.current;
    if (c === 1 || c === 2 || c === 3) return i.slots[c] || null;
    return null;
  };
  function newWeapon(def, over) {
    return { uid: UID++, id: def.id, def, mag: def.mag, reserve: def.reserve, state: 'idle', t: 0, dur: 0, scoped: false, scopeLevel: 0, burst: 0,
      nextFire: 0, drawEnd: 0, reloadT: 0, reloadStage: 0, shellPhase: 0, lastFireT: -9, ...over };
  }

  // ------------------------------------------------------------------------------------------------ equip / inventory
  function ensureLoadout(actor) {
    const i = inv(actor), cb = brain(actor);
    if (i.slots[3] || i.slots[2] || i.slots[1]) return;
    i.slots[3] = newWeapon(TAGGERS.tap); i.slots[2] = newWeapon(TAGGERS.pip);
    i.current = null; equip(actor, 2, true);
    cb.spawnT = core.time;
  }
  function pseudo(actor) {          // equipped() view of utility / gear slots
    const i = actor.inventory;
    if (i.current === 4) { const id = i.utilSel || i.utility[0]; return id ? { id, def: { id, slot: 4, utility: true, name: id, moveSpeed: TAGGERS.tap.moveSpeed, moveSpeedU: 250, price: UTIL_PRICE[id] || 300, mag: 1, cycle: 0.5 }, mag: i.utility.filter((u) => u === id).length, reserve: 0, state: 'idle', t: 0, scoped: false, burst: 0 } : null; }
    if (i.current === 5 && actor.hasBeacon) return { id: 'beacon', def: { ...GEAR.beacon, moveSpeed: TAGGERS.tap.moveSpeed, moveSpeedU: 250, slot: 5 }, mag: 1, reserve: 0, state: 'idle', t: 0, scoped: false, burst: 0 };
    return null;
  }
  function equipped(actor) {
    const i = actor?.inventory; if (!i) return null;
    if (i.current === 1 || i.current === 2 || i.current === 3) return i.slots?.[i.current] || null;
    return pseudo(actor);
  }
  function unscope(actor, cb, w, quiet) {
    if (!w || !w.scopeLevel) return;
    w.scopeLevel = 0; w.scoped = false;
    if (!quiet) { if (isLocal(actor)) vm()?.event?.('scopeOut', { id: w.id }); emit('weapon:scope', { actor, tagger: w.id, scoped: false, level: 0 }); }
  }
  function cancelReload(actor, w, why = 'cancel') {
    if (w && w.state === 'reload') { w.state = 'idle'; w.reloadT = 0; emit('weapon:reload', { actor, tagger: w.id, stage: why }); }
  }
  function equip(actor, slot, force) {
    const i = inv(actor), cb = brain(actor);
    if (!force && i.current === slot) return false;
    const old = cur(actor);
    if (old) { cancelReload(actor, old); unscope(actor, cb, old); old.burst = 0; if (isLocal(actor)) vm()?.event?.('holster', { id: old.id }); }
    cb.burstLeft = 0; cb.melee = null;
    if (cb.throwPrimed) { cb.throwPrimed = false; ctx.combat?.utility?.preview?.hide?.(); }
    if (slot === 1 || slot === 2 || slot === 3) {
      const w = i.slots[slot]; if (!w) return false;
      if (i.current !== slot) i.previous = i.current;
      i.current = slot;
      w.state = 'draw'; w.t = 0; w.dur = w.def.draw; w.drawEnd = core.time + w.def.draw; w.nextFire = Math.max(w.nextFire, w.drawEnd);
      cb.recoilIdx = 0; cb.peakIdx = 0; cb.inaccFire = 0;
      emit('weapon:switch', { actor, tagger: w.id });
      if (isLocal(actor)) { const V = vm(); V?.setTagger?.(w.id, skinOf(actor)); V?.event?.('draw', { id: w.id, time: w.def.draw, dur: w.def.draw }); }
      return true;
    }
    if (slot === 4) {
      if (!i.utility.length) return false;
      if (i.current !== 4) { i.previous = i.current; i.current = 4; if (!i.utilSel || !i.utility.includes(i.utilSel)) i.utilSel = i.utility[0]; }
      else { const k = i.utility.indexOf(i.utilSel); i.utilSel = i.utility[(k + 1) % i.utility.length]; }
      emit('weapon:switch', { actor, tagger: i.utilSel });
      ctx.combat?.utility?.select?.(actor, i.utilSel);
      if (isLocal(actor)) { const V = vm(); V?.setTagger?.(i.utilSel, skinOf(actor)); V?.event?.('draw', { id: i.utilSel, dur: 0.6 }); }
      return true;
    }
    if (slot === 5) {
      if (!actor.hasBeacon) return false;
      if (i.current !== 5) { i.previous = i.current; i.current = 5; }
      emit('weapon:switch', { actor, tagger: 'beacon' });
      if (isLocal(actor)) { const V = vm(); V?.setTagger?.('beacon', skinOf(actor)); V?.event?.('draw', { id: 'beacon', dur: 0.5 }); }
      return true;
    }
    return false;
  }
  function skinOf(actor) {
    try { const c = ctx.cosmetics; return c?.resolve?.(c.getLoadout?.(actor))?.taggerSkin ?? null; } catch { return null; }
  }
  function bestSlot(actor) { const s = actor.inventory.slots; return s[1] ? 1 : s[2] ? 2 : 3; }

  function give(actor, id, o = {}) {
    const i = inv(actor); brain(actor);
    const def = TAGGERS[id];
    if (def) {
      const slot = def.slot, old = i.slots[slot];
      if (old && old.id === id && slot !== 3) { old.mag = o.mag ?? def.mag; old.reserve = o.reserve ?? def.reserve; return old; }
      if (old && slot !== 3) {
        if (i.current === slot) { cancelReload(actor, old); unscope(actor, brain(actor), old); }
        spawnDrop(actor, old, false);
      }
      const w = newWeapon(def, { mag: o.mag ?? def.mag, reserve: o.reserve ?? def.reserve });
      i.slots[slot] = w;
      if (o.select !== false && slot !== 3 && (slot === 1 || i.current !== 1)) equip(actor, slot, true);
      else if (i.current === slot) equip(actor, slot, true);
      return w;
    }
    if (id === 'vest') { actor.armor = 100; actor.helmet = true; return true; }
    if (id === 'kit') { actor.hasKit = true; return true; }
    if (id === 'beacon') { actor.hasBeacon = true; return true; }
    if (UTILITY_IDS.includes(id)) {
      if (i.utility.length >= 3 || i.utility.filter((u) => u === id).length >= (id === 'strobe' ? 2 : 1)) return false;
      i.utility.push(id); ctx.combat?.utility?.give?.(actor, id); return true;
    }
    return null;
  }
  function priceOf(id) { return TAGGERS[id]?.price ?? GEAR[id]?.price ?? UTIL_PRICE[id] ?? null; }
  function buy(actor, id) {
    const price = priceOf(id); if (price == null) return { ok: false, reason: 'unknown' };
    const ph = phase();
    if (ph && !['buy', 'warmup', 'practice', 'freeze'].includes(ph)) return { ok: false, reason: 'phase' };
    if (ctx.match?.canBuy && ctx.match.canBuy(actor) === false) return { ok: false, reason: 'cannot' };
    const teams = (TAGGERS[id] || GEAR[id])?.teams; if (teams && !teams.includes(actor.team)) return { ok: false, reason: 'team' };
    if (actor.credits < price) return { ok: false, reason: 'credits' };
    if (id === 'vest' && actor.armor >= 100 && actor.helmet) return { ok: false, reason: 'owned' };
    if (id === 'kit' && actor.hasKit) return { ok: false, reason: 'owned' };
    const r = give(actor, id); if (r === false || r == null) return { ok: false, reason: 'full' };
    actor.credits -= price;
    emit('buy', { actor, item: id, cost: price }); emit('credits', { actor, delta: -price, reason: 'buy' });
    return { ok: true };
  }

  // ------------------------------------------------------------------------------------------------ drops / pickups
  function spawnDrop(actor, w, thrown = true) {
    if (!w || w.def.melee) return null;
    const p = actor.eyePos(new THREE.Vector3()), f = actor.forward(_v[0]);
    const d = { w, pos: p.clone().addScaledVector(f, thrown ? 0.55 : 0.2), vel: new THREE.Vector3(f.x * 3.6, thrown ? Math.max(0.6, f.y * 3.6 + 1.2) : 1.2, f.z * 3.6), age: 0, rest: false, by: actor, yaw: actor.yaw, mesh: null, spin: (Math.random() - 0.5) * 0 };
    if (!thrown) d.vel.set(f.x * 1.2, 1.4, f.z * 1.2);
    core.drops.push(d);
    while (core.drops.length > 24) removeDrop(core.drops[0]);
    if (ctx.render?.scene) buildDropMesh(d);
    emit('weapon:drop', { actor, tagger: w.id, pos: d.pos.clone() });
    return d;
  }
  function buildDropMesh(d) {
    let m = null;
    try { m = vm()?.worldModel?.(d.w.id, null); } catch { m = null; }
    if (!m) {
      m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: d.w.def.color, emissive: d.w.def.color, emissiveIntensity: 0.35, roughness: 0.6 }));
      m.add(b);
    }
    const g = new THREE.Group(); g.add(m); g.rotation.set(0, d.yaw, 0);
    m.rotation.z = Math.PI / 2;   // lie on its side
    ctx.render.scene.add(g); d.mesh = g;
  }
  function removeDrop(d) {
    const i = core.drops.indexOf(d); if (i >= 0) core.drops.splice(i, 1);
    if (d.mesh) { d.mesh.parent?.remove(d.mesh); d.mesh = null; }
  }
  function clearDrops() { for (const d of [...core.drops]) removeDrop(d); }
  function updateDrops(dt) {
    for (const d of core.drops) {
      d.age += dt;
      if (!d.rest) {
        d.vel.y -= 9.8 * dt;
        const nx = d.pos.x + d.vel.x * dt, ny = d.pos.y + d.vel.y * dt, nz = d.pos.z + d.vel.z * dt;
        const g = ctx.map?.raycast?.(_v[1].set(d.pos.x, d.pos.y + 0.3, d.pos.z), _v[2].set(0, -1, 0), 0.3 + Math.max(0.05, -d.vel.y * dt) + 0.05);
        if (g && d.vel.y <= 0) { d.pos.set(nx, g.point.y + 0.06, nz); d.vel.set(d.vel.x * 0.4, 0, d.vel.z * 0.4); if (Math.hypot(d.vel.x, d.vel.z) < 0.15) d.rest = true; }
        else if (!ctx.map?.raycast && ny < 0.06) { d.pos.set(nx, 0.06, nz); d.rest = true; }
        else d.pos.set(nx, ny, nz);
        if (d.pos.y < -30) d.rest = true;
        d.vel.x *= 1 - 0.6 * dt; d.vel.z *= 1 - 0.6 * dt;
      }
      if (d.mesh) { d.mesh.position.copy(d.pos); if (!d.rest) d.mesh.rotation.y += dt * 4; }
    }
  }
  function pickup(actor, d, swap) {
    const def = d.w.def, i = inv(actor), slot = def.slot, old = i.slots[slot];
    if (old && !swap) return false;
    if (old) { if (i.current === slot) { cancelReload(actor, old); } spawnDrop(actor, old, true); }
    i.slots[slot] = d.w; d.w.state = 'idle';
    removeDrop(d);
    emit('weapon:pickup', { actor, tagger: def.id, pos: actor.pos.clone() });
    if (!old || swap) equip(actor, slot, true);
    return true;
  }
  const slotOfId = (actor, id) => { const sl = inv(actor).slots; for (const k of [1, 2, 3]) if (sl[k]?.id === id) return k; return 0; };
  /** drop(actor) drops the current weapon; drop(actor, slotNumber | taggerId) a specific one. Beacon / gear are the match's business. */
  function drop(actor, which) {
    const i = inv(actor); let slot = typeof which === 'string' ? slotOfId(actor, which) : which || i.current;
    const w = i.slots[slot]; if (!w || w.def.melee) return false;
    cancelReload(actor, w); unscope(actor, brain(actor), w);
    i.slots[slot] = null; brain(actor).dropT = core.time; brain(actor).lastSlotDropped = slot;
    spawnDrop(actor, w, true);
    if (i.current === slot) { i.current = null; equip(actor, bestSlot(actor), true); }
    return true;
  }
  /** Take an item away without dropping it (refunds, resets). */
  function remove(actor, id) {
    const i = inv(actor);
    if (TAGGERS[id]) {
      const slot = slotOfId(actor, id); if (!slot || slot === 3) return false;
      const w = i.slots[slot]; cancelReload(actor, w); unscope(actor, brain(actor), w, true); i.slots[slot] = null;
      if (i.current === slot) { i.current = null; equip(actor, bestSlot(actor), true); }
      return true;
    }
    if (UTILITY_IDS.includes(id)) { const k = i.utility.indexOf(id); if (k < 0) return false; i.utility.splice(k, 1); ctx.combat?.utility?.remove?.(actor, id); if (i.current === 4 && !i.utility.length) { i.current = null; equip(actor, bestSlot(actor), true); } return true; }
    if (id === 'beacon') { actor.hasBeacon = false; if (i.current === 5) { i.current = null; equip(actor, bestSlot(actor), true); } return true; }
    if (id === 'vest') { actor.armor = 0; actor.helmet = false; return true; }
    if (id === 'kit') { actor.hasKit = false; return true; }
    return false;
  }
  function pickupsTick(actor, cb, useEdge) {
    if (core.drops.length === 0) return;
    const i = inv(actor); let best = null, bd = 1e9;
    for (const d of core.drops) {
      if (d.age < 0.4 || (d.by === actor && core.time - cb.dropT < 1.2)) continue;
      const dx = d.pos.x - actor.pos.x, dz = d.pos.z - actor.pos.z, dy = d.pos.y - actor.pos.y;
      const dist = Math.hypot(dx, dz); if (dy < -0.5 || dy > 1.9) continue;
      if (dist < (useEdge ? 1.7 : 0.85) && dist < bd) { bd = dist; best = d; }
    }
    if (!best) return;
    const has = !!i.slots[best.w.def.slot];
    if (!has) pickup(actor, best, false);
    else if (useEdge) pickup(actor, best, true);
  }

  // ------------------------------------------------------------------------------------------------ world / hit queries
  let thinList = null, thinSrc = null, thinLen = -1;
  function thinBoxes() {
    const src = ctx.map?.thinWalls;
    if (!src) return null;
    const n = src.length ?? src.children?.length ?? -1;
    if (src === thinSrc && n === thinLen && thinList) return thinList;
    thinSrc = src; thinLen = n; thinList = [];
    const add = (o) => {
      if (!o) return;
      if (o.isBox3) thinList.push(o);
      else if (o.min && o.max) thinList.push(_box.clone().set(o.min, o.max));
      else if (o.box?.isBox3) thinList.push(o.box);
      else if (o.isObject3D) { o.updateWorldMatrix?.(true, true); thinList.push(new THREE.Box3().setFromObject(o)); }
    };
    try { if (Array.isArray(src)) src.forEach(add); else if (src.isObject3D) src.children.forEach(add); else if (src.forEach) src.forEach(add); } catch { /* ignore malformed */ }
    return thinList;
  }
  function isThin(hit) {
    if (hit.thin || hit.penetrable) return true;
    const l = thinBoxes(); if (!l) return false;
    const p = hit.point;
    for (const b of l) {
      if (p.x >= b.min.x - 0.06 && p.x <= b.max.x + 0.06 && p.y >= b.min.y - 0.06 && p.y <= b.max.y + 0.06 && p.z >= b.min.z - 0.06 && p.z <= b.max.z + 0.06) return true;
    }
    return false;
  }
  const hittable = (att, a) => a !== att && a.alive !== false && !a.tagged && a.hp > 0 && !(att && a.team === att.team);
  const charactersReady = () => { const c = ctx.characters; return !!(c && !c.__stub && c.hitTest); };
  const _res = { actor: null, group: '', t: 0 };
  function findActor(o, dir, maxT, att) {
    let found = false; _res.t = maxT + 1;
    if (charactersReady()) {
      let off = 0;
      for (let iter = 0; iter < 4; iter++) {
        _ray.origin.set(o.x + dir.x * off, o.y + dir.y * off, o.z + dir.z * off); _ray.direction.copy(dir); _ray.far = maxT - off;
        const h = ctx.characters.hitTest(_ray, att);
        if (!h || !h.actor || h.distance + off > maxT) break;
        if (hittable(att, h.actor)) { _res.actor = h.actor; _res.group = normGroup(h.hitgroup); _res.t = off + h.distance; found = true; break; }
        off += h.distance + 0.05;
      }
    }
    const useAll = !charactersReady();
    const test = (a) => {
      if (!hittable(att, a) || (!useAll && a.model)) return;
      if (hitActorBuiltin(o, dir, a, Math.min(maxT, _res.t), _hit) && _hit.t < _res.t) { _res.actor = a; _res.group = _hit.group; _res.t = _hit.t; found = true; }
    };
    for (const a of ctx.actors) test(a);
    for (const a of core.targets) test(a);
    return found ? _res : null;
  }

  // ------------------------------------------------------------------------------------------------ damage
  function damageAllowed() { const p = phase(); return !p || SCORE_PHASES.has(p); }
  /** Public: apply a tag. hit = {attacker, victim, damage(raw pre-armour), hitgroup, point, dir, tagger, wallbang, through, distance} */
  function applyTag(hit) {
    const victim = hit.victim, att = hit.attacker; if (!victim || victim.alive === false || victim.hp <= 0) return null;
    const def = typeof hit.tagger === 'string' ? TAGGERS[hit.tagger] : hit.tagger;
    const group = normGroup(hit.hitgroup);
    let health = 0, absorbed = 0, armorLoss = 0;
    if (damageAllowed()) {
      const s = armourSplit(def || TAGGERS.pip, hit.damage, group, victim.armor || 0, victim.helmet);
      health = Math.min(s.health, victim.hp); absorbed = s.absorbed; armorLoss = s.armorLoss;
      if (health < 1 && hit.damage >= 1) health = Math.min(1, victim.hp);
      victim.armor = Math.max(0, (victim.armor || 0) - armorLoss);
    }
    victim.hp -= health; victim.lastDamagedBy = att;
    const vcb = brain(victim);
    const rec = vcb.dmgBy.get(att?.id) || { actor: att, dmg: 0 }; rec.dmg += health; rec.t = core.time; vcb.dmgBy.set(att?.id, rec);
    if (att) { att.stats.damage += health; }
    const out = victim.hp <= 0;
    const dir = hit.dir || _v[0].set(0, 0, -1);
    const ev = { attacker: att, victim, damage: health, hitgroup: group, headshot: group === 'head', point: hit.point, dir, tagger: def?.id || hit.tagger, armorAbsorbed: absorbed, distance: hit.distance ?? 0, wallbang: !!hit.wallbang, through: hit.through || null };
    // victim flinch + hit slow
    vcb.hitSlow = group === 'leg' ? 0.5 : 0.72; vcb.hitSlowT = 0.5;
    if (isLocal(victim)) {
      const k = Math.min(3.2, 0.6 + health * 0.05);
      vcb.flPitch += k * (0.6 + 0.4 * vcb.arng()); vcb.flYaw += (vcb.arng() - 0.5) * k * 1.4;
    }
    emit('tag:hit', ev);
    for (const f of core.hooks.hit) f(ev);
    if (out) tagOut(att, victim, ev);
    return ev;
  }
  function tagOut(att, victim, ev) {
    victim.hp = 0; victim.alive = false; victim.tagged = true;
    const vcb = brain(victim);
    let assist = null, ad = 39.9;
    for (const [id, r] of vcb.dmgBy) if (r.actor && r.actor !== att && r.actor.team !== victim.team && r.dmg > ad) { ad = r.dmg; assist = r.actor; }
    vcb.dmgBy.clear();
    if (att) { att.stats.tags++; if (ev.headshot) att.stats.crowns++; }
    victim.stats.outs++;
    if (assist) assist.stats.assists++;
    // drop primary & current
    const i = inv(victim); const c = cur(victim);
    if (i.slots[1]) { const w = i.slots[1]; i.slots[1] = null; spawnDrop(victim, w, false); }
    else if (c && !c.def.melee && i.slots[c.def.slot]) { const w = i.slots[c.def.slot]; i.slots[c.def.slot] = null; spawnDrop(victim, w, false); }
    unscope(victim, vcb, cur(victim), true); vcb.burstLeft = 0; vcb.melee = null;
    const dir = ev.dir;
    if (victim.model) ctx.characters?.tagOut?.(victim, dir);
    if (isLocal(victim)) vm()?.setVisible?.(false);
    emit('tag:out', { attacker: att, victim, tagger: ev.tagger, hitgroup: ev.hitgroup, headshot: ev.headshot, assist, wallbang: ev.wallbang, through: ev.through, point: ev.point, dir });
  }
  /** Revive / new round. opts: {keep:true keeps weapons (survivors), revive:true resets hp/alive} */
  function reset(actor, o = {}) {
    const i = inv(actor), cb = brain(actor);
    const keep = o.keep && actor.alive !== false;
    if (!keep) { i.slots = {}; i.utility = []; i.utilSel = null; i.current = null; i.previous = null; actor.armor = 0; actor.helmet = false; }
    else { i.slots = i.slots || {}; if (!i.slots[3]) i.slots[3] = newWeapon(TAGGERS.tap); }
    if (o.revive !== false) { actor.hp = 100; actor.alive = true; actor.tagged = false; }
    cb.inaccFire = 0; cb.recoilIdx = 0; cb.peakIdx = 0; cb.burstLeft = 0; cb.melee = null; cb.hitSlow = 1; cb.hitSlowT = 0; cb.pvYaw = cb.pvPitch = 0; cb.dmgBy.clear();
    const c = cur(actor); if (c) { cancelReload(actor, c); unscope(actor, cb, c, true); c.burst = 0; }
    if (!i.slots[2] && !i.slots[1]) i.slots[2] = newWeapon(TAGGERS.pip);
    if (!i.slots[3]) i.slots[3] = newWeapon(TAGGERS.tap);
    const keepCur = keep && i.current && i.slots[i.current] ? i.current : null;
    i.current = null; equip(actor, keepCur || (i.slots[1] ? 1 : 2), true);
    if (isLocal(actor)) vm()?.setVisible?.(true);
    return actor;
  }

  // ------------------------------------------------------------------------------------------------ tracing a bullet
  /** Fire one ray. Fills `r` = {end, hit:{actor,group,dist,dmgMul,wallbang,through,point}|null, segs:[{point,normal,surface,pen}]} */
  function traceBullet(att, def, o, dir, r) {
    r.hit = null; r.segs.length = 0; r.wallbang = false; r.through = null;
    const pos = _v[3].copy(o);
    let R = def.range, dist = 0, dmgMul = 1, pens = 0;
    for (let seg = 0; seg < 5; seg++) {
      const world = ctx.map?.raycast?.(pos, dir, R) || null;
      const wd = world ? world.distance : R;
      const h = findActor(pos, dir, wd, att);
      if (h) {
        r.hit = { actor: h.actor, group: h.group, dist: dist + h.t, dmgMul, wallbang: r.wallbang, through: r.through };
        r.end.set(pos.x + dir.x * h.t, pos.y + dir.y * h.t, pos.z + dir.z * h.t); r.hit.point = r.end.clone();
        return r;
      }
      if (!world) { r.end.set(pos.x + dir.x * R, pos.y + dir.y * R, pos.z + dir.z * R); return r; }
      dist += wd; R -= wd;
      const P = world.point, N = world.normal;
      const thin = isThin(world);
      let surface = 'stone'; try { surface = ctx.map?.surfaceAt?.(P) || (thin ? 'thin' : 'stone'); } catch { /* ignore */ }
      const sg = { point: P.clone(), normal: N ? N.clone() : new THREE.Vector3(0, 1, 0), surface, pen: false, exit: null };
      r.segs.push(sg); r.end.copy(P);
      if (pens >= 4 || !def.pen || R < 0.2) return r;
      let mat = matOf(surface); if (thin && mat.pen < MATERIALS.thin.pen) mat = MATERIALS.thin;
      const allowed = def.pen * mat.pen;
      if (allowed < 0.03) return r;
      // find the exit: probe from `allowed` deeper, cast back toward the entry
      const probe = _v[4].set(P.x + dir.x * allowed, P.y + dir.y * allowed, P.z + dir.z * allowed);
      const back = _v[5].set(-dir.x, -dir.y, -dir.z);
      const ex = ctx.map?.raycast?.(probe, back, allowed);
      if (!ex) return r;                                   // solid deeper than we can pierce
      const thick = allowed - ex.distance;
      if (thick < 0.012 && !thin) return r;
      if (thick > allowed + 1e-4) return r;
      pens++; r.wallbang = true; r.through = r.through || surface;
      sg.pen = true; sg.exit = ex.point.clone();
      dmgMul *= (def.penDmg ?? 0.6) * mat.dmg; dist += Math.max(thick, 0.02); R -= Math.max(thick, 0.02);
      pos.set(ex.point.x + dir.x * 0.02, ex.point.y + dir.y * 0.02, ex.point.z + dir.z * 0.02);
      r.end.copy(pos);
    }
    return r;
  }

  // ------------------------------------------------------------------------------------------------ shooting
  const _shot = { end: new THREE.Vector3(), hit: null, segs: [], wallbang: false, through: null };
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
  function muzzlePos(actor, out) {
    if (!isLocal(actor)) { const p = ctx.characters?.muzzleWorldPos?.(actor); if (p) return out.copy(p); }
    const f = actor.forward(_f), rx = Math.cos(actor.yaw), rz = -Math.sin(actor.yaw);
    actor.eyePos(out); out.x += f.x * 0.55 + rx * 0.17; out.y += f.y * 0.55 - 0.14; out.z += f.z * 0.55 + rz * 0.17; return out;
  }
  function currentInacc(actor, cb, w) {
    const speed = Math.hypot(actor.vel.x, actor.vel.z);
    return inaccuracyDeg(w.def, { speed, onGround: actor.onGround !== false, crouch: !!actor.crouching, vy: actor.vel.y, fire: cb.inaccFire, land: cb.landT, scopeLevel: w.scopeLevel });
  }
  function shoot(actor, cb, w, dirOverride) {
    const def = w.def, i0 = cb.recoilIdx;
    const inacc = currentInacc(actor, cb, w);
    const scoped = w.scopeLevel > 0 && def.scope;
    const rs = scoped ? def.scope.recoilMul : 1;
    patternAt(def, i0, _pat);
    const pyaw = _pat.yaw * rs * DEG, ppit = _pat.pitch * rs * DEG;
    actor.eyePos(_o);
    // base aim (view + recoil pattern)
    let yaw = actor.yaw - pyaw, pit = actor.pitch + ppit, fx, fy, fz;
    if (dirOverride) { _f.copy(dirOverride); fx = _f.x; fy = _f.y; fz = _f.z; yaw = Math.atan2(-fx, -fz) - pyaw; pit = Math.asin(clamp(fy, -1, 1)) + ppit; }
    const cp = Math.cos(pit); fx = -Math.sin(yaw) * cp; fy = Math.sin(pit); fz = -Math.cos(yaw) * cp;
    // tangent basis
    const rxv = Math.cos(yaw), rzv = -Math.sin(yaw);                      // right
    _r.set(rxv, 0, rzv); _f.set(fx, fy, fz); _u.crossVectors(_r, _f).normalize();   // up = right × forward
    const pellets = def.pellets, res = _shot;
    const agg = pellets > 1 ? new Map() : null, tags = [], hits = [];
    const muzzle = muzzlePos(actor, _v[0]).clone();
    let firstEnd = null, firstDir = null, hitAny = false;
    const spreadTan = Math.tan(inacc * DEG);
    for (let p = 0; p < pellets; p++) {
      const a = cb.rng() * TWO_PI, rr = Math.sqrt(cb.rng()) * spreadTan;
      const ox = Math.cos(a) * rr, oy = Math.sin(a) * rr;
      _d.set(fx + _r.x * ox + _u.x * oy, fy + _r.y * ox + _u.y * oy, fz + _r.z * ox + _u.z * oy).normalize();
      traceBullet(actor, def, _o, _d, res);
      let last = null;
      for (const sg of res.segs) {
        const surf = sg.surface; last = sg;
        emit('impact', { point: sg.point, normal: sg.normal, surface: surf, actor, tagger: def.id, intensity: pellets > 1 ? 0.7 : 1, pen: sg.pen });
        for (const f of core.hooks.impact) f({ point: sg.point, normal: sg.normal, surface: surf, actor, tagger: def.id, shot: cb.shots, pen: sg.pen });
        if (sg.pen) { ctx.vfx?.impact?.(sg.point, sg.normal, surf); if (sg.exit) ctx.vfx?.impact?.(sg.exit, _v[1].copy(_d).negate().clone(), surf); }
      }
      const h = res.hit;
      if (h) {
        hitAny = true;
        hits.push({ point: h.point.clone(), normal: _v[1].copy(_d).negate().clone(), surface: 'body', actor: h.actor, victim: h.actor });
        for (const f of core.hooks.impact) f({ point: h.point, normal: null, surface: 'body', actor, tagger: def.id, shot: cb.shots, victim: h.actor, hitgroup: h.group });
        const dmg = rawDamage(def, h.group, h.dist, h.dmgMul);
        if (agg) {
          const k = h.actor.id, e = agg.get(k);
          if (e) { e.damage += dmg; if (h.group === 'head') e.hitgroup = 'head'; }
          else { const t = { attacker: actor, victim: h.actor, damage: dmg, hitgroup: h.group, point: h.point, dir: _d.clone(), tagger: def.id, wallbang: h.wallbang, through: h.through, distance: h.dist }; agg.set(k, t); tags.push(t); }
        } else tags.push({ attacker: actor, victim: h.actor, damage: dmg, hitgroup: h.group, point: h.point, dir: _d.clone(), tagger: def.id, wallbang: h.wallbang, through: h.through, distance: h.dist });
      } else if (last && last.point.distanceToSquared(res.end) < 1e-6) {
        hits.push({ point: last.point.clone(), normal: last.normal.clone(), surface: last.surface });
      } else {
        // bullet ended in open air / after a wall-bang with no victim: tracer only (vfx skips impacts for entries that carry an actor)
        hits.push({ point: res.end.clone(), normal: null, actor });
      }
      if (p === 0) { firstEnd = res.end.clone(); firstDir = _d.clone(); }
      for (const f of core.hooks.shot) f({ actor, def, origin: _o, dir: _d, end: res.end, hit: res.hit, pellet: p, shot: cb.shots, inacc, pattern: [pyaw / DEG, ppit / DEG], idx: i0 });
    }
    // state
    cb.shots++; cb.lastShotT = core.time; w.lastFireT = core.time;
    cb.recoilIdx = i0 + 1; cb.peakIdx = cb.recoilIdx;
    cb.inaccFire = Math.min(def.inacc.fireMax, cb.inaccFire + def.inacc.fire);
    w.mag--;
    // view punch: the camera shows VIEW_TRACK of the bullet offset
    patternAt(def, cb.recoilIdx, _pat);
    if (isLocal(actor)) {
      const kp = (_pat.pitch * rs - ppit / DEG) * VIEW_TRACK * DEG, ky = (-(_pat.yaw * rs) + pyaw / DEG) * VIEW_TRACK * DEG;
      const P = ctx.player;
      if (P && !P.setAimPunch && typeof P.punch === 'function') P.punch(kp, ky);
    }
    w.state = 'fire'; w.t = 0;
    // one event drives audio + vfx (tracers / muzzle flash / impacts read `hit`)
    emit('weapon:fire', { actor, tagger: def.id, origin: _o.clone(), dir: firstDir, hitscan: true, hit: hits, shot: cb.shots, inaccuracy: inacc, end: firstEnd, scoped: !!scoped, noTracer: def.tracerEvery > 1 && cb.shots % def.tracerEvery !== 1 });
    if (isLocal(actor)) { const V = vm(); V?.event?.('fire', { id: def.id, shot: cb.shots, cycle: def.cycle, scoped: !!scoped, mag: w.mag, max: def.mag }); V?.event?.('heat', { id: def.id, value: clamp(cb.recoilIdx / Math.min(30, def.mag * 0.8 || 30), 0, 1) }); }
    for (const t of tags) applyTag(t);
    core.debugLast = { idx: i0, inacc, pattern: [pyaw / DEG, ppit / DEG], hit: hitAny };
    return true;
  }

  // melee ------------------------------------------------------------------------------------------------------------
  const fan = [[0, 0], [0.09, 0], [-0.09, 0], [0, 0.09], [0, -0.07], [0.14, 0.04], [-0.14, 0.04]];
  function meleeResolve(actor, cb, m) {
    const def = TAGGERS.tap, k = m.kind === 'stab' ? def.stab : def.slash;
    actor.eyePos(_o); const f = actor.forward(_f).clone(), rx = Math.cos(actor.yaw), rz = -Math.sin(actor.yaw);
    let best = null;
    for (const [dx, dy] of fan) {
      _d.set(f.x + rx * dx, f.y + dy, f.z + rz * dx).normalize();
      const h = findActor(_o, _d, k.reach, actor);
      if (h && (!best || h.t < best.t)) best = { actor: h.actor, group: h.group, t: h.t, dir: _d.clone() };
      if (best && dx === 0 && dy === 0) break;
    }
    if (best) {
      const v = best.actor;
      // backstab: attacker behind victim (victim facing away)
      const vfx = -Math.sin(v.yaw), vfz = -Math.cos(v.yaw), ax = actor.pos.x - v.pos.x, az = actor.pos.z - v.pos.z, al = Math.hypot(ax, az) || 1;
      const back = (vfx * ax + vfz * az) / al < -0.35;
      const dmg = back ? k.back : k.damage;
      const p = _o.clone().addScaledVector(best.dir, best.t);
      applyTag({ attacker: actor, victim: v, damage: dmg, hitgroup: best.group === 'head' ? 'chest' : best.group, point: p, dir: best.dir, tagger: 'tap', distance: best.t, back });
    } else {
      const w = ctx.map?.raycast?.(_o, f, k.reach);
      if (w) { const surf = ctx.map?.surfaceAt?.(w.point) || 'stone'; emit('impact', { point: w.point, normal: w.normal, surface: surf, actor, tagger: 'tap', intensity: 0.6 }); ctx.vfx?.impact?.(w.point, w.normal, surf); for (const fn of core.hooks.impact) fn({ point: w.point, normal: w.normal, surface: surf, actor, tagger: 'tap' }); }
    }
  }

  // ------------------------------------------------------------------------------------------------ reload
  function startReload(actor, cb, w) {
    const def = w.def;
    if (def.melee || w.state === 'reload' || core.time < w.drawEnd) return false;
    if (w.mag >= def.mag || w.reserve <= 0) return false;
    if (core.time < w.nextFire - 0.0005 && w.state === 'fire' && def.bolt) return false;
    unscope(actor, cb, w);
    cb.burstLeft = 0;
    w.state = 'reload'; w.reloadT = 0; w.reloadStage = 0;
    if (def.shell) { w.shellPhase = 0; w.dur = def.shell.start; } else w.dur = def.reload;
    emit('weapon:reload', { actor, tagger: def.id, stage: 'start' });
    if (isLocal(actor)) { const dur = def.shell ? def.shell.start + def.shell.each * (def.mag - w.mag) + def.shell.end : def.reload; w.reloadDur = dur; vm()?.event?.('reloadStart', { id: def.id, time: dur, duration: dur, dur, shell: !!def.shell }); }
    return true;
  }
  function reloadTick(actor, cb, w, dt) {
    const def = w.def; w.reloadT += dt; w.t += dt;
    if (!def.shell) {
      const p = w.reloadT / def.reload;
      w.reloadProgress = Math.min(1, p);
      if (w.reloadStage === 0 && p >= 0.55) { w.reloadStage = 2; emit('weapon:reload', { actor, tagger: def.id, stage: 'in' }); }
      if (w.reloadStage === 2 && p >= 0.9) {
        w.reloadStage = 3; const give = Math.min(def.mag - w.mag, w.reserve); w.mag += give; w.reserve -= give;
        emit('weapon:reload', { actor, tagger: def.id, stage: 'commit' });
      }
      if (p >= 1) finishReload(actor, cb, w);
    } else {
      const s = def.shell;
      if (w.shellPhase === 0 && w.reloadT >= s.start) { w.shellPhase = 1; w.reloadT = 0; }
      if (w.shellPhase === 1) {
        if (w.reloadT >= s.each) {
          w.reloadT -= s.each; w.mag++; w.reserve--; emit('weapon:reload', { actor, tagger: def.id, stage: 'in' });
          if (w.mag >= def.mag || w.reserve <= 0) { w.shellPhase = 2; w.reloadT = 0; }
        }
      } else if (w.shellPhase === 2 && w.reloadT >= s.end) finishReload(actor, cb, w);
    }
  }
  function finishReload(actor, cb, w) {
    w.state = 'idle'; w.reloadT = 0; w.reloadProgress = 0; w.nextFire = Math.max(w.nextFire, core.time);
    emit('weapon:reload', { actor, tagger: w.id, stage: 'end' });
    if (isLocal(actor)) vm()?.event?.('reloadEnd', { id: w.id });
  }

  // ------------------------------------------------------------------------------------------------ intents
  const HELD = ['fire', 'aim', 'reload', 'drop', 'use', 'lastWeapon', 'inspect', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
  const localCmd = { fire: false, aim: false, reload: false, drop: false, use: false, last: false, inspect: false, slot: 0, dir: null };
  function readLocal() {
    const I = ctx.input, c = localCmd;
    if (!I || !I.locked) { c.fire = c.aim = c.reload = c.drop = c.use = c.last = c.inspect = false; c.slot = 0; return c; }
    const h = (a) => I.down(a) || (I.pressed(a) && I.released(a));
    c.fire = h('fire'); c.aim = h('aim'); c.reload = h('reload'); c.drop = h('drop'); c.use = h('use'); c.last = h('lastWeapon'); c.inspect = h('inspect');
    c.slot = h('slot1') ? 1 : h('slot2') ? 2 : h('slot3') ? 3 : h('slot4') ? 4 : h('slot5') ? 5 : 0;
    return c;
  }
  const idleCmd = { fire: false, aim: false, reload: false, drop: false, use: false, last: false, inspect: false, slot: 0, dir: null };
  function cmdOf(actor) {
    if (isLocal(actor) && !actor.ai) return readLocal();
    return actor.cb.ext || actor.ai?.cmd || idleCmd;
  }
  const edge = (cb, k, v) => { const e = !!v && !cb.prev[k]; cb.prev[k] = !!v; return e; };

  // ------------------------------------------------------------------------------------------------ per-actor tick
  function tickActor(actor, dt) {
    const cb = brain(actor);
    if (actor.alive === false || actor.tagged) { cb.prevGround = actor.onGround !== false; cb.prev.fire = false; return; }
    ensureLoadout(actor);
    const i = actor.inventory, w = cur(actor);
    const c = cmdOf(actor), human = isLocal(actor) && !actor.ai;
    // timers / landing
    const gnd = actor.onGround !== false;
    if (gnd && !cb.prevGround) cb.landT = 1;
    cb.prevGround = gnd; if (cb.landT > 0) cb.landT = Math.max(0, cb.landT - dt / 0.28);
    if (cb.hitSlowT > 0) { cb.hitSlowT -= dt; if (cb.hitSlowT <= 0) cb.hitSlow = 1; }
    cb.fireBuf = Math.max(0, cb.fireBuf - dt);
    // edges
    const eFire = edge(cb, 'fire', c.fire), eAim = edge(cb, 'aim', c.aim), eRel = edge(cb, 'reload', c.reload), eDrop = edge(cb, 'drop', c.drop),
      eUse = edge(cb, 'use', c.use), eLast = edge(cb, 'last', c.last), eInsp = edge(cb, 'inspect', c.inspect), eSlot = c.slot && cb.prev.slotV !== c.slot ? c.slot : 0;
    cb.prev.slotV = c.slot;
    const blocked = NO_FIRE_PHASES.has(phase());
    // switching
    if (eSlot) equip(actor, eSlot);
    if (eLast && i.previous && i.previous !== i.current) equip(actor, i.previous);
    if (eDrop) drop(actor);
    pickupsTick(actor, cb, eUse);
    if (i.current === 4) { utilTick(actor, cb, c, blocked); decay(actor, cb, dt, null); return; }
    const W = cur(actor);
    if (!W) { decay(actor, cb, dt, null); return; }
    const def = W.def;
    // state timers
    if (W.state === 'draw') { W.t += dt; if (core.time >= W.drawEnd) { W.state = 'idle'; W.t = 0; } }
    else if (W.state === 'fire') { W.t += dt; if (W.t >= Math.min(0.14, def.cycle)) { W.state = 'idle'; W.t = 0; } }
    else if (W.state === 'reload') reloadTick(actor, cb, W, dt);
    else W.t += dt;
    if (eInsp && W.state === 'idle' && isLocal(actor)) vm()?.event?.('inspect', { id: W.id });
    if (def.melee) { meleeTick(actor, cb, W, c, eFire, eAim, blocked); decay(actor, cb, dt, W); return; }
    // scope
    if (def.scope && eAim && W.state !== 'reload' && W.state !== 'draw') {
      const n = def.scope.zoom.length; W.scopeLevel = (W.scopeLevel + 1) % (n + 1); W.scoped = W.scopeLevel > 0;
      cb.scopeResume = 0;
      if (isLocal(actor)) { vm()?.event?.(W.scoped ? 'scopeIn' : 'scopeOut', { id: W.id, level: W.scopeLevel - 1 }); }
      emit('weapon:scope', { actor, tagger: W.id, scoped: W.scoped, level: W.scopeLevel });
    }
    // bolt: resume zoom after the cycle
    if (cb.scopeResume > 0 && core.time >= W.nextFire && W.state === 'idle') { W.scopeLevel = cb.scopeResume; W.scoped = true; cb.scopeResume = 0; if (isLocal(actor)) vm()?.event?.('scopeIn', { id: W.id, level: W.scopeLevel - 1, resume: true }); }
    // manual reload
    if (eRel) startReload(actor, cb, W);
    // auto reload on empty
    if (W.mag <= 0 && W.reserve > 0 && W.state === 'idle' && core.time >= W.nextFire - 1e-6) startReload(actor, cb, W);
    // interrupt shell reload by firing
    if (W.state === 'reload' && def.shell && W.mag > 0 && (c.fire) && !blocked) { W.state = 'idle'; emit('weapon:reload', { actor, tagger: W.id, stage: 'cancel' }); }
    // fire request
    const drawn = W.state !== 'draw' && W.state !== 'reload';
    if (eFire) cb.fireBuf = 0.07;
    let want = false;
    if (cb.burstLeft > 0) want = true;
    else if (def.auto) want = c.fire;
    else want = cb.fireBuf > 0 || (!human && c.fire);
    if (blocked) want = false;
    if (want && drawn && core.time >= W.nextFire - 1e-9) {
      if (W.mag <= 0) {
        if (eFire) { emit('weapon:empty', { actor, tagger: W.id }); if (isLocal(actor)) vm()?.event?.('empty', { id: W.id }); if (W.reserve > 0) startReload(actor, cb, W); }
        cb.burstLeft = 0; cb.fireBuf = 0;
      } else {
        if (cb.fireBuf > 0 && !def.auto) cb.fireBuf = 0;
        const dir = c.dir && !human ? c.dir : null;
        if (def.burst && cb.burstLeft === 0) cb.burstLeft = def.burst.count;
        shoot(actor, cb, W, dir);
        // schedule next
        const late = core.time - W.nextFire;
        const base = late > dt * 1.5 || W.nextFire < core.time - 0.05 ? core.time : W.nextFire;
        if (def.burst) {
          cb.burstLeft--;
          W.nextFire = base + (cb.burstLeft > 0 ? def.burst.interval : def.burst.cooldown);
        } else W.nextFire = base + def.cycle;
        // bolt: unscope for the cycle, resume after
        if (def.bolt && W.scopeLevel) { cb.scopeResume = def.scope.resume ? W.scopeLevel : 0; unscope(actor, cb, W); }
          }
    }
    decay(actor, cb, dt, W);
  }
  // utility slot: LMB = strong, RMB = weak, both = medium; the throw happens when every button is released (CS2 rules).
  function utilTick(actor, cb, c, blocked) {
    const U = ctx.combat?.utility, i = actor.inventory, id = i.utilSel, human = isLocal(actor) && !actor.ai;
    if (!U || !id) return;
    if (cb.utilSwitchAt && core.time >= cb.utilSwitchAt) {
      cb.utilSwitchAt = 0;
      if (U.count?.(actor, id) > 0 && i.utility.includes(id)) { /* more of the same: stay */ }
      else { const prev = i.previous && i.previous !== 4 && i.previous !== 5 && i.slots[i.previous] ? i.previous : bestSlot(actor); i.current = null; equip(actor, prev, true); return; }
    }
    if (blocked || cb.utilSwitchAt) { if (cb.throwPrimed) { cb.throwPrimed = false; U.preview?.hide?.(); } return; }
    const f = !!c.fire, a = !!c.aim;
    if (!cb.throwPrimed) {
      if ((f || a) && U.count?.(actor, id) > 0) { cb.throwPrimed = true; cb.throwBoth = false; cb.throwMode = f ? 'strong' : 'weak'; cb.throwT = 0; }
      else return;
    }
    if (f && a) cb.throwBoth = true;
    else if (f && !cb.throwBoth) cb.throwMode = 'strong'; else if (a && !cb.throwBoth) cb.throwMode = 'weak';
    const power = cb.throwBoth ? 'medium' : cb.throwMode;
    cb.throwT += 1 / 120;
    if (f || a) { if (human && (cb.throwT < 0.02 || (core.time * 120 | 0) % 3 === 0)) U.preview?.show?.(actor, id, power); return; }
    // released
    cb.throwPrimed = false; U.preview?.hide?.();
    if (U.throw?.(actor, id, power)) cb.utilSwitchAt = core.time + 0.75;
  }
  function meleeTick(actor, cb, W, c, eFire, eAim, blocked) {
    const def = W.def;
    if (cb.melee && core.time >= cb.melee.at) { const m = cb.melee; cb.melee = null; meleeResolve(actor, cb, m); }
    if (blocked || W.state === 'draw' || core.time < W.nextFire - 1e-9) return;
    const kind = c.aim && (eAim || !c.fire) ? 'stab' : c.fire ? 'slash' : null;
    if (!kind) return;
    const k = kind === 'stab' ? def.stab : def.slash;
    cb.melee = { at: core.time + k.delay, kind }; W.nextFire = core.time + k.cycle; W.state = 'fire'; W.t = 0;
    cb.shots++;
    emit('weapon:fire', { actor, tagger: 'tap', origin: actor.eyePos(new THREE.Vector3()), dir: actor.forward(new THREE.Vector3()), hitscan: false, kind, noTracer: true });
    if (isLocal(actor)) vm()?.event?.('melee', { id: 'tap', kind });
  }
  // recoil recovery, fire-inaccuracy decay, punch spring, crosshair
  function decay(actor, cb, dt, W) {
    const def = W?.def;
    if (def && !def.melee) {
      const grace = (def.burst ? def.burst.cooldown : def.cycle) * 1.15 + 0.03, since = core.time - cb.lastShotT;
      if (since > grace && cb.burstLeft === 0) {
        const rec = actor.crouching ? def.recover.crouch : def.recover.stand;
        cb.recoilIdx = Math.max(0, cb.recoilIdx - dt * (Math.max(1, cb.peakIdx) / rec));
        cb.inaccFire = Math.max(0, cb.inaccFire - dt * def.inacc.decay);
      }
      cb.inacc = currentInacc(actor, cb, W);
      const x = crosshairFrac(def, cb.inacc);
      cb.xhair = x > cb.xhair ? x : cb.xhair + (x - cb.xhair) * (1 - Math.exp(-dt * 16));
      // punch spring: camera shows VIEW_TRACK of the bullet offset
      const rs = W.scopeLevel && def.scope ? def.scope.recoilMul : 1;
      patternAt(def, cb.recoilIdx, _pat);
      const ty = -_pat.yaw * rs * VIEW_TRACK, tp = _pat.pitch * rs * VIEW_TRACK;
      const kp = tp > cb.pvPitch ? 46 : 11, ky = 30;
      cb.pvPitch += (tp - cb.pvPitch) * (1 - Math.exp(-dt * kp)); cb.pvYaw += (ty - cb.pvYaw) * (1 - Math.exp(-dt * ky));
    } else { cb.recoilIdx = 0; cb.pvPitch *= Math.exp(-dt * 10); cb.pvYaw *= Math.exp(-dt * 10); cb.xhair += (0 - cb.xhair) * (1 - Math.exp(-dt * 12)); cb.inacc = 0; }
    cb.flPitch *= Math.exp(-dt * 9); cb.flYaw *= Math.exp(-dt * 9);
  }

  // ------------------------------------------------------------------------------------------------ API
  function fixedUpdate(dt) {
    core.time += dt;
    for (const a of ctx.actors) if (!a.isDummy) tickActor(a, dt);
    updateDrops(dt);
  }
  const aimPunchOut = { pitch: 0, yaw: 0 };
  function aimPunch(actor, out = aimPunchOut) {
    const cb = actor?.cb; if (!cb) { out.pitch = out.yaw = 0; return out; }
    out.pitch = (cb.pvPitch + cb.flPitch) * DEG; out.yaw = (cb.pvYaw + cb.flYaw) * DEG; return out;
  }
  function zoom(actor) { const w = cur(actor); if (!w || !w.scopeLevel || !w.def.scope) return 1; return w.def.scope.zoom[w.scopeLevel - 1]; }
  function scopeFov(actor, base) {
    const z = zoom(actor); if (z <= 1) return null;
    base = base ?? (ctx.settings?.get?.('fov') || 100);
    return 2 * Math.atan(Math.tan(base * DEG / 2) / z) / DEG;
  }
  function speedMult(actor) {
    const w = equipped(actor), cb = actor.cb;
    let s = (w?.def?.moveSpeedU ?? 250);
    if (w?.scopeLevel && w.def.scopedSpeedU) s = w.def.scopedSpeedU;
    else if (w?.scopeLevel && w.def.scope) s *= w.def.scope.moveMul;
    return (s / 250) * (cb ? cb.hitSlow + (1 - cb.hitSlow) * (1 - clamp(cb.hitSlowT / 0.5, 0, 1)) : 1);
  }
  const api = Object.assign(core, {
    taggers: TAGGERS, gear: GEAR,
    fixedUpdate, equipped, inventory: (a) => { const i = inv(a); brain(a); return i; }, give, buy, drop, reset, applyTag, clearDrops, priceOf,
    switchTo: (actor, slotOrId) => { const slot = typeof slotOrId === 'number' ? slotOrId : SLOT_OF(slotOrId); brain(actor); ensureLoadout(actor); return equip(actor, slot); },
    reload: (actor) => { const w = cur(actor); return w ? startReload(actor, brain(actor), w) : false; },
    command: (actor, cmd) => { brain(actor).ext = cmd; },
    crosshairSpread: (actor) => actor?.cb?.xhair ?? 0,
    inaccuracy: (actor) => { const w = cur(actor); return w && !w.def.melee ? currentInacc(actor, brain(actor), w) : 0; },
    aimPunch, zoom, scopeFov, speedMult, maxSpeed: (a) => speedMult(a) * 6.35,
    ensureLoadout, brain, cur, muzzlePos, remove,
    /** match compat: resetLoadout(a, {keepWeapons}) — does not touch hp/alive (match does that). */
    resetLoadout: (actor, o = {}) => reset(actor, { keep: !!o.keepWeapons, revive: false }),
    sensScale: (a) => 1 / zoom(a),
  });
  return api;
}
