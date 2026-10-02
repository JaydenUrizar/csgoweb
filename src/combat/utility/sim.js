import * as THREE from 'three';
import { G, GRENADE as C } from './config.js';
// Deterministic grenade integrator: fixed sub-steps (<= 0.8 radius each) + closest-point depenetration against the map BVH.
// Because the centre never moves more than 0.8*radius per sub-step, no surface can be skipped (no tunnelling), and edge/corner/stair
// contacts fall out of the closest-point normal for free.
const _n = new THREE.Vector3(), _vt = new THREE.Vector3(), _d = new THREE.Vector3(), _seg = new THREE.Vector3();
const SURF = { stone: [0.45, 0.80], metal: [0.55, 0.85], wood: [0.40, 0.78], glass: [0.5, 0.85], sand: [0.16, 0.55], rubber: [0.6, 0.7], grass: [0.25, 0.6], tile: [0.5, 0.82] };

export function makeGrenade() {
  return { pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), spinAxis: new THREE.Vector3(0, 0, 1), spin: 0, q: new THREE.Quaternion(), age: 0, restT: 0, rest: false, contact: false, contactN: new THREE.Vector3(0, 1, 0), bounces: 0, lastBounceT: -1, impact: 0, impactPos: new THREE.Vector3(), thrower: null, ignoreThrower: 0, ox: 0, oz: 0 };
}

/** Advance one fixed tick. Returns impact speed (>0) if a bounce happened this tick. ev(type,g,speed) optional callback. */
export function stepGrenade(g, dt, W, actors, onBounce) {
  if (g.rest) return 0;
  g.prev.copy(g.pos); g.age += dt; g.impact = 0; g.contact = false;
  const R = C.radius, sp = g.vel.length();
  const n = Math.min(10, Math.max(1, Math.ceil(sp * dt / C.maxSubstep))), h = dt / n;
  let maxImpact = 0;
  for (let s = 0; s < n; s++) {
    g.vel.y -= G * h;
    g.pos.addScaledVector(g.vel, h);
    for (let it = 0; it < 3; it++) {
      if (!W.pushOut(g.pos, R, _n)) break;
      const vn = g.vel.dot(_n);
      g.contact = true; g.contactN.copy(_n);
      if (vn < 0) {
        const surf = SURF[W.surface(g.pos)] || SURF.stone;
        if (-vn > C.restSpeed) {   // bounce
          const e = surf[0];
          _vt.copy(g.vel).addScaledVector(_n, -vn);                // tangential part
          g.vel.copy(_vt).multiplyScalar(surf[1]).addScaledVector(_n, -vn * e);
          if (-vn > maxImpact) { maxImpact = -vn; g.impactPos.copy(g.pos); }
          g.bounces++;
          // spin follows the new tangential motion
          _d.crossVectors(_n, g.vel); if (_d.lengthSq() > 1e-6) { g.spinAxis.copy(_d).normalize(); g.spin = Math.min(30, g.vel.length() / R * 0.7); }
        } else {                    // resting contact: cancel the normal component
          g.vel.addScaledVector(_n, -vn);
        }
      }
    }
    if (actors) actorCollide(g, actors);
  }
  if (maxImpact > 0.6) { g.impact = maxImpact; if (g.age - g.lastBounceT > 0.05) { g.lastBounceT = g.age; onBounce?.(g, maxImpact); } }
  if (g.contact) {
    // rolling resistance on walkable ground, low friction on steep slopes
    const ny = g.contactN.y;
    if (ny > 0.05) {
      _vt.copy(g.vel).addScaledVector(g.contactN, -g.vel.dot(g.contactN));
      const v = _vt.length();
      if (v > 1e-4) {
        const fr = (ny > C.slopeWalkable ? C.rollFriction : 0.6) * dt; const k = Math.max(0, v - fr) / v; g.vel.addScaledVector(_vt, k - 1);
        g.spinAxis.crossVectors(g.contactN, _vt).normalize(); g.spin = (v * k) / R * 0.9;
      }
      if (ny > C.slopeWalkable && g.vel.lengthSq() < C.stopSpeed * C.stopSpeed) { g.restT += dt; if (g.restT > C.stopTime) { g.rest = true; g.vel.set(0, 0, 0); g.spin = 0; } } else g.restT = 0;
    } else g.restT = 0;
  } else { g.restT = 0; }
  // orientation
  if (g.spin > 1e-3) { _d.copy(g.spinAxis); if (_d.lengthSq() > 0) g.q.premultiply(_q.setFromAxisAngle(_d, g.spin * dt)); }
  return maxImpact;
}
const _q = new THREE.Quaternion();

function actorCollide(g, actors) {
  const R = C.radius, ar = 0.36;
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i]; if (!a.alive) continue;
    if (a === g.thrower && g.age < 0.3) continue;
    if (g.age < 0.35 && Math.hypot(a.pos.x - g.ox, a.pos.z - g.oz) < 0.85) continue;   // the thrower (or whoever stands at the release point)
    const dx = g.pos.x - a.pos.x, dz = g.pos.z - a.pos.z; if (dx * dx + dz * dz > (ar + R) * (ar + R)) continue;
    const top = a.pos.y + (a.crouching ? 1.25 : 1.8); if (g.pos.y < a.pos.y - R || g.pos.y > top + R) continue;
    const d = Math.sqrt(dx * dx + dz * dz) || 1e-4;
    _n.set(dx / d, 0, dz / d); g.pos.x = a.pos.x + _n.x * (ar + R); g.pos.z = a.pos.z + _n.z * (ar + R);
    const vn = g.vel.x * _n.x + g.vel.z * _n.z;
    if (vn < 0) { g.vel.x -= _n.x * vn * 1.35; g.vel.z -= _n.z * vn * 1.35; }
  }
}
