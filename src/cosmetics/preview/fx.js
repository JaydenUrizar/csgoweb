// Preview-stage particle systems: shader Points pool, ribbon trail, instanced tag-out effects. No per-frame allocation.
import * as THREE from 'three';

export const SHAPE = { glow: 0, square: 1, petal: 2, star: 3, spark: 4, ring: 5 };

const VERT = /* glsl */`
attribute float aSize; attribute float aAlpha; attribute float aShape; attribute float aAngle; attribute vec3 aColor;
uniform float uScale; varying vec3 vC; varying float vA; varying float vS; varying float vR;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, aSize * uScale / -mv.z); vC = aColor; vA = aAlpha; vS = aShape; vR = aAngle; }`;
const FRAG = /* glsl */`
varying vec3 vC; varying float vA; varying float vS; varying float vR;
void main(){
  vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); vec2 q = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
  float a = 0.0; vec3 col = vC;
  if (vS < 0.5) { float d = length(p) * 2.0; a = pow(max(0.0, 1.0 - d), 1.6); col = mix(vC, vec3(1.0), a * 0.45); }
  else if (vS < 1.5) { vec2 e = abs(q); a = step(max(e.x, e.y), 0.4); col = vC * (0.85 + 0.3 * step(0.0, q.x + q.y)); }
  else if (vS < 2.5) { vec2 e = q * vec2(1.0, 1.9); float d = length(e - vec2(0.0, 0.0)); float notch = smoothstep(0.34, 0.5, d); a = smoothstep(0.5, 0.42, d); a *= 1.0 - 0.0 * notch; col = vC * (0.75 + 0.5 * (q.y + 0.5)); }
  else if (vS < 3.5) { float ang = atan(q.y, q.x); float r = length(q); float k = pow(abs(cos(2.5 * ang)), 3.0); float R = mix(0.14, 0.5, k); a = smoothstep(R, R - 0.06, r); col = mix(vC, vec3(1.0), 0.35 * a * (1.0 - r * 2.0)); a += 0.35 * pow(max(0.0, 1.0 - r * 2.0), 3.0); }
  else if (vS < 4.5) { float d = length(p) * 2.0; a = pow(max(0.0, 1.0 - d), 2.6); col = mix(vC, vec3(1.0), pow(a, 3.0)); }
  else { float d = abs(length(p) - 0.36); a = smoothstep(0.08, 0.0, d); }
  gl_FragColor = vec4(col, a * vA); if (gl_FragColor.a < 0.01) discard;
}`;

