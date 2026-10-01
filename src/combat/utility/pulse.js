import * as THREE from 'three';
import { PULSE as P } from './config.js';
import { makeBillboard, FLARE, RING } from './fx.js';
import { mulberry32 } from '../../core/rng.js';
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _c = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();

const DOME_VERT = /* glsl */`
varying vec3 vN; varying vec3 vWN; varying vec3 vV;
void main(){ vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vWN = normalize(mat3(modelMatrix) * vN); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const DOME_FRAG = /* glsl */`
uniform float uT, uAlpha, uTime; uniform vec3 uColA, uColB;
varying vec3 vN; varying vec3 vWN; varying vec3 vV;
float hexDist(vec2 p){ p = abs(p); float c = dot(p, normalize(vec2(1.0, 1.7320508))); return max(c, p.x); }
float hexEdge(vec2 uv){ vec2 r = vec2(1.0, 1.7320508), h = r * 0.5; vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h; vec2 gv = dot(a,a) < dot(b,b) ? a : b; return 0.5 - hexDist(gv); }
void main(){
  float fres = pow(1.0 - abs(dot(normalize(vWN), normalize(vV))), 2.0);
  vec2 q = vec2(atan(vN.z, vN.x) * 4.2, vN.y * 6.5 + uTime * 0.4);
  float he = hexEdge(q); float lines = 1.0 - smoothstep(0.015, 0.075, he);
  float ripple = 0.5 + 0.5 * sin(vN.y * 16.0 - uT * 24.0 + sin(atan(vN.z, vN.x) * 5.0) * 1.3);
  float shell = 0.05 + fres * 1.25;
  float a = (shell + lines * (0.35 + fres) + ripple * 0.08) * uAlpha;
  vec3 col = mix(uColA, uColB, clamp(fres * 1.1 + lines * 0.3, 0.0, 1.0));
  gl_FragColor = vec4(col * a, 1.0);
  #include <colorspace_fragment>
}`;
const RING_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = /* glsl */`
uniform float uProg, uAlpha, uT; uniform vec3 uCol; varying vec2 vUv;
float ring(float r, float c, float w){ float d = (r - c) / w; return exp(-d * d); }
void main(){
  float r = length(vUv); if (r > 1.0) discard;
  float lead = ring(r, uProg, 0.028 + 0.02 * uT) * 1.7;
  float trail = smoothstep(uProg - 0.42, uProg, r) * step(r, uProg) * 0.42;
  float e2 = ring(r, uProg * 0.72, 0.02) * 0.8, e3 = ring(r, uProg * 0.46, 0.016) * 0.5;
  float a = (lead + trail + e2 + e3) * uAlpha * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(uCol * a, 1.0);
  #include <colorspace_fragment>
}`;

/** Pulse (frag analogue): expanding shockwave dome + ground ring, partial Charge drain with falloff/armor, soft knock, camera shake. */
export function createPulse(ctx, W, deps) {
  const { sparks, haze, time, grenades } = deps;
  const domeGeo = new THREE.IcosahedronGeometry(1, 4);
  const ringGeo = new THREE.PlaneGeometry(2, 2); ringGeo.rotateX(-Math.PI / 2);
  const active = [], pool = []; let n = 0;
  const mkDome = (uAlpha) => new THREE.Mesh(domeGeo, new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uT: { value: 0 }, uAlpha: { value: uAlpha }, uTime: { value: 0 }, uColA: { value: new THREE.Color(0.55, 0.95, 1.0) }, uColB: { value: new THREE.Color(0.95, 0.55, 1.0) } } }));
  const mk = () => {
    const dome = mkDome(1), dome2 = mkDome(0.6); dome.renderOrder = dome2.renderOrder = 82; dome.frustumCulled = dome2.frustumCulled = false;
    const ring = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { uProg: { value: 0 }, uAlpha: { value: 1 }, uT: { value: 0 }, uCol: { value: new THREE.Color(0.7, 0.95, 1.0) } } })); ring.renderOrder = 82; ring.frustumCulled = false;
    return { dome, dome2, ring, flare: makeBillboard(FLARE), bill: makeBillboard(RING), t: 0, pos: new THREE.Vector3(), floor: 0, busy: false };
  };
  const all = (b) => [b.dome, b.dome2, b.ring, b.flare, b.bill];

  function friendly(a, b) { return a && b && a !== b && a.team === b.team; }
  function hitActor(victim, dmg, dir, point, thrower) {
    const payload = { attacker: thrower, victim, damage: dmg, hitgroup: 'chest', point, dir, tagger: 'pulse', utility: true, wallbang: false, through: false, armorAbsorbed: 0 };
    const ct = ctx.combat;
    if (ct && !ct.__stub && typeof ct.applyTag === 'function') { try { ct.applyTag(payload); return; } catch (e) { console.warn('[utility] applyTag failed, using fallback', e); } }
    // fallback: same numbers as the tagger model (armor absorbs 50%)
    let d = dmg;
    if (victim.armor > 0) { const ab = d * P.armorAbsorb; victim.armor = Math.max(0, victim.armor - ab * 0.5); d -= ab; payload.armorAbsorbed = ab; }
    victim.hp = Math.max(0, victim.hp - d); victim.lastDamagedBy = thrower; payload.damage = d;
    if (thrower?.stats) thrower.stats.damage += d;
    ctx.events.emit('tag:hit', payload);
    if (victim.hp <= 0 && victim.alive) { victim.alive = false; victim.tagged = true; ctx.events.emit('tag:out', { attacker: thrower, victim, tagger: 'pulse', hitgroup: 'chest', assist: null, wallbang: false, through: false }); }
  }

  /** Damage/knock model for one actor. Pure query used by tests: returns {damage, knock, falloff, los}. */
  function evaluate(pos, a) {
    if (!a.alive) return null;
    _c.set(a.pos.x, a.pos.y + (a.crouching ? 0.6 : 0.95), a.pos.z); _d.subVectors(_c, pos); const dist = _d.length(); if (dist > P.radius) return null;
    // line of sight to chest / head / feet: best of three (partial cover still hurts a little)
    let vis = 0; _t.set(a.pos.x, a.pos.y + 0.25, a.pos.z);
    _e.copy(pos); _e.y += 0.25;
    for (const y of [0.25, a.crouching ? 0.6 : 0.95, a.crouching ? 1.05 : 1.55]) { _t.set(a.pos.x, a.pos.y + y, a.pos.z); if (!W.segmentBlocked(_e, _t)) vis += 1 / 3; }
    if (vis <= 0) return null;
    const fall = Math.pow(1 - dist / P.radius, P.falloffPow);
    return { dist, falloff: fall, vis, damage: P.maxDamage * fall * (0.4 + 0.6 * vis), dirX: _d.x, dirY: _d.y, dirZ: _d.z };
  }

  return {
    evaluate,
    detonate(pos, thrower) {
      const t = time(); const rnd = mulberry32(5000 + (n++) * 104729 + Math.round(pos.x * 13 + pos.z * 7));
      // ------ gameplay
      for (const a of ctx.actors) {
        const r = evaluate(pos, a);
        // camera shake for anyone nearby (even behind cover, softened)
        if (a === ctx.localActor) { _c.set(a.pos.x, a.pos.y + 1, a.pos.z); const d = _c.distanceTo(pos); const s = Math.pow(Math.max(0, 1 - d / P.shakeRadius), 1.6) * (r ? 1 : 0.45); if (s > 0.01) ctx.render?.shake?.(0.5 + 1.3 * s, 4.5); }
        if (!r) continue;
        let dmg = r.damage; const self = a === thrower;
        if (!self && friendly(thrower, a)) dmg = 0; else if (self) dmg *= 0.6;
        const dl = Math.hypot(r.dirX, r.dirZ) || 1;
        // soft knock: away from the centre, small upward kick, decays with falloff
        const kn = P.knock * Math.pow(r.falloff, 0.8) * (0.35 + 0.65 * r.vis);
        a.vel.x += r.dirX / dl * kn; a.vel.z += r.dirZ / dl * kn; if (kn > 0.4) a.vel.y = Math.max(a.vel.y, P.knockUp * Math.sqrt(r.falloff)); a.onGround = a.onGround && kn < 0.4;
        a.stagger = { t0: t, until: t + 0.18 + 0.55 * r.falloff, amount: Math.min(1, r.falloff * 1.3), by: thrower };
        _t.set(a.pos.x, a.pos.y + 1.0, a.pos.z);
        if (dmg >= 0.5) hitActor(a, Math.round(dmg * 10) / 10, _d.set(r.dirX, r.dirY, r.dirZ).normalize().clone(), _t.clone(), thrower);
        ctx.events.emit('util:pulse:hit', { actor: a, damage: dmg, falloff: r.falloff, thrower });
      }
      grenades?.knock?.(pos, P.radius * 0.8, 7);
      haze?.disturb?.(pos, P.radius * 0.72, 1, 3.4);
      ctx.audio?.play?.('util.pulse.boom', { pos: pos.clone(), gain: 1 });
      // ------ visuals
      const b = pool.pop() || mk(); b.busy = true; b.t = 0; b.pos.copy(pos);
      // floor height under the blast for the ground ring
      _t.copy(pos); _d.set(0, -1, 0); const o = { dist: 0, normal: new THREE.Vector3() }; b.floor = W.raycast(_t, _d, 3, o) ? pos.y - o.dist + 0.04 : pos.y - 0.1;
      const sc = ctx.render?.scene; for (const m of all(b)) { sc?.add(m); m.visible = true; }
      b.flare.material.uniforms.uSeed.value = rnd() * 6; active.push(b);
      for (let i = 0; i < 40; i++) { const az = rnd() * 6.283, sp = 3 + rnd() * 7, up = rnd() * 3 + 0.5; const k = rnd(); sparks.emit(pos.x, pos.y + 0.15, pos.z, Math.cos(az) * sp, up, Math.sin(az) * sp, 0.6 + rnd() * 0.7, 0.045 + rnd() * 0.04, 0.5 + 0.4 * k, 0.85, 1.0, 3, 1.4); }
      for (let i = 0; i < 24; i++) { const az = rnd() * 6.283, sp = 0.6 + rnd() * 1.6; sparks.emit(pos.x + Math.cos(az) * 1.5, b.floor, pos.z + Math.sin(az) * 1.5, Math.cos(az) * sp, 1.4 + rnd() * 2.2, Math.sin(az) * sp, 0.8 + rnd() * 0.8, 0.035, 0.85, 0.7, 1.0, -0.5, 0.8); }
      deps.light?.(pos, 0x9fe8ff, 60, 22, 0.6);
      deps.glow?.(pos, 0.55, 0.9, 1.0, 1.0, 0.8);
    },
    update(dt) {
      for (let i = active.length - 1; i >= 0; i--) {
        const b = active[i]; b.t += dt; const t = b.t, u = Math.min(1, t / P.expandTime), R = P.radius * (1 - Math.pow(1 - u, 3.2));
        const fade = t < P.expandTime ? 1 : Math.pow(Math.max(0, 1 - (t - P.expandTime) / 0.75), 1.6);
        const d = b.dome, d2 = b.dome2;
        d.position.copy(b.pos); d.scale.setScalar(Math.max(0.01, R)); d.material.uniforms.uT.value = u; d.material.uniforms.uAlpha.value = 1.3 * fade * (1 - 0.55 * u); d.material.uniforms.uTime.value = t;
        const R2 = P.radius * (1 - Math.pow(1 - Math.max(0, u - 0.1) / 0.9, 3)) * 0.62; d2.position.copy(b.pos); d2.scale.setScalar(Math.max(0.01, R2)); d2.material.uniforms.uT.value = u; d2.material.uniforms.uAlpha.value = 0.9 * fade * (1 - u); d2.material.uniforms.uTime.value = t + 3;
        b.ring.position.set(b.pos.x, b.floor, b.pos.z); b.ring.scale.set(P.radius, 1, P.radius); const ru = b.ring.material.uniforms; ru.uProg.value = Math.max(0.001, R / P.radius); ru.uT.value = u; ru.uAlpha.value = 2.4 * fade;
        const fl = b.flare.material.uniforms; fl.uPosSize.value.set(b.pos.x, b.pos.y + 0.1, b.pos.z, 0.6 + 2.6 * (1 - Math.exp(-t * 20))); fl.uAlpha.value = 3.2 * Math.exp(-t * 9); fl.uColor.value.setRGB(0.8, 0.95, 1);
        const bl = b.bill.material.uniforms; bl.uPosSize.value.set(b.pos.x, b.pos.y + 0.1, b.pos.z, 0.3 + P.radius * 0.9 * (1 - Math.pow(1 - u, 3))); bl.uT.value = u; bl.uAlpha.value = 1.4 * (1 - u) * (u < 1 ? 1 : 0); bl.uColor.value.setRGB(0.6, 0.9, 1);
        if (t > P.expandTime + 0.8) { for (const m of all(b)) { m.visible = false; m.parent?.remove(m); } b.busy = false; pool.push(b); active.splice(i, 1); }
      }
    },
    active: () => active.length,
    dispose() { for (const b of active) for (const m of all(b)) m.parent?.remove(m); active.length = 0; },
  };
}
