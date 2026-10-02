// "Uber" lit material: ONE MeshStandardMaterial that shades many sub-materials selected by a per-vertex id (`aMat`).
// Palette / roughness / metalness / emissive live in uniform arrays so a whole tagger (or hand) draws in a single call.
// Vertex colours still carry the baked top-light shade. Optional pattern map applies to id 0 only.
import * as THREE from 'three';

/** @param n palette size · @param noTone ids that skip tone mapping (HDR glows) */
export function createUber(n, { noTone = [], mapId = 0 } = {}) {
  const pal = Array.from({ length: n }, () => new THREE.Vector3(0.5, 0.5, 0.5));
  const pbr = Array.from({ length: n }, () => new THREE.Vector2(0.6, 0.1));
  const em = Array.from({ length: n }, () => new THREE.Vector3(0, 0, 0));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 1 });
  const tone = noTone.length ? noTone.map((i) => `mi == ${i}`).join(' || ') : 'false';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPal = { value: pal }; sh.uniforms.uPbr = { value: pbr }; sh.uniforms.uEm = { value: em };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMat;\nvarying float vMat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vMat;\nuniform vec3 uPal[${n}];\nuniform vec2 uPbr[${n}];\nuniform vec3 uEm[${n}];`)
      .replace('#include <map_fragment>', `int mi = int(vMat + 0.5);\ndiffuseColor.rgb = uPal[mi];\n#ifdef USE_MAP\nif (mi == ${mapId}) diffuseColor.rgb *= texture2D(map, vMapUv).rgb;\n#endif`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = uPbr[mi].x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = uPbr[mi].y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = uEm[mi];')
      .replace('#include <tonemapping_fragment>', `if (!(${tone})) {\n#include <tonemapping_fragment>\n}`);
  };
  mat.customProgramCacheKey = () => `vmuber${n}:${noTone.join(',')}:${mapId}`;
  return { material: mat, pal, pbr, em };
}

/** Set sub-material i: base colour (THREE.Color/hex), roughness, metalness, emissive colour * k. */
const _c = new THREE.Color();
export function setSub(u, i, color, rough, metal, emissive = null, k = 1) {
  _c.set(color); u.pal[i].set(_c.r, _c.g, _c.b); u.pbr[i].set(rough, metal);
  if (emissive == null) u.em[i].set(0, 0, 0); else { _c.set(emissive); u.em[i].set(_c.r * k, _c.g * k, _c.b * k); }
}
/** Pure emissive sub-material (unlit look). */
export function setGlow(u, i, color, k = 1) {
  u.pal[i].set(0, 0, 0); u.pbr[i].set(1, 0); _c.set(color); u.em[i].set(_c.r * k, _c.g * k, _c.b * k);
}
