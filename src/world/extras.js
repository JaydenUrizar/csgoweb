// Round-2 dressing: landmarks, bunting, prop clusters, real cover at A / Hub, sightline breakers.
import { H } from './layout.js';
import { rgb, mulc } from './builder.js';
import { tower } from './roofs.js';
import { bunting } from './facade.js';

const A_Y = H.A, B_Y = H.BPLAZA;

export function extras(D) {
  const VB = D.VB;
  // ---- helpers ---------------------------------------------------------------------------------------------------------
  const parasol = (x, z, col = 0xc4573a, y0 = D.ground(x, z)) => {
    D.solid({ x0: x - 0.05, x1: x + 0.05, z0: z - 0.05, z1: z + 0.05, y0, y1: y0 + 2.5, mat: 'plain', color: 0x4a3322, surf: 'wood', name: 'parasol-pole', ao: 1 });
    const n = 8, c = rgb(col), c2 = rgb(0xf1e6c8);
    for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283, P = (r, y, a) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r]; VB.tri('plain', [x, y0 + 3.0, z], P(1.5, y0 + 2.5, a1), P(1.5, y0 + 2.5, a0), i % 2 ? c : c2); VB.tri('plain', [x, y0 + 2.5, z], P(1.5, y0 + 2.5, a0), P(1.5, y0 + 2.5, a1), mulc(i % 2 ? c : c2, 0.7)); }
  };
  const cafe = (x, z, col = 0xc4573a, o = {}) => { // table + 2 chairs + parasol
    const y0 = D.ground(x, z);
    D.solid({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4, y0, y1: y0 + 0.78, mat: 'wood', color: 0xe8d6b0, surf: 'wood', name: 'cafe-table', cover: false, ao: 0.8 });
    for (const [dx, dz] of [[-0.75, 0], [0.75, 0]]) VB.box('wood', x + dx - 0.22, y0, z + dz - 0.22, x + dx + 0.22, y0 + 0.5, z + dz + 0.22, rgb(0x7a4f30), { ao: 0.8 });
    if (!o.noParasol) parasol(x, z, col, y0);
  };
  const cart = (x, z, o = {}) => { // handcart with crates
    const y0 = D.ground(x, z), w = o.w ?? 2.2, d = o.d ?? 1.1;
    D.solid({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y0 + 0.35, y1: y0 + 0.95, mat: 'wood', color: 0x9a6a40, surf: 'wood', name: 'cart', cover: true, kind: 'cart', ao: 0.8, thin: { surface: 'wood', mul: 0.6, name: 'cart' } });
    VB.box('wood', x - w / 2 - 0.5, y0 + 0.85, z - 0.05, x - w / 2, y0 + 0.95, z + 0.05, rgb(0x7a4f30), { ao: 1 });
    for (const sz of [-1, 1]) VB.box('plain', x - 0.1, y0, z + sz * (d / 2 + 0.04) - 0.04, x + 0.1, y0 + 0.7, z + sz * (d / 2 + 0.04) + 0.04, rgb(0x3b3f46), { ao: 1 });
    const cols = o.cols ?? [0xe86a2a, 0xe8c12a, 0x7bbf4a, 0xd9433a]; let k = 0;
    for (let xx = x - w / 2 + 0.25; xx < x + w / 2 - 0.1; xx += 0.42) for (let zz = z - d / 2 + 0.25; zz < z + d / 2 - 0.1; zz += 0.42) VB.box('plain', xx - 0.14, y0 + 0.95, zz - 0.14, xx + 0.14, y0 + 1.25, zz + 0.14, rgb(cols[k++ % cols.length]), { ao: 0.9 });
  };
  const sacks = (x, z, n = 3) => { const y0 = D.ground(x, z); for (let i = 0; i < n; i++) VB.box('plain', x + i * 0.55 - 0.25, y0, z - 0.3, x + i * 0.55 + 0.25, y0 + 0.5, z + 0.3, rgb(0xd8c79a), { ao: 0.8 }); };
  const tree = (x, z, h = 5.2) => { D.palm(x, z, h); D.palm(x + 1.1, z + 0.5, h - 1.0); };
  const arcade = (x0, z0, x1, z1, y0, h, n, col = 0xe8d3a6) => { for (let i = 0; i <= n; i++) D.pillar(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, 0.7, h, { color: col }); };

  // ---- LANDMARK TOWERS above the roofline -----------------------------------------------------------------------------
  tower(VB, D, -7, -32, 8.5, 19, 'bell', 0xe9d6a8, 0x2a9d9f);        // Palace / Tide Mid / Hub
  tower(VB, D, 45.5, -7.5, 8.5, 17, 'dome', 0xf0dcae, 0x2a9d9f);     // A site / Long
  tower(VB, D, -23, -9, 8.0, 17, 'minaret', 0xe0b99a, 0x1f8a8f);     // B plaza / Tunnel mouth
  tower(VB, D, 8, 22, 9.5, 14, 'bell', 0xe8cfa0, 0xc4673d);          // Mid lane east
  tower(VB, D, -33, 42, 7.0, 12, 'dome', 0xd9a98a, 0xc4673d);        // tunnel approach
  tower(VB, D, 44, 33, 8.5, 15, 'minaret', 0xefd7a2, 0xc4673d);      // outer long

  // ---- BUNTING over lanes ---------------------------------------------------------------------------------------------
  for (const z of [34, 15, -1]) bunting(D, [33.05, z], [42.95, z], 6.0, 0.8, z);
  for (const x of [22, 29]) bunting(D, [x, 40.05], [x, 45.95], 5.8, 0.55, x);
  for (const z of [30, 21]) bunting(D, [-4.95, z], [4.95, z], 6.0, 0.8, z);
  for (const z of [-2, 4]) bunting(D, [12.05, z], [16.95, z], 6.0, 0.6, z);
  for (const x of [-11, 3]) bunting(D, [x, -25.95], [x, -16.05], 6.2, 0.8, x);
  bunting(D, [-4.95, -31], [4.95, -31], 6.2, 0.8, 3);
  for (const x of [-40, -36]) bunting(D, [x, 44.95], [x, 40.05], 4.0, 0.0001, 1);
  for (const z of [38, 50]) void z;

  // ---- SIGHTLINE BREAKER: Tide Mid kiosk + planters --------------------------------------------------------------------
  D.solid({ x0: -1.9, x1: 1.9, z0: -32.6, z1: -30.4, y0: 0, y1: 3.4, mat: 'plaster', color: 0xe8dcc0, surf: 'stone', name: 'tide-kiosk', cover: true, kind: 'kiosk', ao: 0.85 });
  VB.box('roof', -2.3, 3.4, -33.0, 2.3, 3.7, -30.0, rgb(0x2a9d9f), { ao: 1, bottom: true });
  D.awning(-1.7, -30.4, 1.7, -29.2, 2.7, 0.4, { axis: 'x', color: 0xffffff });
  D.decal({ type: 'wall', kind: 'shopsign', c: [0, 2.9, -30.33], n: [0, 1], w: 3.0, h: 0.62, text: 'TIDE TEA', color: 0x2a9d9f, seed: 0 });
  D.decal({ type: 'wall', kind: 'shopsign', c: [0, 2.9, -32.67], n: [0, -1], w: 3.0, h: 0.62, text: 'KIOSK', color: 0xc4573a, seed: 0 });
  D.planter(-4.0, -35.5, 1.8, 1.0, 0.75, { flowers: true }); D.planter(4.0, -27.8, 1.8, 1.0, 0.75, { flowers: true });
  // centre hub arch replaced by a wall fountain niche on the palace side
  D.decal({ type: 'wall', kind: 'niche', c: [0, 1.9, -15.95], n: [0, 1], w: 2.2, h: 3.4, seed: 1 });
  D.decal({ type: 'wall', kind: 'sun', c: [0, 5.2, -15.94], n: [0, 1], w: 4, h: 2.4, color: 0x2a9d9f, seed: 2 });
  D.decal({ type: 'wall', kind: 'sun', c: [0, 5.2, -13.94], n: [0, -1], w: 4, h: 2.4, color: 0xc4673d, seed: 3 });

  // ---- HUB: real cover -----------------------------------------------------------------------------------------------
  D.solid({ x0: -4.5, x1: -1.5, z0: -7.5, z1: -4.5, y0: 0, y1: 2.6, mat: 'plaster', color: 0xe3c796, surf: 'stone', name: 'hub-block', cover: true, kind: 'block', ao: 0.85 });
  VB.box('roof', -4.7, 2.6, -7.7, -1.3, 2.9, -4.3, rgb(0xc4673d), { ao: 1, bottom: true });
  D.decal({ type: 'wall', kind: 'shopsign', c: [-3, 1.9, -4.43], n: [0, 1], w: 2.5, h: 0.62, text: 'FRUIT', color: 0xc4573a, seed: 0 });
  D.lowWall(-3.6, 6.2, -0.4, 6.9, 1.2, { color: 0xe3c796 }); D.lowWall(0.4, 7.4, 3.6, 8.1, 1.2, { color: 0xe3c796 });
  // pavilion (4 pillars + slab above head height)
  for (const [px, pz] of [[2.6, -10.8], [7.4, -10.8], [2.6, -7.2], [7.4, -7.2]]) D.pillar(px, pz, 0.6, 3.0, { color: 0xe3c796 });
  D.slab({ x0: 2.0, z0: -11.4, x1: 8.0, z1: -6.6, y0: 3.0, y1: 3.35, color: 0xd9a56e, mat: 'roof', name: 'pavilion-roof' });
  D.bench(5, -10.9, 3.2, 0.5); cafe(9, 3, 0x2a9d9f, {}); cafe(-9, 3.5, 0xc4573a, {}); cart(7.5, 0.5, { w: 2.0 });
  D.crate(-8.8, -1, 1.4); D.crate(-8.8, 0.4, 1.4, { variant: 'tide' });

  // ---- LONG: lane-middle clusters -----------------------------------------------------------------------------------
  cart(35.2, 22.5); sacks(34.6, 24.6, 3); D.barrels([[34.2, 26.2], [34.8, 26.6]]);
  cafe(41.8, 31.5, 0xc4573a, {}); D.planter(34.2, 32, 1.0, 2.6, 0.75); D.palm(34.1, 33.2, 4.4);
  D.lowWall(36, 9.3, 38.5, 10.0, 1.1); cart(42.2, 14.5, { w: 1.8 }); parasol(41.5, 17.5, 0x2a9d9f);
  D.crate(34.2, 2.5, 1.4); D.crate(34.2, 1.1, 1.4, { variant: 'olive' }); D.crate(34.2, 1.8, 1.4, { y0: 1.4, cover: false });
  D.container(33, -3.5, 36, -0.5, 2.4, 0x2a9d9f, { name: 'long-container-2' });
  tree(24, 42.4); cafe(19.5, 41.5, 0x2a9d9f, {}); cart(30.5, 44.4, { w: 2.0 }); D.lowWall(18.5, 44.2, 20.5, 45, 1.1);
  // ---- MID LANE / SHORT / TUNNELS ------------------------------------------------------------------------------------
  cafe(-3.8, 34, 0x2a9d9f, {}); cart(3.6, 31.5, { w: 1.8 }); sacks(-4.0, 17, 3); D.barrels([[3.9, 17.4], [3.4, 17.9]]);
  cafe(15.5, 3.5, 0xc4573a, { noParasol: true }); sacks(12.6, -3.2, 2); D.planter(16.3, -9.5, 1.0, 2.4, 0.75);
  cart(-33, 33, { w: 2.0 }); D.barrels([[-34.8, 20]]); sacks(-41, 12, 3);
  // ---- PALACE ---------------------------------------------------------------------------------------------------------
  cafe(-12, -17.8, 0x2a9d9f, {}); cafe(12, -24, 0xc4573a, { noParasol: true }); tree(-14.4, -22.6, 5.4);
  arcade(-14, -25.3, 10, -25.3, 0, 4.6, 4, 0xefd9ac);
  // ---- A SITE: real cover & multi-height ------------------------------------------------------------------------------
  D.solid({ x0: 27, x1: 32, z0: -37, z1: -35.6, y0: A_Y, y1: A_Y + 2.4, mat: 'wall', color: 0xf0dcae, surf: 'stone', name: 'A-ruin-wall-1', cover: true, kind: 'wall', ao: 0.8 });
  D.solid({ x0: 27, x1: 28.4, z0: -35.6, z1: -32, y0: A_Y, y1: A_Y + 2.4, mat: 'wall', color: 0xf0dcae, surf: 'stone', name: 'A-ruin-wall-2', cover: true, kind: 'wall', ao: 0.8 });
  D.crateBox(28.4, -35.6, 29.8, -34.2, 1.4, { y0: A_Y, variant: 'dark', name: 'A-nook-crate' });
  D.solid({ x0: 30, x1: 33.4, z0: -25.5, z1: -22, y0: A_Y, y1: A_Y + 1.4, mat: 'wall', color: 0xe9d3a0, surf: 'stone', name: 'A-goose-block', cover: true, kind: 'block', ao: 0.8 });
  D.crateBox(28.8, -24.4, 30, -23.2, 0.7, { y0: A_Y, name: 'A-goose-step', thin: false });
  D.solid({ x0: 37.8, x1: 40.4, z0: -34, z1: -33.2, y0: A_Y, y1: A_Y + 1.2, mat: 'wall', color: 0xe9d3a0, surf: 'stone', name: 'A-ledge-wall', cover: true, kind: 'wall', ao: 0.8 });
  D.solid({ x0: 30.5, x1: 33.5, z0: -42, z1: -40.6, y0: A_Y, y1: A_Y + 2.2, mat: 'plaster', color: 0xe9d3a0, surf: 'stone', name: 'A-north-wall', cover: true, kind: 'wall', ao: 0.8 });
  cafe(26, -26.5, 0x2a9d9f, { noParasol: true }); cart(44, -14, { w: 1.8 }); tree(30.5, -44.5, 5.6);
  arcade(25, -45.2, 39, -45.2, A_Y, 4.4, 5, 0xf0dcae);
  // ---- B SITE extra ---------------------------------------------------------------------------------------------------
  tree(-24.5, -44.5, 5.2); cafe(-26.5, -28, 0xc4573a, {}); cart(-28, -23.5, { w: 1.8 });
  D.solid({ x0: -40.5, x1: -37, z0: -30, z1: -28.6, y0: B_Y, y1: B_Y + 2.2, mat: 'plaster', color: 0xdba58a, surf: 'stone', name: 'B-wall-west', cover: true, kind: 'wall', ao: 0.8 });
  arcade(-44, -45.2, -39, -45.2, H.BALC, 4.2, 2, 0xe0b99a);
  // ---- TIDE SPAWN / EMBER SPAWN ---------------------------------------------------------------------------------------
  cafe(-10, -41.5, 0x2a9d9f, { noParasol: false }); cafe(10, -41.5, 0x2a9d9f, {}); cafe(-10, 41.5, 0xc4573a, {}); cafe(10, 41.5, 0xc4573a, {});
  arcade(-12, 49.2, 12, 49.2, 0, 4.0, 6, 0xf0cfa4); arcade(-12, -49.2, 12, -49.2, 0, 4.0, 6, 0xe6dfc8);
  D.solid({ x0: 7.2, x1: 9.6, z0: -33.2, z1: -31, y0: 0, y1: 3.6, mat: 'plaster', color: 0xe9d3b0, surf: 'stone', name: 'east-room-kiosk', cover: true, kind: 'kiosk', ao: 0.85 }); VB.box('roof', 6.9, 3.6, -33.5, 9.9, 3.9, -30.7, rgb(0x2a9d9f), { ao: 1, bottom: true }); D.decal({ type: 'wall', kind: 'shopsign', c: [8.4, 2.9, -30.93], n: [0, 1], w: 2.0, h: 0.62, text: 'BAKERY', color: 0xc4573a, seed: 0 });
  // ---- WINDOW / EAST ROOMS ----------------------------------------------------------------------------------------------
  cafe(-17.5, -29, 0x2a9d9f, {}); D.solid({ x0: -13.5, x1: -11.5, z0: -33, z1: -31, y0: 0, y1: 3.6, mat: 'plaster', color: 0xe3d3b0, surf: 'stone', name: 'window-room-kiosk', cover: true, kind: 'kiosk', ao: 0.85 }); VB.box('roof', -13.8, 3.6, -33.3, -11.2, 3.9, -30.7, rgb(0xc4673d), { ao: 1, bottom: true }); D.decal({ type: 'wall', kind: 'shopsign', c: [-12.5, 2.9, -30.93], n: [0, 1], w: 1.75, h: 0.62, text: 'LAMPS', color: 0xd9a441, seed: 0 }); sacks(8.4, -37, 3); D.planter(10.5, -36.5, 1.2, 2.2, 0.75);
}
