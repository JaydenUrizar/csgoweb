// Utility grenades (Haze / Strobe / Pulse) — owner: `utility` piece. Imported by src/combat/index.js as ctx.combat.utility.
// See docs/pieces/utility.md for the API, tuning constants and how to inspect each effect.
import * as THREE from 'three';
import { G, GRENADE as C, POWER, TYPES, LIMITS } from './config.js';
import { createWorld } from './world.js';
import { makeGrenade, stepGrenade } from './sim.js';
import { createModels } from './models.js';
import { createHaze } from './haze.js';
import { createStrobe } from './strobe.js';
import { createPulse } from './pulse.js';
import { createScreenFx } from './screenfx.js';
import { createSparks } from './fx.js';
import { registerLab } from './lab.js';
import { mulberry32 } from '../../core/rng.js';

const STEP = 1 / 120;
const _eye = new THREE.Vector3(), _dir = new THREE.Vector3(), _o = new THREE.Vector3(), _v = new THREE.Vector3(), _hit = { dist: 0, normal: new THREE.Vector3() };

export function createUtility(ctx) {
  const W = createWorld(ctx);
  const models = createModels(ctx);
  const grenades = [];           // in flight / resting, waiting for fuse
  const pending = [];            // throws waiting for the release frame
  let time = 0, lastTick = -1, lastUpd = -1, serial = 0;
  const shared = {
    sunDir: { value: new THREE.Vector3(0.45, 0.78, 0.35).normalize() }, sunCol: { value: new THREE.Color(1.0, 0.93, 0.8) },
    skyCol: { value: new THREE.Color(0.62, 0.69, 0.8) }, groundCol: { value: new THREE.Color(0.5, 0.47, 0.44) },
    glow: { pos: new THREE.Vector3(), r: 1, g: 1, b: 1, w: 0, decay: 1 }, overlayAmount: 0,
  };
  const sparks = createSparks(512);
  const screen = createScreenFx(ctx);
  const haze = createHaze(ctx, W, shared);
  // flash light (single pooled point light, created once so materials never recompile mid-round)
  const light = new THREE.PointLight(0xffffff, 0, 24, 1.6); light.castShadow = false; light.visible = true; light.name = 'utility-flash-light';
  const lightState = { t: 0, dur: 0.5, peak: 0 };
  let sceneReady = false;
  const now = () => time;
  const fxDeps = { sparks, screen, haze, time: now, grenades: null,
    light(pos, color, peak, range, dur) { light.position.copy(pos); light.color.setHex(color); light.distance = range; lightState.peak = peak; lightState.t = 0; lightState.dur = dur; },
    glow(pos, r, g, b, w, dur) { shared.glow.pos.copy(pos); shared.glow.r = r; shared.glow.g = g; shared.glow.b = b; shared.glow.w = w; shared.glow.decay = 1 / dur; } };
  const strobe = createStrobe(ctx, W, fxDeps);
  const pulse = createPulse(ctx, W, fxDeps);

  // ---------------------------------------------------------------- inventory (actor.inventory.utility = array of ids)
  const list = (a) => { const inv = (a.inventory ||= { slots: {}, utility: [] }); return (inv.utility ||= []); };
  const idOf = (e) => (typeof e === 'string' ? e : e?.id || e?.type || e?.name);
  const nOf = (e) => (typeof e === 'string' ? 1 : e?.n ?? e?.count ?? 1);
  const util = {
    types: TYPES, limits: LIMITS, infinite: false,
    grenades, smokes: haze.list, world: W, shared,
    count(actor, type) { if (util.infinite || actor?.infiniteUtility) return 9; let n = 0; for (const e of list(actor)) if (idOf(e) === type) n += nOf(e); return n; },
    total(actor) { let n = 0; for (const e of list(actor)) n += nOf(e); return n; },
    /** Notification hook: the tagger inventory owns actor.inventory.utility and calls this after adding an item. No-op by design (never double-adds). */
    give(actor, type) { return TYPES[type] ? true : false; },
    select(actor, type) { return TYPES[type] ? true : false; },
    /** Grant grenades directly (tests / practice range) respecting CS-style limits; returns how many were added. */
    grant(actor, type, n = 1) {
      let added = 0; const arr = list(actor);
      while (added < n && util.count(actor, type) < (LIMITS[type] ?? 1) && util.total(actor) < LIMITS.total) { arr.push(type); added++; }
      return added;
    },
    take(actor, type) { const arr = list(actor); const i = arr.findIndex((e) => idOf(e) === type); if (i < 0) return false; const e = arr[i]; if (typeof e !== 'string' && nOf(e) > 1) { if (e.n != null) e.n--; else e.count--; } else arr.splice(i, 1); return true; },
    clearInventory(actor) { list(actor).length = 0; },
    owned(actor) { return list(actor).map(idOf); },
    /** normalise a power spec: 'strong'|'weak'|'medium'|number -> 0..1 */
    strength(power) { if (typeof power === 'number') return Math.min(1, Math.max(0, power)); return POWER[String(power || 'strong').toLowerCase()] ?? 1; },
  };

  // ---------------------------------------------------------------- throw mechanics
  /** Launch position/velocity for an actor (CS: eye+16u fwd, drop by (1-strength)*12u; velocity = dir*v*(0.3+0.7s) + 1.25*actor velocity; 10 deg lift). */
  function launch(actor, s, outPos, outVel) {
    actor.eyePos(_eye);
    const lift = C.pitchLift, p = Math.max(-1.5533, Math.min(1.5533, actor.pitch));
    const pp = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, lift + p * (1 - lift / (Math.PI / 2))));
    const cp = Math.cos(pp); _dir.set(-Math.sin(actor.yaw) * cp, Math.sin(pp), -Math.cos(actor.yaw) * cp);
    const speed = C.vLong * (C.vShort + (1 - C.vShort) * s);
    const inh = actor.crouching ? C.inheritCrouch : C.inherit;
    outVel.copy(_dir).multiplyScalar(speed); if (actor.vel) outVel.addScaledVector(actor.vel, inh);
    outPos.copy(_eye).addScaledVector(_dir, 0.30); outPos.y += s * 0.23 - 0.23;
    // don't release through a wall/ceiling/floor: stop just short of it
    _v.subVectors(outPos, _eye); const dl = _v.length();
    if (dl > 1e-4) { _v.multiplyScalar(1 / dl); if (W.raycast(_eye, _v, dl + C.radius, _hit)) { outPos.copy(_eye).addScaledVector(_v, Math.max(0.02, _hit.dist - C.radius * 1.6)); } }
    return speed;
  }

  function spawnGrenade(type, pos, vel, thrower, opts = {}) {
    const g = makeGrenade(); g.pos.copy(pos); g.prev.copy(pos); g.vel.copy(vel); g.thrower = thrower || null;
    const r = mulberry32(777 + (serial++) * 31); g.spinAxis.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize(); g.spin = 6 + 5 * r(); g.q.setFromAxisAngle(g.spinAxis, r() * 6);
    const gr = { g, type, def: TYPES[type], model: null, fuse: opts.fuse ?? TYPES[type].fuse, t: 0, dead: false, id: serial };
    gr.model = models.make(type); gr.model.position.copy(pos); ctx.render?.scene?.add(gr.model);
    grenades.push(gr); return gr;
  }

  function detonate(gr) {
    const pos = gr.g.pos.clone(); gr.dead = true;
    ctx.events.emit('util:detonate', { type: gr.type, pos, thrower: gr.g.thrower });
    if (gr.type === 'haze') { haze.spawn(pos, gr.g.thrower); }
    else if (gr.type === 'strobe') strobe.detonate(pos, gr.g.thrower);
    else if (gr.type === 'pulse') pulse.detonate(pos, gr.g.thrower);
  }
  fxDeps.grenades = {
    knock(pos, radius, strength) {
      for (const gr of grenades) { if (gr.dead) continue; _v.subVectors(gr.g.pos, pos); const d = _v.length(); if (d > radius || d < 1e-3) continue; _v.multiplyScalar(1 / d); const k = strength * (1 - d / radius); gr.g.vel.addScaledVector(_v, k); gr.g.vel.y += k * 0.5; gr.g.rest = false; }
    },
  };

  /** Begin a throw: consumes the item, plays the viewmodel throw, releases the grenade after the arm-swing delay. Returns true if a throw started. */
  util.throw = function (actor, type, power = 'strong', opts = {}) {
    if (!actor || !TYPES[type] || actor.alive === false) return false;
    if (util.count(actor, type) < 1) return false;
    const s = util.strength(power);
    if (!util.infinite && !actor.infiniteUtility) util.take(actor, type);
    ctx.events.emit('util:throw', { actor, type, power: s });
    const delay = opts.instant ? 0 : (opts.delay ?? C.releaseDelay);
    if (actor === ctx.localActor || opts.viewmodel) ctx.combat?.viewmodel?.event?.('throw', { type, power: s, delay });
    if (delay <= 0) return release(actor, type, s) != null;
    pending.push({ actor, type, s, at: time + delay }); return true;
  };
  function release(actor, type, s) {
    const p = new THREE.Vector3(), v = new THREE.Vector3(); launch(actor, s, p, v);
    return spawnGrenade(type, p, v, actor);
  }
  /** Predict the flight path of the *next* throw (same integrator as the real thing, minus player-body collisions). */
  const _sim = makeGrenade(), _p = new THREE.Vector3(), _vv = new THREE.Vector3();
  util.trajectory = function (actor, type = 'haze', power = 'strong', out = []) {
    const s = util.strength(power); launch(actor, s, _p, _vv);
    const g = _sim; g.pos.copy(_p); g.prev.copy(_p); g.vel.copy(_vv); g.rest = false; g.age = 0; g.restT = 0; g.bounces = 0; g.spin = 0; g.thrower = null; g.lastBounceT = -1;
    let n = 0; const put = (p) => { (out[n] ||= new THREE.Vector3()).copy(p); n++; }; put(g.pos);
    const maxT = 5; for (let i = 0; i < maxT * 120 && !g.rest; i++) { stepGrenade(g, STEP, W, null); if (i % 3 === 2) put(g.pos); if (g.bounces >= 3 || (type !== 'haze' && g.age > TYPES[type].fuse)) break; }
    put(g.pos); out.length = n; return out;
  };

  // ---------------------------------------------------------------- practice arc preview line
  const previewLine = (() => {
    const N = 120, geo = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.22, gapSize: 0.14, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
    line.frustumCulled = false; line.renderOrder = 200; line.visible = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 200; ring.visible = false;
    return { line, ring, geo, pos, N, pts: [] };
  })();
  util.preview = {
    show(actor, type = 'haze', power = 'strong') {
      const pl = previewLine, pts = util.trajectory(actor, type, power, pl.pts); const n = Math.min(pl.N, pts.length);
      for (let i = 0; i < n; i++) { pl.pos[i * 3] = pts[i].x; pl.pos[i * 3 + 1] = pts[i].y; pl.pos[i * 3 + 2] = pts[i].z; }
      pl.geo.attributes.position.needsUpdate = true; pl.geo.setDrawRange(0, n); pl.line.computeLineDistances(); pl.line.material.color.setHex(TYPES[type].band);
      pl.ring.material.color.setHex(TYPES[type].band); pl.ring.position.copy(pts[n - 1]); pl.ring.position.y += 0.03;
      const sc = ctx.render?.scene; if (sc && !pl.line.parent) { sc.add(pl.line); sc.add(pl.ring); }
      pl.line.visible = pl.ring.visible = true; return pts;
    },
    hide() { previewLine.line.visible = previewLine.ring.visible = false; },
  };

  // ---------------------------------------------------------------- visibility helpers
  util.blocksLine = (a, b) => haze.blocksLine(a, b);
  util.opticalDepth = (a, b) => haze.opticalDepth(a, b);
  util.inSmoke = (p) => { for (const c of haze.list) if (c.density(p.x, p.y, p.z) > 0.35) return true; return false; };
  util.punch = (o, d, len, r, s, life) => haze.punch(o, d, len, r, s, life);
  util.disturb = (p, r, s, life) => haze.disturb(p, r, s, life);
  /** current blind level 0..1 (full white = 1) for gameplay (aim/vision penalties, bot behaviour) */
  util.blindAmount = (actor) => { const b = actor?.blind; if (!b) return 0; const t = time - b.t0; if (t >= b.dur) return 0; if (t < b.hold) return 1; const u = (t - b.hold) / Math.max(0.01, b.dur - b.hold); return Math.pow(1 - u, 2.2); };
  util.isBlind = (actor, thr = 0.5) => util.blindAmount(actor) >= thr;
  util.setWorld = (mesh) => W.set(mesh);
  util.strobe = strobe; util.pulse = pulse; util.haze = haze; util.screen = screen;

  // ---------------------------------------------------------------- shots carve smoke
  const offFire = ctx.events.on('weapon:fire', (e) => {
    if (!haze.list.length || !e?.origin || !e?.dir) return;
    _o.copy(e.origin); _dir.copy(e.dir).normalize(); let len = 120; if (W.raycast(_o, _dir, len, _hit)) len = _hit.dist;
    haze.punch(_o.clone(), _dir.clone(), len, 0.27, 0.95, 1.9);
  });
  const offRound = ctx.events.on('round:start', () => util.clear());

  util.clear = function () { for (const gr of grenades) { gr.model.parent?.remove(gr.model); } grenades.length = 0; pending.length = 0; haze.clear(); strobe.dispose(); pulse.dispose(); screen.clear(); shared.glow.w = 0; lightState.peak = 0; };

  // ---------------------------------------------------------------- update loops
  function ensureScene() {
    if (sceneReady) return; const sc = ctx.render?.scene; if (!sc) return;
    sc.add(light); sc.add(sparks.mesh); sceneReady = true;
  }
  function syncLighting() {
    const r = ctx.render; if (!r) return;
    const sd = r.sunDir; if (sd && sd.isVector3) shared.sunDir.value.copy(sd).normalize(); else if (r.sun?.position) shared.sunDir.value.copy(r.sun.position).normalize();
    if (r.sun?.color) { const k = Math.min(1.15, (r.sun.intensity ?? 2.4) / 2.4); shared.sunCol.value.copy(r.sun.color).multiplyScalar(k); }
    const bg = r.scene?.fog?.color || (r.scene?.background?.isColor ? r.scene.background : null); if (bg) { shared.skyCol.value.copy(bg).lerp(new THREE.Color(0.8, 0.85, 0.95), 0.4); }
  }
  let lightTick = 0;
  util.fixedUpdate = function (dt) {
    const tick = ctx.engine?.tick ?? 0; if (tick === lastTick) return; lastTick = tick;
    time += dt;
    for (let i = pending.length - 1; i >= 0; i--) if (time >= pending[i].at) { const p = pending.splice(i, 1)[0]; release(p.actor, p.type, p.s); }
    const actors = ctx.actors;
    for (let i = grenades.length - 1; i >= 0; i--) {
      const gr = grenades[i]; if (gr.dead) { gr.model.parent?.remove(gr.model); grenades.splice(i, 1); continue; }
      gr.t += dt;
      const impact = stepGrenade(gr.g, dt, W, actors, (g, sp) => { ctx.events.emit('util:bounce', { type: gr.type, pos: g.impactPos.clone(), speed: sp, thrower: g.thrower }); });
      if (gr.g.age > C.maxAge || gr.t >= gr.fuse || (gr.def.popOnRest && gr.g.rest)) detonate(gr);
    }
    haze.fixedUpdate(dt);
    // haze glow/lights decay
    if (shared.glow.w > 0) shared.glow.w = Math.max(0, shared.glow.w - dt * shared.glow.decay);
  };
  const cam = () => ctx.render?.camera;
  util.update = function (dt, alpha = 1) {
    const key = (ctx.engine?.tick ?? 0) * 1e6 + (ctx.engine?.frame ?? 0); if (key === lastUpd && dt > 0) return; lastUpd = key;
    ensureScene(); syncLighting();
    for (const gr of grenades) {
      if (gr.dead) continue; const m = gr.model; m.position.lerpVectors(gr.g.prev, gr.g.pos, alpha); m.quaternion.copy(gr.g.q);
      models.blink(m, gr.t / gr.fuse, time, gr.type);
    }
    haze.update(dt, time, cam());
    strobe.update(dt); pulse.update(dt); sparks.update(dt);
    screen.update(dt);
    // flash light envelope
    if (lightState.peak > 0) { lightState.t += dt; const u = lightState.t / lightState.dur; light.intensity = u >= 1 ? 0 : lightState.peak * Math.pow(1 - u, 2.2); if (u >= 1) lightState.peak = 0; } else light.intensity = 0;
  };
  util.dispose = function () { offFire?.(); offRound?.(); util.clear(); haze.dispose(); screen.dispose(); light.parent?.remove(light); sparks.mesh.parent?.remove(sparks.mesh); ctx.engine?.remove?.(util); };

  // ---------------------------------------------------------------- debug / inspection API
  util.debug = {
    /** spawn(type,pos[,vel]) : no vel => detonates immediately at pos; with vel => flies as a real grenade */
    spawn(type, pos, vel) {
      const p = pos.isVector3 ? pos : new THREE.Vector3(pos.x, pos.y, pos.z);
      if (vel) return spawnGrenade(type, p, vel.isVector3 ? vel : new THREE.Vector3(vel.x, vel.y, vel.z), null);
      const gr = spawnGrenade(type, p, new THREE.Vector3(), null); gr.g.rest = true; detonate(gr); return gr;
    },
    /** throw from an explicit viewpoint without needing an actor in the world */
    throwFrom(x, y, z, yaw, pitch, type, power = 'strong', vel) {
      const a = { pos: new THREE.Vector3(x, y - 1.62, z), vel: vel ? new THREE.Vector3(vel[0], vel[1], vel[2]) : new THREE.Vector3(), yaw, pitch, crouching: false, alive: true, inventory: { utility: [] },
        eyePos(o = new THREE.Vector3()) { return o.set(this.pos.x, this.pos.y + 1.62, this.pos.z); } };
      const s = util.strength(power); const p = new THREE.Vector3(), v = new THREE.Vector3(); launch(a, s, p, v); return spawnGrenade(type, p, v, null);
    },
    clear: () => util.clear(),
    detonateAll() { for (const gr of grenades) if (!gr.dead) detonate(gr); },
    state: () => ({ time, grenades: grenades.map((g) => ({ type: g.type, pos: g.g.pos.toArray(), vel: g.g.vel.toArray(), rest: g.g.rest, t: g.t, bounces: g.g.bounces })), smokes: haze.list.map((s) => ({ id: s.id, age: s.age, cells: s.count, radius: s.radius, extent: s.extent, puffs: s.gfx.P.n })), strobe: strobe.active(), pulse: pulse.active(), overlay: shared.overlayAmount }),
    launch(actor, power = 'strong') { const p = new THREE.Vector3(), v = new THREE.Vector3(); const speed = launch(actor, util.strength(power), p, v); return { pos: p, vel: v, speed }; },
    haze, strobe, pulse, models, sparks, shared, get time() { return time; },
  };
  ctx.engine?.add?.(util, 7.5);          // safe even if the combat root also drives us (tick-guarded)
  registerLab(ctx, util);
  return util;
}
