import * as THREE from 'three';
// Small procedural canvas textures (256px, tileable, mipmapped, anisotropic). Detail is stored mostly as luminance around ~0.9 so the
// material colour tints it; brick/wood/grass/water carry their own hue. Generated lazily, cached per kind.

const SIZE = 256;
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// tileable value noise on an n x n lattice (n must divide the texture size for perfect tiling)
function makeNoise(seed, n) {
  const r = prng(seed), g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t) => t * t * (3 - 2 * t);
  return (u, v) => { // u,v in [0,1)
    const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const x0 = ((xi % n) + n) % n, x1 = (x0 + 1) % n, y0 = ((yi % n) + n) % n, y1 = (y0 + 1) % n;
    const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
function fbm(seed, base, oct = 4) {
  const ns = []; for (let i = 0; i < oct; i++) ns.push(makeNoise(seed + i * 101, base << i));
  return (u, v) => { let s = 0, a = 0.5, t = 0; for (let i = 0; i < oct; i++) { s += ns[i](u, v) * a; t += a; a *= 0.5; } return s / t; };
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;

function paint(fn, size = SIZE) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data, out = [0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / size, x, y, out);
    const i = (y * size + x) * 4; d[i] = clamp01(out[0]) * 255; d[i + 1] = clamp01(out[1]) * 255; d[i + 2] = clamp01(out[2]) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return cv;
}

// metres covered by one texture tile, and default tint (multiplied into the texture) per kind
export const KINDS = {
  sand:     { tile: 4.0, tint: 0xf4dcae },
  brick:    { tile: 2.0, tint: 0xffffff },
  concrete: { tile: 3.0, tint: 0xd9d5cc },
  metal:    { tile: 2.0, tint: 0xc9d1da },
  tile:     { tile: 1.6, tint: 0xf1efe8 },
  wood:     { tile: 2.0, tint: 0xffffff },
  grass:    { tile: 3.0, tint: 0xffffff },
  water:    { tile: 4.0, tint: 0xffffff },
  grid:     { tile: 4.0, tint: 0xffffff },
  rubber:   { tile: 1.0, tint: 0x555a64 },
};

const GEN = {
  sand() {
    const big = fbm(11, 4, 4), fine = makeNoise(12, 128), rip = fbm(13, 3, 2), r = prng(14);
    return paint((u, v, x, y, o) => {
      const m = big(u, v), rp = Math.sin((v + rip(u, v) * 0.35) * Math.PI * 2 * 9) * 0.5 + 0.5;
      let l = 0.80 + m * 0.16 + rp * 0.035 + (fine(u, v) - 0.5) * 0.10 + (r() - 0.5) * 0.06;
      const pebble = fine((u * 2.7) % 1, (v * 2.7) % 1); if (pebble > 0.92) l -= 0.07;
      o[0] = l; o[1] = l * 0.985; o[2] = l * 0.96;
    });
  },
  concrete() {
    const big = fbm(21, 3, 5), mid = fbm(22, 16, 3), fine = makeNoise(23, 128), r = prng(24);
    return paint((u, v, x, y, o) => {
      let l = 0.80 + big(u, v) * 0.16 + (mid(u, v) - 0.5) * 0.08 + (fine(u, v) - 0.5) * 0.06 + (r() - 0.5) * 0.04;
      const pit = mid((u * 3) % 1, (v * 3) % 1); if (pit > 0.72) l -= (pit - 0.72) * 0.55;
      const sx = Math.min(x % 128, 128 - (x % 128)), sy = Math.min(y % 128, 128 - (y % 128)); // panel seams every 128 px
      const seam = Math.min(sx, sy); if (seam < 1.2) l *= 0.72; else if (seam < 2.5) l *= 0.94;
      o[0] = l; o[1] = l; o[2] = l * 1.01;
    });
  },
  brick() {
    const n = fbm(31, 8, 3), fine = makeNoise(32, 128), r = prng(33), rows = 8, cols = 4, bw = SIZE / cols, bh = SIZE / rows, jit = [];
    for (let i = 0; i < rows * cols * 2; i++) jit.push([r(), r(), r()]);
    return paint((u, v, x, y, o) => {
      const row = Math.floor(y / bh), off = (row & 1) ? bw / 2 : 0, xx = (x + off) % SIZE, col = Math.floor(xx / bw), fx = xx - col * bw, fy = y - row * bh;
      const j = jit[(row * cols + col) % jit.length];
      const edge = Math.min(fx, bw - fx, (fy) * 1.6, (bh - fy) * 1.6);
      if (edge < 1.6) { const g = 0.72 + fine(u, v) * 0.1; o[0] = g; o[1] = g * 0.98; o[2] = g * 0.94; return; }
      const l = 0.78 + j[0] * 0.2 + (n(u, v) - 0.5) * 0.18 + (fine(u, v) - 0.5) * 0.10;
      const shade = edge < 4 ? 0.9 + (edge - 1.6) * 0.04 : 1;
      o[0] = (0.95 + j[1] * 0.05) * l * shade; o[1] = (0.52 + j[1] * 0.10) * l * shade; o[2] = (0.36 + j[2] * 0.08) * l * shade;
    });
  },
  metal() {
    const streak = makeNoise(41, 256), s2 = makeNoise(42, 8), r = prng(43);
    return paint((u, v, x, y, o) => {
      const st = (streak((u * 2) % 1, (v * 0.02)) + streak((u * 5) % 1, (v * 0.03) + 0.4)) * 0.5;
      let l = 0.80 + st * 0.12 + s2(u, v) * 0.05 + (r() - 0.5) * 0.03;
      const px = x % 128, py = y % 128, seam = Math.min(px, 128 - px, py, 128 - py);
      if (seam < 1.4) l *= 0.62; else if (seam < 2.6) l = l * 1.06;
      const cx = Math.min(px, 128 - px), cy = Math.min(py, 128 - py);
      if (Math.hypot(cx - 9, cy - 9) < 3.0) l = 0.55 + Math.max(0, 3 - Math.hypot(cx - 9, cy - 9)) * 0.1; // rivets
      o[0] = l * 0.97; o[1] = l; o[2] = l * 1.03;
    });
  },
  tile() {
    const n = fbm(51, 8, 3), fine = makeNoise(52, 128), r = prng(53), t = 4, ts = SIZE / t, jit = []; for (let i = 0; i < 16; i++) jit.push(r());
    return paint((u, v, x, y, o) => {
      const tx = Math.floor(x / ts), ty = Math.floor(y / ts), fx = x - tx * ts, fy = y - ty * ts, edge = Math.min(fx, ts - fx, fy, ts - fy);
      if (edge < 1.8) { const g = 0.58 + fine(u, v) * 0.05; o[0] = g; o[1] = g; o[2] = g * 0.98; return; }
      let l = 0.90 + (jit[ty * t + tx] - 0.5) * 0.08 + (n(u, v) - 0.5) * 0.05 + (fine(u, v) - 0.5) * 0.03;
      if (edge < 4) l *= 0.94 + (edge - 1.8) * 0.027; // bevel
      const gl = clamp01(1 - Math.abs((fx + fy) - ts * 0.45) / 5) * 0.06; l += gl; // glossy streak
      o[0] = l; o[1] = l; o[2] = l * 1.01;
    });
  },
  wood() {
    const wn = fbm(61, 4, 3), fine = makeNoise(62, 128), r = prng(63), planks = 8, pw = SIZE / planks, jit = [];
    for (let i = 0; i < planks; i++) jit.push([r(), r()]);
    return paint((u, v, x, y, o) => {
      const p = Math.floor(x / pw), fx = x - p * pw, j = jit[p];
      const warp = wn((u * 2) % 1, (v * 0.5 + j[1]) % 1) * 5, grain = Math.sin((fx / pw * 9 + warp + j[0] * 6) * 3.1) * 0.5 + 0.5;
      let l = 0.72 + grain * 0.14 + (j[0] - 0.5) * 0.14 + (fine(u, v) - 0.5) * 0.06;
      const seam = Math.min(fx, pw - fx); if (seam < 1.3) l *= 0.5; else if (seam < 2.6) l *= 0.9;
      const bt = (y + j[1] * 200) % 256; if (bt < 1.2) l *= 0.6; // end joints
      o[0] = l * 1.0; o[1] = l * 0.74; o[2] = l * 0.50;
    });
  },
  grass() {
    const big = fbm(71, 4, 4), fine = makeNoise(72, 128), blade = makeNoise(73, 256), r = prng(74);
    return paint((u, v, x, y, o) => {
      const b = blade((u * 3) % 1, (v * 0.3) % 1);
      const l = 0.62 + big(u, v) * 0.28 + (fine(u, v) - 0.5) * 0.14 + (b - 0.5) * 0.10 + (r() - 0.5) * 0.04;
      o[0] = l * 0.62; o[1] = l * 0.92; o[2] = l * 0.36;
    });
  },
  water() {
    const a = makeNoise(81, 6), b = makeNoise(82, 9), c = fbm(83, 4, 3);
    return paint((u, v, x, y, o) => {
      const w = Math.abs(a((u + c(u, v) * 0.15) % 1, v) - b(u, (v + c(v, u) * 0.15) % 1)), ca = Math.pow(clamp01(1 - w * 5.0), 3);
      const d = 0.55 + c(u, v) * 0.25 + ca * 0.30;
      o[0] = d * 0.42 + ca * 0.20; o[1] = d * 0.80 + ca * 0.10; o[2] = d * 1.0;
    });
  },
  grid() {
    const fine = makeNoise(91, 64);
    return paint((u, v, x, y, o) => {
      const cell = SIZE / 4, mx = Math.min(x % cell, cell - (x % cell)), my = Math.min(y % cell, cell - (y % cell)), edge = Math.min(mx, my);
      const chk = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) ? 0.90 : 0.99;
      let l = chk - (fine(u, v) - 0.5) * 0.02;
      const sub = Math.min((x % (cell / 4)), (cell / 4) - (x % (cell / 4)), (y % (cell / 4)), (cell / 4) - (y % (cell / 4)));
      if (sub < 0.6) l *= 0.94;
      if (edge < 1.4) l *= 0.55; else if (edge < 2.6) l *= 0.85;
      o[0] = l; o[1] = l; o[2] = l;
    });
  },
  rubber() {
    const fine = makeNoise(101, 128), dimple = makeNoise(102, 32), r = prng(103);
    return paint((u, v, x, y, o) => {
      const d = Math.pow(dimple(u, v), 2) * 0.35, l = 0.78 + d + (fine(u, v) - 0.5) * 0.10 + (r() - 0.5) * 0.06;
      o[0] = l; o[1] = l; o[2] = l * 1.02;
    });
  },
};

const cache = new Map();
export function getTexture(kind, renderer) {
  if (!GEN[kind]) kind = 'concrete';
  let t = cache.get(kind); if (t) return t;
  t = new THREE.CanvasTexture(GEN[kind]());
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4); t.name = 'proc-' + kind;
  cache.set(kind, t); return t;
}

// 3-band soft gradient for toon shading (linear filtered so the band edges are soft)
export function makeToonGradient(bands = [0.32, 0.62, 0.86, 1.0]) {
  const w = 32, data = new Uint8Array(w); // 4 plateaus
  for (let i = 0; i < w; i++) { const t = i / (w - 1) * bands.length, k = Math.min(bands.length - 1, Math.floor(t)), f = clamp01((t - k - 0.72) / 0.28); data[i] = Math.round(255 * mix(bands[k], bands[Math.min(bands.length - 1, k + 1)], f)); }
  const tex = new THREE.DataTexture(data, w, 1, THREE.RedFormat); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; return tex;
}