export class ParticleSystem {
  constructor(max = 1200, { additive = true } = {}) {
    this.max = max; this.n = 0; this.head = 0;
    const g = this.geometry = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.shape = new Float32Array(max); this.angle = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAngle', new THREE.BufferAttribute(this.angle, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 20);
    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 600 } } });
    this.points = new THREE.Points(g, this.material); this.points.frustumCulled = false; this.points.renderOrder = additive ? 10 : 9;
    // simulation state
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.spin = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max); this.swirl = new Float32Array(max); this.step = new Float32Array(max); this.seed = new Float32Array(max);
    this.c1 = new Float32Array(max * 3); this.mode = new Uint8Array(max);
  }
  setScale(v) { this.material.uniforms.uScale.value = v; }
  /** emit one particle. colour c (0xRRGGBB) fading to c2 (or same). */
  emit(x, y, z, vx, vy, vz, life, size0, size1, c, c2, shape = 0, grav = 0, drag = 0, a0 = 1, spin = 0, swirl = 0, step = 0) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = ((c >> 16) & 255) / 255; this.col[k + 1] = ((c >> 8) & 255) / 255; this.col[k + 2] = (c & 255) / 255;
    c2 = c2 ?? c; this.c1[k] = ((c2 >> 16) & 255) / 255; this.c1[k + 1] = ((c2 >> 8) & 255) / 255; this.c1[k + 2] = (c2 & 255) / 255;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = size0; this.s1[i] = size1; this.shape[i] = shape; this.grav[i] = grav; this.drag[i] = drag; this.a0[i] = a0;
    this.spin[i] = spin; this.swirl[i] = swirl; this.step[i] = step; this.angle[i] = Math.random() * 6.28; this.seed[i] = Math.random() * 6.28;
    this.size[i] = size0; this.alpha[i] = a0; this.mode[i] = 1;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); this.mode.fill(0); this.flag(); }
  flag() { const g = this.geometry.attributes; g.position.needsUpdate = g.aColor.needsUpdate = g.aSize.needsUpdate = g.aAlpha.needsUpdate = g.aShape.needsUpdate = g.aAngle.needsUpdate = true; }
  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (!this.mode[i]) continue;
      let l = this.life[i] - dt;
      if (l <= 0) { this.mode[i] = 0; this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] = l; alive++;
      const k = i * 3, t = 1 - l / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= d; this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt; this.vel[k + 2] *= d;
      const sw = this.swirl[i];
      if (sw) { const ph = this.seed[i] + t * 9; this.vel[k] += Math.cos(ph) * sw * dt; this.vel[k + 2] += Math.sin(ph * 1.3) * sw * dt; }
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.02 && this.grav[i] > 0) { this.pos[k + 1] = 0.02; this.vel[k + 1] *= -0.3; }
      this.angle[i] += this.spin[i] * dt;
      let sz = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      if (this.step[i]) { sz = Math.round(sz / this.step[i]) * this.step[i]; }
      this.size[i] = sz;
      const fadeIn = Math.min(1, t * 12), fadeOut = Math.min(1, (1 - t) * 3.2);
      this.alpha[i] = this.a0[i] * fadeIn * fadeOut;
      if (this.c1[k] !== this.col[k] || this.c1[k + 1] !== this.col[k + 1]) { /* colour lerp handled below */ }
    }
    this.n = alive; this.flag();
    return alive;
  }
  // lerp colours towards c1 over life (cheap, separate pass so emit stays simple)
  tintPass() {
    for (let i = 0; i < this.max; i++) {
      if (!this.mode[i]) continue; const k = i * 3, t = 1 - this.life[i] / this.maxLife[i], u = Math.min(1, t * 1.4);
      this.col[k] += (this.c1[k] - this.col[k]) * 0.06 * u; this.col[k + 1] += (this.c1[k + 1] - this.col[k + 1]) * 0.06 * u; this.col[k + 2] += (this.c1[k + 2] - this.col[k + 2]) * 0.06 * u;
    }
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}

