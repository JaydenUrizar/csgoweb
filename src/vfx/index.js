import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { TEAMS } from '../core/config.js';
import { ParticleSystem, Spec, SHAPE } from './particles.js';
import { Decals, DECAL } from './decals.js';
import { Tracers } from './tracers.js';
import { Shards, KIND } from './shards.js';
import { Ambient } from './ambient.js';
import { createBeacon } from './beacon.js';
import { createScreen } from './screen.js';
import { lin, mixLin, TEAM_COL, SURFACES, SURFACE_ALIAS, TAGGER_TRACER, STYLE_ID } from './presets.js';
import { registerLab } from './lab.js';

// FLUX TAG VFX. See docs/pieces/vfx.md for the full API + inspection instructions.
const QUALITY = {
  low:    { dens: 0.45, shards: 0.45, ambient: 0.25, lights: 1, decals: 0.5 },
  medium: { dens: 0.75, shards: 0.75, ambient: 0.55, lights: 2, decals: 0.8 },
  high:   { dens: 1.0, shards: 1.0, ambient: 1.0, lights: 3, decals: 1 },
  ultra:  { dens: 1.3, shards: 1.2, ambient: 1.0, lights: 3, decals: 1 },
};
const S = SHAPE;
const _n = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _col = new THREE.Color(), _hsl = { h: 0, s: 0, l: 0 };
const UP = new THREE.Vector3(0, 1, 0);

