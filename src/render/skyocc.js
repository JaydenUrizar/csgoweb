import * as THREE from 'three';

// Sky-occlusion / interior ambient. Bakes (progressively, at load) a 2D map over the level:
//   R = openness (how much sky an upward hemisphere sees from head height), G = ceiling height /64 (nearest-sampled), A = lamp light amount.
// A global shader hook (all lit MeshStandard/Toon/Phong materials) scales INDIRECT light (hemisphere + environment) by that openness
// where the fragment sits under a ceiling, warms it, and adds warm lamp pools. Sun (shadow-mapped) is untouched.

const CELL = 0.75;
const HOOK_FS = `
uniform sampler2D tSkyOcc; uniform vec4 uSkyRect; uniform vec2 uSkyDim; uniform vec3 uSkyWarm; uniform vec3 uLampCol; uniform float uSkyOccOn, uSkyOccMin, uLampK;
`;
// macro/micro value variation on every lit surface (breaks up flat floors); also drives a roughness variation
const VAR_FN = `
float vh_(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn_(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vh_(i), vh_(i + vec3(1,0,0)), f.x), mix(vh_(i + vec3(0,1,0)), vh_(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vh_(i + vec3(0,0,1)), vh_(i + vec3(1,0,1)), f.x), mix(vh_(i + vec3(0,1,1)), vh_(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
const VAR_COLOR = `
float mvar_ = 0.5;
{
  vec3 wv_ = transpose(mat3(viewMatrix)) * (-vViewPosition) + cameraPosition;
  vec3 fn_ = normalize(cross(dFdx(wv_), dFdy(wv_)));
  float up_ = smoothstep(0.5, 0.95, abs(fn_.y));
  vec3 q_ = wv_ * vec3(1.0, 1.0, 1.0);
  float big_ = vn_(q_ * 0.22) * 0.65 + vn_(q_ * 0.9) * 0.35, fine_ = vn_(q_ * 4.1);
  mvar_ = big_;
  float v_ = (big_ - 0.5) * (0.20 + 0.14 * up_) + (fine_ - 0.5) * 0.07;
  diffuseColor.rgb *= 1.0 + v_;
}
`;
const HOOK_CODE = `
if (uSkyOccOn > 0.5) {
  vec3 wp_ = transpose(mat3(viewMatrix)) * (-vViewPosition) + cameraPosition;
  vec2 suv = (wp_.xz - uSkyRect.xy) * uSkyRect.zw;
  if (suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) {
    vec4 so = texture2D(tSkyOcc, suv);
    vec4 sc = texelFetch(tSkyOcc, ivec2(suv * uSkyDim), 0);
    float cov = step(wp_.y, sc.g * 64.0 + 0.08);
    float occ = mix(1.0, uSkyOccMin + (1.0 - uSkyOccMin) * so.r, cov);
    // everywhere: partial occlusion by nearby walls, stronger when roofed
    vec3 tintc = mix(vec3(1.0), uSkyWarm, cov * (1.0 - so.r));
    reflectedLight.indirectDiffuse *= occ * tintc;
    reflectedLight.indirectSpecular *= occ;
    reflectedLight.indirectDiffuse += diffuseColor.rgb * uLampCol * (so.a * so.a * uLampK);
  }
}
`;

export function createSkyOcc() {
  const U = {
    tSkyOcc: { value: null }, uSkyRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uSkyDim: { value: new THREE.Vector2(1, 1) },
    uSkyWarm: { value: new THREE.Color(1.0, 0.86, 0.70) }, uLampCol: { value: new THREE.Color(1.0, 0.72, 0.42) },
    uSkyOccOn: { value: 0 }, uSkyOccMin: { value: 0.34 }, uLampK: { value: 2.2 },
  };
  const hook = (sh) => {
    if (!sh.fragmentShader || !sh.fragmentShader.includes('#include <lights_fragment_end>')) return;
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + VAR_COLOR).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor * (0.78 + 0.44 * mvar_), 0.04, 1.0);');
    for (const k in U) sh.uniforms[k] = U[k];
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + VAR_FN + HOOK_FS).replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + HOOK_CODE);
  };
  const st = { job: null, done: false };
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const dirs = []; { const ga = Math.PI * (3 - Math.sqrt(5)); dirs.push([0, 1, 0, 2]); for (let i = 0; i < 7; i++) { const a = i * ga, t = 0.9; dirs.push([Math.cos(a) * Math.sin(t), Math.cos(t), Math.sin(a) * Math.sin(t), 1]); } }

  function begin(map) {
    const bb = map.bounds, x0 = bb.min.x, z0 = bb.min.z, nx = Math.ceil((bb.max.x - x0) / CELL), nz = Math.ceil((bb.max.z - z0) / CELL);
    const data = new Uint8Array(nx * nz * 4), tex = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
    const lamps = (map.lamps || []).map((l) => ({ p: l.pos, k: l.intensity ?? 1 }));
    let row = 0;
    st.job = {
      progress: () => row / nz,
      run(ms) {
        const t0 = performance.now();
        while (row < nz) {
          for (let i = 0; i < nx; i++) {
            const x = x0 + (i + 0.5) * CELL, z = z0 + (row + 0.5) * CELL, fy = map.heightAt ? map.heightAt(x, z) : 0, k = (row * nx + i) * 4;
            _o.set(x, fy + 0.3, z); const hu = map.raycast(_o, _up, 60);
            let r = 1, g = 0, a = 0;
            if (hu && hu.distance < 0.25) { r = 1; g = 0; }                         // inside solid: leave unoccluded
            else {
              const ceil = hu ? _o.y + hu.distance : 63.9; g = Math.min(1, ceil / 64);
              const oy = hu ? Math.min(fy + 1.5, _o.y + hu.distance * 0.5) : fy + 1.5; _o.set(x, oy, z);
              let w = 0, occ = 0;
              for (const d of dirs) { _d.set(d[0], d[1], d[2]); const h = map.raycast(_o, _d, 16); w += d[3]; if (h) occ += d[3] * (1 - 0.55 * h.distance / 16); }
              r = 1 - occ / w;
              for (const l of lamps) {
                const dx = l.p.x - x, dz = l.p.z - z, d2 = dx * dx + dz * dz; if (d2 > 49) continue;
                _a.set(x, fy + 1.2, z); if (!map.visible(_a, l.p)) continue;
                a += l.k * Math.max(0, 1 - Math.sqrt(d2) / 7);
              }
              a = Math.min(1, a * 0.9);
            }
            data[k] = Math.round(r * 255); data[k + 1] = Math.round(g * 255); data[k + 2] = 0; data[k + 3] = Math.round(a * 255);
          }
          row++; if (performance.now() - t0 > ms) return false;
        }
        // smooth openness a little (3x3, only between cells of equal cover state) to soften stair-steps
        const src = data.slice();
        for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
          const k = (j * nx + i) * 4; let s = 0, c = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const kk = ((j + dj) * nx + i + di) * 4; if (Math.abs(src[kk + 1] - src[k + 1]) < 6) { s += src[kk]; c++; } }
          data[k] = s / c;
        }
        tex.needsUpdate = true; U.tSkyOcc.value = tex; U.uSkyRect.value.set(x0, z0, 1 / (nx * CELL), 1 / (nz * CELL)); U.uSkyDim.value.set(nx, nz); U.uSkyOccOn.value = 1; st.done = true; st.job = null;
        return true;
      },
    };
  }
  return { U, hook, state: st, begin, set enabled(v) { U.uSkyOccOn.value = v && st.done ? 1 : 0; } };
}
