// Tag-out particle effects: body-shaped light shards / confetti / pixels / fireworks / petals / stars with soft physics.
// Struct-of-arrays CPU sim, one InstancedMesh per shape kind, swap-remove, zero per-frame allocation. Harmless: no gore.
import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { hull, place, boxP, slabP, sphereP, V } from './geo.js';

const CAP = 700;
const KINDS = { shard: 0, quad: 1, cube: 2, star: 3, spark: 4, glint: 5 };
const NK = 6;

function shardGeo() {  // irregular flat crystal splinter
  const g = hull([V(0, 0.5, 0.01), V(-0.32, -0.45, 0.07), V(0.3, -0.5, 0.1), V(0.02, -0.4, -0.12), V(-0.1, 0.05, -0.06), V(0.14, 0.1, 0.09)]);
  return g;
}
function quadGeo() { return hull(boxP(1, 0.55, 0.06, 0.01)); }
function cubeGeo() { return hull(boxP(1, 1, 1, 0.08)); }
function starGeo() {
  const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.22 : 0.5, a = (i / 10) * Math.PI * 2 + Math.PI / 2; p.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return hull(slabP(p, 0.12));
}
function sparkGeo() { return hull([V(0, 0, 0.5), V(0, 0, -0.5), V(0.18, 0, 0), V(-0.18, 0, 0), V(0, 0.18, 0), V(0, -0.18, 0)]); }
function glintGeo() { return hull(sphereP(0.5, 0.5, 0.5, 0)); }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _c = new THREE.Color();

