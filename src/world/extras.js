// Round-2 dressing: landmarks, bunting, prop clusters, real cover at A / Hub, sightline breakers.
import { H } from './layout.js';
import { rgb, mulc } from './builder.js';
import { tower, hipRoof } from './roofs.js';
import { bunting } from './facade.js';

const A_Y = H.A, B_Y = H.BPLAZA;

export function extras(D) {
  const VB = D.VB;
  // ---- helpers ---------------------------------------------------------------------------------------------------------
  const parasol = (x, z, col = 0xc4573a, y0 = D.ground(x, z)) => {
    D.solid({ x0: x - 0.05, x1: x + 0.05, z0: z - 0.05, z1: z + 0.05, y0, y1: y0 + 2.5, mat: 'plain', color: 0x4a3322, surf: 'wood', name: 'parasol-pole', ao: 1 });
    const n = 8, c = rgb(col), c2 = rgb(0xf1e6c8);
    for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283, P = (r, y, a) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r]; VB.tri('plain', [x, y0 + 3.0, z], P(1.5, y0 + 2.5, a1), P(1.5, y0 + 2.5, a0), i % 2 ? c : c2); VB.tri('plain', [x, y0 + 2.96, z], P(1.5, y0 + 2.5, a0), P(1.5, y0 + 2.5, a1), mulc(i % 2 ? c : c2, 0.8)); VB.quad('plain', P(1.5, y0 + 2.5, a0), P(1.5, y0 + 2.5, a1), P(1.5, y0 + 2.34, a1), P(1.5, y0 + 2.34, a0), mulc(i % 2 ? c : c2, 0.9)); }
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
  const sacks = (x, z, n = 3) => { const y0 = D.ground(x, z); for (let i = 0; i < n; i++) VB.box('plain', x + i * 0.55 - 0.25, y0, z - 0.3, x + i * 0.55 + 0.25, y0 + 0.5, z + 0.3, rgb(0xb09c74), { ao: 0.8 }); };
  const tree = (x, z, h = 5.2) => { D.palm(x, z, h); D.palm(x + 1.1, z + 0.5, h - 1.0); };
  const arcade = (x0, z0, x1, z1, y0, h, n, col = 0xe8d3a6) => { for (let i = 0; i <= n; i++) D.pillar(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, 0.7, h, { color: col }); };

  // ---- LANDMARK TOWERS above the roofline -----------------------------------------------------------------------------
  tower(VB, D, -7, -32, 8.5, 19, 'bell', 0xe9d6a8, 0x2a9d9f, { clock: true });   // Palace / Tide Mid / Hub: the clock tower
  tower(VB, D, 45.5, -7.5, 8.5, 17, 'dome', 0xf4e4bc, 0x1f8a8f);               // A site / Long: teal dome
  tower(VB, D, -23, -9, 8.0, 17, 'minaret', 0xe0b99a, 0xc4673d);                // B plaza / Tunnel mouth: terracotta minaret
  tower(VB, D, 8, 22, 9.5, 15, 'campanile', 0xc9694a, 0x2a9d9f);                // Mid lane: red brick campanile
  tower(VB, D, -33, 42, 7.0, 14, 'round', 0xf1e6cc, 0xc4673d);                  // tunnel approach: lighthouse (far from A/B sight)

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
  // Tide Mid: teal-tiled wall fountain with obelisk (a monument, not a shop) -- differs from Ember Mid's market stall
  D.solid({ x0: -1.9, x1: 1.9, z0: -32.6, z1: -30.4, y0: 0, y1: 3.4, mat: 'tile', color: 0x2a9d9f, surf: 'stone', name: 'tide-monument', cover: true, kind: 'monument', ao: 0.85 });
  VB.box('wall', -2.1, 3.4, -32.8, 2.1, 3.7, -30.2, rgb(0xf1ead2), { ao: 1, bottom: true });
  VB.box('wall', -0.6, 3.7, -32.0, 0.6, 7.2, -31.0, rgb(0xe9e2c8), { ao: 0.9 });
  for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2, P = (r, a, y) => [Math.cos(a) * r * 0.85, y, -31.5 + Math.sin(a) * r * 0.55]; VB.tri('wall', P(1.0, a0, 7.2), P(1.0, a0 + Math.PI / 2, 7.2), [0, 8.6, -31.5], rgb(0xf6efd8)); }
  VB.box('emissive', -0.1, 8.6, -31.6, 0.1, 9.0, -31.4, mulc(rgb(0x62e6d8), 2.4), { ao: 1 });
  VB.quad('water', [-1.2, 2.6, -30.38], [1.2, 2.6, -30.38], [1.2, 0.7, -30.38], [-1.2, 0.7, -30.38], rgb(0xcff4ff));
  D.solid({ x0: -2.2, x1: 2.2, z0: -30.4, z1: -29.3, y0: 0, y1: 0.6, mat: 'wall', color: 0xe8d6ac, surf: 'stone', name: 'tide-basin', cover: false, ao: 0.8 }); VB.quad('water', [-1.9, 0.52, -29.4], [1.9, 0.52, -29.4], [1.9, 0.52, -30.4], [-1.9, 0.52, -30.4], rgb(0x2aa6a6));
  VB.box('emissive', -2.15, 0.45, -29.34, 2.15, 0.5, -29.3, mulc(rgb(0x62e6d8), 1.8), { ao: 1, top: false });
  D.decal({ type: 'wall', kind: 'sun', c: [0, 1.6, -32.67], n: [0, -1], w: 3.0, h: 2.0, color: 0xf1ead2, seed: 4 });
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
  D.bench(5, -10.9, 3.2, 0.5); cafe(9, 3, 0x2a9d9f, {}); cafe(-9, 3.5, 0xc4573a, {});
  D.crate(-8.8, -1, 1.4); D.crate(-8.8, 0.4, 1.4, { variant: 'tide' });

  // ---- LONG: lane-middle clusters -----------------------------------------------------------------------------------
  D.barrels([[34.2, 26.2], [34.8, 26.6]]);
  cafe(41.8, 31.5, 0xc4573a, {}); D.planter(34.2, 32, 1.0, 2.6, 0.75); D.palm(34.1, 33.2, 4.4);
  D.lowWall(36, 9.3, 38.5, 10.0, 1.1); cart(42.2, 14.5, { w: 1.8 }); parasol(41.5, 17.5, 0x2a9d9f);
  D.crate(34.2, 2.5, 1.4); D.crate(34.2, 1.1, 1.4, { variant: 'olive' }); D.crate(34.2, 1.8, 1.4, { y0: 1.4, cover: false });
  D.container(33, -3.5, 36, -0.5, 2.4, 0x9a3f2f, { name: 'long-container-2' }); D.crateBox(33.4, -3.2, 34.8, -1.8, 1.4, { y0: 2.4, variant: 'olive', name: 'long-container-top' }); D.crateBox(34.9, -2.6, 36, -1.5, 0.9, { y0: 2.4, variant: 'dark', name: 'long-container-top-2' });
  tree(24, 42.4); cafe(19.5, 41.5, 0x2a9d9f, {}); cart(30.5, 44.4, { w: 2.0 }); D.lowWall(18.5, 44.2, 20.5, 45, 1.1);
  // ---- MID LANE / SHORT / TUNNELS ------------------------------------------------------------------------------------
  cafe(-3.8, 34, 0x2a9d9f, {}); cart(3.6, 31.5, { w: 1.8 }); sacks(-4.0, 17, 3); D.barrels([[3.9, 17.4], [3.4, 17.9]]);
  cafe(15.5, 3.5, 0xc4573a, { noParasol: true }); sacks(12.6, -3.2, 2); D.planter(16.3, -9.5, 1.0, 2.4, 0.75);
  cart(-33, 33, { w: 2.0 }); D.barrels([[-34.8, 20]]); sacks(-41, 12, 3);
  // ---- PALACE ---------------------------------------------------------------------------------------------------------
  cafe(-12, -17.8, 0x2a9d9f, {}); cafe(12, -24, 0xc4573a, { noParasol: true }); 
  arcade(-14, -25.3, 10, -25.3, 0, 4.6, 4, 0xefd9ac);
  // ---- A SITE: real cover & multi-height ------------------------------------------------------------------------------
  D.solid({ x0: 27, x1: 32, z0: -37, z1: -35.6, y0: A_Y, y1: A_Y + 2.4, mat: 'wall', color: 0xf0dcae, surf: 'stone', name: 'A-ruin-wall-1', cover: true, kind: 'wall', ao: 0.8 });
  D.solid({ x0: 27, x1: 28.4, z0: -35.6, z1: -32, y0: A_Y, y1: A_Y + 2.4, mat: 'wall', color: 0xf0dcae, surf: 'stone', name: 'A-ruin-wall-2', cover: true, kind: 'wall', ao: 0.8 });
  D.crateBox(28.4, -35.6, 29.8, -34.2, 1.4, { y0: A_Y, variant: 'dark', name: 'A-nook-crate' });
  D.solid({ x0: 30, x1: 33.4, z0: -25.5, z1: -22, y0: A_Y, y1: A_Y + 1.4, mat: 'wall', color: 0xe9d3a0, surf: 'stone', name: 'A-goose-block', cover: true, kind: 'block', ao: 0.8 });
  D.crateBox(28.8, -24.4, 30, -23.2, 0.7, { y0: A_Y, name: 'A-goose-step', thin: false });
  D.solid({ x0: 37.8, x1: 40.4, z0: -34, z1: -33.2, y0: A_Y, y1: A_Y + 1.2, mat: 'wall', color: 0xe9d3a0, surf: 'stone', name: 'A-ledge-wall', cover: true, kind: 'wall', ao: 0.8 });
  D.solid({ x0: 30.5, x1: 33.5, z0: -42, z1: -40.6, y0: A_Y, y1: A_Y + 2.2, mat: 'plaster', color: 0xe9d3a0, surf: 'stone', name: 'A-north-wall', cover: true, kind: 'wall', ao: 0.8 });
  cafe(26, -26.5, 0x2a9d9f, { noParasol: true }); tree(30.5, -44.5, 5.6);
  arcade(25, -45.2, 39, -45.2, A_Y, 4.4, 5, 0xf0dcae);
  // ---- B SITE extra ---------------------------------------------------------------------------------------------------
  tree(-24.5, -44.5, 5.2); cart(-28, -23.5, { w: 1.8 });
  D.solid({ x0: -40.5, x1: -37, z0: -30, z1: -28.6, y0: B_Y, y1: B_Y + 2.2, mat: 'plaster', color: 0xdba58a, surf: 'stone', name: 'B-wall-west', cover: true, kind: 'wall', ao: 0.8 });
  arcade(-44, -45.2, -39, -45.2, H.BALC, 4.2, 2, 0xe0b99a);
  // ---- TIDE SPAWN / EMBER SPAWN ---------------------------------------------------------------------------------------
  cafe(-10, -41.5, 0x2a9d9f, { noParasol: false }); cafe(10, -41.5, 0x2a9d9f, {}); cafe(-10, 41.5, 0xc4573a, {}); cafe(10, 41.5, 0xc4573a, {});
  arcade(-12, 49.2, 12, 49.2, 0, 4.0, 6, 0xf0cfa4); arcade(-12, -49.2, 12, -49.2, 0, 4.0, 6, 0xe6dfc8);
  D.solid({ x0: 8.0, x1: 12.0, z0: -33.2, z1: -31, y0: 0, y1: 3.6, mat: 'plaster', color: 0xe9d3b0, surf: 'stone', name: 'east-room-kiosk', cover: true, kind: 'kiosk', ao: 0.85 }); VB.box('roof', 7.7, 3.6, -33.5, 12.0, 3.9, -30.7, rgb(0x2a9d9f), { ao: 1, bottom: true }); D.decal({ type: 'wall', kind: 'shopsign', c: [10, 2.9, -30.93], n: [0, 1], w: 3.0, h: 0.62, text: 'BAKERY', color: 0xc4573a, seed: 0 });
  // ---- WINDOW / EAST ROOMS ----------------------------------------------------------------------------------------------
  cafe(-17.5, -29, 0x2a9d9f, {}); D.solid({ x0: -14, x1: -9, z0: -33, z1: -31, y0: 0, y1: 3.6, mat: 'plaster', color: 0xe3d3b0, surf: 'stone', name: 'window-room-kiosk', cover: true, kind: 'kiosk', ao: 0.85 }); VB.box('roof', -14.3, 3.6, -33.3, -9, 3.9, -30.7, rgb(0xc4673d), { ao: 1, bottom: true }); D.decal({ type: 'wall', kind: 'shopsign', c: [-11.5, 2.9, -30.93], n: [0, 1], w: 3.0, h: 0.62, text: 'LAMPS', color: 0xd9a441, seed: 0 }); sacks(8.4, -37, 3); D.planter(10.5, -36.5, 1.2, 2.2, 0.75);

  // ================= ROUND 3 =================
  // ---- A: loggia on the east wall (covered arcade with trellis), gallery on the north arcade, stepped ziggurat cover ------
  for (const z of [-20.6, -17, -13.6]) for (const x of [44.9, 47.5]) D.solid({ x0: x - 0.25, x1: x + 0.25, z0: z - 0.25, z1: z + 0.25, y0: A_Y, y1: A_Y + 2.7, mat: 'wall', color: 0xf0e2bc, surf: 'stone', name: 'loggia-post', ao: 0.85 });
  D.slab({ x0: 44.4, z0: -21.2, x1: 48, z1: -13, y0: A_Y + 2.7, y1: A_Y + 3.0, color: 0xe9d3a0, mat: 'wall', name: 'loggia-roof' });
  VB.box('roof', 44.1, A_Y + 3.0, -21.5, 48, A_Y + 3.25, -12.8, rgb(0xc4673d), { ao: 1 });
  for (let z = -21.2; z <= -13.1; z += 0.9) VB.box('wood', 44.4, A_Y + 2.62, z, 48, A_Y + 2.7, z + 0.1, rgb(0x7a4f30), { ao: 1, top: false });
  for (const z of [-20.6, -17, -13.6]) { D.bush(44.9, A_Y + 2.1, z, 0.35, rgb(0x5fa04a)); D.bush(44.9, A_Y + 2.45, z + 0.3, 0.3, rgb(0x86bb5c)); }
  D.bench(46.6, -17, 0.8, 3.4); D.lampPost(44.2, -22.2, 4.2);
  D.slab({ x0: 25, z0: -46, x1: 39.4, z1: -44.6, y0: A_Y + 4.4, y1: A_Y + 4.7, color: 0xf0dcae, mat: 'wall', name: 'north-gallery' }); VB.box('roof', 24.7, A_Y + 4.7, -46, 39.7, A_Y + 4.95, -44.3, rgb(0xb85a3a), { ao: 1 });
  for (const lx of [27, 31, 35]) D.lantern(lx, A_Y + 3.7, -45.2, 0xffd9a0, { hang: A_Y + 4.4, intensity: 1.1, radius: 5 });
  // ziggurat: 3 stepped tiers + lantern pillar (default-plant cover, boost steps)
  D.solid({ x0: 30, x1: 35, z0: -35, z1: -31.5, y0: A_Y, y1: A_Y + 0.7, mat: 'wall', color: 0xf0dcae, surf: 'stone', name: 'A-zig-1', cover: true, kind: 'platform', ao: 0.8 });
  D.solid({ x0: 31, x1: 34, z0: -34.3, z1: -32.2, y0: A_Y + 0.7, y1: A_Y + 1.4, mat: 'wall', color: 0xf4e4bc, surf: 'stone', name: 'A-zig-2', cover: true, kind: 'platform', ao: 0.8 });
  D.solid({ x0: 32.1, x1: 32.9, z0: -33.7, z1: -32.9, y0: A_Y + 1.4, y1: A_Y + 3.0, mat: 'wall', color: 0xf8ecc8, surf: 'stone', name: 'A-zig-pillar', cover: true, kind: 'pillar', ao: 0.85 });
  VB.box('emissive', 32.0, A_Y + 3.0, -33.8, 33.0, A_Y + 3.5, -32.8, mulc(rgb(0x62e6d8), 2.2), { ao: 1 }); VB.box('wall', 31.9, A_Y + 2.95, -33.9, 33.1, A_Y + 3.05, -32.7, rgb(0xf4e4bc), { ao: 1 });
  VB.box('emissive', 30.02, A_Y + 0.4, -35.02, 35.0, A_Y + 0.5, -34.98, mulc(rgb(0x2a9d9f), 2.0), { ao: 1, top: false });
  // ---- HUB: stepped stage + stone pillars / low walls --------------------------------------------------------------------
  D.solid({ x0: 6.5, x1: 9.5, z0: -3, z1: 2, y0: 0, y1: 0.6, mat: 'wall', color: 0xe3c796, surf: 'stone', name: 'hub-stage-1', cover: true, kind: 'platform', ao: 0.8 });
  D.solid({ x0: 7.6, x1: 9.5, z0: -2, z1: 1, y0: 0.6, y1: 1.2, mat: 'wall', color: 0xeed3a4, surf: 'stone', name: 'hub-stage-2', cover: true, kind: 'platform', ao: 0.8 });
  D.pillar(8.6, -0.5, 0.7, 3.4, { color: 0xe3c796 }); D.lowWall(-9.5, 5.5, -7, 6.1, 1.0, { color: 0xe3c796 });
  // ---- B: stepped stage ---------------------------------------------------------------------------------------------------
  D.solid({ x0: -33.5, x1: -29.5, z0: -37.5, z1: -34, y0: B_Y, y1: B_Y + 0.7, mat: 'wall', color: 0xe0b99a, surf: 'stone', name: 'B-stage-1', cover: true, kind: 'platform', ao: 0.8 });
  D.solid({ x0: -32.8, x1: -30.2, z0: -36.8, z1: -34.8, y0: B_Y + 0.7, y1: B_Y + 1.4, mat: 'wall', color: 0xe8c5a8, surf: 'stone', name: 'B-stage-2', cover: true, kind: 'platform', ao: 0.8 });
  D.pillar(-31.5, -35.8, 0.8, 2.9, { color: 0xe8c5a8, y0: B_Y + 1.4 });
  // ---- WINDOW ROOM / CANAL lighting -----------------------------------------------------------------------------------------
  for (const z of [-37, -33, -28]) D.wallLamp(-20, 2.9, z, 1, 0, 0xffd0a0); for (const z of [-36, -30]) D.wallLamp(-9, 2.9, z, -1, 0, 0xffd0a0);
  bunting(D, [-14.5, -37.95], [-14.5, -26.05], 5.6, 0.7, 2);
  for (const z of [-29, -25]) D.wallLamp(-46, B_Y + 3.0, z, 1, 0, 0x9ae8ff);
  VB.box('emissive', -44.06, -1.72, -30, -44.0, -1.62, -22, mulc(rgb(0x62e6d8), 1.8), { ao: 1, top: false }); VB.box('emissive', -46.0, -1.72, -30, -45.94, -1.62, -22, mulc(rgb(0x62e6d8), 1.8), { ao: 1, top: false });
  for (const z of [-27, -23]) D.lampPost(-42.8, z, 3.4, 0x9ae8ff);

  // ================= ROUND 4 =================
  // ---- overhead arches across the lanes: hard-edged shade bands + framing for the long sightlines -------------------------------
  D.arch({ axis: 'z', cx: 38, cz: 21, w: 10, depth: 1.2, floorY: 0, spring: 5.0, rise: 1.5, topY: 8.4, margin: 0.9, color: 0xf0dcae, dark: 0.7 });
  D.arch({ axis: 'z', cx: 38, cz: -1, w: 10, depth: 1.2, floorY: 0, spring: 5.0, rise: 1.5, topY: 8.4, margin: 0.9, color: 0xe8cf9f, dark: 0.7 });
  D.arch({ axis: 'z', cx: 0, cz: 26, w: 10, depth: 1.2, floorY: 0, spring: 5.2, rise: 1.4, topY: 7.8, margin: 0.9, color: 0xe4c595, dark: 0.7 });
  for (const [x, z] of [[38, 21], [38, -1], [0, 26]]) { D.lantern(x, 3.7, z, 0xffc880, { hang: 5.4, s: 1.3, intensity: 1.3, radius: 6 }); D.pool(x, z, 3.0, 0xffc880, 0.14, 0); }
  // ---- Long: covered portico along the west wall (mid-ground depth), mixed containers ------------------------------------------
  for (const z of [12.6, 15.6, 18.6, 21.4]) D.solid({ x0: 35.05, x1: 35.45, z0: z - 0.2, z1: z + 0.2, y0: 0, y1: 3.4, mat: 'wall', color: 0xf0dcae, surf: 'stone', name: 'portico-post', ao: 0.85 });
  D.slab({ x0: 33, z0: 12, x1: 35.6, z1: 22, y0: 3.4, y1: 3.65, color: 0xdcc394, mat: 'wall', name: 'portico-roof' });
  VB.quad('roof', [33, 3.65, 22.3], [35.9, 3.45, 22.3], [35.9, 3.45, 11.7], [33, 3.65, 11.7], mulc(rgb(0xc4673d), 1.0));
  for (let z = 12.2; z < 22; z += 1.0) VB.box('wood', 33, 3.28, z, 35.6, 3.4, z + 0.1, rgb(0x7a4f30), { ao: 1, top: false });
  D.bench(33.8, 14.5, 0.7, 2.2); D.bench(33.8, 19.5, 0.7, 2.2); D.pool(34.2, 17, 2.4, 0xffc880, 0.22, 0);
  D.decal({ type: 'wall', kind: 'shopsign', c: [33.05, 3.0, 17], n: [1, 0], w: 3.0, h: 0.62, text: 'GELATO', color: 0xc4573a, seed: 0 });
  // ---- Mid lane: central market stall breaks the straight spawn peek -----------------------------------------------------------
  D.solid({ x0: -1.7, x1: 1.7, z0: 28.4, z1: 30.4, y0: 0, y1: 2.7, mat: 'plaster', color: 0xe6c690, surf: 'stone', name: 'mid-market', cover: true, kind: 'kiosk', ao: 0.85 });
  VB.box('roof', -2.2, 2.7, 27.9, 2.2, 3.0, 30.9, rgb(0xc4673d), { ao: 1, bottom: true }); VB.box('wall', -2.3, 3.0, 27.8, 2.3, 3.3, 31.0, rgb(0xefe0b8), { ao: 1 });
  D.decal({ type: 'wall', kind: 'shopsign', c: [0, 2.0, 30.43], n: [0, 1], w: 3.0, h: 0.62, text: 'FLUX MARKET', color: 0x2a9d9f, seed: 0 }); D.decal({ type: 'wall', kind: 'shopsign', c: [0, 2.0, 28.37], n: [0, -1], w: 3.0, h: 0.62, text: 'ORANGE & CO', color: 0xe8883e, seed: 0 });
  D.awning(-1.6, 28.4, 1.6, 27.3, 2.45, 0.4, { axis: 'x', color: 0xffffff });
  // ---- A hero: lantern gazebo over the default (4 posts, hip roof, bench) ---------------------------------------------------------
  heroPergola(D, 38.6, -32.0, 42.6, -27.2, 3.5, A_Y, { cols: [0x2a9d9f, 0xf1e6c8, 0xd9a441], gazebo: true });
  // ---- B hero: lantern market pergola with stalls -----------------------------------------------------------------------------------
  heroPergola(D, -28.2, -30.4, -22.2, -24.6, 3.6, B_Y, { cols: [0xc4573a, 0xf1e6c8, 0x2a9d9f] });
}

