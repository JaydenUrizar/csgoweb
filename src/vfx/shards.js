import * as THREE from 'three';

// Mesh-shard bursts (tag-out shatter / confetti / pixels / petals / stars). CPU simulated, drawn as instanced meshes
// (one draw call per kind that is currently alive). Struct-of-arrays state, swap-remove, no allocation per frame.

const KIND = { shard: 0, quad: 1, cube: 2, petal: 3, star: 4 };
const N_KINDS = 5;

function nonIndexed(g) { const n = g.index ? g.toNonIndexed() : g; return n; }
function geoShard() {
  const g = new THREE.BufferGeometry();
  // thin irregular kite/tetra: tip up, three base points
  const t = [0, 0.5, 0.02], a = [-0.30, -0.5, 0.10], b = [0.28, -0.5, 0.14], c = [0.04, -0.45, -0.16];
  const v = [...t, ...a, ...b, ...t, ...b, ...c, ...t, ...c, ...a, ...a, ...c, ...b];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3)); return g;
}
function geoPetal() {
  const g = new THREE.BufferGeometry();
  const p = [[0, -0.5, 0], [-0.32, -0.12, 0.10], [0.32, -0.12, 0.10], [-0.2, 0.28, 0.14], [0.2, 0.28, 0.14], [0, 0.5, 0.02], [0, 0.0, 0.06]];
  const idx = [0, 1, 6, 0, 6, 2, 1, 3, 6, 2, 6, 4, 3, 5, 6, 4, 6, 5];
  const v = []; for (const i of idx) v.push(...p[i]);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3)); return g;
}
function geoStar() {
  const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.5, a = (i / 10) * Math.PI * 2 + Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const v = []; const th = 0.09;
  for (let i = 0; i < 10; i++) {
    const p = pts[i], q = pts[(i + 1) % 10];
    v.push(0, 0, th, p[0], p[1], th * 0.4, q[0], q[1], th * 0.4);          // front
    v.push(0, 0, -th, q[0], q[1], -th * 0.4, p[0], p[1], -th * 0.4);       // back
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3)); return g;
}

