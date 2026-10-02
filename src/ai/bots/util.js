// Small math/RNG helpers (no allocations in hot paths).
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrapPi = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
export const pitchTo = (dy, h) => Math.atan2(dy, h);
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function randn(r) { let u = 0; for (let i = 0; i < 4; i++) u += r(); return (u - 2) * 1.732; } // ~N(0,1), cheap
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export const between = (r, [a, b]) => a + (b - a) * r();
export function shuffle(r, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
/** Spray pattern offset (deg) for shot index idx — mirrors combat's patternAt (read-only copy so bots can pre-compensate recoil). */
export function patternOff(def, idx, out) {
  const p = def.pattern, n = def.patternLen;
  if (!p || idx <= 0) { out.yaw = 0; out.pitch = 0; return out; }
  const at = (k, o) => {
    if (k < n) { o[0] = p[k * 2]; o[1] = p[k * 2 + 1]; return; }
    const e = k - (n - 1), s = def.recoilScale ?? 1;
    o[0] = p[(n - 1) * 2] + Math.sin(e * 0.9) * 0.9 * s; o[1] = p[(n - 1) * 2 + 1] + Math.min(e, 6) * 0.05;
  };
  const i = Math.floor(idx), f = idx - i, a = _a, b = _b; at(i, a); at(i + 1, b);
  const s = def.recoilScale ?? 1;
  out.yaw = (a[0] + (b[0] - a[0]) * f) * s; out.pitch = (a[1] + (b[1] - a[1]) * f) * s; return out;
}
const _a = [0, 0], _b = [0, 0];
