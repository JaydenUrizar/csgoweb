// Distant city skyline + far ground so the arena never looks like it floats in a void. Visual only.
import { rgb, mulc, mixc } from './builder.js';
import { hash2 } from './terrain.js';
import { hipRoof } from './roofs.js';

export function buildSkyline(VB, D) {
  const sandA = rgb(0xe3c793), sandB = rgb(0xd0a874), teal = rgb(0x2a9d9f), terra = rgb(0xc4673d), cream = rgb(0xf1e2bf);
  // far ground
  VB.quad('sand', [-400, -3.2, 400], [400, -3.2, 400], [400, -3.2, -400], [-400, -3.2, -400], mulc(sandB, 0.9), { chunkAt: [0, 0] });
  const place = (x0, z0, w, d, h, col, roof = 0.5) => {
    VB.box('wall', x0, -3.2, z0, x0 + w, h, z0 + d, col, { ao: 0.7, bottom: false });
    hipRoof(VB, x0, z0, x0 + w, z0 + d, h, mixc(terra, rgb(0xd9b48a), hash2(Math.floor(x0), Math.floor(z0))), { eave: 0.5 });
    if (D) { const near = (x0 + w / 2) ** 2 < 2500 && (z0 + d / 2) ** 2 < 2700; void near; }
  };
  let n = 0;
  for (let ring = 0; ring < 3; ring++) {
    const dist = 54 + ring * 18;
    for (let side = 0; side < 4; side++) {
      const len = side < 2 ? 112 : 108;
      for (let t = -len / 2; t < len / 2; t += 9 + hash2(side * 31 + ring, Math.floor(t)) * 9) {
        const h = 9 + hash2(ring * 7 + side, Math.floor(t * 3)) * (14 + ring * 8) + ring * 3;
        const w = 8 + hash2(Math.floor(t), ring + side * 5) * 10, d = 8 + hash2(ring * 3 + side, Math.floor(t * 5)) * 8;
        const c = mulc(mixc(sandA, hash2(side, Math.floor(t)) < 0.35 ? terra : hash2(Math.floor(t), side) < 0.3 ? teal : cream, 0.25 + 0.45 * hash2(Math.floor(t * 2), ring)), 0.78 + 0.1 * ring);
        let x, z;
        if (side === 0) { x = t; z = -dist - d; } else if (side === 1) { x = t; z = dist; } else if (side === 2) { x = -dist - w; z = t; } else { x = dist; z = t; }
        place(x, z, w, d, h, c); n++;
        if (D && ring < 2) { const nrmv = [[0, 1], [0, -1], [1, 0], [-1, 0]][side]; const fx = side === 0 ? x + w / 2 : side === 1 ? x + w / 2 : side === 2 ? x + w : x; const fz = side === 0 ? z + d : side === 1 ? z : z + d / 2; const len2 = side < 2 ? w : d;
          for (let r = 0; r * 3.4 + 4 < h - 2; r++) for (let k = 0; k * 3.2 + 1.8 < len2 - 1; k++) { const hh = hash2(Math.floor(x * 3 + k * 11), Math.floor(z * 3 + r * 7)); if (hh < 0.25) continue; const off = -len2 / 2 + 1.6 + k * 3.2; const cc = side < 2 ? [fx + off, 4 + r * 3.4 - 3.2 + 1.2, fz] : [fx, 4 + r * 3.4 - 3.2 + 1.2, fz + off]; D.decal({ type: 'wall', kind: hh < 0.6 ? 'window' : hh < 0.85 ? 'shutter' : 'grille', c: cc, n: nrmv, w: 1.2, h: 1.9, seed: Math.floor(hh * 977), sky: true }); } }
        if (hash2(Math.floor(t * 7), ring + side) < 0.12) { // tower with dome
          const cx = x + w / 2, cz = z + d / 2; VB.box('wall', cx - 1.4, h, cz - 1.4, cx + 1.4, h + 6, cz + 1.4, mulc(cream, 0.95), { ao: 0.8 });
          for (let i = 0; i < 8; i++) { const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2; VB.tri('roof', [cx, h + 9, cz], [cx + Math.cos(a1) * 1.9, h + 6, cz + Math.sin(a1) * 1.9], [cx + Math.cos(a0) * 1.9, h + 6, cz + Math.sin(a0) * 1.9], mulc(teal, 1.0)); }
        }
      }
    }
  }
  return n;
}
