import * as THREE from 'three';

// GPU particle system. Every particle is a single row in one interleaved Float32Array (ring buffer). The motion is solved
// analytically in the vertex shader (drag + gravity closed form), so the CPU only writes a row when a particle is *spawned*
// and per-frame CPU cost is O(1) (a uniform update + one buffer range upload). Zero allocation per frame.
//
//   row layout (32 floats = 8 x vec4):
//     aPos    x y z  birthTime
//     aVel    vx vy vz  life
//     aPhys   gravityY  drag  size0  size1
//     aCol0   r g b a          (HDR allowed, >1 blooms)
//     aCol1   r g b a
//     aMisc   rot0  spin  stretch(seconds of velocity trail)  seed
//     aExtra  floorY  fadeIn(0..1 of life)  softness(m)  shape + additive*0.99
//     aFx     fadeOutStart(0=off)  colourCurvePow  -  -
//
// One draw call renders additive + alpha particles together (premultiplied blending: additive is alpha 0, rgb only).

export const SHAPE = { GLOW: 0, DISC: 1, STAR: 2, RING: 3, STREAK: 4, PUFF: 5, CHIP: 6, DIAMOND: 7, STAR5: 8, SHOCK: 9, DOT: 10, SMOKE: 11, HEX: 12 };
const STRIDE = 32;

