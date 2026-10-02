// Material factory for the map. Uses ctx.render.materials.* when the render piece provides it; falls back to MeshStandardMaterial.
import * as THREE from 'three';

const TEXTURED = ['wall', 'plaster', 'floor', 'brick', 'sand', 'tile', 'roof', 'wood', 'crate', 'metal', 'ribbed', 'deck', 'cloth'];

export function makeMaterials(ctx, T, atlas) {
  const rm = ctx.render?.materials;
  const own = ctx.params?.get('ownmat');
  const flat = (o = {}) => {
    if (!own && rm?.flat) { try { const m = rm.flat(0xffffff, { vertexColors: true, ...o }); if (m && m.isMaterial) { const c = m.clone(); c.vertexColors = true; c.flatShading = false; return c; } } catch (e) { /* fall through */ } }
    return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, flatShading: false, vertexColors: true, ...o });
  };
  const M = {};
  for (const k of TEXTURED) {
    const m = flat(); m.map = T[k] || null; m.vertexColors = true; m.needsUpdate = true; m.name = 'map-' + k;
    if (k === 'metal' || k === 'ribbed' || k === 'deck') { if ('roughness' in m) m.roughness = 0.6; if ('metalness' in m) m.metalness = 0.0; }
    if (k === 'tile') { if ('roughness' in m) m.roughness = 0.45; }
    M[k] = m;
  }
  M.cloth.side = THREE.DoubleSide;
  M.plain = flat(); M.plain.name = 'map-plain';
  M.foliage = flat(); M.foliage.side = THREE.DoubleSide; M.foliage.name = 'map-foliage';
  M.emissive = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); M.emissive.name = 'map-emissive';
  M.glass = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.0, depthWrite: false, side: THREE.DoubleSide }); M.glass.name = 'map-glass';
  { const w = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: T.water, transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.05, depthWrite: false }); w.name = 'map-water'; M.water = w; }
  { const s = new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas?.texture || null, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, vertexColors: true }); s.name = 'map-signs'; M.signs = s; }
  { const c = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); c.name = 'map-contact'; M.contact = c; }
  return M;
}
