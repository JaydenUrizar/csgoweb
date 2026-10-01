import * as THREE from 'three';
import { TYPES } from './config.js';
// Grenade world models. Prefers ctx.combat.viewmodel.worldModel(id) (scaled to grenade size), else own low-poly capsule with an emissive band.
const SIZE = 0.2;   // target longest dimension in metres
export function createModels(ctx) {
  const geo = { body: new THREE.CylinderGeometry(0.052, 0.058, 0.105, 10, 1), cap: new THREE.CylinderGeometry(0.036, 0.052, 0.03, 10, 1), top: new THREE.SphereGeometry(0.036, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    band: new THREE.CylinderGeometry(0.0595, 0.0595, 0.026, 10, 1), lever: new THREE.BoxGeometry(0.018, 0.075, 0.012), pin: new THREE.TorusGeometry(0.014, 0.003, 4, 8), foot: new THREE.SphereGeometry(0.058, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2) };
  const mats = {};
  const mk = (kind, color, o) => { const m = ctx.render?.materials; try { if (m?.[kind]) return m[kind](color, o); } catch {} return null; };
  function bodyMat(def) { return mk('flat', def.body) || new THREE.MeshStandardMaterial({ color: def.body, flatShading: true, roughness: 0.55, metalness: 0.25 }); }
  function capMat(def) { return mk('flat', def.cap) || new THREE.MeshStandardMaterial({ color: def.cap, flatShading: true, roughness: 0.7, metalness: 0.4 }); }
  function bandMat(def) { const c = new THREE.Color(def.band); const m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2), toneMapped: false }); m.userData.base = c; return m; }
  function build(type) {
    const def = TYPES[type]; const g = new THREE.Group(); g.name = 'grenade-' + type;
    const bm = (mats[type + 'b'] ||= bodyMat(def)), cm = (mats[type + 'c'] ||= capMat(def));
    const body = new THREE.Mesh(geo.body, bm), foot = new THREE.Mesh(geo.foot, bm); foot.position.y = -0.0525;
    const top = new THREE.Mesh(geo.top, cm); top.position.y = 0.0525;
    const cap = new THREE.Mesh(geo.cap, cm); cap.position.y = 0.068;
    const band = new THREE.Mesh(geo.band, bandMat(def)); band.position.y = 0.0;
    const lever = new THREE.Mesh(geo.lever, cm); lever.position.set(0.05, 0.05, 0);
    const pin = new THREE.Mesh(geo.pin, cm); pin.position.set(0.0, 0.088, 0); pin.rotation.y = Math.PI / 2;
    g.add(body, foot, top, cap, band, lever, pin);
    if (type === 'strobe') { for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(geo.lever, cm); s.scale.set(0.5, 0.35, 1.2); s.position.set(Math.cos(i * 2.09) * 0.055, -0.02, Math.sin(i * 2.09) * 0.055); s.rotation.y = -i * 2.09; g.add(s); } }
    if (type === 'pulse') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 4, 12), band.material); ring.rotation.x = Math.PI / 2; ring.position.y = 0.032; g.add(ring); }
    g.userData.band = band; return g;
  }
  function external(type) {
    try {
      const o = ctx.combat?.viewmodel?.worldModel?.(type);
      if (!o) return null;
      const box = new THREE.Box3().setFromObject(o); const sz = box.getSize(new THREE.Vector3()); const m = Math.max(sz.x, sz.y, sz.z); if (!(m > 0)) return null;
      const w = new THREE.Group(); const c = box.getCenter(new THREE.Vector3()); o.position.sub(c); w.add(o); w.scale.setScalar(SIZE / m); w.userData.external = true; return w;
    } catch { return null; }
  }
  return {
    /** A fresh model instance (own band material so fuse blinking is per-grenade). */
    make(type) {
      const ext = external(type); if (ext) return ext;
      const g = build(type); const band = g.userData.band; band.material = band.material.clone(); band.material.userData.base = band.material.userData.base; g.scale.setScalar(1.0);
      g.traverse((o) => { o.castShadow = false; o.frustumCulled = true; });
      return g;
    },
    /** Blink the emissive band; rate accelerates as the fuse runs out (0..1 = fraction of fuse consumed). */
    blink(g, frac, time, type) {
      const b = g.userData.band; if (!b) return; const m = b.material; const base = TYPES[type].band; 
      const rate = 3 + frac * frac * 18; const on = 0.55 + 0.45 * Math.sin(time * rate * 6.283); const k = 1.2 + on * (1.5 + frac * 2.5);
      m.color.setHex(base).multiplyScalar(k);
    },
    dispose() {},
  };
}