const VERT = /* glsl */`
attribute vec2 corner;
attribute vec4 aPos, aVel, aPhys, aCol0, aCol1, aMisc, aExtra, aFx;
uniform float uTime;
uniform float uNear;         // near-camera fade start distance (metres); full fade at uNear*0.35
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;          // x seed, y shape, z additive, w life t
varying vec2 vLight;
varying float vViewZ;
varying float vSoft;
void main() {
  float age = uTime - aPos.w;
  float life = aVel.w;
  float t = age / life;
  if (age < 0.0 || t >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); vInfo = vec4(0.0); vUv = vec2(0.0); vLight = vec2(0.0); vViewZ = 0.0; vSoft = 0.0; return; }
  float k = max(aPhys.y, 0.0005);
  vec3 G = vec3(0.0, aPhys.x, 0.0);
  float ek = exp(-k * age);
  vec3 gk = G / k;
  vec3 v0k = aVel.xyz - gk;
  vec3 p = aPos.xyz + gk * age + v0k * ((1.0 - ek) / k);
  p.y = max(p.y, aExtra.x);
  bool stretched = aMisc.z > 0.0;
  float grow = aPhys.w > aPhys.z ? 1.0 - (1.0 - t) * (1.0 - t) : t;
  float size = mix(aPhys.z, aPhys.w, grow);
  float shape = floor(aExtra.w + 0.001);
  float add = clamp((aExtra.w - shape) / 0.99, 0.0, 1.0);
  vec4 mv0 = modelViewMatrix * vec4(p, 1.0);
  float solidNear = 1.0;
  if ((shape > 5.5 && shape < 7.5) || (shape > 0.5 && shape < 1.5) || (shape > 9.5 && shape < 10.5)) {   // solid flecks (chip/diamond/disc/dot): never loom near the camera
    float dz = max(-mv0.z, 0.05);
    solidNear = smoothstep(0.8, 2.6, dz);
    size = min(size, dz * 0.045);
  }
  vec3 vp;
  if (stretched) {
    vec3 vel = v0k * ek + gk;
    vec3 tail = p - vel * aMisc.z;
    tail.y = max(tail.y, aExtra.x);
    vec4 mv1 = modelViewMatrix * vec4(tail, 1.0);
    vec2 axis = mv1.xy - mv0.xy;
    float alen = length(axis);
    vec2 along = alen > 1e-5 ? axis / alen : vec2(0.0, -1.0);
    vec2 perp = vec2(-along.y, along.x);
    // corner.y = +1 -> head (particle position), -1 -> tail. Extend a little past the head by half a width.
    float s = corner.y * 0.5 + 0.5;
    vec2 base = mix(mv1.xy, mv0.xy, s) + along * (corner.y * size * 0.5);
    vp = vec3(base + perp * corner.x * size * 0.5, mix(mv1.z, mv0.z, s));
    vUv = vec2(corner.x, corner.y);
  } else {
    float rot = aMisc.x + aMisc.y * age;
    float c = cos(rot), sn = sin(rot);
    vec2 q = vec2(c * corner.x - sn * corner.y, sn * corner.x + c * corner.y);
    vp = vec3(mv0.xy + q * size * 0.5, mv0.z);
    vUv = corner;
  }
  float fin = aExtra.y > 0.0 ? smoothstep(0.0, aExtra.y, t) : 1.0;
  vec4 col = mix(aCol0, aCol1, smoothstep(0.0, 1.0, pow(t, aFx.y)));
  if (aFx.x > 0.0) col.a *= 1.0 - smoothstep(aFx.x, 1.0, t);
  float nearFade = smoothstep(uNear * 0.35, uNear, -mv0.z) * solidNear;
  col.a *= fin * nearFade;
  col.rgb *= mix(1.0, nearFade, add);
  vCol = col;
  vInfo = vec4(aMisc.w, shape, add, t);
  vec3 sunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  vLight = sunV.xy;
  vViewZ = -vp.z;
  vSoft = aExtra.z;
  gl_Position = projectionMatrix * vec4(vp, 1.0);
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uDepth;
uniform vec4 uDepthInfo;   // near, far, 1/width, 1/height
uniform vec3 uFogColor;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;
varying vec2 vLight;
varying float vViewZ;
varying float vSoft;

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.7) * 0.15; }

void main() {
  if (vCol.a <= 0.0 && vInfo.z <= 0.0) discard;
  float shape = vInfo.y;
  vec2 p = vUv;
  float r2 = dot(p, p);
  float r = sqrt(r2);
  float a = 0.0;
  float shade = 1.0;
  if (shape < 0.5) {                                   // GLOW
    a = exp(-r2 * 4.2) * step(r, 1.0);
  } else if (shape < 1.5) {                            // DISC
    a = 1.0 - smoothstep(0.82, 1.0, r);
  } else if (shape < 2.5) {                            // STAR burst (4 long spikes + 4 short diagonals + hot core)
    vec2 ap = abs(p);
    float s1 = exp(-ap.x * 22.0) * (1.0 - smoothstep(0.0, 1.0, ap.y));
    float s2 = exp(-ap.y * 22.0) * (1.0 - smoothstep(0.0, 1.0, ap.x));
    vec2 d = vec2(p.x + p.y, p.x - p.y) * 0.7071;
    float s3 = exp(-abs(d.x) * 30.0) * (1.0 - smoothstep(0.0, 0.62, abs(d.y)));
    float s4 = exp(-abs(d.y) * 30.0) * (1.0 - smoothstep(0.0, 0.62, abs(d.x)));
    a = s1 + s2 + 0.55 * (s3 + s4) + exp(-r2 * 18.0) * 1.3 + exp(-r2 * 3.0) * 0.25;
    a *= step(r, 1.02);
  } else if (shape < 3.5) {                            // RING (thin)
    a = exp(-pow((r - 0.78) * 11.0, 2.0)) * step(r, 1.0);
  } else if (shape < 4.5) {                            // STREAK (stretched spark, bright head thin tail)
    float y = p.y * 0.5 + 0.5;
    float w = mix(2.4, 0.9, y);
    a = exp(-p.x * p.x * 9.0 * w) * pow(y, 1.4) * (0.55 + 0.45 * smoothstep(0.7, 1.0, y));
    a *= 1.0 - smoothstep(0.92, 1.0, abs(p.x));
  } else if (shape < 5.5) {                            // PUFF (noisy dust cloud, lit from sun side)
    float ang = vInfo.x * 6.283;
    vec2 q = p * 1.35 + vec2(cos(ang), sin(ang)) * 3.0 + vInfo.x * 17.0;
    float n = fbm(q + vInfo.w * 0.6);
    float nl = fbm(q + vLight * 0.35 + vInfo.w * 0.6);
    float rr = r * (0.92 + 0.55 * (0.5 - n));
    a = (1.0 - smoothstep(0.25, 1.0, rr));
    a = a * a * (3.0 - 2.0 * a);
    shade = clamp(0.86 + (nl - n) * 2.4 + vLight.y * p.y * 0.1, 0.55, 1.28);
  } else if (shape < 6.5) {                            // CHIP (solid rotated square)
    vec2 ap = abs(p);
    a = 1.0 - smoothstep(0.62, 0.74, max(ap.x, ap.y));
    shade = 0.8 + 0.4 * (p.x * 0.5 - p.y * 0.5 + 0.5);
  } else if (shape < 7.5) {                            // DIAMOND / petal-ish
    a = 1.0 - smoothstep(0.72, 0.9, abs(p.x) * 1.15 + abs(p.y) * 0.7);
    shade = 0.85 + 0.3 * (p.y * 0.5 + 0.5);
  } else if (shape < 8.5) {                            // 5 point star
    float th = atan(p.y, p.x) + 1.5708;
    float rad = mix(0.34, 1.0, pow(abs(cos(th * 2.5)), 1.6));
    a = (1.0 - smoothstep(rad * 0.86, rad, r)) * 1.0 + exp(-r2 * 10.0) * 0.4;
  } else if (shape < 9.5) {                            // SHOCK (thick soft ring that thins as it expands)
    float w = mix(0.34, 0.06, vInfo.w);
    float rr = r - (0.98 - w);
    a = exp(-pow(rr / w, 2.0)) * step(r, 1.0);
  } else if (shape < 10.5) {                           // DOT (tiny hot spark: core + halo)
    a = exp(-r2 * 26.0) + 0.3 * exp(-r2 * 5.0);
  } else if (shape < 11.5) {                           // SMOKE (large, slow, layered cloud with soft interior shading)
    float ang = vInfo.x * 6.283;
    vec2 q = p * 1.6 + vec2(cos(ang), sin(ang)) * 5.0 + vInfo.x * 31.0;
    float n = fbm(q + vInfo.w * 0.25);
    float nl = fbm(q + vLight * 0.4 + vInfo.w * 0.25);
    float rr = r * (0.8 + 0.6 * (0.55 - n));
    a = 1.0 - smoothstep(0.35, 1.0, rr);
    shade = clamp(0.88 + (nl - n) * 2.2 + vLight.y * p.y * 0.12 + (0.5 - r) * 0.1, 0.5, 1.2);
  } else {                                             // HEX (crystal spark)
    vec2 ap = abs(p);
    float h = max(ap.x * 0.866 + ap.y * 0.5, ap.y);
    a = (1.0 - smoothstep(0.7, 0.82, h)) * (0.55 + 0.45 * (1.0 - h));
    shade = 0.9 + 0.3 * p.y;
  }
#ifdef SOFT
  if (vSoft > 0.0) {
    vec2 suv = gl_FragCoord.xy * uDepthInfo.zw;
    float d = texture2D(uDepth, suv).x;
    float zn = d * 2.0 - 1.0;
    float sceneZ = 2.0 * uDepthInfo.x * uDepthInfo.y / (uDepthInfo.y + uDepthInfo.x - zn * (uDepthInfo.y - uDepthInfo.x));
    a *= clamp((sceneZ - vViewZ) / vSoft, 0.0, 1.0);
  }
#endif
  float alpha = vCol.a * a;
  vec3 rgb = vCol.rgb * shade * alpha;
  gl_FragColor = vec4(rgb, alpha * (1.0 - vInfo.z));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Reusable mutable spawn description (no allocation): fill fields after reset() then ps.emit(now, spec). */
export class Spec {
  constructor() { this.reset(); }
  reset() {
    this.x = this.y = this.z = 0; this.vx = this.vy = this.vz = 0; this.life = 1; this.g = 0; this.drag = 0; this.s0 = this.s1 = 0.2;
    this.r0 = this.g0 = this.b0 = 1; this.a0 = 1; this.r1 = this.g1 = this.b1 = 1; this.a1 = 0;
    this.rot = 0; this.spin = 0; this.stretch = 0; this.seed = 0; this.shape = SHAPE.GLOW; this.add = 0; this.fadeIn = 0.06; this.floor = -1e4; this.soft = 0; this.fadeOut = 0; this.colPow = 1;
    return this;
  }
  pos(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  vel(x, y, z) { this.vx = x; this.vy = y; this.vz = z; return this; }
  col(r, g, b, a, r1 = r, g1 = g, b1 = b, a1 = 0) { this.r0 = r; this.g0 = g; this.b0 = b; this.a0 = a; this.r1 = r1; this.g1 = g1; this.b1 = b1; this.a1 = a1; return this; }
}

export class ParticleSystem {
  /**
   * @param {THREE.Scene|THREE.Object3D} parent where the mesh lives
   * @param {number} max capacity of the ring buffer
   * @param {object} shared { time:{value}, sunDir:{value:Vector3}, near:{value} }
   */
  constructor(parent, max, shared, { name = 'particles', order = 20 } = {}) {
    this.max = max; this.head = 0; this.hwm = 0; this.dmin = Infinity; this.dmax = -1;
    this.data = new Float32Array(max * STRIDE);
    this.data.fill(0); for (let i = 0; i < max; i++) this.data[i * STRIDE + 3] = -1e6;   // dead
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    quad.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    const names = ['aPos', 'aVel', 'aPhys', 'aCol0', 'aCol1', 'aMisc', 'aExtra', 'aFx'];
    names.forEach((n, i) => quad.setAttribute(n, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    quad.instanceCount = 0;
    this.geometry = quad;
    this.uniforms = {
      uTime: shared.time, uNear: shared.near, uSunDir: shared.sunDir,
      uDepth: { value: null }, uDepthInfo: { value: new THREE.Vector4(0.05, 400, 1, 1) }, uFogColor: { value: new THREE.Color(0x8fb4d8) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(quad, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = order; this.mesh.name = name; this.mesh.matrixAutoUpdate = false;
    parent.add(this.mesh);
    this.scale = 1;          // quality density multiplier used by callers via `n(count)`
    this.spawned = 0;
    this._soft = false;
  }

  /** Scale a nominal particle count by the quality multiplier (at least 1 when count>0). */
  n(count) { const v = count * this.scale; return v <= 0 ? 0 : Math.max(1, Math.round(v)); }

  setSoftDepth(tex, near, far, w, h) {
    const on = !!tex;
    if (on !== this._soft) { this._soft = on; this.material.defines = on ? { SOFT: '' } : {}; this.material.needsUpdate = true; }
    if (on) { this.uniforms.uDepth.value = tex; this.uniforms.uDepthInfo.value.set(near, far, 1 / w, 1 / h); }
  }

  /**
   * Low level positional spawn. All times in seconds, colours linear, HDR ok.
   * additive: 0 = alpha blended, 1 = additive (fractional mixes).
   */
  spawn(t, x, y, z, vx, vy, vz, life, gravity, drag, s0, s1,
    r0, g0, b0, a0, r1, g1, b1, a1, rot, spin, stretch, seed, shape, additive, fadeIn = 0.06, floorY = -1e4, softness = 0, fadeOut = 0, colPow = 1) {
    const i = this.head; this.head = (i + 1) % this.max; if (i + 1 > this.hwm) this.hwm = i + 1;
    const d = this.data, o = i * STRIDE;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = t;
    d[o + 4] = vx; d[o + 5] = vy; d[o + 6] = vz; d[o + 7] = life;
    d[o + 8] = gravity; d[o + 9] = drag; d[o + 10] = s0; d[o + 11] = s1;
    d[o + 12] = r0; d[o + 13] = g0; d[o + 14] = b0; d[o + 15] = a0;
    d[o + 16] = r1; d[o + 17] = g1; d[o + 18] = b1; d[o + 19] = a1;
    d[o + 20] = rot; d[o + 21] = spin; d[o + 22] = stretch; d[o + 23] = seed;
    d[o + 24] = floorY; d[o + 25] = fadeIn; d[o + 26] = softness; d[o + 27] = shape + additive * 0.99;
    d[o + 28] = fadeOut; d[o + 29] = colPow; d[o + 30] = 0; d[o + 31] = 0;
    if (i < this.dmin) this.dmin = i; if (i > this.dmax) this.dmax = i;
    this.spawned++;
  }

  emit(t, e) {
    this.spawn(t, e.x, e.y, e.z, e.vx, e.vy, e.vz, e.life, e.g, e.drag, e.s0, e.s1, e.r0, e.g0, e.b0, e.a0, e.r1, e.g1, e.b1, e.a1,
      e.rot, e.spin, e.stretch, e.seed, e.shape, e.add, e.fadeIn, e.floor, e.soft, e.fadeOut, e.colPow);
  }

  /** Call once per frame before render: uploads only what was spawned. */
  flush() {
    if (this.dmax >= 0) {
      const b = this.buf;
      b.addUpdateRange(this.dmin * STRIDE, (this.dmax - this.dmin + 1) * STRIDE);
      b.needsUpdate = true; this.dmin = Infinity; this.dmax = -1;
    }
    this.geometry.instanceCount = this.hwm;
  }

  clear() { for (let i = 0; i < this.max; i++) this.data[i * STRIDE + 3] = -1e6; this.dmin = 0; this.dmax = this.max - 1; }

  /** Number of particles currently alive (debug; O(n)). */
  alive(now) { let c = 0; for (let i = 0; i < this.hwm; i++) { const o = i * STRIDE; const age = now - this.data[o + 3]; if (age >= 0 && age < this.data[o + 7]) c++; } return c; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); }
}
