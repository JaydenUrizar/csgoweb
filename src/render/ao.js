import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

// Bake ambient occlusion (+ sky/ground colour bias) into a `color` vertex attribute. Load-time only.
// geometry: preferably non-indexed (flat faces). Indexed geometry is converted (returned instead).
const _o = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const _ray = new THREE.Ray();

function makeDirs(samples) { // cosine-weighted hemisphere in tangent space (z up), Fibonacci-ish
  const dirs = new Float32Array(samples * 3), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const u = (i + 0.5) / samples, r = Math.sqrt(u), th = i * ga;
    dirs[i * 3] = Math.cos(th) * r; dirs[i * 3 + 1] = Math.sin(th) * r; dirs[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - u));
  }
  return dirs;
}

export function bakeVertexAO(geometry, opts = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  bakeVertexAO.begin(g, opts).run(Infinity); return g;
}

// incremental job so huge geometry can be baked across frames: job.run(msBudget) → true when finished
bakeVertexAO.begin = function (g, opts = {}) {
  const { samples = 24, radius = 2.5, strength = 0.65, bvh = null, tint = 0xffffff, groundBounce = 0x000000, skyBoost = 0.10 } = opts;
  const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3), tc = new THREE.Color(tint), gb = new THREE.Color(groundBounce);
  let tree = bvh, i = 0, done = false; const dirs = samples > 0 ? makeDirs(samples) : null;
  const nrm = g.attributes.normal;
  const job = {
    geometry: g,
    run(ms = 8) {
      if (done) return true; const t0 = performance.now();
      if (samples > 0 && !tree) { tree = new MeshBVH(g, { targetLeafSize: 6, indirect: true }); }
      while (i < n) {
        _o.fromBufferAttribute(pos, i);
        if (nrm) _n.fromBufferAttribute(nrm, i); else { // flat normal from the triangle
          const f = i - (i % 3); _t.fromBufferAttribute(pos, f + 1).sub(_b.fromBufferAttribute(pos, f)); _d.fromBufferAttribute(pos, f + 2).sub(_b); _n.crossVectors(_t, _d).normalize();
        }
        let vis = 1;
        if (dirs) {
          _t.set(Math.abs(_n.y) < 0.99 ? 0 : 1, Math.abs(_n.y) < 0.99 ? 1 : 0, 0).cross(_n).normalize(); _b.crossVectors(_n, _t);
          let occ = 0;
          _ray.origin.copy(_o).addScaledVector(_n, 0.03);
          for (let s = 0; s < samples; s++) {
            const dx = dirs[s * 3], dy = dirs[s * 3 + 1], dz = dirs[s * 3 + 2];
            _ray.direction.set(_t.x * dx + _b.x * dy + _n.x * dz, _t.y * dx + _b.y * dy + _n.y * dz, _t.z * dx + _b.z * dy + _n.z * dz);
            const hit = tree.raycastFirst(_ray, THREE.DoubleSide, 0, radius);
            if (hit) { const k = 1 - hit.distance / radius; occ += k * k * 0.5 + 0.5 * k; }
          }
          vis = 1 - (occ / samples) * strength;
        }
        // sky/ground bias: up-facing surfaces pick up cool sky light, down-facing ones warm bounce
        const up = _n.y * 0.5 + 0.5;
        const r = vis * tc.r * (1 - skyBoost * up * 0.3) + gb.r * (1 - up) * 0.35, gg = vis * tc.g + gb.g * (1 - up) * 0.35, bb = vis * tc.b * (1 + skyBoost * up * 0.4) + gb.b * (1 - up) * 0.35;
        col[i * 3] = Math.min(1, r); col[i * 3 + 1] = Math.min(1, gg); col[i * 3 + 2] = Math.min(1, bb);
        i++;
        if ((i & 63) === 0 && performance.now() - t0 > ms) return false;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); tree = null; done = true; return true;
    },
    get progress() { return i / n; },
  };
  return job;
};

export function bakeVertexAOAsync(geometry, opts = {}, ms = 6) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry, job = bakeVertexAO.begin(g, opts);
  return new Promise((res) => { const step = () => { if (job.run(ms)) res(g); else setTimeout(step, 0); }; step(); });
}