// Dense, lit hero pergola: stone-based posts, double beams, closely spaced slats (hard stripe shadows), striped cloth, vines, string lights, lanterns, produce stalls.
function heroPergola(D, x0, z0, x1, z1, h, gy, o = {}) {
  const VB = D.VB, wood = rgb(0x7a4f30), dark = rgb(0x5a3a22), cols = o.cols || [0xc4573a, 0xf1e6c8];
  const px = [x0, (x0 + x1) / 2, x1], pz = [z0, z1];
  for (const x of (o.gazebo ? [x0, x1] : px)) for (const z of pz) {
    D.solid({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, y0: gy, y1: gy + h, mat: 'wood', color: 0x8a5a36, surf: 'wood', name: 'pergola-post', ao: 0.85 });
    VB.box('wall', x - 0.34, gy, z - 0.34, x + 0.34, gy + 0.5, z + 0.34, rgb(0xe0cba0), { ao: 0.8 }); VB.box('wall', x - 0.28, gy + h - 0.3, z - 0.28, x + 0.28, gy + h, z + 0.28, rgb(0x9a6a40), { ao: 0.9 });
    VB.box('wood', x - 0.12, gy + h - 0.9, z - 0.5 * Math.sign(z - (z0 + z1) / 2) - 0.04, x + 0.12, gy + h - 0.82, z - 0.04, dark, { ao: 1 });   // knee braces
  }
  // two beam levels
  for (const z of pz) VB.box('wood', x0 - 0.5, gy + h, z - 0.16, x1 + 0.5, gy + h + 0.3, z + 0.16, wood, { ao: 0.9 });
  for (let x = x0 - 0.3; x <= x1 + 0.4; x += 0.42) VB.box('wood', x - 0.07, gy + h + 0.3, z0 - 0.6, x + 0.07, gy + h + 0.52, z1 + 0.6, dark, { ao: 1 });
  for (let z = z0; z <= z1; z += 0.8) VB.box('wood', x0 - 0.5, gy + h + 0.52, z - 0.05, x1 + 0.5, gy + h + 0.6, z + 0.05, wood, { ao: 1 });
  // striped cloth strips between slats (alternating)
  const n = 4, sw = (x1 - x0 + 1) / n;
  for (let i = 0; i < n; i += 2) { const xa = x0 - 0.5 + i * sw, xb = xa + sw; VB.quad('cloth', [xa, gy + h + 0.66, z1 + 0.5], [xb, gy + h + 0.66, z1 + 0.5], [xb, gy + h + 0.66, z0 - 0.5], [xa, gy + h + 0.66, z0 - 0.5], [1, 1, 1], { uv: [[0, 0], [1.5, 0], [1.5, 3], [0, 3]] }); VB.box('plain', xa, gy + h + 0.6, z0 - 0.5, xb, gy + h + 0.66, z1 + 0.5, rgb(cols[i % cols.length]), { ao: 1, top: false }); }
  // hanging vines + hanging cloth valance
  for (let x = x0; x <= x1; x += 0.9) for (const z of pz) { const L = 0.7 + 0.5 * ((Math.sin(x * 3.1 + z) + 1) / 2); for (let k = 0; k < 3; k++) D.bush(x + (k - 1) * 0.12, gy + h - L, z + (z === z0 ? -0.2 : 0.2), 0.2, rgb(k % 2 ? 0x5fa04a : 0x86bb5c)); }
  for (const z of [z0 - 0.2, z1 + 0.2]) { const zz = z; for (let x = x0 - 0.2; x < x1 + 0.2; x += 0.6) VB.tri('plain', [x, gy + h, zz], [x + 0.6, gy + h, zz], [x + 0.3, gy + h - 0.5, zz], rgb(cols[Math.floor(x * 2) & 1 ? 0 : 2 % cols.length])); }
  // string lights (dense) + lanterns
  for (const zz of [(z0 + z1) / 2 - 0.9, (z0 + z1) / 2 + 0.9]) for (let i = 0; i < 16; i++) { const t = i / 15, x = x0 - 0.3 + (x1 - x0 + 0.6) * t, y = gy + h - 0.15 - Math.sin(t * Math.PI) * -0.0 - Math.abs(Math.sin(t * 6)) * 0.18; VB.box('emissive', x - 0.05, y - 0.07, zz - 0.05, x + 0.05, y + 0.05, zz + 0.05, mulc(rgb(0xffd9a0), 3.2), { ao: 1 }); }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; D.lantern(mx - 1.2, gy + h - 0.8, mz, 0xffc880, { hang: gy + h, s: 1.2, intensity: 1.3, radius: 6 }); D.lantern(mx + 1.2, gy + h - 0.8, mz, 0xffc880, { hang: gy + h, s: 1.2, intensity: 1.3, radius: 6 });
  if (o.gazebo) { // lattice sides, hip roof, bench
    for (const z of pz) for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.35) VB.box('wood', x - 0.02, gy + 0.5, z - 0.03, x + 0.02, gy + 1.5, z + 0.03, wood, { ao: 1, top: false });
    for (let y = gy + 0.55; y < gy + 1.5; y += 0.3) for (const z of pz) VB.box('wood', x0, y, z - 0.03, x1, y + 0.04, z + 0.03, wood, { ao: 1 });
    hipRoof(VB, x0 - 0.2, z0 - 0.2, x1 + 0.2, z1 + 0.2, gy + h + 0.62, rgb(0x2a9d9f), { eave: 0.5, rise: 1.5 });
    D.bench(mx, z0 + 0.5, 2.6, 0.5); D.bench(mx, z1 - 0.5, 2.6, 0.5);
  } else { // produce stalls under the canopy
    D.stall(x0 + 0.5, z0 + 0.4, x0 + 3.0, z0 + 1.5, { seed: 2 }); D.stall(x1 - 3.0, z1 - 1.5, x1 - 0.5, z1 - 0.4, { seed: 3 });
    D.crateBox(mx - 0.4, mz - 0.4, mx + 0.4, mz + 0.4, 0.8, { y0: gy, name: 'pergola-crate', variant: 'olive' }); D.barrels([[x1 + 0.6, z0 + 0.5], [x1 + 0.6, z0 + 1.5]], { y0: gy });
    D.awning(x0 + 0.5, z0 + 0.4, x0 + 3.0, z0 - 0.8, gy + 2.6, 0.4, { axis: 'x', color: 0xffffff });
  }
  D.pool(mx, mz, 3.6, 0xffd9a0, 0.14, gy);
}