// ------------------------------------------------------------------------------------------------ Ribbon
export class RibbonTrail {
  constructor(segs = 44) {
    this.segs = segs; this.width = 0.09;
    const g = this.geometry = new THREE.BufferGeometry();
    this.pos = new Float32Array(segs * 2 * 3); this.col = new Float32Array(segs * 2 * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 20);
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 11;
    this.pts = new Float32Array(segs * 3); this.count = 0; this.acc = 0; this.c = new THREE.Color(); this.c2 = new THREE.Color(); this.tmp = new THREE.Color();
    this.mesh.visible = false;
  }
  setColors(a, b) { this.c.setHex(a); this.c2.setHex(b); }
  reset() { this.count = 0; this.mesh.visible = false; }
  /** head at (x,y,z); trail flows along (bx,bz) (unit) at `speed`. side = offset for the strip width. */
  update(dt, x, y, z, bx, bz, speed, emit = true) {
    const P = this.pts;
    // scroll existing points backwards
    for (let i = 0; i < this.count; i++) { P[i * 3] += bx * speed * dt; P[i * 3 + 2] += bz * speed * dt; P[i * 3 + 1] += Math.sin(i * 0.5 + performance.now() * 0.004) * 0.002; }
    this.acc += dt;
    if (emit && this.acc >= 0.02) {
      this.acc = 0;
      for (let i = Math.min(this.count, this.segs - 1); i > 0; i--) { P[i * 3] = P[(i - 1) * 3]; P[i * 3 + 1] = P[(i - 1) * 3 + 1]; P[i * 3 + 2] = P[(i - 1) * 3 + 2]; }
      P[0] = x; P[1] = y; P[2] = z; this.count = Math.min(this.segs, this.count + 1);
    } else if (this.count > 0 && this.acc === 0) { /* noop */ }
    if (!emit && this.count > 0) { this.fade = (this.fade ?? 1) - dt * 1.8; if (this.fade <= 0) { this.count = 0; this.fade = 1; } } else this.fade = 1;
    this.mesh.visible = this.count > 1;
    const n = this.count, w = this.width;
    for (let i = 0; i < n; i++) {
      const t = i / (this.segs - 1), sw = w * (1 - t) * (0.7 + 0.3 * Math.sin(t * 20 - performance.now() * 0.01));
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      // strip is vertical-ish so it reads from the side: extrude along Y plus a bit across X
      this.pos[i * 6] = px; this.pos[i * 6 + 1] = py + sw; this.pos[i * 6 + 2] = pz;
      this.pos[i * 6 + 3] = px; this.pos[i * 6 + 4] = py - sw; this.pos[i * 6 + 5] = pz;
      this.tmp.copy(this.c).lerp(this.c2, Math.min(1, t * 1.4));
      const a = Math.pow(1 - t, 1.3) * 0.95 * (this.fade ?? 1);
      for (let k = 0; k < 2; k++) { const o = (i * 2 + k) * 4; this.col[o] = this.tmp.r * 1.6; this.col[o + 1] = this.tmp.g * 1.6; this.col[o + 2] = this.tmp.b * 1.6; this.col[o + 3] = a; }
    }
    for (let i = n; i < this.segs; i++) { const l = Math.max(0, n - 1); for (let k = 0; k < 2; k++) { this.pos[(i * 2 + k) * 3] = this.pos[(l * 2 + k) * 3]; this.pos[(i * 2 + k) * 3 + 1] = this.pos[(l * 2 + k) * 3 + 1]; this.pos[(i * 2 + k) * 3 + 2] = this.pos[(l * 2 + k) * 3 + 2]; this.col[(i * 2 + k) * 4 + 3] = 0; } }
    this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}

// ------------------------------------------------------------------------------------------------ Tag-out effects
const PALETTE = [0xff6fb5, 0xffd166, 0x5fe6ff, 0xa6ff6a, 0xc38bff, 0xffffff];
export class TagOutFx {
  constructor(parent, glow, solid) {
    this.group = new THREE.Group(); parent.add(this.group); this.glow = glow; this.solid = solid;
    this.t = 0; this.dur = 0; this.kind = null; this.playing = false; this.N = 0;
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._m = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color(); this._w = new THREE.Color(1, 1, 1);
    this.meshes = {};
    this.MAX = 260;
    this.px = new Float32Array(this.MAX * 3); this.pv = new Float32Array(this.MAX * 3); this.pa = new Float32Array(this.MAX * 3); this.ps = new Float32Array(this.MAX * 3); this.pq = new Float32Array(this.MAX * 4); this.pl = new Float32Array(this.MAX); this.pd = new Float32Array(this.MAX);
    this.flash = null; this.fired = 0; this.fireT = 0;
  }
  _mesh(kind) {
    if (this.meshes[kind]) return this.meshes[kind];
    let geo, mat;
    if (kind === 'shatter') { geo = new THREE.TetrahedronGeometry(0.055, 0); mat = new THREE.MeshStandardMaterial({ color: 0xbfefff, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.92, emissive: 0x2a8fb0, emissiveIntensity: 0.9, flatShading: true }); }
    else if (kind === 'confetti') { geo = new THREE.PlaneGeometry(0.06, 0.1); mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }); }
    else { geo = new THREE.BoxGeometry(0.075, 0.075, 0.075); mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); }
    const m = new THREE.InstancedMesh(geo, mat, this.MAX); m.frustumCulled = false; m.count = 0; m.setColorAt(0, this._c.setHex(0xffffff)); m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(m); this.meshes[kind] = m; return m;
  }
  /** @param spec effect name; color primary; palette array; origin {x,y,z}; radius, height */
  play(kind, color, palette, ox = 0, oz = 0) {
    this.stop(); this.kind = kind; this.t = 0; this.playing = true; this.color = color; this.ox = ox; this.oz = oz; this.fired = 0;
    const pal = palette?.length ? palette : PALETTE;
    if (kind === 'shatter' || kind === 'confetti' || kind === 'pixelate') {
      const m = this._mesh(kind); m.visible = true;
      const N = this.N = kind === 'shatter' ? 200 : kind === 'confetti' ? 250 : 230; m.count = N;
      if (kind === 'shatter') { m.material.color.setHex(color); m.material.emissive.setHex(color).multiplyScalar(0.35); }
      if (kind === 'pixelate') m.material.color.setScalar(1.7);
      this.dur = kind === 'confetti' ? 3.4 : kind === 'pixelate' ? 2.6 : 2.4;
      for (let i = 0; i < N; i++) {
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 0.26, y = 0.12 + Math.random() * 1.62;
        const px = ox + Math.cos(a) * r, pz = oz + Math.sin(a) * r * 0.7;
        this.px[i * 3] = px; this.px[i * 3 + 1] = y; this.px[i * 3 + 2] = pz;
        const dx = Math.cos(a), dz = Math.sin(a), sp = kind === 'shatter' ? 1.2 + Math.random() * 3.2 : kind === 'confetti' ? 0.8 + Math.random() * 2.6 : 0.2 + Math.random() * 0.8;
        this.pv[i * 3] = dx * sp; this.pv[i * 3 + 1] = (kind === 'confetti' ? 2.4 + Math.random() * 3.5 : kind === 'pixelate' ? 0.8 + Math.random() * 1.6 : (y - 0.9) * 0.9 + Math.random() * 2.2); this.pv[i * 3 + 2] = dz * sp;
        this.pa[i * 3] = (Math.random() - 0.5) * 12; this.pa[i * 3 + 1] = (Math.random() - 0.5) * 12; this.pa[i * 3 + 2] = (Math.random() - 0.5) * 12;
        const sc = kind === 'shatter' ? 0.6 + Math.random() * 1.7 : kind === 'confetti' ? 0.8 + Math.random() * 0.9 : 0.7 + Math.random() * 0.9;
        this.ps[i * 3] = this.ps[i * 3 + 1] = this.ps[i * 3 + 2] = sc;
        if (kind === 'shatter') { this.ps[i * 3 + 1] = sc * (0.5 + Math.random()); }
        this.pq[i * 4] = Math.random() - 0.5; this.pq[i * 4 + 1] = Math.random() - 0.5; this.pq[i * 4 + 2] = Math.random() - 0.5; this.pq[i * 4 + 3] = Math.random() - 0.5;
        const qn = Math.hypot(this.pq[i * 4], this.pq[i * 4 + 1], this.pq[i * 4 + 2], this.pq[i * 4 + 3]) || 1; for (let k = 0; k < 4; k++) this.pq[i * 4 + k] /= qn;
        this.pd[i] = Math.random(); this.pl[i] = 0;
        if (kind !== 'shatter') { this._c.setHex(pal[i % pal.length]); if (kind === 'pixelate') this._c.multiplyScalar(0.9 + Math.random() * 0.5); m.setColorAt(i, this._c); }
        else { this._c.setHex(color).lerp(this._w, Math.random() * 0.5); m.setColorAt(i, this._c); }
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    } else if (kind === 'fireworks') {
      this.dur = 3.0; this.fireT = 0.25;
      this.glow.emit(ox, 0.2, oz, 0, 6.0, 0, 0.6, 0.12, 0.05, 0xfff2b0, 0xffb627, SHAPE.spark, -0.2, 0.2, 1);
    } else if (kind === 'petals') {
      this.dur = 3.4;
      for (let i = 0; i < 150; i++) {
        const a = Math.random() * 6.28, r = Math.random() * 0.3;
        this.solid.emit(ox + Math.cos(a) * r, 0.2 + Math.random() * 1.6, oz + Math.sin(a) * r, Math.cos(a) * (0.8 + Math.random() * 1.6), 1.4 + Math.random() * 2.6, Math.sin(a) * (0.8 + Math.random() * 1.6), 2.0 + Math.random() * 1.4, 0.06 + Math.random() * 0.04, 0.05, pal[i % pal.length], pal[(i + 1) % pal.length], SHAPE.petal, 0.9, 0.9, 1, (Math.random() - 0.5) * 6, 3.2);
      }
    } else if (kind === 'stars') {
      this.dur = 3.0;
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * 6.28, r = Math.random() * 0.3;
        this.glow.emit(ox + Math.cos(a) * r, 0.2 + Math.random() * 1.6, oz + Math.sin(a) * r, Math.cos(a) * (0.4 + Math.random() * 1.8), 0.6 + Math.random() * 2.6, Math.sin(a) * (0.4 + Math.random() * 1.8), 1.6 + Math.random() * 1.2, 0.08 + Math.random() * 0.07, 0.03, pal[i % 3 === 0 ? 0 : 1], 0xffe9a8, SHAPE.star, -0.4, 0.8, 1, (Math.random() - 0.5) * 5);
      }
    }
    // flash
    this.flashT = 0.35;
  }
  stop() {
    this.playing = false;
    for (const k in this.meshes) { this.meshes[k].visible = false; this.meshes[k].count = 0; }
    this.kind = null;
  }
  update(dt) {
    if (!this.playing) return;
    this.t += dt; const t = this.t;
    const k = this.kind;
    if (k === 'shatter' || k === 'confetti' || k === 'pixelate') {
      const m = this.meshes[k]; const N = this.N;
      for (let i = 0; i < N; i++) {
        const o = i * 3;
        let g = 9.8, drag = 0.12;
        if (k === 'confetti') { g = 2.0; drag = 1.4; this.pv[o] += Math.sin(t * 6 + i) * 0.9 * dt; this.pv[o + 2] += Math.cos(t * 5 + i * 1.3) * 0.9 * dt; }
        else if (k === 'pixelate') { g = -0.5; drag = 1.3; }
        this.pv[o + 1] -= g * dt; const d = Math.max(0, 1 - drag * dt);
        this.pv[o] *= d; this.pv[o + 2] *= d;
        this.px[o] += this.pv[o] * dt; this.px[o + 1] += this.pv[o + 1] * dt; this.px[o + 2] += this.pv[o + 2] * dt;
        if (this.px[o + 1] < 0.04 && k !== 'pixelate') { this.px[o + 1] = 0.04; this.pv[o + 1] *= -0.35; this.pv[o] *= 0.7; this.pv[o + 2] *= 0.7; }
        // spin: quaternion integrate
        const wx = this.pa[o] * dt, wy = this.pa[o + 1] * dt, wz = this.pa[o + 2] * dt;
        this._q2.set(wx * 0.5, wy * 0.5, wz * 0.5, 1).normalize(); this._q.set(this.pq[i * 4], this.pq[i * 4 + 1], this.pq[i * 4 + 2], this.pq[i * 4 + 3]).multiply(this._q2).normalize();
        this.pq[i * 4] = this._q.x; this.pq[i * 4 + 1] = this._q.y; this.pq[i * 4 + 2] = this._q.z; this.pq[i * 4 + 3] = this._q.w;
        // scale envelope
        let s = 1; const rem = this.dur - t;
        if (rem < 0.7) s = Math.max(0, rem / 0.7);
        if (k === 'pixelate') { s *= 0.25 + 0.75 * (Math.floor((0.4 + t * 1.2) * 4) % 4 === (i & 3) ? 1 : 0.65) ; s = Math.floor(s * 5) / 5; if (t < 0.12) s *= t / 0.12; }
        this._p.set(k === 'pixelate' ? Math.round(this.px[o] / 0.08) * 0.08 : this.px[o], k === 'pixelate' ? Math.round(this.px[o + 1] / 0.08) * 0.08 : this.px[o + 1], k === 'pixelate' ? Math.round(this.px[o + 2] / 0.08) * 0.08 : this.px[o + 2]);
        this._s.set(this.ps[o] * s, this.ps[o + 1] * s, this.ps[o + 2] * s);
        this._m.compose(this._p, k === 'pixelate' ? this._q.identity() : this._q, this._s);
        m.setMatrixAt(i, this._m);
      }
      m.instanceMatrix.needsUpdate = true;
      if (k === 'shatter') m.material.opacity = 0.95 - Math.max(0, (t - 1.6) * 0.5);
      // sparkle glints on shatter
      if (k === 'shatter' && t < 0.5 && Math.random() < 0.7) this.glow.emit(this.ox + (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 1.4, this.oz + (Math.random() - 0.5) * 0.4, 0, 0, 0, 0.35, 0.3, 0.02, 0xffffff, this.color, SHAPE.star, 0, 0, 1, 3);
      if (k === 'pixelate' && t < 1.6 && Math.random() < 0.5) this.glow.emit(this.ox + (Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 1.6, this.oz + (Math.random() - 0.5) * 0.4, 0, 0.5 + Math.random(), 0, 0.5, 0.09, 0.02, this.color, 0xffffff, SHAPE.square, 0, 0, 0.8, 0, 0, 0.02);
    } else if (k === 'fireworks') {
      // rocket rises 0.6 s then bursts into three coloured bloom shells
      if (this.fired === 0 && t > 0.55) {
        this.fired = 1;
        const cx = this.ox, cy = 2.05, cz = this.oz, cols = [this.color, 0xff5a3c, 0xffe9a8, 0xff9ad5];
        for (let s = 0; s < 3; s++) {
          const c1 = cols[s], c2 = cols[s + 1], ox = (s - 1) * 0.35, oy = s * 0.18;
          for (let i = 0; i < 70; i++) {
            const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u), sp = 1.7 + Math.random() * 1.6 - s * 0.35;
            this.glow.emit(cx + ox, cy + oy, cz, Math.cos(a) * r * sp, u * sp, Math.sin(a) * r * sp, 1.5 + Math.random() * 0.8, 0.12, 0.02, c1, c2, SHAPE.spark, 3.2, 1.4, 1);
          }
        }
        for (let i = 0; i < 28; i++) this.glow.emit(cx, cy, cz, (Math.random() - 0.5) * 3.4, (Math.random() - 0.5) * 3.4, (Math.random() - 0.5) * 3.4, 0.9, 0.34, 0.05, 0xffffff, this.color, SHAPE.glow, 0, 0.8, 0.9);
        this.glow.emit(cx, cy, cz, 0, 0, 0, 0.5, 0.2, 2.2, 0xfff0c0, 0xffb627, SHAPE.ring, 0, 0, 0.9);
        this.flashT = 0.4;
      }
      if (t < 0.55) this.glow.emit(this.ox, 0.2 + t * 3.4, this.oz, (Math.random() - 0.5) * 0.3, -0.5, (Math.random() - 0.5) * 0.3, 0.5, 0.09, 0.01, 0xffe08a, 0xff8a3c, SHAPE.spark, 0, 0.5, 1);
      if (t > 0.55 && t < 1.4 && Math.random() < 0.45) { const c = Math.random() < 0.5 ? this.color : 0xffffff; this.glow.emit(this.ox + (Math.random() - 0.5) * 2, 1.4 + Math.random() * 1.2, this.oz + (Math.random() - 0.5) * 1, 0, -0.5, 0, 0.9, 0.16, 0.02, c, 0xff7a3c, SHAPE.spark, 0.5, 0.3, 1, 0); }
    } else if (k === 'petals' || k === 'stars') { /* fully particle driven at play() */ }
    if (t >= this.dur) { this.playing = false; this.stop(); }
  }
  get progress() { return this.playing ? this.t / this.dur : 1; }
  dispose() { for (const k in this.meshes) { this.meshes[k].geometry.dispose(); this.meshes[k].material.dispose(); this.meshes[k].dispose?.(); } this.group.removeFromParent(); }
}
