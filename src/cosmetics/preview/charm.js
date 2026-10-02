// Hanging charm object (chain + model) shared by the locker preview and the in-game attach (ingame.js).
import * as THREE from 'three';
import { mix } from './textures.js';
const geos = new Map();
const g = (k, f) => { let x = geos.get(k); if (!x) { x = f(); geos.set(k, x); } return x; };
function extrude(pts, depth, scale) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x * scale, y * scale) : s.moveTo(x * scale, y * scale))); s.closePath(); const ge = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: depth * 0.25, bevelThickness: depth * 0.25, bevelSegments: 1 }); ge.translate(0, 0, -depth / 2); return ge; }
let chainMat = null;
/** returns { group, update(t, swing) } ; origin = hook point, hangs along -Y. scale ~ metres. */
export function buildCharmObject(c, scale = 1) {
  const group = new THREE.Group(); if (!c || c.model === 'none') return null;
  chainMat ||= new THREE.MeshStandardMaterial({ color: 0xaab0bd, roughness: 0.3, metalness: 0.9 });
  const pivot = new THREE.Group(); group.add(pivot); group.scale.setScalar(scale);
  const chain = new THREE.Mesh(g('chain', () => new THREE.CylinderGeometry(0.004, 0.004, 0.09, 4)), chainMat); chain.position.y = -0.045; pivot.add(chain);
  const cm = new THREE.MeshStandardMaterial({ color: mix(c.color, 0x000000, 0.25), emissive: c.color, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.1, flatShading: true });
  const item = new THREE.Group(); item.position.y = -0.13; pivot.add(item);
  const add = (geo, mat = cm, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); item.add(m); return m; };
  switch (c.model) {
    case 'orb': add(g('orb', () => new THREE.IcosahedronGeometry(0.045, 1))); break;
    case 'cube': add(g('cube', () => new THREE.BoxGeometry(0.07, 0.07, 0.07))); break;
    case 'star': add(g('star', () => { const p = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.4 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return extrude(p, 0.02, 0.06); })); break;
    case 'cat': add(g('catH', () => new THREE.SphereGeometry(0.05, 8, 6))); for (const sx of [-1, 1]) { const e = add(g('catE', () => new THREE.ConeGeometry(0.02, 0.04, 4)), cm, sx * 0.03, 0.05, 0); e.rotation.z = -sx * 0.25; } break;
    case 'bolt': add(g('bolt', () => extrude([[0.2, 1], [-0.5, -0.1], [-0.05, -0.1], [-0.3, -1], [0.55, 0.1], [0.08, 0.1], [0.4, 1]], 0.02, 0.06))); break;
  }
  return { group, pivot, item, mat: cm, update(t, swing = 0) { pivot.rotation.z = Math.sin(t * 2.6) * 0.16 + swing; pivot.rotation.x = Math.cos(t * 1.9) * 0.08; item.rotation.y = t * 1.6; }, dispose() { cm.dispose(); } };
}
