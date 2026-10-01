import * as THREE from 'three';
import { DECAL } from './decals.js';

// Beacon FX: holographic column + rotating core + base rings + expanding pulse rings + armed alarm cadence.
// Driven automatically from ctx.match.beacon (polled) and one-shot events, or manually via ctx.vfx.beacon.show/hide/…

const COLS = {
  dropped: [0.75, 0.95, 1.0], carried: [0.75, 0.95, 1.0], arming: [1.0, 0.55, 0.16], armed: [1.0, 0.16, 0.08],
  disarming: [0.15, 0.85, 1.0], disarmed: [0.25, 0.9, 0.7], complete: [1.0, 0.85, 0.5],
};

const VERT = /* glsl */`
varying vec3 vN; varying vec3 vV; varying float vY; varying vec2 vUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
  vY = position.y + 0.5; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = /* glsl */`
uniform float uTime, uAlpha, uPulse, uFill;
uniform vec3 uCol;
varying vec3 vN; varying vec3 vV; varying float vY; varying vec2 vUv;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
  float scan = 0.65 + 0.35 * sin(vY * 140.0 - uTime * 4.0);
  float bands = 0.5 + 0.5 * sin(vY * 9.0 - uTime * 1.6);
  float seg = step(0.5, fract(vUv.x * 12.0 + uTime * 0.05));
  float fill = 1.0 - smoothstep(uFill - 0.02, uFill + 0.02, vY);
  float bot = smoothstep(0.0, 0.06, vY), top = 1.0 - smoothstep(0.6, 1.0, vY);
  float a = (0.08 + fres * 0.9) * scan * bot * top * (0.75 + 0.25 * bands) * (0.85 + 0.15 * seg);
  a *= mix(0.45, 1.0, fill);
  a += uPulse * 0.6 * bot * top * (0.4 + fres);
  vec3 c = uCol * (1.0 + uPulse * 1.5);
  gl_FragColor = vec4(c * a * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createBeacon(ctx, host) {
  const group = new THREE.Group(); group.visible = false; group.name = 'vfx-beacon';
  const uniforms = { uTime: host.time, uAlpha: { value: 0 }, uPulse: { value: 0 }, uFill: { value: 1 }, uCol: { value: new THREE.Color(1, 1, 1) } };
  const H = 7.5;
  const colGeo = new THREE.CylinderGeometry(0.42, 0.55, H, 28, 1, true); colGeo.translate(0, H / 2, 0);
  const colMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const column = new THREE.Mesh(colGeo, colMat); column.frustumCulled = false; column.renderOrder = 12;
  group.add(column);

  const S = { state: 'none', target: 'none', col: new THREE.Color(1, 1, 1), tcol: new THREE.Color(1, 1, 1), alpha: 0, talpha: 0, prog: 0, fuse: 35, fuseLeft: 35, pulseT: 0, pulse: 0, x: 0, y: 0, z: 0, auto: true, seen: false, lastState: '' };
  const rc = [1, 1, 1];

  function setState(state, o = {}) {
    if (state === S.state && !o.force) return;
    const prev = S.state; S.state = state;
    const c = COLS[state] || COLS.dropped; S.tcol.setRGB(c[0], c[1], c[2]);
    S.talpha = state === 'carried' || state === 'none' || state === 'disarmed' ? 0 : 1;
    group.visible = S.talpha > 0 || S.alpha > 0.01;
    if (state === 'armed' && prev !== 'armed') { S.pulseT = 0; burst(1.0); }
    if (state === 'disarmed' && prev !== 'disarmed') burst(0.8, true);
    if (state === 'complete') { bigBlast(); }
  }
  function ring(size1, life, r, g, b, a, kind = DECAL.BEACON) {
    host.decals.add(host.now(), S.x, S.y + 0.03, S.z, 0, 1, 0, life, 0.35, size1, kind, host.rand(), r, g, b, a);
  }
  function burst(power = 1, calm = false) {
    const c = S.tcol; ring(6 * power, 0.9, c.r, c.g, c.b, 1.2, DECAL.PULSE); ring(3.6 * power, 0.7, 1, 1, 1, 0.8, DECAL.PULSE);
    S.pulse = 1; host.lightPulse(S.x, S.y + 1.5, S.z, c.r, c.g, c.b, calm ? 5 : 9, 9 * power, 0.35);
    host.sparkleBurst(S.x, S.y + 0.3, S.z, c.r, c.g, c.b, calm ? 12 : 22, power);
  }
  function bigBlast() {
    const c = S.tcol; for (let i = 0; i < 4; i++) host.decals.add(host.now() + i * 0.12, S.x, S.y + 0.03, S.z, 0, 1, 0, 1.4, 0.5, 14 + i * 5, DECAL.PULSE, host.rand(), c.r * 1.4, c.g * 1.3, c.b * 1.1, 1.2);
    host.lightPulse(S.x, S.y + 2, S.z, 1, 0.85, 0.55, 40, 30, 0.8); host.sparkleBurst(S.x, S.y + 0.5, S.z, 1, 0.8, 0.4, 60, 2);
    host.screen?.run('pulse', { color: 0xffe0a0, amount: 0.45, shake: 0.6 }); S.pulse = 1.5;
  }

  const api = {
    group, get state() { return S.state; },
    show(pos, state = 'dropped', o = {}) { S.x = pos.x; S.y = pos.y; S.z = pos.z; group.position.set(pos.x, pos.y, pos.z); if (o.fuse) S.fuse = o.fuse; setState(state, o); },
    setState, setProgress(p) { S.prog = p; }, setFuse(left, total) { S.fuseLeft = left; if (total) S.fuse = total; },
    hide() { setState('none'); },
    pulse(color = 0xffffff, size = 5) { const c = new THREE.Color(color); ring(size, 0.9, c.r, c.g, c.b, 1.1, DECAL.PULSE); S.pulse = 1; },
    burst, blast: bigBlast,
    set auto(v) { S.auto = v; }, get auto() { return S.auto; },
    poll() {
      const b = ctx.match?.beacon; if (!b || !S.auto) return;
      const st = b.state;
      if (!b.pos || st === 'carried' || st === 'disarmed') { if (S.state !== 'none' && S.state !== 'disarmed') setState(st === 'disarmed' ? 'disarmed' : 'none'); if (st !== 'disarmed') return; }
      if (b.pos) { if (S.x !== b.pos.x || S.y !== b.pos.y || S.z !== b.pos.z) { S.x = b.pos.x; S.y = b.pos.y; S.z = b.pos.z; group.position.set(S.x, S.y, S.z); } }
      if (st && st !== S.state) setState(st);
      S.prog = b.progress || 0; if (b.fuseLeft != null) S.fuseLeft = b.fuseLeft;
    },
    update(dt, camera) {
      api.poll();
      const k = 1 - Math.exp(-dt * 6);
      S.col.lerp(S.tcol, k); S.alpha += (S.talpha - S.alpha) * k;
      if (S.alpha < 0.004 && S.talpha === 0) { group.visible = false; return; }
      group.visible = true;
      S.pulse *= Math.exp(-dt * 5);
      const t = host.now();
      uniforms.uCol.value.copy(S.col); uniforms.uAlpha.value = S.alpha; uniforms.uPulse.value = S.pulse;
      const st = S.state;
      let fill = 1;
      if (st === 'arming') fill = Math.max(0.03, S.prog); else if (st === 'disarming') fill = Math.max(0.03, 1 - S.prog); else if (st === 'armed') fill = 1;
      else if (st === 'dropped') fill = 0.35 + 0.1 * Math.sin(t * 2);
      uniforms.uFill.value += (fill - uniforms.uFill.value) * Math.min(1, dt * 10);
      // core
      column.scale.set(1 + S.pulse * 0.12, 1, 1 + S.pulse * 0.12);
      // ring cadence
      let interval = 0;
      if (st === 'dropped') interval = 1.6; else if (st === 'arming') interval = 0.7 - 0.45 * S.prog; else if (st === 'disarming') interval = 0.5; else if (st === 'armed') { const f = Math.max(0, Math.min(1, S.fuseLeft / (S.fuse || 35))); interval = 0.16 + 0.9 * f * f; }
      if (interval > 0) {
        S.pulseT -= dt;
        if (S.pulseT <= 0) {
          S.pulseT = interval; const c = S.col;
          const armed = st === 'armed', far = armed ? 7 - 3 * (1 - Math.min(1, S.fuseLeft / (S.fuse || 35))) : 3.2;
          ring(far, armed ? 1.1 : 1.6, c.r, c.g, c.b, armed ? 1.4 : 0.9);
          if (armed) { S.pulse = 1; host.lightPulse(S.x, S.y + 1.4, S.z, c.r, c.g, c.b, 3.5, 8, 0.18); }
        }
      }
    },
  };
  return api;
}
