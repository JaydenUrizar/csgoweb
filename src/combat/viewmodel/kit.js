// Shared modelling helpers for the long arms (cm, grip at origin, barrel -Z).
const DEG = Math.PI / 180;

/** Raked pistol grip. pts: [[z,y]...]; ribs on both cheeks. */
export function pgrip(b, { w = 3.6, top = 4.5, bot = -10, zf = -2.4, zr = 3.2, rake = 14, mat = 'grip', ribs = true } = {}) {
  const m = b.main, dz = Math.tan(rake * DEG) * (top - bot);
  m.side(mat, 0, w, [[zf, top], [zr, top], [zr + dz, bot], [zf + dz, bot]], { bevel: 0.7 });
  if (ribs) for (let i = 0; i < 6; i++) { const y = bot + 2 + i * ((top - bot - 4) / 5.5), z = (zf + zr) / 2 + dz * ((top - y) / (top - bot)) * 0 + dz * (1 - (y - bot) / (top - bot)) ; for (const sx of [-1, 1]) m.box('dark', [sx * (w / 2 + 0.02), y, z], [0.22, 0.4, zr - zf - 0.8], { rot: [-rake, 0, 0] }); }
  return { dz };
}
export function tguard(b, z0 = -7, z1 = -1, y = 2.2) {
  const m = b.main;
  m.box('body', [0, y + 0.8, z0], [2.6, 3.2, 0.9], { bevel: 0.3 });
  m.box('body', [0, y - 0.7, (z0 + z1) / 2], [2.6, 0.9, z1 - z0 + 0.9], { bevel: 0.3 });
}
/** Picatinny-style teeth. */
export function teeth(p, mat, x, y, z0, z1, w = 2.4, step = 1.3, h = 0.55) {
  for (let z = z0; z <= z1; z += step) p.box(mat, [x, y, z], [w, h, step * 0.55], { bevel: 0.1 });
}
/** Vent slots (vent material) on both sides. */
export function vents(p, z0, z1, y, xHalf, n = 4, h = 2.4, mat = 'vent') {
  for (let i = 0; i < n; i++) { const z = z0 + ((z1 - z0) * i) / Math.max(1, n - 1); for (const sx of [-1, 1]) p.box(mat, [sx * xHalf, y, z], [0.18, h, 0.9]); }
}
/** Glowing strip on both sides. */
export function strips(p, z0, z1, y, xHalf, h = 0.5, mat = 'glow') {
  for (const sx of [-1, 1]) p.box(mat, [sx * xHalf, y, (z0 + z1) / 2], [0.16, h, Math.abs(z1 - z0)]);
}
/** Muzzle emitter: trim ring + glowing lens facing forward. */
export function emitter(p, z, y, r = 1.4, x = 0) {
  p.cyl('trim', [x, y, z], r * 1.15, r * 1.25, 1.2, 8);
  p.cyl('glow', [x, y, z - 0.7], r * 0.7, r * 0.7, 0.3, 8);
}
/** Curved (banana) cell: returns segment centres. part pivot at top. */
export function curvedCell(b, partName, top, { n = 3, len = 6.2, w = 3.8, d = 4.4, phi0 = 8, dphi = 14, gauge = 8, glassMat = 'glass' } = {}) {
  const P = b.part(partName, top), pts = [];
  let z = top[2], y = top[1];
  for (let i = 0; i < n; i++) {
    const ph = (phi0 + dphi * i) * DEG, cz = z - Math.sin(ph) * len / 2, cy = y - Math.cos(ph) * len / 2;
    P.box(glassMat, [0, cy, cz], [w, len + 0.2, d], { rot: [phi0 + dphi * i, 0, 0], bevel: 0.3 });
    pts.push({ cz, cy, ph: phi0 + dphi * i, len });
    z -= Math.sin(ph) * len; y -= Math.cos(ph) * len;
  }
  P.box('dark', [0, y - 0.4, z + 0.2], [w + 0.5, 0.9, d + 0.7], { rot: [phi0 + dphi * (n - 1), 0, 0], bevel: 0.25 });
  const segs = [];
  for (let i = 0; i < gauge; i++) {
    const u = (gauge - 1 - i + 0.5) / gauge * n, k = Math.min(n - 1, Math.floor(u)), f = u - k, s = pts[k], ph = s.ph * DEG;
    // position along the k-th segment (0 = top)
    const zt = s.cz + Math.sin(ph) * s.len / 2, yt = s.cy + Math.cos(ph) * s.len / 2;
    segs.push({ p: [0, yt - Math.cos(ph) * s.len * f, zt - Math.sin(ph) * s.len * f], s: [w + 0.12, (n * len) / gauge * 0.72, d - 1.3], r: [s.ph, 0, 0] });
  }
  segs.reverse(); b.gauge(partName, segs);
  return { P, pts, bottom: [0, y, z] };
}
/** Straight, optionally tilted cell. center = top centre. tilt degrees (bottom swings forward). */
export function straightCell(b, partName, top, { h = 11, w = 3.6, d = 4.2, tilt = 8, gauge = 8, glassMat = 'glass' } = {}) {
  const P = b.part(partName, top), t = tilt * DEG;
  const cz = top[2] - Math.sin(t) * h / 2, cy = top[1] - Math.cos(t) * h / 2;
  P.box(glassMat, [0, cy, cz], [w, h, d], { rot: [tilt, 0, 0], bevel: 0.3 });
  P.box('dark', [0, top[1] - Math.cos(t) * (h + 0.4), top[2] - Math.sin(t) * (h + 0.4)], [w + 0.5, 0.9, d + 0.7], { rot: [tilt, 0, 0], bevel: 0.25 });
  const segs = [];
  for (let i = 0; i < gauge; i++) { const f = (i + 0.5) / gauge, hh = h * (1 - f) * 0.92 + h * 0.04; const y = top[1] - Math.cos(t) * (h * (1 - (i + 0.5) / gauge) * 0 + h * (1 - f)), z = top[2] - Math.sin(t) * h * (1 - f);
    void hh; segs.push({ p: [0, y - 0, z], s: [w + 0.12, (h / gauge) * 0.72, d - 1.4], r: [tilt, 0, 0] }); }
  // order bottom-up: lowest segment first
  segs.reverse(); b.gauge(partName, segs);
  return { P };
}
