import * as THREE from 'three';
import { getTexture, makeToonGradient, KINDS } from './textures.js';
import { TEAMS } from '../core/config.js';

// Shared, cached material factory. The materials are shared between callers: never mutate, clone() first.
export function createMaterials(renderer) {
  const time = { value: 0 };                 // shared animated-time uniform (updated by render())
  const cache = new Map();
  let toonGrad = null;
  const C = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c ?? 0xffffff));
  const hex = (c) => C(c).getHexString();

  function key(type, color, o) {
    if (o) for (const k in o) { const v = o[k]; if (v && typeof v === 'object' && !Array.isArray(v)) return null; } // objects (textures…) → don't cache
    return type + ':' + (color === undefined ? '' : hex(color)) + ':' + (o ? JSON.stringify(o) : '');
  }
  function cached(k, make) { if (k === null) return make(); let m = cache.get(k); if (!m) { m = make(); cache.set(k, m); } return m; }
  const SETTABLE = ['roughness', 'metalness', 'vertexColors', 'emissiveIntensity', 'map', 'side', 'transparent', 'opacity', 'envMapIntensity', 'depthWrite', 'fog', 'alphaTest', 'wireframe', 'blending'];
  function apply(mat, o) {
    if (!o) return mat;
    for (const k of SETTABLE) if (o[k] !== undefined) mat[k] = o[k];
    if (o.emissive !== undefined) mat.emissive = C(o.emissive);
    if (o.opacity !== undefined && o.opacity < 1 && o.transparent === undefined) mat.transparent = true;
    return mat;
  }

  // ---- shader patches --------------------------------------------------------------------------------------------------------------
  // cfg: { tri: [scaleXZ], fade: [y1, min], rim: [hex, power, strength], grad: [hexTop, hexBottom, y0, y1], fres: [strength] }
  function patch(mat, cfg) {
    const ckey = 'fx' + JSON.stringify(cfg);
    mat.customProgramCacheKey = () => ckey;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      let vs = sh.vertexShader, fs = sh.fragmentShader, decl = 'varying vec3 vWP;\nuniform float uTime;\n';
      if (cfg.tri) { sh.uniforms.uTexScale = { value: cfg.tri[0] }; decl += 'uniform float uTexScale;\n'; }
      if (cfg.rim) { sh.uniforms.uRim = { value: new THREE.Color(cfg.rim[0]) }; decl += 'uniform vec3 uRim;\n'; }
      if (cfg.grad) { sh.uniforms.uGT = { value: new THREE.Color(cfg.grad[0]) }; sh.uniforms.uGB = { value: new THREE.Color(cfg.grad[1]) }; decl += 'uniform vec3 uGT; uniform vec3 uGB;\n'; }
      vs = vs.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 wp_ = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wp_ = instanceMatrix * wp_;\n#endif\n vWP = (modelMatrix * wp_).xyz;');
      fs = fs.replace('#include <common>', '#include <common>\n' + decl);
      if (cfg.tri) {
        fs = fs.replace('#include <map_fragment>',
          `#ifdef USE_MAP
  vec3 fn_ = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 an_ = abs(fn_);
  vec2 tuv_ = (an_.y > an_.x && an_.y > an_.z) ? vWP.xz : ((an_.x > an_.z) ? vec2(vWP.z, -vWP.y) : vec2(vWP.x, -vWP.y));
  diffuseColor *= texture2D(map, tuv_ * uTexScale);
#endif`);
      }
      if (cfg.grad) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(uGB, uGT, clamp((vWP.y - ' + cfg.grad[2].toFixed(3) + ') / ' + Math.max(0.001, cfg.grad[3] - cfg.grad[2]).toFixed(3) + ', 0.0, 1.0));');
      if (cfg.fade) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(' + cfg.fade[1].toFixed(3) + ', 1.0, smoothstep(0.0, ' + cfg.fade[0].toFixed(3) + ', vWP.y));');
      if (cfg.rim) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uRim * pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), ' + cfg.rim[1].toFixed(2) + ') * ' + cfg.rim[2].toFixed(3) + ';');
      if (cfg.fres) fs = fs.replace('#include <opaque_fragment>', 'diffuseColor.a = clamp(diffuseColor.a + pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0) * ' + cfg.fres[0].toFixed(2) + ', 0.0, 1.0);\n#include <opaque_fragment>');
      sh.vertexShader = vs; sh.fragmentShader = fs;
    };
    return mat;
  }

  const groundFadeDefault = [1.6, 0.86];   // fake contact/bounce darkening near the ground plane (world materials only)

  const M = {
    time,
    /** Faceted low-poly lit material. o: {roughness, metalness, vertexColors, emissive, emissiveIntensity, map, side, transparent, opacity, groundFade:false} */
    flat(color = 0xffffff, o) {
      return cached(key('flat', color, o), () => {
        const m = new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.86, metalness: 0.0, flatShading: true });
        apply(m, o); if (!o || o.groundFade !== false) patch(m, { fade: groundFadeDefault }); return m;
      });
    },
    /** Soft 3-band gradient-lit toon material (rim-lit). */
    toon(color = 0xffffff, o) {
      return cached(key('toon', color, o), () => {
        toonGrad ||= makeToonGradient();
        const m = new THREE.MeshToonMaterial({ color: C(color), gradientMap: toonGrad });
        m.flatShading = true; apply(m, o); patch(m, { rim: [0xbfe0ff, 3.0, 0.10] }); return m;
      });
    },
    /** Bloom-friendly emissive. Colour is scaled by intensity into HDR range (bloom threshold ≈1.4). */
    emissive(color = 0xffffff, intensity = 2, o) {
      return cached(key('emis' + intensity, color, o), () => {
        const m = new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(intensity), toneMapped: false });
        m.userData.emissiveIntensity = intensity; apply(m, o); return m;
      });
    },
    /** Transparent glass with env reflections and fresnel edges. */
    glass(color = 0x9fdcff, opacity = 0.28, o) {
      return cached(key('glass' + opacity, color, o), () => {
        const m = new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.06, metalness: 0.15, transparent: true, opacity, depthWrite: false, envMapIntensity: 1.8, flatShading: true });
        apply(m, o); patch(m, { fres: [0.55] }); m.userData.glass = true; return m;
      });
    },
    metal(color = 0xc8ccd2, rough = 0.35, o) {
      return cached(key('metal' + rough, color, o), () => {
        const m = new THREE.MeshStandardMaterial({ color: C(color), roughness: rough, metalness: 0.92, flatShading: true, envMapIntensity: 1.25 });
        return apply(m, o);
      });
    },
    /** Procedural textured material, world-space box-mapped (no UVs needed). kind ∈ sand|brick|concrete|metal|tile|wood|grass|water|grid|rubber. o.repeat scales, o.geomUV:true uses mesh UVs. */
    textured(kind = 'concrete', color, o) {
      const kd = KINDS[kind] || KINDS.concrete;
      return cached(key('tex:' + kind, color, o), () => {
        const c = color === undefined ? kd.tint : color;
        const m = new THREE.MeshStandardMaterial({ color: C(c), map: getTexture(kind, renderer), roughness: kind === 'metal' ? 0.5 : kind === 'tile' ? 0.45 : kind === 'water' ? 0.25 : 0.9, metalness: kind === 'metal' ? 0.6 : 0.0, flatShading: true });
        if (kind === 'water') { m.transparent = false; }
        apply(m, o);
        const rep = o?.repeat ? (Array.isArray(o.repeat) ? o.repeat[0] : o.repeat) : 1;
        if (o?.geomUV) { m.map.repeat.set(1, 1); patch(m, { fade: groundFadeDefault }); }
        else patch(m, { tri: [rep / kd.tile], fade: groundFadeDefault });
        return m;
      });
    },
    /** Team-colour suit material: satin, faceted, fresnel rim glow in the team colour. */
    team(teamId = 'ember', o) {
      return cached(key('team:' + teamId, undefined, o), () => {
        const t = TEAMS[teamId] || TEAMS.ember, col = new THREE.Color(t.color);
        const m = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.92), roughness: 0.5, metalness: 0.12, flatShading: true, emissive: col.clone(), emissiveIntensity: 0.10 });
        apply(m, o); patch(m, { rim: [t.color, 2.4, 0.55] }); return m;
      });
    },
    hologram(color = 0x66e0ff, o) {
      return cached(key('holo', color, o), () => {
        const m = new THREE.ShaderMaterial({
          uniforms: { uTime: time, uColor: { value: C(color).multiplyScalar(2.2) } },
          vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vec4 mv = viewMatrix*w; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }',
          fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec3 n = normalize(vN); vec3 v = normalize(vV); float f = pow(1.0-abs(dot(n,v)), 2.2); float sc = 0.55+0.45*sin(vW.y*38.0 - uTime*3.0); float fl = 0.92+0.08*sin(uTime*47.0); float a = (0.16 + f*0.85) * (0.6+0.4*sc) * fl; gl_FragColor = vec4(uColor*(0.5+f), a); }',
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        });
        return apply(m, o);
      });
    },
    unlit(color = 0xffffff, o) { return cached(key('unlit', color, o), () => apply(new THREE.MeshBasicMaterial({ color: C(color) }), o)); },
    /** Vertical (world-Y) colour gradient, lit. gradient(top, bottom, {y0:0, y1:3}). */
    gradient(top = 0xffffff, bottom = 0x888888, o) {
      return cached(key('grad', top, { ...o, b: hex(bottom) }), () => {
        const m = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, flatShading: true });
        apply(m, o); patch(m, { grad: [C(top).getHex(), C(bottom).getHex(), o?.y0 ?? 0, o?.y1 ?? 3] }); return m;
      });
    },
    setVertexColorAO(mat) { mat.vertexColors = true; mat.needsUpdate = true; return mat; },
    /** Write box-projected uv (metres * scale) into a NON-indexed geometry. */
    worldUV(geometry, scale = 1) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry, p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i += 3) {
        const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i), bx = p.getX(i + 1) - ax, by = p.getY(i + 1) - ay, bz = p.getZ(i + 1) - az, cx = p.getX(i + 2) - ax, cy = p.getY(i + 2) - ay, cz = p.getZ(i + 2) - az;
        const nx = Math.abs(by * cz - bz * cy), ny = Math.abs(bz * cx - bx * cz), nz = Math.abs(bx * cy - by * cx);
        for (let k = 0; k < 3; k++) {
          const x = p.getX(i + k), y = p.getY(i + k), z = p.getZ(i + k);
          let u, v; if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = -y; } else { u = x; v = -y; }
          uv[(i + k) * 2] = u * scale; uv[(i + k) * 2 + 1] = v * scale;
        }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
    },
    /** Every cached material (for quality re-tuning / disposal). */
    all() { return [...cache.values()]; },
  };
  return M;
}