export function create(ctx) {
  const R = ctx.render, scene = R.scene, viewScene = R.viewScene;
  const rnd = () => rng.next();
  const time = { value: 0 }, sunDir = { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() }, nearFade = { value: 1.0 };
  let now = 0, dtLast = 1 / 60;
  const E = new Spec(), Ev = new Spec();
  const root = new THREE.Group(); root.name = 'vfx'; scene.add(root);

  // ---- systems ----------------------------------------------------------------------------------------------------
  const P = new ParticleSystem(root, 6144, { time, sunDir, near: nearFade }, { name: 'vfx-particles', order: 20 });
  const PL = new ParticleSystem(root, 1024, { time, sunDir, near: { value: 0.6 } }, { name: 'vfx-long', order: 18 });      // long-lived (haze, ambient FX)
  const PV = viewScene ? new ParticleSystem(viewScene, 192, { time, sunDir, near: { value: 0.02 } }, { name: 'vfx-view', order: 40 }) : null;
  const decals = new Decals(root, 320, time, { order: 14, name: 'vfx-decals' });
  const rings = new Decals(root, 128, time, { order: 16, name: 'vfx-rings' });
  const tracers = new Tracers(root, 128, time, nearFade);
  const groundCache = new Map();
  const shards = new Shards(root, {
    time, sunDir,
    groundAt(x, y, z, fallback) {
      const map = ctx.map; if (!map?.raycast) return fallback;
      const key = (Math.floor(x * 1.5) + 4096) * 16777216 + (Math.floor(z * 1.5) + 4096) * 2048 + (Math.floor(y / 1.5) + 512);
      let v = groundCache.get(key);
      if (v === undefined) {
        _v.set(x, y + 0.5, z); _v2.set(0, -1, 0);
        const h = map.raycast(_v, _v2, 6);
        v = h ? h.point.y : fallback;
        if (groundCache.size > 2048) groundCache.clear();
        groundCache.set(key, v);
      }
      return v;
    },
    glint: (x, y, z, size, r, g, b) => glint(x, y, z, size, r, g, b),
  });
  const ambient = new Ambient(root, time, 360);
  const screen = createScreen(ctx);
  const lights = []; let vmLight = null;
  const beaconHost = {
    time, now: () => now, decals: rings, screen, rand: rnd,
    lightPulse: (...a) => lightPulse(...a),
    sparkleBurst(x, y, z, r, g, b, n, power) { sparkleBurst(x, y, z, r, g, b, n, power); },
  };
  const beacon = createBeacon(ctx, beaconHost); root.add(beacon.group);

  let q = QUALITY.high, qName = 'high';
  function setQuality(name) {
    const nm = typeof name === 'number' ? (name < 0.3 ? 'low' : name < 0.6 ? 'medium' : name < 0.9 ? 'high' : 'ultra') : String(name || 'high');
    qName = QUALITY[nm] ? nm : 'high'; q = QUALITY[qName];
    P.scale = PL.scale = q.dens; if (PV) PV.scale = 1; shards.scale = q.shards;
    ambient.set({ density: q.ambient });
    lights.forEach((l, i) => { l.enabled = i < q.lights; });
  }

  // point-light pool (fixed count: no shader recompiles at runtime)
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.position.set(0, -500, 0); root.add(l); l.castShadow = false;
    lights.push({ light: l, t: 9, life: 1, peak: 0, enabled: true });
  }
  if (viewScene) { vmLight = new THREE.PointLight(0xffb060, 0, 3, 2); vmLight.position.set(0, -50, 0); viewScene.add(vmLight); }
  const vmL = { t: 9, life: 1, peak: 0 };
  function lightPulse(x, y, z, r, g, b, intensity, range, life) {
    let best = null;
    for (const l of lights) { if (!l.enabled) continue; if (l.t >= l.life) { best = l; break; } if (!best || l.t / l.life > best.t / best.life) best = l; }
    if (!best) return;
    best.t = 0; best.life = life; best.peak = intensity; best.light.position.set(x, y, z); best.light.color.setRGB(r, g, b); best.light.distance = range;
  }

  // ---- helpers ----------------------------------------------------------------------------------------------------
  const cam = R.camera;
  function distToCam(x, y, z) { const p = cam.position; return Math.hypot(x - p.x, y - p.y, z - p.z); }
  function lod(x, y, z) { const d = distToCam(x, y, z); return d < 22 ? 1 : d > 120 ? 0 : d > 70 ? 0.35 : 1 - (d - 22) / 48 * 0.65; }
  function basis(nx, ny, nz) {
    _n.set(nx, ny, nz); if (_n.lengthSq() < 1e-6) _n.set(0, 1, 0); _n.normalize();
    _t1.copy(Math.abs(_n.y) > 0.95 ? _v3.set(1, 0, 0) : UP).cross(_n).normalize(); _t2.copy(_n).cross(_t1);
  }
  /** random direction in a cone about _n with half-angle spread (0..1 = up to 90deg); writes into _v */
  function cone(spread) {
    const a = rnd() * 6.2832, s = Math.sqrt(rnd()) * spread, c = Math.sqrt(Math.max(0, 1 - s * s));
    return _v.set(_n.x * c + (_t1.x * Math.cos(a) + _t2.x * Math.sin(a)) * s, _n.y * c + (_t1.y * Math.cos(a) + _t2.y * Math.sin(a)) * s, _n.z * c + (_t1.z * Math.cos(a) + _t2.z * Math.sin(a)) * s);
  }
  const surfCol = {}; for (const k in SURFACES) surfCol[k] = { dust: lin(SURFACES[k].dust), chip: lin(SURFACES[k].chip) };

  /** sparkle: a tiny bright star glint */
  function glint(x, y, z, size, r, g, b) {
    E.reset(); E.pos(x, y, z); E.life = 0.32 + rnd() * 0.3; E.s0 = size * 0.35; E.s1 = size; E.shape = S.STAR; E.add = 1; E.fadeIn = 0.1; E.rot = rnd() * 3; E.spin = (rnd() - 0.5) * 3; E.seed = rnd();
    E.col(1 + r * 2.4, 1 + g * 2.4, 1 + b * 2.4, 1, r * 1.2, g * 1.2, b * 1.2, 0); E.g = 0.4; E.drag = 1.5; E.vy = 0.15;
    P.emit(now, E);
  }
  function sparkleBurst(x, y, z, r, g, b, n, power = 1) {
    n = P.n(n);
    for (let i = 0; i < n; i++) {
      const th = rnd() * 6.2832, ph = Math.acos(2 * rnd() - 1), sp = (1.5 + rnd() * 4.5) * power;
      E.reset(); E.pos(x, y, z); E.vel(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp + 1.2, Math.sin(ph) * Math.sin(th) * sp);
      E.life = 0.5 + rnd() * 0.7; E.g = -5; E.drag = 1.7; E.s0 = 0.05 + rnd() * 0.05; E.s1 = 0.01; E.shape = i % 3 === 0 ? S.STAR : S.DOT; E.add = 1; E.fadeIn = 0.02; E.seed = rnd(); E.rot = rnd() * 3; E.spin = (rnd() - 0.5) * 6;
      E.col(1 + r * 2.5, 1 + g * 2.5, 1 + b * 2.5, 1, r * 1.5, g * 1.5, b * 1.5, 0); P.emit(now, E);
    }
  }

  // ---- decal / impact ---------------------------------------------------------------------------------------------
  const recent = { imp: new Float32Array(8 * 4), impI: 0, tr: new Float32Array(8 * 7), trI: 0, sh: new Float32Array(4 * 4), shI: 0 };
  function dupImpact(x, y, z) {
    const a = recent.imp;
    for (let i = 0; i < 8; i++) if (now - a[i * 4] < 0.06 && Math.abs(a[i * 4 + 1] - x) + Math.abs(a[i * 4 + 2] - y) + Math.abs(a[i * 4 + 3] - z) < 0.4) return true;
    const j = recent.impI++ & 7; a[j * 4] = now; a[j * 4 + 1] = x; a[j * 4 + 2] = y; a[j * 4 + 3] = z; return false;
  }

  /** Contact with a participant: a small clean light-spark (never a splatter); the bigger ping comes from tag:hit. */
  function bodySpark(x, y, z, normal, o) {
    const L = lod(x, y, z); if (L <= 0.2) return;
    basis(normal?.x ?? 0, normal?.y ?? 1, normal?.z ?? 0);
    const c = lin(o.color ?? 0xbfefff), n = P.n(9 * L), k = Math.min(2.6, 1.2 + distToCam(x, y, z) / 22);
    E.reset(); E.pos(x, y, z); E.life = 0.12; E.s0 = 0.22 * k; E.s1 = 0.5 * k; E.shape = S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd() * 3; E.col(1.8 + c[0] * 2.4, 1.8 + c[1] * 2.4, 1.8 + c[2] * 2.4, 1, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 0); P.emit(now, E);
    for (let i = 0; i < P.n(4 * L); i++) {                               // soft coloured light-mist (the stylised 'I hit' cue)
      cone(1.0); const sp = 0.6 + rnd() * 1.4;
      E.reset(); E.pos(x, y, z); E.vel(_v.x * sp, _v.y * sp + 0.2, _v.z * sp); E.life = 0.4 + rnd() * 0.25; E.drag = 3; E.s0 = 0.12 * k; E.s1 = (0.55 + rnd() * 0.3) * k; E.shape = S.PUFF; E.add = 0.7; E.fadeIn = 0.05; E.seed = rnd(); E.rot = rnd() * 6;
      E.col(c[0] * 1.6 + 0.2, c[1] * 1.6 + 0.2, c[2] * 1.6 + 0.2, 0.55, c[0], c[1], c[2], 0); P.emit(now, E);
    }
    for (let i = 0; i < n; i++) {
      cone(0.95); const sp = 2 + rnd() * 4;
      E.reset(); E.pos(x, y, z); E.vel(_v.x * sp, _v.y * sp + 0.4, _v.z * sp); E.life = 0.22 + rnd() * 0.22; E.g = -5; E.drag = 1.1; E.s0 = 0.04 * k; E.s1 = 0.01; E.stretch = 0.045; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0;
      E.col(1.8 + c[0] * 2.5, 1.8 + c[1] * 2.5, 1.8 + c[2] * 2.5, 1, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 0); P.emit(now, E);
    }
  }

  /** Surface impact: dust/chips/sparks/splinters/ripples per surface + an energy ring decal. */
  function impact(point, normal, surface = 'stone', o = {}) {
    if (!point) return;
    const x = point.x, y = point.y, z = point.z;
    if (!o.force && dupImpact(x, y, z)) return;
    const L = lod(x, y, z); if (L <= 0) return;
    if (surface === 'body' || surface === 'actor') { if (o.color != null) bodySpark(x, y, z, normal, o); return; }       // tag:hit draws the coloured burst
    const key = SURFACE_ALIAS[surface] || 'stone', S0 = SURFACES[key], sc = (o.scale ?? 1), t = now;
    basis(normal?.x ?? 0, normal?.y ?? 1, normal?.z ?? 0);
    const nx = _n.x, ny = _n.y, nz = _n.z;
    const tint = lin(o.color ?? 0xffffff), dust = surfCol[key].dust, chip = surfCol[key].chip;
    const floor = ny > 0.7 ? y + 0.012 : -1e4;
    // light energy ring decal (or ripple)
    if (key === 'glass') decals.add(t, x, y, z, nx, ny, nz, 0.7, 0.1 * sc, 0.65 * sc, DECAL.RIPPLE, rnd(), tint[0] * 1.2 + 0.5, tint[1] * 1.2 + 0.7, tint[2] * 1.2 + 0.8, 1);
    else if (key === 'water') rings.add(t, x, y + 0.01, z, 0, 1, 0, 0.9, 0.08 * sc, 0.75 * sc, DECAL.WATER, rnd(), 0.9, 1, 1, 0.9);
    else decals.add(t, x, y, z, nx, ny, nz, 24, 0.4 * sc, 0.4 * sc, DECAL.IMPACT, rnd(), 0.5 + tint[0] * 1.4, 0.5 + tint[1] * 1.4, 0.5 + tint[2] * 1.4, 0.9, dust[0] * 0.14, dust[1] * 0.13, dust[2] * 0.12, 0.95);
    // hot flash
    E.reset(); E.pos(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03); E.life = 0.09; E.s0 = 0.34 * sc; E.s1 = 0.5 * sc; E.shape = S.STAR; E.add = 1; E.fadeIn = 0.0; E.rot = rnd() * 3;
    E.col(2.6 * (0.6 + tint[0] * 0.4), 2.3 * (0.6 + tint[1] * 0.4), 2.1 * (0.6 + tint[2] * 0.4), 0.9, 1, 0.8, 0.6, 0); P.emit(t, E);
    { const ns = P.n(7 * L);                                        // tagger-coloured light streaks (readable on light walls)
      for (let i = 0; i < ns; i++) {
        cone(0.97); const sp = 3 + rnd() * 5;
        E.reset(); E.pos(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03); E.vel(_v.x * sp, _v.y * sp, _v.z * sp); E.life = 0.14 + rnd() * 0.12; E.g = -3; E.drag = 1.2; E.s0 = 0.03 * sc; E.s1 = 0.012; E.stretch = 0.045; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.floor = floor;
        E.col(1.6 + tint[0] * 3, 1.6 + tint[1] * 3, 1.6 + tint[2] * 3, 1, tint[0] * 2, tint[1] * 2, tint[2] * 2, 0); P.emit(t, E); } }
    // dust puffs
    const np = P.n(S0.puffN * L * (o.density ?? 1));
    for (let i = 0; i < np; i++) {
      cone(0.95); const sp = (0.55 + rnd() * 1.2) * S0.kick;
      E.reset(); E.pos(x + nx * 0.04, y + ny * 0.04, z + nz * 0.04); E.vel(_v.x * sp, _v.y * sp + 0.12, _v.z * sp);
      E.life = 0.55 + rnd() * 0.5; E.g = 0.28; E.drag = 3.1; E.s0 = 0.08 * sc; E.s1 = S0.puff * (0.75 + rnd() * 0.5) * sc; E.shape = S.PUFF; E.add = 0; E.fadeIn = 0.1; E.seed = rnd(); E.rot = rnd() * 6; E.spin = (rnd() - 0.5) * 0.9; E.s1 *= 1.25;
      const l = 1.0 + (rnd() - 0.5) * 0.14; E.col(dust[0] * l, dust[1] * l, dust[2] * l, Math.min(0.9, S0.dustA * 1.5), dust[0] * l * 0.9, dust[1] * l * 0.9, dust[2] * l * 0.9, 0); P.emit(t, E);
    }
    // chips (solid) + flecks (bright)
    const nc = P.n(S0.chipN * L * (o.density ?? 1));
    for (let i = 0; i < nc; i++) {
      cone(0.8); const sp = 2.2 + rnd() * 4.6;
      E.reset(); E.pos(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02); E.vel(_v.x * sp, _v.y * sp, _v.z * sp); E.life = 0.36 + rnd() * 0.3; E.g = -13; E.drag = 0.35; E.s0 = E.s1 = (0.026 + rnd() * 0.03) * sc;
      E.shape = S.CHIP; E.add = 0; E.fadeIn = 0; E.fadeOut = 0.7; E.rot = rnd() * 6; E.spin = (rnd() - 0.5) * 30; E.seed = rnd(); E.floor = floor;
      const l = 0.45 + rnd() * 0.45; E.col(chip[0] * l, chip[1] * l, chip[2] * l, 1, chip[0] * l, chip[1] * l, chip[2] * l, 1); P.emit(t, E);
    }
    if (key !== 'glass' && key !== 'water') {
      const nf = P.n(3 * L);
      for (let i = 0; i < nf; i++) {
        cone(0.9); const sp = 1.5 + rnd() * 3.5;
        E.reset(); E.pos(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03); E.vel(_v.x * sp, _v.y * sp, _v.z * sp); E.life = 0.22 + rnd() * 0.25; E.g = -7; E.drag = 0.6; E.s0 = 0.05 * sc; E.s1 = 0.01; E.shape = S.DOT; E.add = 1; E.fadeIn = 0;
        E.floor = floor; E.seed = rnd(); E.col(1.6 + tint[0] * 1.6, 1.4 + tint[1] * 1.6, 1.2 + tint[2] * 1.6, 1, 1, 0.7, 0.4, 0); P.emit(t, E);
      }
    }
    if (key === 'metal') {                                            // sparks
      const ns = P.n(S0.spark * L);
      for (let i = 0; i < ns; i++) {
        cone(0.98); const sp = 4 + rnd() * 7;
        E.reset(); E.pos(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02); E.vel(_v.x * sp, _v.y * sp, _v.z * sp); E.life = 0.16 + rnd() * 0.24; E.g = -11; E.drag = 0.7; E.s0 = 0.022 + rnd() * 0.02; E.s1 = 0.012; E.stretch = 0.028; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.floor = floor;
        E.col(3.0, 1.9 + rnd() * 0.6, 0.7, 1, 1.4, 0.35, 0.08, 0); P.emit(t, E);
      }
    } else if (key === 'wood') {                                      // splinters as bright flecks
      const ns = P.n(S0.splinter * L);
      for (let i = 0; i < ns; i++) {
        cone(0.9); const sp = 2.5 + rnd() * 4.5;
        E.reset(); E.pos(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02); E.vel(_v.x * sp, _v.y * sp, _v.z * sp); E.life = 0.28 + rnd() * 0.3; E.g = -9; E.drag = 0.5; E.s0 = 0.02 + rnd() * 0.015; E.s1 = 0.012; E.stretch = 0.03; E.shape = S.STREAK; E.add = 0.6; E.fadeIn = 0; E.floor = floor;
        E.col(1.9, 1.35, 0.7, 1, 1.2, 0.75, 0.38, 0); P.emit(t, E);
      }
    } else if (key === 'glass') {                                     // glints
      const ns = P.n(S0.glass * L);
      for (let i = 0; i < ns; i++) {
        cone(0.95); const sp = 1.5 + rnd() * 3.8;
        E.reset(); E.pos(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02); E.vel(_v.x * sp, _v.y * sp, _v.z * sp); E.life = 0.3 + rnd() * 0.4; E.g = -6; E.drag = 0.9; E.s0 = 0.05 + rnd() * 0.05; E.s1 = 0.01; E.shape = i % 2 ? S.HEX : S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd() * 3; E.spin = (rnd() - 0.5) * 12; E.floor = floor;
        E.col(1.6 + tint[0], 2.2 + tint[1], 2.6 + tint[2], 1, 0.4, 0.9, 1.2, 0); P.emit(t, E);
      }
    } else if (key === 'water') {                                     // splash
      const nd = P.n(S0.water * L);
      for (let i = 0; i < nd; i++) {
        cone(0.55); const sp = 2.2 + rnd() * 3.6;
        E.reset(); E.pos(x, y + 0.02, z); E.vel(_v.x * sp, Math.abs(_v.y) * sp + 1.0, _v.z * sp); E.life = 0.5 + rnd() * 0.35; E.g = -13; E.drag = 0.3; E.s0 = 0.032 + rnd() * 0.03; E.s1 = 0.02; E.shape = S.DISC; E.add = 0; E.fadeIn = 0; E.fadeOut = 0.7; E.floor = y - 0.02;
        E.col(0.85, 0.96, 1, 0.9, 0.7, 0.9, 1, 0.9); P.emit(t, E);
      }
      E.reset(); E.pos(x, y + 0.03, z); E.vel(0, 3.2, 0); E.life = 0.3; E.g = -14; E.drag = 0.2; E.s0 = 0.05; E.s1 = 0.03; E.stretch = 0.06; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.col(1.5, 2, 2.4, 1, 0.5, 0.9, 1.2, 0); P.emit(t, E);
    }
  }

  // ---- tracers ----------------------------------------------------------------------------------------------------
  const tCache = new WeakMap();
  function actorTint(actor, fallback = 0xffffff) {
    if (!actor) return fallback;
    let c = tCache.get(actor);
    if (!c || c.team !== actor.team || c.cos !== actor.cosmetics) {
      let glow = null;
      try { const spec = actor.cosmetics && ctx.cosmetics?.resolve?.(actor.cosmetics); glow = spec?.taggerSkin?.glow ?? null; } catch { /* stub */ }
      c = { team: actor.team, cos: actor.cosmetics, col: glow ?? TEAM_COL[actor.team] ?? fallback }; tCache.set(actor, c);
    }
    return c.col;
  }
  function taggerLook(tagger) {
    const id = typeof tagger === 'string' ? tagger : tagger?.id;
    return TAGGER_TRACER[id] || TAGGER_TRACER.default;
  }
  /** Bright tapered beam with a travelling head. style: 'beam'|'pulse'|'comet'|'prism'|'laser'|'twin' */
  function tracer(from, to, color = 0xffffff, style = 'beam', o = {}) {
    if (!from || !to) return;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, dist = Math.hypot(dx, dy, dz);
    if (dist < 0.4) return;
    // duplicate suppression (combat may call tracer() explicitly while weapon:fire also auto-spawns one)
    if (!o.force) {
      const a = recent.tr; for (let i = 0; i < 8; i++) if (now - a[i * 7] < 0.07 && Math.abs(a[i * 7 + 4] - to.x) + Math.abs(a[i * 7 + 5] - to.y) + Math.abs(a[i * 7 + 6] - to.z) < 0.6 && Math.abs(a[i * 7 + 1] - from.x) + Math.abs(a[i * 7 + 2] - from.y) + Math.abs(a[i * 7 + 3] - from.z) < 1.2) return;
    }
    const j = recent.trI++ & 7, a = recent.tr; a[j * 7] = now; a[j * 7 + 1] = from.x; a[j * 7 + 2] = from.y; a[j * 7 + 3] = from.z; a[j * 7 + 4] = to.x; a[j * 7 + 5] = to.y; a[j * 7 + 6] = to.z;
    const look = o.look || TAGGER_TRACER.default;
    const sid = typeof style === 'number' ? style : (STYLE_ID[style] ?? 0);
    const c = lin(color), w = o.white ?? look.white ?? 0.35, cm = mixLin(c, [1, 1, 1], w);
    const inten = Math.max(1.2, (o.intensity ?? look.intensity ?? 1.6)), len = Math.min(o.len ?? look.len ?? 3, dist + 0.5), width = o.width ?? look.width ?? 0.02;
    const spd0 = o.speed ?? look.speed ?? 480, spd = Math.min(spd0, (dist + len) / 0.11);   // always visible for >= ~6 frames
    tracers.add(now, from.x, from.y, from.z, to.x, to.y, to.z, spd, cm[0], cm[1], cm[2], inten, width, len, sid, rnd());
    if ((sid === 2 || sid === 3 || o.sparkle) && dist > 1) {          // glitter trail left behind by fancy styles
      const n = Math.min(P.n(dist * 0.45), 28), sp = (o.speed ?? look.speed ?? 480);
      for (let i = 0; i < n; i++) {
        const f = (i + rnd()) / n, d = f * dist;
        E.reset(); E.pos(from.x + dx * f + (rnd() - 0.5) * 0.08, from.y + dy * f + (rnd() - 0.5) * 0.08, from.z + dz * f + (rnd() - 0.5) * 0.08);
        E.life = 0.3 + rnd() * 0.45; E.shape = rnd() < 0.4 ? S.STAR : S.DOT; E.add = 1; E.s0 = 0.05 + rnd() * 0.05; E.s1 = 0.01; E.fadeIn = 0; E.vy = 0.2 + rnd() * 0.3; E.g = -0.6; E.drag = 1.2; E.rot = rnd() * 3; E.spin = (rnd() - 0.5) * 6; E.seed = rnd();
        // delay birth so the glints appear as the head passes
        const birth = now + d / sp; E.col(cm[0] * 2.2 + 0.4, cm[1] * 2.2 + 0.4, cm[2] * 2.2 + 0.4, 1, c[0], c[1], c[2], 0); P.emit(birth, E);
      }
    }
  }

  // ---- muzzle flash -----------------------------------------------------------------------------------------------
  const lastFlash = new Map();
  const _mp = new THREE.Vector3(), _md = new THREE.Vector3(), _mr = new THREE.Vector3();
  function muzzleWorld(actor, out) {
    const v = ctx.characters?.muzzleWorldPos?.(actor, out);
    if (v && v.isVector3 && Number.isFinite(v.x)) { if (v !== out) out.copy(v); return out; }
    actor.eyePos(out); actor.forward(_md); _mr.set(Math.cos(actor.yaw), 0, -Math.sin(actor.yaw));
    return out.addScaledVector(_md, 0.62).addScaledVector(_mr, 0.2).addScaledVector(UP, -0.36);
  }
  /**
   * Muzzle flash. target: actor (third person) | 'view' | viewmodel-ish true. tagger id or def. o: {power, color, dir}
   */
  function muzzleFlash(target, tagger, o = {}) {
    const look = taggerLook(tagger), pw = (o.power ?? look.power ?? 1);
    const vmod = ctx.combat?.viewmodel;
    const isView = target === 'view' || target === 'viewmodel' || target === true || (target && (target === vmod || target.isViewmodel || (typeof target.event === 'function' && !target.eyePos)));
    const actor = isView ? ctx.localActor : target;
    if (!actor && !isView) return;
    { const key = isView ? -1 : actor.id, lf = lastFlash.get(key); if (lf !== undefined && now - lf < 0.03 && !o.force) return; lastFlash.set(key, now); }
    const col = lin(o.color ?? (isView ? 0xffb35a : 0xffb35a)), tint = lin(actorTint(actor, 0xffb35a));
    const warm = mixLin(col, tint, 0.28);
    if (isView) {
      const vm = ctx.combat?.viewmodel?.muzzle || api.viewMuzzleOverride; if (!vm || !PV) return;
      vm.getWorldPosition(_mp); vm.getWorldDirection(_md).negate();
      if (api.fpFlash === 'off' || (api.fpFlash === 'auto' && vmod?.muzzleWorld)) return;    // the viewmodel piece draws its own FP flash; avoid doubling
      const tid = typeof tagger === 'string' ? tagger : tagger?.id, def = ctx.combat?.taggers?.[tid];
      const auto = !!def && def.cycle < 0.2;
      viewFlash(_mp, _md, pw, warm, auto);
      vmL.t = 0; vmL.life = 0.035; vmL.peak = 0.8 * Math.min(pw, 1.2); vmLight.position.copy(_mp).addScaledVector(_md, 0.12); vmLight.color.setRGB(warm[0] * 1.6 + 0.4, warm[1] * 1.1 + 0.2, warm[2] * 0.6);
    } else if (actor) {
      const d = distToCam(actor.pos.x, actor.pos.y, actor.pos.z); if (d > 90) return;
      muzzleWorld(actor, _mp); if (o.dir) _md.copy(o.dir); else actor.forward(_md);
      flashAt(P, _mp, _md, pw * (d > 40 ? 0.8 : 1), warm, false);
      lightPulse(_mp.x + _md.x * 0.3, _mp.y + _md.y * 0.3, _mp.z + _md.z * 0.3, warm[0] * 1.4 + 0.3, warm[1] * 1.0 + 0.15, warm[2] * 0.5, 16 * pw, 8, 0.08);
    }
  }
  const _nd = new THREE.Vector3();
  /** First-person flash: 1-2 frames, small, varied, and pushed away from the screen centre so it never hides the aim point. */
  function viewFlash(p, d, pw, c, auto) {
    const t = now, vc = R.viewCamera; let x = p.x, y = p.y, z = p.z;
    if (vc) {
      _nd.copy(p).project(vc); const r = Math.hypot(_nd.x, _nd.y), MIN = 0.26;
      if (r < MIN) { let ux = _nd.x, uy = _nd.y; if (r < 0.02) { ux = 0.8; uy = -0.6; } else { ux /= r; uy /= r; } if (uy > 0.2) uy = -0.2; _nd.x = ux * MIN; _nd.y = uy * MIN; _nd.unproject(vc); x = _nd.x; y = _nd.y; z = _nd.z; }
    }
    const k = (auto ? 0.7 : 1.1) * pw * (0.75 + rnd() * 0.5), life = 0.03;
    E.reset(); E.pos(x, y, z); E.life = life; E.s0 = 0.07 * k; E.s1 = 0.15 * k; E.shape = rnd() < 0.5 ? S.STAR : S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd() * 6.28;
    E.col(3.2 * (0.75 + c[0] * 0.25), 2.2 * (0.75 + c[1] * 0.25), 1.0 * (0.75 + c[2] * 0.25), 1, 2.0, 0.9, 0.35, 0); PV.emit(t, E);
    E.reset(); E.pos(x, y, z); E.life = life * 1.3; E.s0 = 0.06 * k; E.s1 = 0.14 * k; E.shape = S.GLOW; E.add = 1; E.fadeIn = 0; E.col(2.2, 1.3, 0.55, 0.6, 1.1, 0.45, 0.12, 0); PV.emit(t, E);
    if (rnd() < 0.8) { E.reset(); E.pos(x, y, z); const sp = 12 + rnd() * 8; E.vel(d.x * sp + (rnd() - 0.5) * 3, d.y * sp + (rnd() - 0.5) * 3, d.z * sp + (rnd() - 0.5) * 3); E.life = 0.04; E.s0 = 0.02 * k; E.s1 = 0.008; E.stretch = 0.012; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.col(3, 1.8, 0.7, 1, 1.5, 0.5, 0.1, 0); PV.emit(t, E); }
  }
  function flashAt(ps, p, d, pw, c, view) {
    const t = now, k = view ? 1 : 1;
    // star burst
    E.reset(); E.pos(p.x, p.y, p.z); E.life = view ? 0.05 : 0.055; E.s0 = 0.12 * pw * k; E.s1 = 0.3 * pw * k; E.shape = S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd() * 6.28; E.spin = (rnd() - 0.5) * 5;
    E.col(3.4 * (0.75 + c[0] * 0.25), 2.4 * (0.75 + c[1] * 0.25), 1.2 * (0.75 + c[2] * 0.25), 1, 2.0, 0.9, 0.35, 0); ps.emit(t, E);
    // glow disc
    E.reset(); E.pos(p.x + d.x * 0.03, p.y + d.y * 0.03, p.z + d.z * 0.03); E.life = 0.08; E.s0 = 0.16 * pw; E.s1 = 0.36 * pw; E.shape = S.GLOW; E.add = 1; E.fadeIn = 0; E.col(2.4, 1.4, 0.6, 0.75, 1.2, 0.5, 0.15, 0); ps.emit(t, E);
    // forward jet streaks
    for (let i = 0; i < 3; i++) {
      E.reset(); E.pos(p.x, p.y, p.z); const sp = 14 + rnd() * 10; E.vel(d.x * sp + (rnd() - 0.5) * 2.4, d.y * sp + (rnd() - 0.5) * 2.4, d.z * sp + (rnd() - 0.5) * 2.4);
      E.life = 0.05 + rnd() * 0.03; E.s0 = 0.035 * pw; E.s1 = 0.012; E.stretch = 0.012 + rnd() * 0.01; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.col(3, 1.8, 0.7, 1, 1.5, 0.5, 0.1, 0); ps.emit(t, E);
    }
    // lingering side sparks
    if (!view || rnd() < 0.7) for (let i = 0; i < 2; i++) {
      E.reset(); E.pos(p.x, p.y, p.z); const sp = 3 + rnd() * 5; E.vel(d.x * sp * 0.4 + (rnd() - 0.5) * sp, d.y * sp * 0.4 + (rnd() - 0.2) * sp * 0.7, d.z * sp * 0.4 + (rnd() - 0.5) * sp);
      E.life = 0.12 + rnd() * 0.12; E.g = -6; E.s0 = 0.02; E.s1 = 0.008; E.stretch = 0.02; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.col(2.5, 1.4, 0.5, 1, 1, 0.3, 0.05, 0); ps.emit(t, E);
    }
    // smoke wisp + heat shimmer (faint warm haze that rises off the muzzle)
    if (!view) {
      E.reset(); E.pos(p.x + d.x * 0.1, p.y + d.y * 0.1, p.z + d.z * 0.1); E.vel(d.x * 0.9, d.y * 0.9 + 0.35, d.z * 0.9); E.life = 0.5; E.g = 0.25; E.drag = 2.2; E.s0 = 0.05; E.s1 = 0.26 * pw; E.shape = S.PUFF; E.fadeIn = 0.15; E.seed = rnd(); E.rot = rnd() * 6;
      E.col(0.9, 0.88, 0.85, 0.22, 0.9, 0.88, 0.85, 0); ps.emit(t, E);
      E.reset(); E.pos(p.x + d.x * 0.15, p.y + d.y * 0.15, p.z + d.z * 0.15); E.vel(d.x * 0.5, d.y * 0.5 + 0.7, d.z * 0.5); E.life = 0.45; E.g = 0.5; E.drag = 1.8; E.s0 = 0.12; E.s1 = 0.38 * pw; E.shape = S.SMOKE; E.add = 1; E.fadeIn = 0.2; E.seed = rnd();
      E.col(0.38, 0.22, 0.1, 0.14, 0.2, 0.1, 0.04, 0); ps.emit(t, E);
    } else {
      E.reset(); E.pos(p.x + d.x * 0.08, p.y + d.y * 0.08, p.z + d.z * 0.08); E.vel(d.x * 0.5, d.y * 0.5 + 0.25, d.z * 0.5); E.life = 0.45; E.g = 0.2; E.drag = 2.5; E.s0 = 0.04; E.s1 = 0.2 * pw; E.shape = S.PUFF; E.fadeIn = 0.15; E.seed = rnd();
      E.col(0.85, 0.85, 0.85, 0.16, 0.85, 0.85, 0.85, 0); ps.emit(t, E);
    }
  }

  // ---- shards (tag-out) -------------------------------------------------------------------------------------------
  const hueShift = (c, dh, sMul = 1, lAdd = 0) => { _col.setRGB(c[0], c[1], c[2]); _col.getHSL(_hsl); _col.setHSL((_hsl.h + dh + 1) % 1, Math.min(1, _hsl.s * sMul), Math.min(0.95, _hsl.l + lAdd)); return [_col.r, _col.g, _col.b]; };
  const pend = []; for (let i = 0; i < 24; i++) pend.push({ t: 0, x: 0, y: 0, z: 0, r: 1, g: 1, b: 1, on: false, kind: 0 });
  function schedule(delay, kind, x, y, z, r, g, b) { for (const p of pend) if (!p.on) { p.on = true; p.t = now + delay; p.kind = kind; p.x = x; p.y = y; p.z = z; p.r = r; p.g = g; p.b = b; return; } }
  function firework(x, y, z, r, g, b) {
    const n = P.n(46);
    for (let i = 0; i < n; i++) {
      const th = rnd() * 6.2832, ph = Math.acos(2 * rnd() - 1), sp = 3.5 + rnd() * 2.6;
      const cc = i % 5 === 0 ? [1, 1, 1] : [r, g, b];
      E.reset(); E.pos(x, y, z); E.vel(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp); E.life = 0.9 + rnd() * 0.5; E.g = -3.4; E.drag = 1.5; E.s0 = 0.06; E.s1 = 0.015; E.stretch = 0.085; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0;
      E.col(1.6 + cc[0] * 3, 1.6 + cc[1] * 3, 1.6 + cc[2] * 3, 1, cc[0] * 1.4, cc[1] * 1.4, cc[2] * 1.4, 0); P.emit(now, E);
    }
    E.reset(); E.pos(x, y, z); E.life = 0.22; E.s0 = 0.6; E.s1 = 1.6; E.shape = S.GLOW; E.add = 1; E.fadeIn = 0; E.col(2.8 * (0.5 + r), 2.8 * (0.5 + g), 2.8 * (0.5 + b), 0.8, r, g, b, 0); P.emit(now, E);
    E.reset(); E.pos(x, y, z); E.life = 0.16; E.s0 = 0.5; E.s1 = 1.1; E.shape = S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd(); E.col(3.5, 3.5, 3.5, 1, 1, 1, 1, 0); P.emit(now, E);
    lightPulse(x, y, z, r * 1.2 + 0.2, g * 1.2 + 0.2, b * 1.2 + 0.2, 26, 12, 0.45);
  }
  const ST = { shatter: 1, confetti: 1, pixelate: 1, fireworks: 1, petals: 1, stars: 1 };
  /**
   * Harmless tag-out burst at `point` (chest height). style: shatter|confetti|pixelate|fireworks|petals|stars.
   * o: {dir:{x,y,z} incoming direction, height, radius, scale}
   */
  function burstShards(point, color = 0x2fd0ff, style = 'shatter', o = {}) {
    if (!point) return;
    if (!ST[style]) style = 'shatter';
    const x = point.x, y = point.y, z = point.z;
    if (!o.force) { const a = recent.sh; for (let i = 0; i < 4; i++) if (now - a[i * 4] < 0.25 && Math.abs(a[i * 4 + 1] - x) + Math.abs(a[i * 4 + 2] - y) + Math.abs(a[i * 4 + 3] - z) < 2.0) return; const j = recent.shI++ & 3; a[j * 4] = now; a[j * 4 + 1] = x; a[j * 4 + 2] = y; a[j * 4 + 3] = z; }
    const L = Math.max(0.35, lod(x, y, z)); if (distToCam(x, y, z) > 140) return;
    const c = lin(color), light = mixLin(c, [1, 1, 1], 0.5), dark = [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5];
    const comp = hueShift(c, 0.5, 1, 0.05), an1 = hueShift(c, 0.08, 1, 0.08), an2 = hueShift(c, -0.08, 1, 0.08);
    const H = o.height ?? 1.8, sc = o.scale ?? 1;
    const dir = o.dir; let dx = dir ? dir.x : 0, dz = dir ? dir.z : 0; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const gy = shards.groundAt ? shards.groundAt(x, y, z, y - H * 0.55) : y - H * 0.55;
    // shared: flash + rings + sparkles + light
    E.reset(); E.pos(x, y, z); E.life = 0.2; E.s0 = 0.4; E.s1 = 1.1 * sc; E.shape = S.GLOW; E.add = 1; E.fadeIn = 0; E.col(0.8 + c[0], 0.8 + c[1], 0.8 + c[2], 0.6, c[0], c[1], c[2], 0); P.emit(now, E);
    E.reset(); E.pos(x, y, z); E.life = 0.14; E.s0 = 0.7; E.s1 = 1.3 * sc; E.shape = S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd(); E.col(3.2, 3.2, 3.2, 1, light[0] * 2, light[1] * 2, light[2] * 2, 0); P.emit(now, E);
    rings.add(now, x, gy + 0.03, z, 0, 1, 0, 0.75, 0.3, 1.5, DECAL.PULSE, rnd(), c[0] * 0.8 + 0.3, c[1] * 0.8 + 0.3, c[2] * 0.8 + 0.3, 0.6);
    lightPulse(x, y + 0.3, z, c[0] * 1.2 + 0.2, c[1] * 1.2 + 0.2, c[2] * 1.2 + 0.2, 12, 8, 0.28);
    sparkleBurst(x, y, z, c[0], c[1], c[2], 28, 1);
    const nS = (n) => Math.max(4, Math.round(n * shards.scale * Math.max(0.5, L)));
    const emitBody = (kind, n, fn) => {
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.2832, rr = Math.sqrt(rnd()) * 0.34 * (o.radius ?? 1), hh = (rnd() - 0.5) * H * 0.9;
        const px = x + Math.cos(a) * rr, py = y + hh * 0.85, pz = z + Math.sin(a) * rr;
        fn(kind, i, px, py, pz, Math.cos(a), Math.sin(a), hh);
      }
    };
    if (style === 'shatter') {
      emitBody(KIND.shard, nS(64), (kind, i, px, py, pz, cx, cz, hh) => {
        const sp = 1.8 + rnd() * 3.6, up = 1.5 + rnd() * 3.5, push = 1.5 + rnd() * 3;
        const cc = rnd() < 0.18 ? [1.6, 1.7, 1.8] : rnd() < 0.4 ? light : rnd() < 0.75 ? c : dark; const sz = 0.09 + rnd() * 0.15;
        shards.add(kind, px, py, pz, cx * sp + dx * push, up + hh * 0.5, cz * sp + dz * push, sz * 0.7, sz * 1.5, sz * 0.7, cc[0], cc[1], cc[2], cc === dark ? 0.15 : 0.45, 3 + rnd() * 0.9, -17, 0.15, 0.34, 0, (rnd() - 0.5) * 22, (rnd() - 0.5) * 22, (rnd() - 0.5) * 22, gy, rnd());
      });
    } else if (style === 'confetti') {
      const pal = [c, light, c, [1.5, 1.5, 1.5], c, an1];
      emitBody(KIND.quad, nS(70), (kind, i, px, py, pz, cx, cz, hh) => {
        const sp = 1.6 + rnd() * 3.6, cc = pal[i % pal.length], sz = 0.06 + rnd() * 0.06;
        shards.add(kind, px, py, pz, cx * sp + dx * 1.5, 3.5 + rnd() * 4.5, cz * sp + dz * 1.5, sz, sz * (1.4 + rnd()), 1, cc[0], cc[1], cc[2], 0.55, 3.4 + rnd() * 1.4, -5.5, 2.6, 0.1, 5.5, (rnd() - 0.5) * 16, (rnd() - 0.5) * 16, (rnd() - 0.5) * 16, gy, rnd());
      });
    } else if (style === 'pixelate') {
      const pal = [c, light, dark, mixLin(c, [1, 1, 1], 0.8)];
      emitBody(KIND.cube, nS(46), (kind, i, px, py, pz, cx, cz, hh) => {
        const sp = 1.3 + rnd() * 2.6, cc = pal[(rnd() * 4) | 0], sz = 0.085 + Math.floor(rnd() * 3) * 0.035;
        // snap spawn to a coarse 0.1 m grid so the burst reads as voxels
        shards.add(kind, Math.round(px * 10) / 10, Math.round(py * 10) / 10, Math.round(pz * 10) / 10, cx * sp + dx, 2 + rnd() * 4, cz * sp + dz, sz, sz, sz, cc[0], cc[1], cc[2], 0.6, 2.8 + rnd(), -14, 0.2, 0.55, 0, (rnd() - 0.5) * 4, (rnd() - 0.5) * 4, (rnd() - 0.5) * 4, gy, rnd());
      });
    } else if (style === 'petals') {
      const pal = [mixLin(c, [1, 0.85, 0.9], 0.55), mixLin(c, [1, 1, 1], 0.7), c, comp];
      emitBody(KIND.petal, nS(72), (kind, i, px, py, pz, cx, cz, hh) => {
        const sp = 1.0 + rnd() * 2.4, cc = pal[i & 3], sz = 0.12 + rnd() * 0.08;
        shards.add(kind, px, py, pz, cx * sp + dx * 0.8, 2 + rnd() * 3, cz * sp + dz * 0.8, sz * 0.8, sz * 1.3, sz, cc[0], cc[1], cc[2], 0.4, 4.4 + rnd() * 1.4, -1.8, 1.7, 0.05, 3.2, (rnd() - 0.5) * 5, (rnd() - 0.5) * 5, (rnd() - 0.5) * 5, gy, rnd());
      });
    } else if (style === 'stars') {
      const pal = [c, [1.7, 1.45, 0.6], light, [1.7, 1.45, 0.6]];
      emitBody(KIND.star, nS(30), (kind, i, px, py, pz, cx, cz, hh) => {
        const sp = 2 + rnd() * 3, cc = pal[i & 3], sz = 0.17 + rnd() * 0.12;
        shards.add(kind, px, py, pz, cx * sp + dx * 1.2, 3 + rnd() * 4, cz * sp + dz * 1.2, sz, sz, sz, cc[0], cc[1], cc[2], 0.7, 3 + rnd() * 1.2, -12, 0.25, 0.5, 0, (rnd() - 0.5) * 10, (rnd() - 0.5) * 10, (rnd() - 0.5) * 10, gy, rnd());
      });
    } else if (style === 'fireworks') {
      const top = y + 1.2;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094 + rnd(), r0 = 0.3, rx = x + Math.cos(a) * r0, rz = z + Math.sin(a) * r0;
        E.reset(); E.pos(rx, y, rz); E.vel(Math.cos(a) * 1.2, 9 + rnd() * 2, Math.sin(a) * 1.2); E.life = 0.42 + i * 0.1; E.g = -4; E.drag = 0.4; E.s0 = 0.05; E.s1 = 0.02; E.stretch = 0.11; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0;
        E.col(3, 3, 3, 1, c[0] * 2, c[1] * 2, c[2] * 2, 0); P.emit(now, E);
        const cc = i === 1 ? comp : i === 2 ? light : c;
        schedule(0.36 + i * 0.1, 0, rx + Math.cos(a) * 0.5, top + 1.5 + rnd() * 1.4, rz + Math.sin(a) * 0.5, cc[0], cc[1], cc[2]);
      }
      emitBody(KIND.star, nS(14), (kind, i, px, py, pz, cx, cz) => {
        const sp = 1.5 + rnd() * 2.5, cc = i & 1 ? c : light, sz = 0.14 + rnd() * 0.1;
        shards.add(kind, px, py, pz, cx * sp, 3 + rnd() * 3, cz * sp, sz, sz, sz, cc[0], cc[1], cc[2], 0.7, 2.6 + rnd(), -10, 0.25, 0.45, 0, (rnd() - 0.5) * 9, (rnd() - 0.5) * 9, (rnd() - 0.5) * 9, gy, rnd());
      });
    }
  }

  // ---- footsteps / landing / movement -----------------------------------------------------------------------------
  function surfaceAt(pos) { try { return ctx.map?.surfaceAt?.(pos) || 'stone'; } catch { return 'stone'; } }
  function footstepDust(pos, surface, speed = 6, o = {}) {
    if (!pos) return; const L = lod(pos.x, pos.y, pos.z); if (L <= 0.2) return;
    const key = SURFACE_ALIAS[surface || surfaceAt(pos)] || 'stone', S0 = SURFACES[key];
    if (key === 'glass' || key === 'metal' && speed < 6) return;
    const dust = surfCol[key].dust, k = Math.min(1, Math.max(0.25, (speed - 3) / 6));
    const n = P.n((key === 'sand' || key === 'grass' ? 3 : 2) * L);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, sp = (0.35 + rnd() * 0.8) * k;
      E.reset(); E.pos(pos.x + Math.cos(a) * 0.1, pos.y + 0.03, pos.z + Math.sin(a) * 0.1); E.vel(Math.cos(a) * sp, 0.25 + rnd() * 0.4, Math.sin(a) * sp);
      E.life = 0.5 + rnd() * 0.35; E.g = 0.15; E.drag = 3; E.s0 = 0.05; E.s1 = (0.16 + S0.puff * 0.25) * (0.6 + k * 0.6); E.shape = S.PUFF; E.fadeIn = 0.15; E.seed = rnd(); E.rot = rnd() * 6; E.spin = (rnd() - 0.5);
      E.col(dust[0], dust[1], dust[2], 0.16 * (0.5 + S0.dustA) * (0.5 + k), dust[0], dust[1], dust[2], 0); E.floor = pos.y + 0.01; P.emit(now, E);
    }
  }
  function landPuff(pos, speed, surface) {
    if (!pos) return; const L = lod(pos.x, pos.y, pos.z); if (L <= 0.2 || speed < 3) return;
    const key = SURFACE_ALIAS[surface || surfaceAt(pos)] || 'stone', S0 = SURFACES[key]; if (key === 'glass') return;
    const dust = surfCol[key].dust, k = Math.min(1.6, (speed - 2) / 8);
    const n = P.n((5 + k * 5) * L);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + rnd() * 0.5, sp = (1.2 + rnd() * 1.4) * (0.6 + k * 0.5);
      E.reset(); E.pos(pos.x + Math.cos(a) * 0.15, pos.y + 0.04, pos.z + Math.sin(a) * 0.15); E.vel(Math.cos(a) * sp, 0.25 + rnd() * 0.35, Math.sin(a) * sp);
      E.life = 0.55 + rnd() * 0.4; E.g = 0.12; E.drag = 3.6; E.s0 = 0.08; E.s1 = (0.3 + S0.puff * 0.3) * (0.7 + k * 0.4); E.shape = S.PUFF; E.fadeIn = 0.12; E.seed = rnd(); E.rot = rnd() * 6; E.spin = (rnd() - 0.5) * 0.7;
      E.col(dust[0], dust[1], dust[2], 0.22 + 0.15 * k, dust[0], dust[1], dust[2], 0); E.floor = pos.y + 0.01; P.emit(now, E);
    }
    rings.add(now, pos.x, pos.y + 0.02, pos.z, 0, 1, 0, 0.5, 0.15, 0.9 + k * 0.7, DECAL.PULSE, rnd(), 0.5, 0.55, 0.6, 0.32 * k);
    if (k > 0.7) decals.add(now, pos.x, pos.y + 0.01, pos.z, 0, 1, 0, 6, 0.5, 0.5, DECAL.SCORCH, rnd(), 0, 0, 0, 0, dust[0] * 0.25, dust[1] * 0.24, dust[2] * 0.22, 0.22 * k);
  }
  function slideSparks(pos, dir, o = {}) {
    if (!pos) return; const L = lod(pos.x, pos.y, pos.z); if (L <= 0.3) return; const c = lin(o.color ?? 0xffd070);
    const n = P.n(3 * L);
    for (let i = 0; i < n; i++) {
      const sp = 2 + rnd() * 3;
      E.reset(); E.pos(pos.x + (rnd() - 0.5) * 0.3, pos.y + 0.03, pos.z + (rnd() - 0.5) * 0.3); E.vel((dir ? -dir.x : 0) * sp * 0.8 + (rnd() - 0.5) * 2, 1 + rnd() * 2.2, (dir ? -dir.z : 0) * sp * 0.8 + (rnd() - 0.5) * 2);
      E.life = 0.2 + rnd() * 0.2; E.g = -10; E.drag = 0.5; E.s0 = 0.02; E.s1 = 0.01; E.stretch = 0.03; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.floor = pos.y + 0.01; E.col(1.5 + c[0] * 2.2, 1.2 + c[1] * 2, 0.6 + c[2], 1, 1.2, 0.35, 0.08, 0); P.emit(now, E);
    }
    if (rnd() < 0.5) footstepDust(pos, surfaceAt(pos), 8);
  }
  function jumpPad(pos, o = {}) {
    if (!pos) return; const c = lin(o.color ?? 0x66e0ff), x = pos.x, y = pos.y, z = pos.z;
    rings.add(now, x, y + 0.03, z, 0, 1, 0, 0.6, 0.3, 2.2, DECAL.PULSE, rnd(), c[0] * 2, c[1] * 2, c[2] * 2, 1);
    rings.add(now + 0.07, x, y + 0.03, z, 0, 1, 0, 0.7, 0.3, 3.2, DECAL.PULSE, rnd(), c[0] * 1.4, c[1] * 1.4, c[2] * 1.4, 0.7);
    const n = P.n(20);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, r = 0.2 + rnd() * 0.7;
      E.reset(); E.pos(x + Math.cos(a) * r, y + 0.05, z + Math.sin(a) * r); E.vel(Math.cos(a) * 0.8, 5 + rnd() * 6, Math.sin(a) * 0.8); E.life = 0.4 + rnd() * 0.3; E.g = -2; E.drag = 0.6; E.s0 = 0.04; E.s1 = 0.01; E.stretch = 0.09; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.col(1.5 + c[0] * 2, 1.5 + c[1] * 2, 1.5 + c[2] * 2, 1, c[0], c[1], c[2], 0); P.emit(now, E);
    }
    lightPulse(x, y + 0.4, z, c[0] + 0.2, c[1] + 0.2, c[2] + 0.2, 10, 6, 0.25);
  }

  // ---- utility effects --------------------------------------------------------------------------------------------
  /** Expanding light shock rings (Pulse utility). o: {radius, color, duration, height} */
  function pulse(pos, o = {}) {
    if (!pos) return; const R0 = o.radius ?? 6, c = lin(o.color ?? 0x8fe8ff), dur = o.duration ?? 0.9, gy = (pos.y ?? 0);
    const g = (o.floorY ?? gy) + 0.03;
    rings.add(now, pos.x, g, pos.z, 0, 1, 0, dur, 0.4, R0, DECAL.PULSE, rnd(), c[0] * 1.5 + 0.4, c[1] * 1.5 + 0.4, c[2] * 1.5 + 0.4, 1.1);
    rings.add(now + 0.09, pos.x, g, pos.z, 0, 1, 0, dur * 1.1, 0.4, R0 * 0.72, DECAL.PULSE, rnd(), c[0] + 0.3, c[1] + 0.3, c[2] + 0.3, 0.7);
    rings.add(now + 0.03, pos.x, g + 0.5, pos.z, 0, 1, 0, dur * 0.8, 0.3, R0 * 0.85, DECAL.PULSE, rnd(), 1, 1, 1, 0.35);
    const nS = P.n(36);
    for (let i = 0; i < nS; i++) {
      const a = (i / nS) * 6.283 + rnd() * 0.2, sp = R0 / dur * (0.8 + rnd() * 0.3) * 0.9;
      E.reset(); E.pos(pos.x, g + 0.05, pos.z); E.vel(Math.cos(a) * sp, 0.5 + rnd() * 1.5, Math.sin(a) * sp); E.life = dur * 0.8; E.g = -1; E.drag = 3.0; E.s0 = 0.05; E.s1 = 0.02; E.stretch = 0.05; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.floor = g; E.col(1.5 + c[0] * 2.2, 1.5 + c[1] * 2.2, 1.5 + c[2] * 2.2, 1, c[0], c[1], c[2], 0); P.emit(now, E);
    }
    E.reset(); E.pos(pos.x, g + 0.4, pos.z); E.life = 0.35; E.s0 = 0.8; E.s1 = R0 * 0.45; E.shape = S.GLOW; E.add = 1; E.fadeIn = 0; E.col(0.5 + c[0], 0.5 + c[1], 0.5 + c[2], 0.5, c[0], c[1], c[2], 0); P.emit(now, E);
    lightPulse(pos.x, g + 1, pos.z, c[0] + 0.3, c[1] + 0.3, c[2] + 0.3, 30, R0 * 1.5, 0.4);
    const d = distToCam(pos.x, pos.y, pos.z); if (d < R0 * 3) screen.run('pulse', { color: o.color ?? 0x8fe8ff, amount: 0.22 * Math.max(0, 1 - d / (R0 * 3)), shake: 0.35 * Math.max(0.2, 1 - d / (R0 * 3)) });
  }
  function strobe(pos, o = {}) {
    if (!pos) return; const c = lin(o.color ?? 0xffffff), y = pos.y;
    E.reset(); E.pos(pos.x, y, pos.z); E.life = 0.28; E.s0 = 1.2; E.s1 = 5.5; E.shape = S.GLOW; E.add = 1; E.fadeIn = 0; E.col(4, 4, 4, 1, 1.5, 1.6, 2, 0); P.emit(now, E);
    E.reset(); E.pos(pos.x, y, pos.z); E.life = 0.2; E.s0 = 1.0; E.s1 = 4.0; E.shape = S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd(); E.spin = 2; E.col(5, 5, 5, 1, 1, 1, 1, 0); P.emit(now, E);
    for (let i = 0; i < 3; i++) rings.add(now + i * 0.06, pos.x, y + 0.1, pos.z, 0, 1, 0, 0.6 + i * 0.15, 0.3, 5 + i * 3, DECAL.PULSE, rnd(), 2.2, 2.2, 2.4, 1 - i * 0.25);
    const n = P.n(30);
    for (let i = 0; i < n; i++) { const th = rnd() * 6.283, ph = Math.acos(2 * rnd() - 1), sp = 4 + rnd() * 8; E.reset(); E.pos(pos.x, y, pos.z); E.vel(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp); E.life = 0.3 + rnd() * 0.3; E.g = -4; E.drag = 1.2; E.s0 = 0.06; E.s1 = 0.01; E.stretch = 0.06; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.col(3.5, 3.5, 3.8, 1, 1.2, 1.3, 1.6, 0); P.emit(now, E); }
    lightPulse(pos.x, y + 0.5, pos.z, 1, 1, 1, 90, 24, 0.35);
  }
  /** Volumetric-looking smoke: a blob of large lit noise puffs. Returns a handle {fade(), pos, radius}. */
  function haze(pos, o = {}) {
    if (!pos) return null; const rad = o.radius ?? 4.5, dur = o.duration ?? 18, c = lin(o.color ?? 0xb9c6d4);
    const n = Math.round(46 * Math.max(0.5, q.dens));
    for (let i = 0; i < n; i++) {
      const th = rnd() * 6.283, ph = Math.acos(1 - rnd() * 1.6), rr = Math.cbrt(rnd()) * rad * 0.62;
      const dx = Math.sin(ph) * Math.cos(th), dy = Math.abs(Math.cos(ph)) * 0.75, dz = Math.sin(ph) * Math.sin(th);
      const sp = rr * 5.2, sz = rad * (0.6 + rnd() * 0.5);
      const v = 0.85 + rnd() * 0.25;
      E.reset(); E.pos(pos.x, pos.y + 0.4, pos.z); E.vel(dx * sp, dy * sp + 0.6, dz * sp); E.life = dur * (0.9 + rnd() * 0.15); E.g = 0.0; E.drag = 2.6; E.s0 = sz * 0.5; E.s1 = sz * 1.05; E.shape = S.SMOKE; E.add = 0; E.fadeIn = 0.5 / dur * 1.2; E.fadeOut = 0.78;
      E.seed = rnd(); E.rot = rnd() * 6; E.spin = (rnd() - 0.5) * 0.12; E.floor = pos.y + 0.05;
      E.col(c[0] * v, c[1] * v, c[2] * v, 0.62, c[0] * v, c[1] * v, c[2] * v, 0.62); PL.emit(now, E);
    }
    E.reset(); E.pos(pos.x, pos.y + 0.6, pos.z); E.life = 0.3; E.s0 = 0.5; E.s1 = rad * 1.4; E.shape = S.GLOW; E.add = 1; E.fadeIn = 0; E.col(1.2, 1.3, 1.4, 0.6, 0.5, 0.6, 0.7, 0); P.emit(now, E);
    rings.add(now, pos.x, pos.y + 0.03, pos.z, 0, 1, 0, 0.9, 0.3, rad * 1.5, DECAL.PULSE, rnd(), 0.6, 0.7, 0.8, 0.22);
    return { pos, radius: rad, born: now, life: dur };
  }

  // ---- hit feedback -----------------------------------------------------------------------------------------------
  function hitPing(point, o = {}) {
    if (!point) return; const crown = !!o.crown, c = lin(o.color ?? (crown ? 0xffe066 : 0xffffff)), k = crown ? 1.5 : 1;
    E.reset(); E.pos(point.x, point.y, point.z); E.life = crown ? 0.34 : 0.22; E.s0 = 0.1 * k; E.s1 = 0.5 * k; E.shape = S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd(); E.spin = 0.8; E.col(2.6 + c[0], 2.6 + c[1], 2.6 + c[2], 1, c[0], c[1], c[2], 0); P.emit(now, E);
    E.reset(); E.pos(point.x, point.y, point.z); E.life = crown ? 0.36 : 0.26; E.s0 = 0.1; E.s1 = 0.75 * k; E.shape = S.RING; E.add = 1; E.fadeIn = 0; E.col(2 * c[0], 2 * c[1], 2 * c[2], 0.9, c[0], c[1], c[2], 0); P.emit(now, E);
    const n = P.n(crown ? 12 : 7);
    for (let i = 0; i < n; i++) { const th = rnd() * 6.283, ph = Math.acos(2 * rnd() - 1), sp = (1.5 + rnd() * 3) * k; E.reset(); E.pos(point.x, point.y, point.z); E.vel(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp + 0.6, Math.sin(ph) * Math.sin(th) * sp); E.life = 0.3 + rnd() * 0.3; E.g = -4; E.drag = 1.3; E.s0 = 0.04; E.s1 = 0.01; E.stretch = 0.04; E.shape = S.STREAK; E.add = 1; E.fadeIn = 0; E.col(2.2 * (0.5 + c[0]), 2.2 * (0.5 + c[1]), 2.2 * (0.5 + c[2]), 1, c[0], c[1], c[2], 0); P.emit(now, E); }
  }

  // ---- events -------------------------------------------------------------------------------------------------------
  const off = [];
  const on = (ev, fn) => off.push(ctx.events.on(ev, fn));
  const _o = new THREE.Vector3(), _e = new THREE.Vector3(), _hp = new THREE.Vector3(), _hn = new THREE.Vector3();
  const isLocal = (a) => a && a === ctx.localActor;
  function autoFire(e) {
    const actor = e.actor; if (!actor) return;
    const look = taggerLook(e.tagger); if (look.style === 'none') return;
    const local = isLocal(actor) && !ctx.spectating;
    if (local) muzzleFlash('view', e.tagger); else muzzleFlash(actor, e.tagger, { dir: e.dir });
    if (e.hitscan === false || e.noTracer) return;
    const origin = e.origin || actor.eyePos(_o), dir = e.dir || actor.forward(_e);
    const hits = Array.isArray(e.hit) ? e.hit : e.hit?.point ? [e.hit] : Array.isArray(e.hitscan) ? e.hitscan : e.hitscan && typeof e.hitscan === 'object' ? [e.hitscan] : null;
    // tracer start: for the local player, just ahead/below/right of the eye so it reads as coming from the tagger
    if (local) { _mr.set(Math.cos(actor.yaw), 0, -Math.sin(actor.yaw)); _mp.copy(origin).addScaledVector(dir, 0.55).addScaledVector(_mr, 0.17).addScaledVector(UP, -0.14); } else muzzleWorld(actor, _mp);
    const tid = typeof e.tagger === 'string' ? e.tagger : e.tagger?.id; const col = ctx.combat?.taggers?.[tid]?.color ?? actorTint(actor);
    if (hits) {
      for (const h of hits) {
        const p = h.point || h.pos; if (!p) continue;
        tracer(_mp, p, col, look.style, { look });
        if (h.actor || h.victim) continue;                                        // tag on a body: tag:hit handles the ping
        impact(p, h.normal, h.surface || surfaceAt(p), { color: col });
      }
    } else if (e.end && Number.isFinite(e.end.x)) {                               // combat: impacts already spawned explicitly
      tracer(_mp, e.end, col, look.style, { look });
    } else if (e.hitscan === true || e.hitscan === undefined) {
      const h = ctx.map?.raycast?.(origin, dir, 300);
      if (h) { tracer(_mp, h.point, col, look.style, { look }); impact(h.point, h.normal, surfaceAt(h.point), { color: col }); }
      else { _e.copy(dir).multiplyScalar(90).add(origin); tracer(_mp, _e, col, look.style, { look }); }
    }
  }
  on('weapon:fire', (e) => { try { autoFire(e); } catch (err) { ctx.errors?.push('vfx fire: ' + (err?.stack || err)); } });
  on('tag:hit', (e) => {
    const p = e.point || e.victim?.pos; if (!p) return;
    const crown = e.hitgroup === 'crown' || e.hitgroup === 'head';
    const tcol = ctx.combat?.taggers?.[typeof e.tagger === 'string' ? e.tagger : e.tagger?.id]?.color ?? (e.attacker && TEAM_COL[e.attacker.team]);
    hitPing(p, { crown, color: crown ? 0xffe066 : (e.color ?? tcol ?? 0xffffff) });
    bodySpark(p.x, p.y, p.z, e.dir ? _hn.set(-e.dir.x, -e.dir.y, -e.dir.z) : null, { color: e.color ?? tcol });
    if (isLocal(e.attacker)) screen.run('hit', { amount: crown ? 0.07 : 0.03 });
    if (isLocal(e.victim)) ctx.render?.shake?.(0.12 + (e.damage || 10) / 300);
  });
  on('tag:out', (e) => {
    const v = e.victim; if (!v) return;
    if (ctx.characters?.handlesTagOut || (ctx.characters?.tagOut && !ctx.characters.__stub && v.model)) return;       // the avatars piece plays its own shatter on real models
    let style = v.cosmetics?.tagOutEffect;
    try { style = ctx.cosmetics?.resolve?.(v.cosmetics)?.tagOutEffect || style; } catch { /* stub */ }
    _hp.set(v.pos.x, v.pos.y + (v.height || 1.8) * 0.55, v.pos.z);
    let dir = e.dir; if (!dir && e.attacker) dir = _hn.set(v.pos.x - e.attacker.pos.x, 0, v.pos.z - e.attacker.pos.z);
    burstShards(_hp, TEAM_COL[v.team] ?? 0xffffff, style || 'shatter', { dir });
  });
  const onShatter = (e) => {                                                // avatars owns shards; we add a small flash + light + sparkles only (no floor rings)
    const p = e?.point; if (!p) return; const c = lin(e.color ?? 0xffffff);
    E.reset(); E.pos(p.x, p.y, p.z); E.life = 0.16; E.s0 = 0.4; E.s1 = 1.0; E.shape = S.STAR; E.add = 1; E.fadeIn = 0; E.rot = rnd(); E.col(1.6 + c[0], 1.6 + c[1], 1.6 + c[2], 0.9, c[0], c[1], c[2], 0); P.emit(now, E);
    lightPulse(p.x, p.y + 0.3, p.z, c[0] + 0.2, c[1] + 0.2, c[2] + 0.2, 12, 8, 0.28);
    sparkleBurst(p.x, p.y, p.z, c[0], c[1], c[2], 14, 0.8);
  };
  on('character:shatter', onShatter); on('character:shattered', onShatter);
  on('footstep', (e) => { if (!e.pos || e.crouch || e.walk) return; if ((e.speed ?? 6) < 3.8) return; footstepDust(e.pos, e.surface, e.speed); });
  on('land', (e) => { const a = e.actor; if (a) landPuff(a.pos, e.speed ?? 6, surfaceAt(a.pos)); });
  on('jump', (e) => { const a = e.actor; if (a && a.pos) footstepDust(a.pos, surfaceAt(a.pos), 8); });
  on('slide', (e) => { const a = e.actor; if (a) slideSparks(a.pos, a.vel && a.vel.lengthSq() > 0.01 ? _e.copy(a.vel).setY(0).normalize() : null); });
  on('jumppad', (e) => jumpPad(e.pos || e.actor?.pos, e));
  on('util:detonate', (e) => {
    const p = e.pos; if (!p) return;
    if (!api.autoUtility()) return;
    if (e.type === 'pulse') pulse(p, { radius: e.radius });
    else if (e.type === 'strobe') strobe(p);
    else if (e.type === 'haze' && api.autoHaze) haze(p, { radius: e.radius, duration: e.duration });
  });
  on('util:blind', (e) => { if (api.autoUtility() && isLocal(e.actor) && (e.amount ?? 1) > 0.05) screen.whiteout(Math.min(4, 0.4 + (e.amount ?? 1) * 2.4)); });
  on('ping', (e) => { if (e.pos) { rings.add(now, e.pos.x, e.pos.y + 0.05, e.pos.z, 0, 1, 0, 1.2, 0.3, 1.6, DECAL.BEACON, rnd(), 1.8, 1.8, 0.8, 1); glint(e.pos.x, e.pos.y + 0.6, e.pos.z, 0.5, 1, 0.9, 0.4); } });
  const beaconEvent = (state) => (e) => {
    if (ctx.match?.beacon && ctx.match.beacon.pos) return;                          // polled instead
    const pos = e?.pos || ctx.map?.sites?.[e?.site]?.center || e?.actor?.pos; if (!pos) return;
    beacon.show(pos, state);
  };
  on('beacon:drop', beaconEvent('dropped')); on('beacon:arm', beaconEvent('arming')); on('beacon:armed', beaconEvent('armed'));
  on('beacon:disarm', beaconEvent('disarming')); on('beacon:complete', beaconEvent('complete')); on('beacon:pickup', () => { if (!ctx.match?.beacon?.pos) beacon.hide(); });
  on('round:phase', (e) => { if (e?.phase === 'buy' || e?.phase === 'freeze') { api.clear(); } });
  on('settings:change', (e) => { if (e?.key === 'quality') setQuality(e.value); });

  // ---- frame update -------------------------------------------------------------------------------------------------
  const flushAll = () => {
    P.flush(); PL.flush(); PV?.flush(); decals.flush(); rings.flush(); tracers.update(R.camera, R.renderer?.domElement?.height || 720);
  };
  // Upload freshly spawned rows right before any render of the scene (works with composers / patched render() too):
  // Scene.onBeforeRender runs at the start of renderer.render(scene, camera), before draw lists are built.
  const prevSceneHook = scene.onBeforeRender, prevViewHook = viewScene?.onBeforeRender;
  scene.onBeforeRender = function (...a) { flushAll(); return prevSceneHook?.apply(this, a); };
  if (viewScene) viewScene.onBeforeRender = function (...a) { PV?.flush(); return prevViewHook?.apply(this, a); };

  // Compile every vfx program up-front so the first shot / tag-out does not hitch on shader compilation.
  function prewarm() {
    try {
      const saved = [];
      for (const K of shards.kinds) { saved.push([K.mesh, K.mesh.visible, K.mesh.count]); K.mesh.visible = true; K.mesh.count = 1; }
      for (const pl of [decals.pool, rings.pool, tracers.pool]) { saved.push([pl.mesh, pl.mesh.visible, 0]); pl.mesh.visible = true; }
      saved.push([beacon.group, beacon.group.visible, 0]); beacon.group.visible = true; saved.push([ambient.mesh, ambient.mesh.visible, 0]); ambient.mesh.visible = true;
      R.renderer?.compile?.(scene, R.camera);
      if (viewScene && R.viewCamera) R.renderer?.compile?.(viewScene, R.viewCamera);
      for (const [o, v, c] of saved) { o.visible = v; if (o.isInstancedMesh) o.count = c; }
    } catch (e) { /* optional */ }
  }
  on('boot:done', prewarm);
  let lastQ = null;
  function update(dt) {
    dtLast = dt; now += dt; time.value = now;
    if (R.quality && R.quality !== lastQ) { lastQ = R.quality; setQuality(R.quality); }
    if (R.sunDir) sunDir.value.copy(R.sunDir);
    // pending fireworks bursts
    for (const p of pend) if (p.on && now >= p.t) { p.on = false; firework(p.x, p.y, p.z, p.r, p.g, p.b); }
    shards.update(dt, now, cam);
    // light envelopes
    for (const l of lights) { if (l.t < l.life) { l.t += dt; const k = Math.max(0, 1 - l.t / l.life); l.light.intensity = l.peak * k * k; } else if (l.light.intensity !== 0) l.light.intensity = 0; }
    if (vmLight) { if (vmL.t < vmL.life) { vmL.t += dt; const k = Math.max(0, 1 - vmL.t / vmL.life); vmLight.intensity = vmL.peak * k; } else vmLight.intensity = 0; }
    ambient.update(cam, sunDir.value);
    beacon.update(dt, cam);
    screen.update(dt);
    // near-fade distance follows fov so wide fovs don't clip
    nearFade.value = 1.0;
  }

  // ---- public API ---------------------------------------------------------------------------------------------------
  const api = {
    particles: P, longParticles: PL, viewParticles: PV, decals, rings, tracers, ambient, beacon, screenFx: screen,
    spec: () => new Spec(), get now() { return now; }, SHAPE, DECAL, autoHaze: true, fpFlash: 'auto', characterDriven: true, autoUtility: () => { const u = ctx.combat?.utility; return !u || u.__stub || u.selfFx === false; }, lightPulse, glint, sparkleBurst,
    tracer(from, to, color, style, o) {
      if (o == null && typeof style === 'object' && style) { o = style; style = o.style; }
      // combat passes the tagger id as `style` (e.g. 'arc'): resolve to that tagger's look
      let look = o?.look || (o?.tagger ? taggerLook(o.tagger) : undefined);
      if (typeof style === 'string' && TAGGER_TRACER[style] && !(style in STYLE_ID)) { look = TAGGER_TRACER[style]; style = look.style; }
      if (look?.style === 'none') return;
      tracer(from, to, color ?? 0xffffff, style ?? look?.style ?? 'beam', look ? { ...o, look } : o);
    },
    impact, decal: (point, normal, o = {}) => decals.add(now, point.x, point.y, point.z, normal?.x ?? 0, normal?.y ?? 1, normal?.z ?? 0, o.life ?? 10, o.size ?? 0.2, o.size ?? 0.2, o.kind ?? DECAL.IMPACT, rnd(), ...(o.glow || [1.6, 1.6, 1.6, 0.8]), ...(o.body || [0.05, 0.05, 0.05, 0.6])),
    muzzleFlash, pulse, strobe, haze, hitPing, footstepDust, landPuff, slideSparks, jumpPad,
    screen: (name, params) => screen.run(name, params),
    setQuality, get quality() { return qName; },
    fixedUpdate() {}, update,
    clear() { P.clear(); PL.clear(); PV?.clear(); decals.clear(); rings.clear(); tracers.clear(); shards.clear(); for (const p of pend) p.on = false; for (const l of lights) { l.t = l.life; l.light.intensity = 0; } },
    dispose() { off.forEach((f) => f()); scene.onBeforeRender = prevSceneHook; if (viewScene) viewScene.onBeforeRender = prevViewHook; root.parent?.remove(root); },
  };
  api.shardSystem = shards; api.shards = burstShards; api.haze = haze;
  api.debug = {
    stats() { return { alive: P.alive(now), aliveLong: PL.alive(now), spawned: P.spawned, shards: shards.active, tracers: tracers.count, drawCalls: R.info?.()?.calls, quality: qName }; },
    hooks: { flushAll },
  };
  setQuality(R.quality || ctx.settings?.get?.('quality') || 'high');
  registerLab(ctx, api, { E: Ev });
  return api;
}