export function createTagOutFx(ctx, parent) {
  const group = new THREE.Group(); group.name = 'tagout-fx'; parent.add(group);
  const litMat = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.25, emissive: 0x0a1218, flatShading: false });
  const glowMat = new THREE.MeshBasicMaterial({ toneMapped: true });
  const geos = [shardGeo(), quadGeo(), cubeGeo(), starGeo(), sparkGeo(), glintGeo()];
  const mats = [litMat, litMat, litMat, glowMat, glowMat, glowMat];
  const meshes = [], S = [];
  for (let k = 0; k < NK; k++) {
    const im = new THREE.InstancedMesh(geos[k], mats[k], CAP); im.count = 0; im.frustumCulled = false; im.castShadow = k < 3; im.name = 'tagout-' + k;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    group.add(im); meshes.push(im);
    const f = (n) => new Float32Array(CAP * n);
    S.push({ n: 0, p: f(3), v: f(3), q: f(4), w: f(3), life: f(1), max: f(1), size: f(3), g: f(1), drag: f(1), bounce: f(1), sway: f(2), floor: f(1), fade: f(1), col: f(3), flags: new Uint8Array(CAP), t: f(1), pop: f(4) });
  }
  const pend = [];   // delayed fireworks pops
  let floorY = 0;

  function spawn(k, px, py, pz, vx, vy, vz, sx, sy, sz, r, g, b, life, o = {}) {
    const s = S[k]; if (s.n >= CAP) return -1; const i = s.n++;
    s.p[i * 3] = px; s.p[i * 3 + 1] = py; s.p[i * 3 + 2] = pz; s.v[i * 3] = vx; s.v[i * 3 + 1] = vy; s.v[i * 3 + 2] = vz;
    const rr = rng.next, qx = rr() - 0.5, qy = rr() - 0.5, qz = rr() - 0.5, qw = rr() - 0.5, ql = Math.hypot(qx, qy, qz, qw) || 1;
    s.q[i * 4] = qx / ql; s.q[i * 4 + 1] = qy / ql; s.q[i * 4 + 2] = qz / ql; s.q[i * 4 + 3] = qw / ql;
    const sp = o.spin ?? 10; s.w[i * 3] = (rr() - 0.5) * sp; s.w[i * 3 + 1] = (rr() - 0.5) * sp; s.w[i * 3 + 2] = (rr() - 0.5) * sp;
    s.life[i] = life; s.max[i] = life; s.size[i * 3] = sx; s.size[i * 3 + 1] = sy; s.size[i * 3 + 2] = sz;
    s.g[i] = o.g ?? -9; s.drag[i] = o.drag ?? 0.3; s.bounce[i] = o.bounce ?? 0.35; s.sway[i * 2] = o.swayAmp ?? 0; s.sway[i * 2 + 1] = o.swayFreq ?? 0;
    s.floor[i] = o.floor ?? floorY; s.fade[i] = o.fade ?? 0.4; s.t[i] = -(o.delay ?? 0); s.flags[i] = o.flags ?? 0;
    s.col[i * 3] = r; s.col[i * 3 + 1] = g; s.col[i * 3 + 2] = b; if (o.pop) { s.pop[i * 4] = o.pop; s.pop[i * 4 + 1] = r; s.pop[i * 4 + 2] = g; s.pop[i * 4 + 3] = b; } else s.pop[i * 4] = 0;
    const ic = meshes[k].instanceColor.array; ic[i * 3] = r; ic[i * 3 + 1] = g; ic[i * 3 + 2] = b;
    return i;
  }
  function kill(k, i) {
    const s = S[k], j = --s.n; if (i === j) return;
    const mm = meshes[k].instanceMatrix.array; mm.copyWithin(i * 16, j * 16, j * 16 + 16);
    const cp = (a, n) => { for (let c = 0; c < n; c++) a[i * n + c] = a[j * n + c]; };
    cp(s.p, 3); cp(s.v, 3); cp(s.q, 4); cp(s.w, 3); cp(s.life, 1); cp(s.max, 1); cp(s.size, 3); cp(s.g, 1); cp(s.drag, 1); cp(s.bounce, 1); cp(s.sway, 2); cp(s.floor, 1); cp(s.fade, 1); cp(s.col, 3); cp(s.t, 1); cp(s.pop, 4);
    s.flags[i] = s.flags[j];
    const ic = meshes[k].instanceColor.array; ic[i * 3] = ic[j * 3]; ic[i * 3 + 1] = ic[j * 3 + 1]; ic[i * 3 + 2] = ic[j * 3 + 2];
  }
  const fireworkPop = (x, y, z, r, g, b) => {
    for (let i = 0; i < 24; i++) {
      const th = rng.next() * 6.2832, ph = Math.acos(2 * rng.next() - 1), sp = 2.6 + rng.next() * 2.4, w = i % 4 === 0;
      spawn(KINDS.spark, x, y, z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp, 0.03, 0.03, 0.22, (w ? 1 : r) * 3, (w ? 1 : g) * 3, (w ? 1 : b) * 3, 0.9 + rng.next() * 0.5, { g: -3.2, drag: 1.4, bounce: 0, spin: 0, fade: 0.4, flags: 1 });
    }
    spawn(KINDS.glint, x, y, z, 0, 0, 0, 0.9, 0.9, 0.9, r * 4, g * 4, b * 4, 0.2, { g: 0, drag: 0, spin: 0, fade: 0.2, bounce: 0 });
  };

  function update(dt) {
    dt = Math.min(dt, 0.05);
    for (let pi = pend.length - 1; pi >= 0; pi--) { const p = pend[pi]; p.t -= dt; if (p.t <= 0) { fireworkPop(p.x, p.y, p.z, p.r, p.g, p.b); pend.splice(pi, 1); } }
    let any = false;
    for (let k = 0; k < NK; k++) {
      const s = S[k], im = meshes[k], me = im.instanceMatrix.array;
      for (let i = s.n - 1; i >= 0; i--) {
        s.t[i] += dt; let tt = s.t[i];
        if (tt < 0) { me.fill(0, i * 16, i * 16 + 16); continue; }
        s.life[i] -= dt;
        if (s.life[i] <= 0) {
          if (s.pop[i * 4] > 0) fireworkPop(s.p[i * 3], s.p[i * 3 + 1], s.p[i * 3 + 2], s.pop[i * 4 + 1], s.pop[i * 4 + 2], s.pop[i * 4 + 3]);
          kill(k, i); continue;
        }
        const i3 = i * 3;
        let vx = s.v[i3], vy = s.v[i3 + 1], vz = s.v[i3 + 2];
        vy += s.g[i] * dt; const d = Math.max(0, 1 - s.drag[i] * dt); vx *= d; vy *= d; vz *= d;
        if (s.sway[i * 2] > 0) { const f = s.sway[i * 2 + 1] * tt + i; vx += Math.sin(f) * s.sway[i * 2] * dt; vz += Math.cos(f * 1.3) * s.sway[i * 2] * dt; }
        let px = s.p[i3] + vx * dt, py = s.p[i3 + 1] + vy * dt, pz = s.p[i3 + 2] + vz * dt;
        const sz = Math.max(s.size[i3], s.size[i3 + 1]) * 0.5, fl = s.floor[i] + Math.min(sz, 0.05);
        let landed = false;
        if (py < fl) { py = fl; if (vy < -0.6) { vy = -vy * s.bounce[i]; vx *= 0.65; vz *= 0.65; s.w[i3] *= 0.5; s.w[i3 + 1] *= 0.5; s.w[i3 + 2] *= 0.5; } else { vy = 0; vx *= 0.8; vz *= 0.8; landed = true; } }
        s.v[i3] = vx; s.v[i3 + 1] = vy; s.v[i3 + 2] = vz; s.p[i3] = px; s.p[i3 + 1] = py; s.p[i3 + 2] = pz;
        // rotation integration
        const wx = landed ? 0 : s.w[i3], wy = landed ? 0 : s.w[i3 + 1], wz = landed ? 0 : s.w[i3 + 2];
        const qx = s.q[i * 4], qy = s.q[i * 4 + 1], qz = s.q[i * 4 + 2], qw = s.q[i * 4 + 3], h = 0.5 * dt;
        let nx = qx + h * (wx * qw + wy * qz - wz * qy), ny = qy + h * (wy * qw + wz * qx - wx * qz), nz = qz + h * (wz * qw + wx * qy - wy * qx), nw = qw + h * (-wx * qx - wy * qy - wz * qz);
        const nl = 1 / (Math.hypot(nx, ny, nz, nw) || 1); nx *= nl; ny *= nl; nz *= nl; nw *= nl;
        s.q[i * 4] = nx; s.q[i * 4 + 1] = ny; s.q[i * 4 + 2] = nz; s.q[i * 4 + 3] = nw;
        // scale: pop in, shrink out
        const lf = s.life[i], fade = s.fade[i], sc = Math.min(1, tt * 14 + 0.25) * (lf < fade ? lf / fade : 1);
        let ax = s.size[i3] * sc, ay = s.size[i3 + 1] * sc, az = s.size[i3 + 2] * sc;
        if (k === KINDS.glint) { const fl2 = 0.6 + 0.4 * Math.sin(tt * 40 + i * 7); ax *= fl2; ay *= fl2; az *= fl2; }
        let R0, R1, R2, R3, R4, R5, R6, R7, R8;
        if (k === KINDS.spark && s.flags[i] === 1) {   // streak aligned to velocity
          const sp = Math.hypot(vx, vy, vz) || 1, dx = vx / sp, dy = vy / sp, dz = vz / sp;
          // build basis with z along velocity
          let ux = 0, uy = 1, uz = 0; if (Math.abs(dy) > 0.95) { ux = 1; uy = 0; }
          let rx = uy * dz - uz * dy, ry = uz * dx - ux * dz, rz = ux * dy - uy * dx; const rl = 1 / (Math.hypot(rx, ry, rz) || 1); rx *= rl; ry *= rl; rz *= rl;
          const tx = dy * rz - dz * ry, ty = dz * rx - dx * rz, tz = dx * ry - dy * rx;
          R0 = rx * ax; R1 = ry * ax; R2 = rz * ax; R3 = tx * ay; R4 = ty * ay; R5 = tz * ay; R6 = dx * az * (1 + sp * 0.12); R7 = dy * az * (1 + sp * 0.12); R8 = dz * az * (1 + sp * 0.12);
        } else {
          const xx = nx * nx, yy = ny * ny, zz = nz * nz, xy = nx * ny, xz = nx * nz, yz = ny * nz, wx2 = nw * nx, wy2 = nw * ny, wz2 = nw * nz;
          R0 = (1 - 2 * (yy + zz)) * ax; R1 = 2 * (xy + wz2) * ax; R2 = 2 * (xz - wy2) * ax;
          R3 = 2 * (xy - wz2) * ay; R4 = (1 - 2 * (xx + zz)) * ay; R5 = 2 * (yz + wx2) * ay;
          R6 = 2 * (xz + wy2) * az; R7 = 2 * (yz - wx2) * az; R8 = (1 - 2 * (xx + yy)) * az;
        }
        const o = i * 16; me[o] = R0; me[o + 1] = R1; me[o + 2] = R2; me[o + 3] = 0; me[o + 4] = R3; me[o + 5] = R4; me[o + 6] = R5; me[o + 7] = 0; me[o + 8] = R6; me[o + 9] = R7; me[o + 10] = R8; me[o + 11] = 0;
        me[o + 12] = px; me[o + 13] = py; me[o + 14] = pz; me[o + 15] = 1;
      }
      im.count = s.n;
      if (s.n > 0 || im.userData.was) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
      im.userData.was = s.n > 0; im.visible = s.n > 0; if (s.n > 0) any = true;
    }
    return any;
  }

  // ------------------------------------------------------------- recipes
  const P = () => rng.next();
  const lerpc = (a, b, t) => a + (b - a) * t;
  /**
   * @param samples function(out:{x,y,z}) -> writes a random point inside the actor's body volume
   * @param pal array of [r,g,b] linear colours (HDR ok) : [0]=team, others = suit/accent/visor
   */
  function burst(style, { samples, dir, center, floor, pal, team }) {
    floorY = floor; const pt = { x: 0, y: 0, z: 0 };
    const dx = dir.x, dz = dir.z, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
    const rad = (o) => { const ox = pt.x - center.x, oz = pt.z - center.z, l = Math.hypot(ox, oz) || 1; o.x = ox / l; o.z = oz / l; return o; };
    const r2 = { x: 0, z: 0 }, ice = [0.75, 0.93, 1.0];
    const pickc = () => pal[(P() * pal.length) | 0];
    const N = (n) => n;
    switch (style) {
      case 'confetti': {
        const rain = [[1, 0.25, 0.4], [1, 0.8, 0.2], [0.3, 0.9, 0.5], [0.3, 0.6, 1], [0.9, 0.4, 1]];
        for (let i = 0; i < N(130); i++) {
          samples(pt); rad(r2); const sp = 2.5 + P() * 3.5, c = P() < 0.45 ? pickc() : rain[(P() * 5) | 0], s = 0.05 + P() * 0.045;
          spawn(KINDS.quad, pt.x, pt.y, pt.z, r2.x * sp + ux * 2.2, 1.2 + P() * 3.6, r2.z * sp + uz * 2.2, s * 1.5, s, s, c[0] * 1.3, c[1] * 1.3, c[2] * 1.3, 2.2 + P() * 1.4, { g: -2.6, drag: 2.4, bounce: 0.15, swayAmp: 3.2, swayFreq: 5 + P() * 5, spin: 22 });
        } break;
      }
      case 'pixelate': {
        for (let i = 0; i < N(96); i++) {
          samples(pt); rad(r2); const sp = 0.8 + P() * 1.8, c = pickc(), s = 0.05 + P() * 0.045, q = 0.09;
          spawn(KINDS.cube, Math.round(pt.x / q) * q, Math.round(pt.y / q) * q, Math.round(pt.z / q) * q, r2.x * sp + ux * 1.2, 1.5 + P() * 3.2, r2.z * sp + uz * 1.2, s, s, s, c[0], c[1], c[2], 1.6 + P() * 1.0, { g: -8, drag: 0.4, bounce: 0.5, spin: 5, fade: 0.3, delay: P() * 0.12 });
        } break;
      }
      case 'fireworks': {
        for (let i = 0; i < 3; i++) {
          samples(pt); const c = i === 0 ? pal[0] : pickc();
          spawn(KINDS.spark, pt.x, pt.y, pt.z, (P() - 0.5) * 1.6, 6 + P() * 2.5, (P() - 0.5) * 1.6, 0.04, 0.04, 0.3, 3 * c[0] + 1, 3 * c[1] + 1, 3 * c[2] + 1, 0.42 + P() * 0.2, { g: -1.5, drag: 0.2, bounce: 0, spin: 0, fade: 0.05, flags: 1, pop: 1 });
        }
        for (let i = 0; i < 46; i++) {
          samples(pt); rad(r2); const sp = 1.5 + P() * 3, c = P() < 0.5 ? pal[0] : pickc();
          spawn(KINDS.spark, pt.x, pt.y, pt.z, r2.x * sp + ux, 1 + P() * 3.5, r2.z * sp + uz, 0.03, 0.03, 0.2, c[0] * 3, c[1] * 3, c[2] * 3, 0.7 + P() * 0.6, { g: -6, drag: 1.2, bounce: 0.3, spin: 0, flags: 1 });
        } break;
      }
      case 'petals': {
        const pink = [[1, 0.55, 0.7], [1, 0.85, 0.9], [1, 0.4, 0.6]];
        for (let i = 0; i < N(120); i++) {
          samples(pt); rad(r2); const sp = 1.2 + P() * 2.4, c = P() < 0.3 ? pal[0] : pink[(P() * 3) | 0], s = 0.055 + P() * 0.04;
          spawn(KINDS.quad, pt.x, pt.y, pt.z, r2.x * sp + ux * 1.4, 1 + P() * 2.6, r2.z * sp + uz * 1.4, s * 1.7, s * 0.9, s, c[0], c[1], c[2], 3 + P() * 1.5, { g: -0.9, drag: 1.7, bounce: 0.05, swayAmp: 2.2, swayFreq: 2 + P() * 3, spin: 6, fade: 0.8 });
        } break;
      }
      case 'stars': {
        const gold = [[1, 0.85, 0.3], [1, 1, 1], [1, 0.6, 0.85]];
        for (let i = 0; i < N(50); i++) {
          samples(pt); rad(r2); const sp = 1 + P() * 2.6, c = P() < 0.35 ? pal[0] : gold[(P() * 3) | 0], s = 0.09 + P() * 0.08;
          spawn(KINDS.star, pt.x, pt.y, pt.z, r2.x * sp + ux, 1.5 + P() * 3.2, r2.z * sp + uz, s, s, s, c[0] * 2.4, c[1] * 2.4, c[2] * 2.4, 1.8 + P() * 1.0, { g: -0.9, drag: 1.1, bounce: 0.2, spin: 8, fade: 0.6 });
        } break;
      }
      default: { // shatter: crystal splinters, team-tinted
        for (let i = 0; i < N(80); i++) {
          samples(pt); rad(r2); const sp = 1.6 + P() * 3.4, s = 0.07 + P() * 0.09, k = P(), c = k < 0.55 ? ice : k < 0.8 ? pal[0] : pal[1 + ((P() * (pal.length - 1)) | 0)];
          const m = k < 0.55 ? 1 : 1.6;
          spawn(KINDS.shard, pt.x, pt.y, pt.z, r2.x * sp + ux * (1.8 + P() * 2.5), 1.4 + P() * 3.4, r2.z * sp + uz * (1.8 + P() * 2.5), s * 0.7, s * 1.5, s * 0.7, c[0] * m, c[1] * m, c[2] * m, 2 + P() * 0.9, { g: -9.5, drag: 0.35, bounce: 0.34, spin: 18 });
        }
      }
    }
    // shared light dust (glints)
    for (let i = 0; i < 34; i++) {
      samples(pt); rad(r2); const sp = 0.6 + P() * 2.2, c = P() < 0.5 ? pal[0] : ice, m = 3.2;
      spawn(KINDS.glint, pt.x, pt.y, pt.z, r2.x * sp, 0.4 + P() * 2.2, r2.z * sp, 0.035 + P() * 0.03, 0.035 + P() * 0.03, 0.035 + P() * 0.03, c[0] * m, c[1] * m, c[2] * m, 0.5 + P() * 0.9, { g: -0.5, drag: 1.5, bounce: 0, spin: 0, fade: 0.4 });
    }
    // core flash
    spawn(KINDS.glint, center.x, center.y, center.z, 0, 0, 0, 1.1, 1.1, 1.1, pal[0][0] * 3 + 1, pal[0][1] * 3 + 1, pal[0][2] * 3 + 1, 0.16, { g: 0, drag: 0, spin: 0, fade: 0.16 });
  }
  function clear() { for (let k = 0; k < NK; k++) { S[k].n = 0; meshes[k].count = 0; meshes[k].visible = false; } pend.length = 0; }
  function count() { let n = 0; for (let k = 0; k < NK; k++) n += S[k].n; return n; }
  return { group, update, burst, clear, count, dispose() { for (const g of geos) g.dispose(); litMat.dispose(); glowMat.dispose(); group.removeFromParent(); } };
}
