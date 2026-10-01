// Movement test course (owner: move). Pure geometry (no DOM) so tools/move_test.mjs and ?scene=movement-course share it.
// Everything is triangle soup for the capsule collider + per-vertex colours for the visible mesh.
// Layout (metres, +Y up, top of the main floor = y 0, all lanes run toward −Z, yaw 0):
//   z 44..58  stairs (rise .12 / .18 / .30 / .44 / .50)         x −52..−22
//   z ≤ 34    ramps 8° 15° 25° 35° 44° 50° 60° (3 m tall + plateau)
//   z −8      ledge boxes 0.3 … 2.0 m                             x −52..0
//   z −16     jump-box chain along +x
//   z −26…    pillar fields, corridors (0.75/0.9/1.2 m, zig-zag, 45°, hairpin), low tunnels, doors, thin walls, V-crease, octagon
//   z −80     gap platforms along +x (2 … 6 m gaps)
//   x 46      slide-slope (10° decline), x 56 free lane for bhop / slide / speed runs
const TAU = Math.PI * 2;

export function buildCourse() {
  const pos = [], col = [];
  const stations = {};
  const stat = (name, x, z, yaw = 0, y = 0, note = '') => { stations[name] = { x, y, z, yaw, note }; };

  // ---- solid emitters -------------------------------------------------------------------------
  const tmpN = [0, 0, 0];
  function emitSolid(verts, faces, color) {
    // verts: [[x,y,z]…], faces: array of index polygons (convex). Orient outward using the centroid.
    let cx = 0, cy = 0, cz = 0; for (const v of verts) { cx += v[0]; cy += v[1]; cz += v[2]; } cx /= verts.length; cy /= verts.length; cz /= verts.length;
    const c = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
    for (const f of faces) {
      for (let k = 1; k < f.length - 1; k++) {
        let a = verts[f[0]], b = verts[f[k]], d = verts[f[k + 1]];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        tmpN[0] = uy * vz - uz * vy; tmpN[1] = uz * vx - ux * vz; tmpN[2] = ux * vy - uy * vx;
        if (Math.hypot(...tmpN) < 1e-9) continue;
        const mx = (a[0] + b[0] + d[0]) / 3 - cx, my = (a[1] + b[1] + d[1]) / 3 - cy, mz = (a[2] + b[2] + d[2]) / 3 - cz;
        if (tmpN[0] * mx + tmpN[1] * my + tmpN[2] * mz < 0) { const t = b; b = d; d = t; }
        // subtle per-face shading baked into colours so the flat mesh reads without lights
        const nl = Math.hypot(...tmpN) || 1, ny = Math.abs(tmpN[1]) / nl;
        const sh = 0.72 + 0.28 * ny;
        for (const v of [a, b, d]) { pos.push(v[0], v[1], v[2]); col.push(c[0] * sh, c[1] * sh, c[2] * sh); }
      }
    }
  }
  const box = (x0, y0, z0, x1, y1, z1, color = 0x9aa3ad) => {
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    emitSolid(v, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]], color);
  };
  // convex polygon (XZ, CCW irrelevant) extruded y0..y1
  function prism(poly, y0, y1, color = 0x9aa3ad) {
    const n = poly.length, v = [];
    for (const p of poly) v.push([p[0], y0, p[1]]);
    for (const p of poly) v.push([p[0], y1, p[1]]);
    const faces = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => n + i)];
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
    emitSolid(v, faces, color);
  }
  // convex profile in (z,y) extruded along x0..x1   (ramps / wedges)
  function profile(x0, x1, pts, color = 0x9aa3ad) {
    const n = pts.length, v = [];
    for (const p of pts) v.push([x0, p[1], p[0]]);
    for (const p of pts) v.push([x1, p[1], p[0]]);
    const faces = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => n + i)];
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
    emitSolid(v, faces, color);
  }
  const ngon = (cx, cz, r, n, rot = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos(rot + (i / n) * TAU) * r, cz + Math.sin(rot + (i / n) * TAU) * r]);
  // oriented wall segment from (ax,az) to (bx,bz) with thickness t, centred on the line
  function wall(ax, az, bx, bz, t, y0, y1, color = 0x7d8794) {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * t / 2, nz = dx / l * t / 2;
    prism([[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]], y0, y1, color);
  }
  // corridor along a polyline: walls on both sides (mitred), inner clear width w
  function corridor(pts, w, t = 0.3, h = 3, color = 0x7d8794) {
    const off = (side) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dirs = [];
        if (i > 0) dirs.push([p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]]);
        if (i < pts.length - 1) dirs.push([pts[i + 1][0] - p[0], pts[i + 1][1] - p[1]]);
        const ns = dirs.map(([dx, dz]) => { const l = Math.hypot(dx, dz); return [-dz / l * side, dx / l * side]; });
        let mx = ns.reduce((s, n) => s + n[0], 0), mz = ns.reduce((s, n) => s + n[1], 0);
        const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;
        const cosHalf = ns.length === 2 ? Math.max(0.25, mx * ns[0][0] + mz * ns[0][1]) : 1;
        out.push([mx / cosHalf, mz / cosHalf]);
      }
      return out;
    };
    for (const side of [1, -1]) {
      const m = off(side);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], ma = m[i], mb = m[i + 1];
        const i0 = w / 2, i1 = w / 2 + t;
        prism([[a[0] + ma[0] * i0, a[1] + ma[1] * i0], [b[0] + mb[0] * i0, b[1] + mb[1] * i0], [b[0] + mb[0] * i1, b[1] + mb[1] * i1], [a[0] + ma[0] * i1, a[1] + ma[1] * i1]], 0, h, color);
      }
    }
  }
  const hue = (h01, s = 0.55, l = 0.62) => { // hsl → 0xRRGGBB
    const f = (n) => { const k = (n + h01 * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
  };

  // ---- base floor + catch floor --------------------------------------------------------------
  box(-60, -2, -62, 62, 0, 62, 0x8b93a0);
  box(-140, -42, -140, 140, -40, 40, 0x3a3f4a);         // catch floor under the gap row

  // ---- stairs (rise, tread) ------------------------------------------------------------------
  function stairs(x, rise, tread, n, width = 3, z0 = 52, name, note) {
    let z = z0;
    for (let i = 0; i < n; i++) { box(x - width / 2, 0, z - tread, x + width / 2, rise * (i + 1), z, i % 2 ? 0xb9c1cc : 0xa3acb8); z -= tread; }
    const top = rise * n;
    box(x - width / 2, 0, z - 3, x + width / 2, top, z, 0x8fd18f);                   // landing
    for (let i = 0; i < n; i++) { box(x - width / 2, 0, z - 3 - tread * (i + 1), x + width / 2, top - rise * (i + 1), z - 3 - tread * i, i % 2 ? 0xb9c1cc : 0xa3acb8); }
    stat(name, x, z0 + 5, 0, 0, note);
  }
  stairs(-52, 0.18, 0.30, 14, 3, 52, 'stairs18', 'rise 0.18 tread 0.30, 14 up, landing, 14 down');
  stairs(-46, 0.30, 0.30, 8, 3, 52, 'stairs30', 'rise 0.30');
  stairs(-40, 0.44, 0.30, 5, 3, 52, 'stairs44', 'rise 0.44 (just under step height)');
  stairs(-34, 0.50, 0.30, 4, 3, 52, 'stairs50', 'rise 0.50 (needs a jump / mantle)');
  stairs(-28, 0.12, 0.16, 22, 3, 52, 'stairsFine', 'rise 0.12 tread 0.16, dense stairs');

  // ---- ramps ---------------------------------------------------------------------------------
  [8, 15, 25, 35, 44, 50, 60].forEach((deg, i) => {
    const x = -52 + i * 8, h = 3, run = h / Math.tan(deg * Math.PI / 180), z0 = 32;
    const walk = deg < 45.5;
    profile(x - 1.5, x + 1.5, [[z0, 0], [z0 - run, 0], [z0 - run, h]], walk ? hue(0.33, 0.5, 0.6) : hue(0.0, 0.55, 0.6));
    box(x - 1.5, 0, z0 - run - 4, x + 1.5, h, z0 - run, 0xc7cfd9);   // plateau
    stat('ramp' + deg, x, z0 + 6, 0, 0, `${deg}° ramp ${walk ? '(walkable)' : '(too steep → slides)'}`);
  });
  // crest launch: 20° hill with a drop after the crest
  { const x = 8, h = 2, run = h / Math.tan(20 * Math.PI / 180), z0 = 34;
    profile(x - 2, x + 2, [[z0, 0], [z0 - run, 0], [z0 - run, h]], hue(0.15, 0.5, 0.62)); stat('crest', x, z0 + 10, 0, 0, '20° ramp ending in a drop (launch when fast)'); }
  // decline for slide (10°): platform y=3 then ramp down
  { const x = 46, h = 3, run = h / Math.tan(10 * Math.PI / 180);
    box(x - 3, 0, 46, x + 3, h, 58, 0xc7cfd9);
    profile(x - 3, x + 3, [[46, h], [46 - run, 0], [46, 0]], hue(0.33, 0.5, 0.6));
    stat('slideSlope', x, 55, 0, h, '10° decline from a 3 m platform, then flat'); }

  // ---- ledges / jump boxes -------------------------------------------------------------------
  const ledgeH = [0.3, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2.0];
  ledgeH.forEach((h, i) => {
    const x = -52 + i * 3.4;
    box(x - 1, 0, -9, x + 1, h, -7, hue(0.62 - Math.min(1, h / 2) * 0.62, 0.6, 0.6));
    stat('ledge' + h, x, 2, 0, 0, `${h} m box`);
  });
  { let x = -52;
    for (const gap of [2.0, 2.5, 3.0, 3.5, 4.0]) { box(x, 0, -17, x + 2, 1.0, -15, 0xf0b060); x += 2 + gap; }
    box(x, 0, -17, x + 2, 1.0, -15, 0xf0b060);
    stat('jumpchain', -56, -16, -Math.PI / 2, 0, '1 m boxes with growing gaps, run along +x'); }

  // ---- pillars ---------------------------------------------------------------------------------
  { const r = 0.45;
    for (let row = 0; row < 5; row++) for (let c = 0; c < 8; c++) {
      const x = -52 + c * 1.9 + (row % 2) * 0.95, z = -26 - row * 1.9;
      prism(ngon(x, z, r, 8, Math.PI / 8), 0, 3.2, 0xd7a86e);
    }
    stat('pillars', -52, -20, 0, 0, 'staggered octagon pillars, ~1.0 m gaps');
    // squeeze rows: gaps 0.80 (passable), 0.74 (barely), 0.68 (blocked)
    [0.80, 0.74, 0.68].forEach((gap, i) => {
      const x = -32 + i * 5, z = -36;
      prism(ngon(x - gap / 2 - r, z, r, 12), 0, 3, 0xd7a86e); prism(ngon(x + gap / 2 + r, z, r, 12), 0, 3, 0xd7a86e);
      stat('squeeze' + gap, x, z + 8, 0, 0, `${gap} m gap between pillars`);
    });
    // slalom
    for (let i = 0; i < 8; i++) prism(ngon(-52 + i * 2.6 + (i % 2) * 0.0, -44 - (i % 2) * 0.9, r, 10), 0, 3, 0xc9a06a);
    stat('slalom', -52, -40, 0, 0, 'alternating pillars for slalom run'); }

  // ---- corridors -------------------------------------------------------------------------------
  [[0.75, -12], [0.9, -8], [1.2, -4]].forEach(([w, x]) => { corridor([[x, -22], [x, -36]], w, 0.3, 3); stat('corridor' + w, x, -16, 0, 0, `${w} m wide straight corridor`); });
  corridor([[2, -22], [2, -28], [8, -28], [8, -34], [2, -34], [2, -40]], 1.0, 0.3, 3); stat('zigzag', 2, -16, 0, 0, '1.0 m corridor with three 90° corners');
  corridor([[13, -22], [13, -28], [18, -33], [18, -40]], 1.0, 0.3, 3); stat('diag45', 13, -16, 0, 0, '1.0 m corridor with two 45° corners');
  corridor([[22, -22], [22, -36], [25, -36], [25, -22]], 1.2, 0.3, 3); stat('hairpin', 22, -16, 0, 0, '1.2 m hairpin (180°)');
  corridor([[29, -22], [29, -28], [33, -28]], 0.8, 0.3, 3); stat('narrowL', 29, -16, 0, 0, '0.8 m L turn');
  // low tunnels
  [1.5, 1.3, 1.15].forEach((hgt, i) => {
    const x = 38 + i * 4;
    box(x - 1.2, 0, -22, x - 0.9, 3, -30, 0x7d8794); box(x + 0.9, 0, -22, x + 1.2, 3, -30, 0x7d8794);
    box(x - 1.2, hgt, -22, x + 1.2, 3, -30, 0x6c7684);
    stat('tunnel' + hgt, x, -16, 0, 0, `crawl tunnel, ceiling ${hgt} m`);
  });
  // doors: gap widths 0.9 / 0.78 / 0.7
  [0.9, 0.78, 0.7].forEach((w, i) => {
    const cx = 30 + i * 7, z = -12;
    box(cx - 3, 0, z - 0.15, cx - w / 2, 3, z + 0.15, 0x7d8794); box(cx + w / 2, 0, z - 0.15, cx + 3, 3, z + 0.15, 0x7d8794); box(cx - w / 2, 2.2, z - 0.15, cx + w / 2, 3, z + 0.15, 0x7d8794);
    stat('door' + w, cx, z + 7, 0, 0, `${w} m doorway`);
  });

  // ---- thin walls / corners / creases -----------------------------------------------------------
  box(-10, 0, -50, 0, 3, -49.98, 0xff8080); stat('thinwall', -5, -40, 0, 0, '2 cm thick wall (tunnelling test)');
  // V crease: two walls meeting at 30°
  { const ax = 12, az = -56, len = 10, a = 15 * Math.PI / 180;
    wall(ax, az, ax - Math.sin(a) * len, az + Math.cos(a) * len, 0.3, 0, 3); wall(ax, az, ax + Math.sin(a) * len, az + Math.cos(a) * len, 0.3, 0, 3);
    stat('vcrease', ax, az + 14, 0, 0, '30° V-shaped crease (wall-stick test)'); }
  // convex corner block + 90° inner corner
  box(20, 0, -52, 24, 3, -48, 0x9aa3ad); stat('block', 22, -40, 0, 0, '4 m block, round its corners');
  box(28, 0, -56, 40, 3, -55.7, 0x7d8794); box(28, 0, -56, 28.3, 3, -44, 0x7d8794); stat('innerCorner', 36, -46, 0, 0, '90° inner corner');
  prism(ngon(46, -50, 1.6, 24), 0, 3, 0xc9a06a); stat('roundPillar', 46, -40, 0, 0, '24-gon pillar');

  // ---- gap platforms (row along +x at z −80) -----------------------------------------------------
  { let x = -56; const gaps = [2.0, 3.0, 4.0, 4.6, 5.2, 6.0];
    box(x, -2, -84, x + 10, 0, -76, 0x8b93a0); x += 10;
    for (const g of gaps) { x += g; box(x, -2, -84, x + 8, 0, -76, 0xa9b2bf); x += 8; }
    stat('gaps', -55, -80, -Math.PI / 2, 0, 'gaps 2.0/3.0/4.0/4.6/5.2/6.0 m, run along +x'); }

  stat('start', 0, 55, 0, 0, 'open floor');
  stat('lane', 56, 56, 0, 0, '110 m open lane for speed / bhop / slide runs');
  stat('flat', 0, 0, 0, 0, 'flat, open');

  return { positions: new Float32Array(pos), colors: new Float32Array(col), stations };
}
