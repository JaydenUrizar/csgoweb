// Animation primitives: springs, easing, keyframe clips (allocation-free sampling).
const DEG = Math.PI / 180;

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Frame-rate independent exponential approach. */
export const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export const EASE = {
  lin: (t) => t,
  in: (t) => t * t,
  in3: (t) => t * t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  out3: (t) => 1 - Math.pow(1 - t, 3),
  io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },   // out-back overshoot
  snap: (t) => (t < 0.999 ? 0 : 1),
  hold: () => 0,
  spring: (t) => 1 - Math.exp(-7 * t) * Math.cos(t * 14),
};

/** N-dimensional damped spring, semi-implicit Euler with sub-stepping. */
export class Spring {
  constructor(n, k = 200, c = 20) { this.n = n; this.k = k; this.c = c; this.x = new Float64Array(n); this.v = new Float64Array(n); this.t = new Float64Array(n); }
  step(dt) {
    const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps, { x, v, t, k, c, n } = this;
    for (let s = 0; s < steps; s++) for (let i = 0; i < n; i++) { v[i] += (k * (t[i] - x[i]) - c * v[i]) * h; x[i] += v[i] * h; }
  }
  kick(i, dx, dv = 0) { this.x[i] += dx; this.v[i] += dv; }
  reset() { this.x.fill(0); this.v.fill(0); this.t.fill(0); }
}

/**
 * Compile a clip. tracks: { name: [[t(0..1), values[], ease?], ...] }  values are cm + degrees for 6-vectors
 * (px,py,pz,rx,ry,rz) or a single number for 1-vectors (curl deltas). marks: [[t, 'name'], ...].
 */
export function clip(dur, tracks, marks = [], opts = {}) {
  const c = { dur, tracks: {}, marks: marks.slice().sort((a, b) => a[0] - b[0]), ...opts };
  for (const name in tracks) {
    const keys = tracks[name].map(([t, v, e]) => {
      const arr = Array.isArray(v) ? v : [v];
      const six = arr.length > 1 || name.length > 2 && arr.length === 1 && false;
      const out = arr.length >= 3 ? [arr[0] * 0.01, arr[1] * 0.01, arr[2] * 0.01, (arr[3] || 0) * DEG, (arr[4] || 0) * DEG, (arr[5] || 0) * DEG] : [arr[0]];
      void six; return { t, v: out, e: EASE[e || 'io'] || EASE.io };
    });
    c.tracks[name] = keys;
  }
  return c;
}

/** Sample track `keys` at normalized time u into out (len 6 or 1). Returns false if the track is empty. */
export function sampleTrack(keys, u, out) {
  const n = keys.length; if (!n) return false;
  if (u <= keys[0].t) { for (let i = 0; i < keys[0].v.length; i++) out[i] += keys[0].v[i]; return true; }
  if (u >= keys[n - 1].t) { const v = keys[n - 1].v; for (let i = 0; i < v.length; i++) out[i] += v[i]; return true; }
  let i = 1; while (i < n - 1 && keys[i].t < u) i++;
  const a = keys[i - 1], b = keys[i], f = b.e((u - a.t) / Math.max(1e-6, b.t - a.t));
  for (let k = 0; k < a.v.length; k++) out[k] += a.v[k] + (b.v[k] - a.v[k]) * f;
  return true;
}
