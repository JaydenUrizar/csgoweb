// Heightfield "column map" used as the structural skeleton of Crux Station.
// 1 m cells. Every cell is either OPEN (walkable floor with 4 corner heights, so ramps are exact)
// or SOLID (a building mass with a flat top). Walls are generated wherever heights differ, which makes the
// level watertight by construction (no holes / light leaks). Overhead structure (lintels, roofs, catwalk decks,
// props) is layered on top as separate solids (see layout.js).
export const X0 = -50, Z0 = -52, NX = 100, NZ = 104;
export const idx = (i, j) => j * NX + i;
export const cellOf = (x, z) => [Math.floor(x - X0), Math.floor(z - Z0)];

export const SURF = ['stone', 'sand', 'tile', 'brick', 'water', 'metal', 'wood', 'grass'];
export const SURF_ID = Object.fromEntries(SURF.map((s, i) => [s, i]));

export function createGrid() {
  const N = NX * NZ;
  const g = {
    NX, NZ, X0, Z0,
    open: new Uint8Array(N),
    zone: new Uint8Array(N),
    surf: new Uint8Array(N),
    stairs: new Uint8Array(N),
    stairBase: new Float32Array(N),
    tint: new Uint32Array(N),          // optional per-cell floor tint override (0xRRGGBB | 0x1000000 flag)
    wallStyle: new Uint8Array(N),      // 0=default per-zone
    h: new Float32Array(N * 4),        // corner heights: [x0z0, x1z0, x0z1, x1z1]
    zoneNames: ['mass'],
    zoneId(name) { let k = g.zoneNames.indexOf(name); if (k < 0) { k = g.zoneNames.length; g.zoneNames.push(name); } return k; },
    inb(i, j) { return i >= 0 && j >= 0 && i < NX && j < NZ; },
  };
  return g;
}

const eachCell = (x0, z0, x1, z1, fn) => {
  for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { const i = x - X0, j = z - Z0; if (i < 0 || j < 0 || i >= NX || j >= NZ) continue; fn(i, j, idx(i, j)); }
};

export function makeOps(g) {
  const setH = (k, a, b, c, d) => { g.h[k * 4] = a; g.h[k * 4 + 1] = b; g.h[k * 4 + 2] = c; g.h[k * 4 + 3] = d; };
  return {
    /** Solid building mass with flat top. */
    solid(x0, z0, x1, z1, top, zone = 'mass') {
      const zid = g.zoneId(zone);
      eachCell(x0, z0, x1, z1, (i, j, k) => { g.open[k] = 0; g.zone[k] = zid; g.stairs[k] = 0; setH(k, top, top, top, top); });
    },
    /** Flat walkable floor. */
    floor(x0, z0, x1, z1, h, zone, surf = 'stone') {
      const zid = g.zoneId(zone), sid = SURF_ID[surf];
      eachCell(x0, z0, x1, z1, (i, j, k) => { g.open[k] = 1; g.zone[k] = zid; g.surf[k] = sid; g.stairs[k] = 0; setH(k, h, h, h, h); });
    },
    /** Sloped floor. axis 'x' or 'z': height ha at coordinate ca, hb at cb (linear, clamped). */
    ramp(x0, z0, x1, z1, axis, ca, ha, cb, hb, zone, surf = 'stone', o = {}) {
      const zid = g.zoneId(zone), sid = SURF_ID[surf];
      const f = (c) => { const t = Math.max(0, Math.min(1, (c - ca) / (cb - ca))); return ha + (hb - ha) * t; };
      eachCell(x0, z0, x1, z1, (i, j, k) => {
        const x = i + X0, z = j + Z0;
        g.open[k] = 1; g.zone[k] = zid; g.surf[k] = sid; g.stairs[k] = o.stairs ? 1 : 0; g.stairBase[k] = Math.min(ha, hb);
        if (axis === 'x') setH(k, f(x), f(x + 1), f(x), f(x + 1)); else setH(k, f(z), f(z), f(z + 1), f(z + 1));
      });
    },
    /** Change the surface/zone of already-open cells without touching heights. */
    paint(x0, z0, x1, z1, { zone, surf, tint } = {}) {
      eachCell(x0, z0, x1, z1, (i, j, k) => {
        if (!g.open[k]) return;
        if (zone) g.zone[k] = g.zoneId(zone);
        if (surf) g.surf[k] = SURF_ID[surf];
        if (tint !== undefined) g.tint[k] = tint === 0 ? 0 : (tint | 0x1000000);
      });
    },
    /** Set the wall style of solid cells (0 default). */
    wallStyle(x0, z0, x1, z1, style) { eachCell(x0, z0, x1, z1, (i, j, k) => { g.wallStyle[k] = style; }); },
  };
}

export const cellH = (g, k) => (g.h[k * 4] + g.h[k * 4 + 1] + g.h[k * 4 + 2] + g.h[k * 4 + 3]) / 4;
/** Ground height under a world point (open cells: bilinear; solid: top). */
export function heightAt(g, x, z) {
  const i = Math.floor(x - X0), j = Math.floor(z - Z0);
  if (!g.inb(i, j)) return -3;
  const k = idx(i, j), fx = x - X0 - i, fz = z - Z0 - j;
  const a = g.h[k * 4], b = g.h[k * 4 + 1], c = g.h[k * 4 + 2], d = g.h[k * 4 + 3];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
