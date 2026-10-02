// First-person effects: muzzle flash (faceted starburst + forward cone + glow + point light), ejected glowing cells (pooled),
// swing trail ribbon, vent puffs. Everything is pooled / preallocated; nothing allocates per frame.
import * as THREE from 'three';
import { Part, toGeometries } from './geo.js';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Color();
let _seed = 1234567;
export const frand = () => { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; };
export const seedFx = (s) => { _seed = (s % 2147483646) + 1; };

function glowTexture() {
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const starCache = new Map();
/** Faceted starburst in the XY plane (normal +Z). Centre bright, tips dark (additive => fades out). */
function starGeo(spikes, inner = 0.34) {
  const key = spikes + ':' + inner; if (starCache.has(key)) return starCache.get(key);
  const n = spikes * 2, pos = [], col = [];
  const ringP = [], ringC = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2 ? 0 : 0.0), tip = i % 2 === 0, r = tip ? 1 * (0.72 + 0.28 * ((i * 7919 % 13) / 13)) : inner;
    ringP.push([Math.cos(a) * r, Math.sin(a) * r]); ringC.push(tip ? [0.42, 0.14, 0.02] : [0.85, 0.55, 0.2]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    pos.push(0, 0, 0, ringP[i][0], ringP[i][1], 0, ringP[j][0], ringP[j][1], 0);
    col.push(1, 0.97, 0.85, ...ringC[i], ...ringC[j]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  starCache.set(key, g); return g;
}
function coneGeo() {  // 4-sided elongated pyramid, base at z=0 (radius 1), apex at z=-1; base bright, apex dark
  const p = [], c = []; const B = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let i = 0; i < 4; i++) { const a = B[i], b = B[(i + 1) % 4]; p.push(a[0], a[1], 0, b[0], b[1], 0, 0, 0, -1); c.push(0.95, 0.6, 0.2, 0.95, 0.6, 0.2, 0.05, 0.02, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g;
}
function ringGeo() {  // flat annulus for the halo pulse
  const p = [], c = [], n = 16;
  for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, r0 = 0.7, r1 = 1;
    const A = [Math.cos(a0) * r0, Math.sin(a0) * r0], B = [Math.cos(a0) * r1, Math.sin(a0) * r1], C = [Math.cos(a1) * r0, Math.sin(a1) * r0], D = [Math.cos(a1) * r1, Math.sin(a1) * r1];
    p.push(A[0], A[1], 0, B[0], B[1], 0, D[0], D[1], 0, A[0], A[1], 0, D[0], D[1], 0, C[0], C[1], 0);
    c.push(1, 0.9, 0.8, 0.2, 0.1, 0.05, 0.2, 0.1, 0.05, 1, 0.9, 0.8, 0.2, 0.1, 0.05, 1, 0.9, 0.8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g;
}

export function createFx({ muzzle, castRoot, root }) {
  const add = (o) => { o.depthWrite = false; o.blending = THREE.AdditiveBlending; o.transparent = true; o.toneMapped = false; return o; };
  const starMat = add(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0xffffff }));
  const coneMat = add(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0xffffff }));
  const glowMat = add(new THREE.MeshBasicMaterial({ map: typeof document !== 'undefined' ? glowTexture() : null, color: 0xffffff }));
  const flash = new THREE.Group(); flash.visible = false; flash.name = 'muzzle-flash'; muzzle.add(flash);
  const star = new THREE.Mesh(starGeo(8), starMat), star2 = new THREE.Mesh(starGeo(5, 0.3), starMat), cone = new THREE.Mesh(coneGeo(), coneMat), cone2 = new THREE.Mesh(coneGeo(), coneMat);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat), ringM = new THREE.Mesh(ringGeo(), starMat);
  cone2.rotation.z = Math.PI / 4; ringM.visible = false;
  for (const m of [glow, star, star2, cone, cone2, ringM]) { m.renderOrder = 10; m.frustumCulled = false; flash.add(m); }
  const light = new THREE.PointLight(0xffa040, 0, 1.6, 2); light.position.set(0, 0.01, -0.06); muzzle.add(light);
  const F = { t: 0, life: 0.06, size: 1, style: 'star', tint: new THREE.Color(1, 0.6, 0.2), lightPeak: 3 };

  // ---- ejected cells ----
  const cp = new Part('c', [0, 0, 0]); cp.cylX('glow', [0, 0, 0], 0.5, 0.5, 2.1, 6); cp.cylX('glow', [1.15, 0, 0], 0.62, 0.62, 0.35, 6, { shade: 0.25 }); cp.cylX('glow', [-1.15, 0, 0], 0.62, 0.62, 0.35, 6, { shade: 0.25 });
  const cellGeo = toGeometries(cp).get('glow');
  const cellMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: 0xffffff });
  const CAP = 18, cells = [];
  for (let i = 0; i < CAP; i++) { const m = new THREE.Mesh(cellGeo, cellMat); m.visible = false; m.frustumCulled = false; castRoot.add(m); cells.push({ m, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, life: 0, max: 1, size: 1 }); }
  let nextCell = 0;

  // ---- muzzle smoke puffs (view-space billboards, normal blending) ----
  const gtex = glowTexture(), PUFF = 10, puffs = [];
  for (let i = 0; i < PUFF; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: gtex, color: 0x9a9aa6, transparent: true, depthWrite: false, opacity: 0 })); m.visible = false; m.frustumCulled = false; m.renderOrder = 8; castRoot.add(m); puffs.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0.05, s1: 0.2, a: 0.3 }); }
  let nextPuff = 0;

  // ---- big dropped cell (reload) : dim cell casing box ----
  const bigMat = new THREE.MeshBasicMaterial({ toneMapped: false, color: 0xffffff, vertexColors: false });
  const bigGeo = new THREE.BoxGeometry(1, 1, 1);
  const dropped = { m: new THREE.Mesh(bigGeo, bigMat), vy: 0, vx: 0, vz: 0, life: 0, sx: 0, sz: 0 }; dropped.m.visible = false; dropped.m.frustumCulled = false; castRoot.add(dropped.m);

  // ---- swing trail ribbon ----
  const TN = 14, tpos = new Float32Array(TN * 2 * 3), tcol = new Float32Array(TN * 2 * 3), idx = [];
  for (let i = 0; i < TN - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3)); tg.setIndex(idx);
  const trailMat = add(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const trail = new THREE.Mesh(tg, trailMat); trail.frustumCulled = false; trail.visible = false; trail.renderOrder = 9; castRoot.add(trail);
  const T = { n: 0, on: false, fade: 0, color: new THREE.Color(1, 0.7, 0.2), head: 0, ring: new Float32Array(TN * 6) };

  const api = {
    flashLife() { return F.t; },
    /** Trigger a muzzle flash. spec = profile.flash, colour = THREE.Color of the tagger glow. */
    fire(spec, color, power = 1) {
      F.t = F.life = spec.style === 'bolt' ? 0.1 : spec.style === 'wide' ? 0.085 : 0.07; F.size = spec.size * (0.9 + frand() * 0.25) * power; F.style = spec.style;
      F.tint.copy(color).lerp(_c.set(1, 0.75, 0.35), 0.35);
      starMat.color.copy(F.tint).multiplyScalar(2.2); coneMat.color.copy(F.tint).multiplyScalar(2.0); glowMat.color.copy(F.tint).multiplyScalar(1.6);
      star.geometry = starGeo(spec.spikes || 8); star.rotation.z = frand() * 6.28; star2.rotation.z = frand() * 6.28;
      cone.rotation.z = frand() * 1.5; cone2.rotation.z = cone.rotation.z + Math.PI / 4;
      ringM.visible = spec.style === 'ring';
      cone.scale.set(0.03 * F.size, 0.03 * F.size, 0.09 * F.size * spec.len); cone2.scale.copy(cone.scale);
      flash.visible = true; light.color.copy(F.tint); F.lightPeak = 2.2 * spec.size;
    },
    /** Smoke puff at a view-space point. size ~1 for a rifle. */
    smoke(px, py, pz, size = 1, n = 2) {
      for (let k = 0; k < n; k++) {
        const c = puffs[nextPuff]; nextPuff = (nextPuff + 1) % PUFF;
        c.m.position.set(px + (frand() - 0.5) * 0.02, py + (frand() - 0.5) * 0.02, pz - 0.02 - k * 0.04); c.vx = (frand() - 0.5) * 0.05; c.vy = 0.03 + frand() * 0.05; c.vz = -0.18 - frand() * 0.15;
        c.life = c.max = 0.5 + frand() * 0.25; c.s0 = (0.05 + 0.02 * k) * size; c.s1 = (0.2 + 0.07 * k) * size; c.a = 0.3 + frand() * 0.12; c.m.visible = true; c.m.material.color.setRGB(0.78, 0.66, 0.55);
      }
    },
    /** Eject a glowing cell from world position/velocity given in view (castRoot) space. */
    eject(px, py, pz, vx, vy, vz, color, size = 1) {
      const c = cells[nextCell]; nextCell = (nextCell + 1) % CAP;
      c.m.position.set(px, py, pz); c.vx = vx; c.vy = vy; c.vz = vz; c.sx = (frand() - 0.5) * 22; c.sy = (frand() - 0.5) * 22; c.sz = (frand() - 0.5) * 30;
      c.m.rotation.set(frand() * 6, frand() * 6, frand() * 6); c.life = c.max = 0.7 + frand() * 0.25; c.size = size; c.m.scale.setScalar(size); c.m.visible = true;
      cellMat.color.copy(color).multiplyScalar(2.0);
    },
    drop(px, py, pz, w, h, d, color, vx = 0.15, vy = 0.25) {
      dropped.m.position.set(px, py, pz); dropped.m.scale.set(w, h, d); dropped.vx = vx; dropped.vy = vy; dropped.vz = 0.05; dropped.life = 0.8; dropped.m.visible = true; dropped.sx = 3; dropped.sz = -2;
      bigMat.color.copy(color).multiplyScalar(0.7);
    },
    trailStart(color) { T.on = true; T.n = 0; T.color.copy(color); T.fade = 1; trail.visible = true; },
    trailStop() { T.on = false; },
    /** push a ribbon sample (tip + base, castRoot space) */
    trailPush(tx, ty, tz, bx, by, bz) {
      const r = T.ring; for (let i = TN - 1; i > 0; i--) for (let k = 0; k < 6; k++) r[i * 6 + k] = r[(i - 1) * 6 + k];
      r[0] = tx; r[1] = ty; r[2] = tz; r[3] = bx; r[4] = by; r[5] = bz; T.n = Math.min(TN, T.n + 1);
    },
    update(dt) {
      if (F.t > 0) {
        F.t -= dt; const u = Math.max(0, F.t) / F.life;  // 1 -> 0
        if (F.t <= 0) { flash.visible = false; light.intensity = 0; }
        else {
          const e = u * u, s = F.size;
          star.scale.setScalar(0.125 * s * (0.65 + 0.7 * u)); star2.scale.setScalar(0.088 * s * (0.55 + 0.6 * u)); glow.scale.setScalar(0.32 * s * (0.6 + 0.5 * u)); glow.material.opacity = 1;
          cone.scale.z = (F.style === 'bolt' ? 0.5 : 0.24) * s * (1 + (1 - u) * 0.7); cone2.scale.z = cone.scale.z; cone.scale.x = cone.scale.y = cone2.scale.x = cone2.scale.y = 0.042 * s * (0.5 + u);
          if (F.style === 'wide') { cone.scale.x = cone.scale.y = cone2.scale.x = cone2.scale.y = 0.06 * s * (0.5 + u); }
          if (ringM.visible) { ringM.scale.setScalar(0.035 * s + (1 - u) * 0.12 * s); }
          light.intensity = F.lightPeak * e;
          starMat.opacity = coneMat.opacity = glowMat.opacity = 0.25 + 0.75 * u;
        }
      }
      for (const c of puffs) if (c.life > 0) {
        c.life -= dt; if (c.life <= 0) { c.m.visible = false; continue; }
        const k = 1 - c.life / c.max; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.vz *= 1 - 2.2 * dt; c.vy *= 1 - 1.0 * dt;
        c.m.scale.setScalar(c.s0 + (c.s1 - c.s0) * Math.sqrt(k)); c.m.material.opacity = c.a * (1 - k) * Math.min(1, k * 8);
        const g = 0.78 + 0.0 * k; c.m.material.color.setRGB(0.78 + (0.62 - 0.78) * k, 0.66 + (0.62 - 0.66) * k, 0.55 + (0.66 - 0.55) * k); void g;
      }
      for (const c of cells) if (c.life > 0) {
        c.life -= dt; if (c.life <= 0) { c.m.visible = false; continue; }
        c.vy -= 7.0 * dt; c.vx *= 1 - 0.6 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
        c.m.rotation.x += c.sx * dt; c.m.rotation.y += c.sy * dt; c.m.rotation.z += c.sz * dt;
        const k = c.life / c.max; c.m.scale.setScalar(c.size * (k < 0.25 ? k * 4 : 1));
      }
      if (dropped.life > 0) {
        dropped.life -= dt; if (dropped.life <= 0) dropped.m.visible = false; else {
          dropped.vy -= 8.5 * dt; dropped.m.position.x += dropped.vx * dt; dropped.m.position.y += dropped.vy * dt; dropped.m.position.z += dropped.vz * dt;
          dropped.m.rotation.x += dropped.sx * dt; dropped.m.rotation.z += dropped.sz * dt;
        }
      }
      if (trail.visible) {
        if (!T.on) T.fade -= dt * 5; if (T.fade <= 0) { trail.visible = false; } else {
          const r = T.ring, n = Math.max(2, T.n);
          for (let i = 0; i < TN; i++) {
            const s = Math.min(i, n - 1), a = (1 - i / (TN - 1)) * T.fade * (T.n > 1 ? 1 : 0);
            tpos[i * 6] = r[s * 6]; tpos[i * 6 + 1] = r[s * 6 + 1]; tpos[i * 6 + 2] = r[s * 6 + 2];
            tpos[i * 6 + 3] = r[s * 6 + 3]; tpos[i * 6 + 4] = r[s * 6 + 4]; tpos[i * 6 + 5] = r[s * 6 + 5];
            tcol[i * 6] = T.color.r * 1.5 * a; tcol[i * 6 + 1] = T.color.g * 1.5 * a; tcol[i * 6 + 2] = T.color.b * 1.5 * a; tcol[i * 6 + 3] = 0.25 * a; tcol[i * 6 + 4] = 0.18 * a; tcol[i * 6 + 5] = 0.1 * a;
          }
          tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true;
        }
      }
    },
    setCellColor(c) { cellMat.color.copy(c).multiplyScalar(2); },
    clear() { flash.visible = false; light.intensity = 0; F.t = 0; for (const c of cells) { c.life = 0; c.m.visible = false; } for (const c of puffs) { c.life = 0; c.m.visible = false; } dropped.life = 0; dropped.m.visible = false; trail.visible = false; },
  };
  return api;
}
