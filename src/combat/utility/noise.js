import * as THREE from 'three';
// Procedural tileable cloud noise texture, generated once (no assets). RGBA8:
//   R = billow height (fbm, tileable)   G/B = height gradient (x,y) encoded 0.5+g   A = second, higher-frequency fbm
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x, y, per, s) { // periodic value noise, smooth
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi % per, yi % per, s), b = hash((xi + 1) % per, yi % per, s), c = hash(xi % per, (yi + 1) % per, s), d = hash((xi + 1) % per, (yi + 1) % per, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, base, oct, s) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) { const per = base * f; sum += amp * vnoise(x * per, y * per, per, s + o * 17); norm += amp; amp *= 0.55; f *= 2; }
  return sum / norm;
}
let cached = null;
export function cloudTexture(size = 128) {
  if (cached) return cached;
  const H = new Float32Array(size * size), H2 = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = i / size, y = j / size;
    // billow = 1-|2n-1| gives cauliflower creases
    const n = fbm(x, y, 3, 4, 1); H[j * size + i] = 0.35 * n + 0.65 * (1 - Math.abs(2 * n - 1)) * 0.9 + 0.05;
    H2[j * size + i] = fbm(x, y, 8, 3, 91);
  }
  let lo = 1e9, hi = -1e9; for (const v of H) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const data = new Uint8Array(size * size * 4);
  const at = (a, i, j) => a[((j + size) % size) * size + ((i + size) % size)];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const h = (H[j * size + i] - lo) / (hi - lo);
    const gx = (at(H, i + 1, j) - at(H, i - 1, j)) / (hi - lo) * 6, gy = (at(H, i, j + 1) - at(H, i, j - 1)) / (hi - lo) * 6;
    const k = (j * size + i) * 4;
    data[k] = Math.round(h * 255);
    data[k + 1] = Math.round(Math.max(0, Math.min(1, 0.5 + gx * 0.5)) * 255);
    data[k + 2] = Math.round(Math.max(0, Math.min(1, 0.5 + gy * 0.5)) * 255);
    data[k + 3] = Math.round(H2[j * size + i] * 255);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  cached = t; return t;
}