const VERT = /* glsl */`
attribute vec4 aColor;    // rgb, glint phase
attribute vec2 aState;    // emissive amount, seed
uniform float uTime;
uniform vec3 uSunW;
varying vec3 vSun;
varying vec3 vView;
varying vec4 vColor;
varying vec2 vState;
void main() {
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  vView = mv.xyz; vColor = aColor; vState = aState; vSun = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uSky;
uniform vec3 uGround;
varying vec3 vSun;
varying vec3 vView;
varying vec4 vColor;
varying vec2 vState;
void main() {
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  if (!gl_FrontFacing) n = -n;
  // derivative normal points toward camera when winding faces; make it face the viewer
  if (dot(n, -vView) < 0.0) n = -n;
  vec3 V = normalize(-vView);
  vec3 uSunV = normalize(vSun);
  float ndl = dot(n, uSunV);
  vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
  float dif = max(ndl, 0.0);
  vec3 base = vColor.rgb;
  vec3 col = base * (amb * 0.75 + vec3(1.0, 0.96, 0.88) * dif * 0.9);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 H = normalize(uSunV + V);
  float spec = pow(max(dot(n, H), 0.0), 40.0);
  float tw = pow(0.5 + 0.5 * sin(uTime * 4.0 + vColor.w * 60.0), 14.0);
  col += base * vState.x * (0.55 + 0.35 * tw);                       // self-illumination (light-shard look)
  col += mix(base, vec3(1.0), 0.6) * (fres * 0.55 + spec * 2.2 * (0.5 + tw) + tw * 0.4 * vState.x);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const _QI = new THREE.Quaternion(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

class Kind {
  constructor(parent, geometry, cap, uniforms) {
    this.cap = cap; this.count = 0;
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3); this.q = new Float32Array(cap * 4); this.w = new Float32Array(cap * 3);
    this.scale = new Float32Array(cap * 3); this.age = new Float32Array(cap); this.life = new Float32Array(cap); this.rest = new Float32Array(cap);
    this.gr = new Float32Array(cap * 4);   // gravity, drag, bounce, sway
    this.floor = new Float32Array(cap); this.cell = new Int32Array(cap); this.state = new Uint8Array(cap); this.seed = new Float32Array(cap); this.half = new Float32Array(cap);
    this.col = new Float32Array(cap * 4); this.emis = new Float32Array(cap * 2); this.glintT = new Float32Array(cap);
    const g = geometry.clone ? geometry.clone() : geometry;
    this.aColor = new THREE.InstancedBufferAttribute(this.col, 4); this.aColor.setUsage(THREE.DynamicDrawUsage);
    this.aState = new THREE.InstancedBufferAttribute(this.emis, 2); this.aState.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aColor', this.aColor); g.setAttribute('aState', this.aState);
    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(g, this.material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false; this.mesh.matrixAutoUpdate = false;
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    parent.add(this.mesh);
  }
  remove(i) {
    const l = --this.count; if (i === l) return;
    const cp = (a, s) => { for (let k = 0; k < s; k++) a[i * s + k] = a[l * s + k]; };
    cp(this.pos, 3); cp(this.vel, 3); cp(this.q, 4); cp(this.w, 3); cp(this.scale, 3); cp(this.gr, 4); cp(this.col, 4); cp(this.emis, 2);
    for (const a of [this.age, this.life, this.rest, this.floor, this.cell, this.state, this.seed, this.half, this.glintT]) a[i] = a[l];
  }
}

export class Shards {
  constructor(parent, opts) {
    this.uniforms = { uTime: opts.time, uSunW: opts.sunDir, uSky: { value: new THREE.Color(0.85, 0.92, 1.0) }, uGround: { value: new THREE.Color(0.45, 0.38, 0.3) } };
    this.sunDir = opts.sunDir;
    const caps = opts.caps || [320, 320, 256, 160, 128];
    this.kinds = [
      new Kind(parent, geoShard(), caps[0], this.uniforms),
      new Kind(parent, new THREE.PlaneGeometry(1, 1), caps[1], this.uniforms),
      new Kind(parent, nonIndexed(new THREE.BoxGeometry(1, 1, 1)), caps[2], this.uniforms),
      new Kind(parent, geoPetal(), caps[3], this.uniforms),
      new Kind(parent, geoStar(), caps[4], this.uniforms),
    ];
    this.groundAt = opts.groundAt;     // (x,y,z)->floor y
    this.glint = opts.glint;           // (x,y,z,size,r,g,b,strong)
    this.scale = 1; this.glintBudget = 0;
    this.groundCache = new Map();
  }
  get active() { let n = 0; for (const k of this.kinds) n += k.count; return n; }
  clear() { for (const k of this.kinds) { k.count = 0; k.mesh.count = 0; k.mesh.visible = false; } }

  /** Add one shard. Returns false if the pool for this kind is full. */
  add(kind, x, y, z, vx, vy, vz, sx, sy, sz, r, g, b, emis, life, gravity, drag, bounce, sway, wx, wy, wz, floorY, seed) {
    const K = this.kinds[kind]; if (K.count >= K.cap) return false;
    const i = K.count++;
    K.pos[i * 3] = x; K.pos[i * 3 + 1] = y; K.pos[i * 3 + 2] = z;
    K.vel[i * 3] = vx; K.vel[i * 3 + 1] = vy; K.vel[i * 3 + 2] = vz;
    _q.set(seed * 7.13 % 1 - 0.5, seed * 3.7 % 1 - 0.5, seed * 11.3 % 1 - 0.5, (seed * 5.1 % 1) + 0.2).normalize();
    K.q[i * 4] = _q.x; K.q[i * 4 + 1] = _q.y; K.q[i * 4 + 2] = _q.z; K.q[i * 4 + 3] = _q.w;
    K.w[i * 3] = wx; K.w[i * 3 + 1] = wy; K.w[i * 3 + 2] = wz;
    K.scale[i * 3] = sx; K.scale[i * 3 + 1] = sy; K.scale[i * 3 + 2] = sz;
    K.age[i] = 0; K.life[i] = life; K.rest[i] = 0; K.state[i] = 0; K.seed[i] = seed; K.half[i] = Math.min(sx, sy, Math.max(sz, 0.02)) * 0.5 + 0.005; K.glintT[i] = seed * 2;
    K.gr[i * 4] = gravity; K.gr[i * 4 + 1] = drag; K.gr[i * 4 + 2] = bounce; K.gr[i * 4 + 3] = sway;
    K.floor[i] = floorY; K.cell[i] = -1;
    K.col[i * 4] = r; K.col[i * 4 + 1] = g; K.col[i * 4 + 2] = b; K.col[i * 4 + 3] = seed;
    K.emis[i * 2] = emis; K.emis[i * 2 + 1] = seed;
    return true;
  }

  _ground(k, i, x, y, z) {
    if (!this.groundAt) return k.floor[i];
    const cell = ((Math.floor(x * 1.5) & 1023) << 10) | (Math.floor(z * 1.5) & 1023);
    if (cell !== k.cell[i]) { k.cell[i] = cell; k.floor[i] = this.groundAt(x, y, z, k.floor[i]); }
    return k.floor[i];
  }

  update(dt, time, camera) {
    if (dt > 0.05) dt = 0.05;
    this.glintBudget = 5;
    for (let ki = 0; ki < N_KINDS; ki++) {
      const K = this.kinds[ki];
      if (K.count === 0) { K.mesh.visible = false; continue; }
      const m = K.mesh.instanceMatrix.array, isFlat = ki === KIND.quad || ki === KIND.petal || ki === KIND.star;
      for (let i = K.count - 1; i >= 0; i--) {
        const age = K.age[i] += dt, life = K.life[i];
        if (age >= life) { K.remove(i); continue; }
        const i3 = i * 3, i4 = i * 4;
        let px = K.pos[i3], py = K.pos[i3 + 1], pz = K.pos[i3 + 2];
        if (K.state[i] === 0) {
          let vx = K.vel[i3], vy = K.vel[i3 + 1], vz = K.vel[i3 + 2];
          const drag = K.gr[i4 + 1], sway = K.gr[i4 + 3], sd = K.seed[i];
          vy += K.gr[i4] * dt;
          if (sway > 0) { vx += Math.sin(time * 5.2 + sd * 40) * sway * dt; vz += Math.cos(time * 4.3 + sd * 33) * sway * dt; }
          const dk = 1 / (1 + drag * dt); vx *= dk; vy *= dk; vz *= dk;
          px += vx * dt; py += vy * dt; pz += vz * dt;
          const gy = this._ground(K, i, px, py, pz) + K.half[i];
          if (py < gy) {
            py = gy;
            const bounce = K.gr[i4 + 2];
            if (vy < -0.9 && bounce > 0.02) { vy = -vy * bounce; vx *= 0.72; vz *= 0.72; K.w[i3] *= 0.6; K.w[i3 + 1] *= 0.6; K.w[i3 + 2] *= 0.6; }
            else { vy = 0; K.state[i] = 1; K.rest[i] = age; }
          }
          K.vel[i3] = vx; K.vel[i3 + 1] = vy; K.vel[i3 + 2] = vz;
          // angular integration (fast small-angle quaternion update)
          const wx = K.w[i3], wy = K.w[i3 + 1], wz = K.w[i3 + 2];
          let qx = K.q[i4], qy = K.q[i4 + 1], qz = K.q[i4 + 2], qw = K.q[i4 + 3];
          const hx = wx * dt * 0.5, hy = wy * dt * 0.5, hz = wz * dt * 0.5;
          const nqx = qx + hx * qw + hy * qz - hz * qy, nqy = qy + hy * qw + hz * qx - hx * qz, nqz = qz + hz * qw + hx * qy - hy * qx, nqw = qw - hx * qx - hy * qy - hz * qz;
          const il = 1 / Math.sqrt(nqx * nqx + nqy * nqy + nqz * nqz + nqw * nqw);
          K.q[i4] = nqx * il; K.q[i4 + 1] = nqy * il; K.q[i4 + 2] = nqz * il; K.q[i4 + 3] = nqw * il;
        } else {
          // resting: thin flat shapes settle onto their face
          if (isFlat) {
            _q.set(K.q[i4], K.q[i4 + 1], K.q[i4 + 2], K.q[i4 + 3]);
            _v.set(0, 0, 1).applyQuaternion(_q);
            _v2.set(0, _v.y >= 0 ? 1 : -1, 0);
            _q2.setFromUnitVectors(_v, _v2); _q2.slerp(_QI, 1 - Math.min(1, dt * 10));
            _q.premultiply(_q2);
            K.q[i4] = _q.x; K.q[i4 + 1] = _q.y; K.q[i4 + 2] = _q.z; K.q[i4 + 3] = _q.w;
          }
          K.glintT[i] -= dt;
          if (K.glintT[i] < 0 && this.glintBudget > 0 && this.glint && age < life - 0.8) { this.glintBudget--; K.glintT[i] = 0.5 + K.seed[i] * 1.6 + ((K.seed[i] * 97.1) % 1) * 0.3; this.glint(px, py + 0.03, pz, 0.14 + K.seed[i] * 0.12, K.col[i4], K.col[i4 + 1], K.col[i4 + 2]); }
        }
        K.pos[i3] = px; K.pos[i3 + 1] = py; K.pos[i3 + 2] = pz;
        // scale: pop-in then shrink out over the last 0.7 s
        const fade = Math.min(1, (life - age) / 0.7), pop = Math.min(1, age * 14 + 0.4);
        const s = fade * (fade < 1 ? fade : 1) * pop;
        const o = i * 16;
        const qx = K.q[i4], qy = K.q[i4 + 1], qz = K.q[i4 + 2], qw = K.q[i4 + 3];
        const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx2 = qw * x2, wy2 = qw * y2, wz2 = qw * z2;
        const sx = K.scale[i3] * s, sy = K.scale[i3 + 1] * s, sz = K.scale[i3 + 2] * s;
        m[o] = (1 - (yy + zz)) * sx; m[o + 1] = (xy + wz2) * sx; m[o + 2] = (xz - wy2) * sx; m[o + 3] = 0;
        m[o + 4] = (xy - wz2) * sy; m[o + 5] = (1 - (xx + zz)) * sy; m[o + 6] = (yz + wx2) * sy; m[o + 7] = 0;
        m[o + 8] = (xz + wy2) * sz; m[o + 9] = (yz - wx2) * sz; m[o + 10] = (1 - (xx + yy)) * sz; m[o + 11] = 0;
        m[o + 12] = px; m[o + 13] = py; m[o + 14] = pz; m[o + 15] = 1;
      }
      K.mesh.count = K.count; K.mesh.visible = K.count > 0;
      K.mesh.instanceMatrix.needsUpdate = true; K.aColor.needsUpdate = true; K.aState.needsUpdate = true;
      K.mesh.instanceMatrix.clearUpdateRanges?.(); K.mesh.instanceMatrix.addUpdateRange(0, K.count * 16);
      K.aColor.clearUpdateRanges?.(); K.aColor.addUpdateRange(0, K.count * 4); K.aState.clearUpdateRanges?.(); K.aState.addUpdateRange(0, K.count * 2);
    }
  }
}
export { KIND };
