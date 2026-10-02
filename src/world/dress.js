// Hand-dressing of Crux Station: structures (gates, tunnel roofs, catwalk), props, signage requests, callouts, spawns, sites.
import { H, ZONES } from './layout.js';
import { hash2 } from './terrain.js';
import { dressFacades, bunting } from './facade.js';
import { extras } from './extras.js';
import { rgb, mulc } from './builder.js';

const A_Y = H.A, B_Y = H.BPLAZA;

export const CALLOUTS = [
  // name, x, z, radius, floor-label {rot,w} (optional)
  ['Ember Spawn', 0, 44, 13], ['Tunnel Approach', -23, 43, 6], ['Outer Long', 25, 43, 8], ['Long Doors', 38, 28.5, 4],
  ['Long', 38, 12, 11], ['Pit', 46, 14, 3.5], ['Cargo', 41.5, 3, 4], ['Long Ramp', 38, -8, 6],
  ['A Site', 35, -28, 10], ['Ledge', 44.5, -40, 5], ['Ledge Stairs', 45, -31.5, 3.5], ['A Door', 19, -43, 4], ['Catwalk Stairs', 24.5, -29, 3.5], ['Terrace', 17, -29, 5],
  ['Mid Lane', 0, 26, 9], ['Mid Doors', 0, 12.5, 3.5], ['Hub', 0, 0, 10], ['Short', 14.5, -6, 6], ['Catwalk', 14.5, -21, 6], ['Arches', 0, -15, 9], ['Palace', 0, -21, 10],
  ['Tide Mid', 0, -32, 6], ['Tide Spawn', 0, -44, 13], ['Window Room', -14.5, -32, 6], ['East Room', 9, -32, 4.5],
  ['B Window', -22, -34, 3], ['B Connector', -19, -23, 4], ['B Site', -33, -31, 10], ['Balcony', -42, -41, 5], ['B Door', -19, -43, 4], ['Plaza', -28, -40, 6],
  ['Tunnel Mouth', -33, -16, 4], ['Upper Tunnel', -33, -1, 7], ['Tunnel Bend', -37, 9, 5], ['Lower Tunnel', -39, 18, 6], ['Tunnel Corner', -37, 27, 4], ['Outer Tunnel', -33, 36, 6],
  ['Canal', -45, -26, 3], ['Hub Ledge', -8.5, -8, 3],
].map(([name, x, z, radius]) => ({ name, x, z, radius }));

export function dressWorld(D) {
  const g = D.g;
  const sandC = 0xe6cf9f;

  // ============================================================ ROOFS over tunnels (toggleable) + arched portals
  const roofRects = [[-30, 40, -16, 46], [-36, 24, -30, 46], [-42, 24, -30, 30], [-42, 6, -36, 30], [-42, 6, -30, 12], [-36, -16, -30, 12]];
  for (const [x0, z0, x1, z1] of roofRects) D.slab({ x0, z0, x1, z1, y0: 4.4, y1: 5.7, color: 0xb59470, roof: true, name: 'tunnel-roof' });
  // beams under tunnel roofs
  for (const [x0, z0, x1, z1] of roofRects) {
    const alongX = (x1 - x0) > (z1 - z0);
    for (let t = 3; t < (alongX ? x1 - x0 : z1 - z0) - 1; t += 5) {
      if (alongX) D.VBroof.box('wood', x0 + t, 4.05, z0, x0 + t + 0.4, 4.4, z1, rgb(0x7a4f30), { ao: 0.9, top: false });
      else D.VBroof.box('wood', x0, 4.05, z0 + t, x1, 4.4, z0 + t + 0.4, rgb(0x7a4f30), { ao: 0.9, top: false });
    }
  }
  // portals (barrel-vaulted blocks): axis z => passage along z
  D.arch({ axis: 'x', cx: -17, cz: 43, w: 6, depth: 2, spring: 3.0, rise: 1.3, topY: 6.6, color: 0xf0c9a0 });         // ES -> tunnels
  D.arch({ axis: 'x', cx: 17, cz: 43, w: 6, depth: 2, spring: 3.0, rise: 1.3, topY: 6.6, color: 0xf0d6a8 });          // ES -> long
  D.arch({ axis: 'z', cx: 0, cz: 12.5, w: 4, depth: 5, spring: 3.2, rise: 1.0, topY: 8.4, color: 0xe4c595 });         // mid doors
  D.arch({ axis: 'z', cx: 38, cz: 28.5, w: 6, depth: 3, spring: 3.4, rise: 1.5, topY: 8.4, color: 0xf0dcae });        // long doors
  for (const cx of [-6, 6]) D.arch({ axis: 'z', cx, cz: -15, w: 4, depth: 2, spring: 3.4, rise: 1.0, topY: 8.4, color: 0xeed3a4 }); // hub arches
  D.arch({ axis: 'x', cx: 19, cz: -43, w: 6, depth: 2, spring: 3.4, rise: 1.2, topY: 7.4, color: 0xf0dcae });         // tide -> A
  D.arch({ axis: 'x', cx: -19, cz: -43, w: 6, depth: 2, spring: 3.4, rise: 1.2, topY: 7.4, color: 0xe8c5a8 });        // tide -> B
  D.arch({ axis: 'x', cx: -19, cz: -23, w: 6, depth: 2, spring: 3.4, rise: 1.2, topY: 7.6, color: 0xe8c5a8 });        // palace -> B
  D.arch({ axis: 'z', cx: -33, cz: -15, w: 6, depth: 2, spring: 3.2, rise: 1.2, topY: 7.6, color: 0xdcc394 });        // tunnel mouth
  D.arch({ axis: 'x', cx: -21, cz: -34, w: 4, depth: 2, floorY: 1.1, spring: 3.0, rise: 0.6, topY: 7.8, color: 0xeadcc0 }); // B window frame
  // jambs/stair gates
  D.arch({ axis: 'x', cx: 11, cz: 7, w: 6, depth: 2, spring: 3.2, rise: 1.0, topY: 8.4, color: 0xe4c595 });          // hub -> short

  // ============================================================ CATWALK deck, supports, railings
  D.slab({ x0: 12, z0: -26, x1: 17, z1: -16, y0: 2.55, y1: 3.0, mat: 'deck', color: 0xc9c2b4, surf: 'metal', name: 'catwalk-deck' });
  D.VB.box('plain', 12, 2.3, -26, 17, 2.55, -16, rgb(0x59616b), { ao: 0.7, top: false });
  for (const z of [-17.5, -21, -24.5]) D.pillar(12.7, z, 0.6, 2.55, { color: 0xcfc0a0, mat: 'plain' });
  D.railing(12.06, -26, 12.06, -16, 3.0, 1.05);
  D.railing(12.06, -32, 12.06, -26, 3.0, 1.05);

  // ============================================================ EMBER SPAWN (south)
  D.planter(-13.6, 48.6, 2.4, 1.1, 0.8, { flowers: true }); D.planter(13.6, 48.6, 2.4, 1.1, 0.8, { flowers: true });
  D.palm(-15.2, 47.2, 4.6); D.palm(15.2, 47.2, 4.6); D.palm(-9, 49, 3.8); D.palm(9, 49, 3.8);
  D.crate(-14.6, 39.4, 1.4, { variant: 'ember' }); D.crate(-13.1, 39.4, 1.4, { variant: 'wood' }); D.crate(-13.85, 39.4, 1.4, { variant: 'ember', y0: 0 + 1.4, cover: false });
  D.barrels([[14.6, 39.5], [13.6, 39.8], [14.3, 40.7]]);
  D.bench(-5, 49.3, 3.0, 0.7); D.bench(5, 49.3, 3.0, 0.7);
  D.pillar(-5.8, 38.6, 1.2, 5, { color: 0xf0cfa4, trim: 0xff7a2f }); D.pillar(5.8, 38.6, 1.2, 5, { color: 0xf0cfa4, trim: 0xff7a2f });
  for (const x of [-9, 9]) D.banner(x, 2.2, 38.15, 0, 1, 1.7, 3.6, 0xff7a2f);
  for (const x of [-10, -2, 6, 12]) D.wallLamp(x, 3.0, 49.0, 0, -1, 0xffb070);
  D.lampPost(-11, 44, 3.6); D.lampPost(11, 44, 3.6);

  // ============================================================ MID APPROACH / MID DOORS
  D.crate(-4.2, 30, 1.4); D.crate(-4.2, 28.6, 1.4, { variant: 'olive' }); D.crate(-4.2, 29.3, 1.4, { y0: 1.4, cover: false });
  D.planter(4.2, 25, 1.2, 2.6, 0.75); D.palm(4.2, 24, 3.6);
  D.barrels([[4.3, 19], [3.5, 19.5]]);
  D.lowWall(-5, 21, -3.2, 23.5, 1.2);
  // open door leaves flush against jambs
  for (const sx of [-1, 1]) D.VB.box('wood', sx * 2 - (sx > 0 ? 0.12 : 0), 0, 10.1, sx * 2 + (sx > 0 ? 0 : 0.12), 3.1, 14.9, rgb(0xb07848), { ao: 0.8 });
  for (const z of [11, 17.5, 25, 34]) D.wallLamp(-5, 3.2, z, 1, 0, 0xffc880);

  for (const [x, z] of [[0, 11.5], [0, 13.5], [38, 28.5]]) { D.VB.box('plain', x - 0.02, 3.2, z - 0.02, x + 0.02, 4.0, z + 0.02, rgb(0x30343a), { ao: 1 }); D.VB.box('emissive', x - 0.15, 2.9, z - 0.15, x + 0.15, 3.3, z + 0.15, mulc(rgb(0xffc880), 3.0), { ao: 1 }); D.lamps.push({ pos: [x, 3.1, z], color: 0xffc880, intensity: 1 }); }
  // ============================================================ HUB
  D.container(1.5, -5, 4.5, -2.5, 1.2, 0xc4673d, { name: 'xbox' }); D.crateBox(4.5, -4.2, 5.9, -2.6, 0.6, { variant: 'dark', name: 'xbox-step' });
  D.pillar(-5.5, 5, 1.0, 5.2); D.pillar(5.5, 5, 1.0, 5.2);
  D.planter(-8.8, 9, 1.8, 1.2, 0.75); D.planter(8.8, 9, 1.8, 1.2, 0.75); D.palm(-9, 8.2, 4.4); D.palm(9, 8.2, 4.4);
  D.crate(-3, 7.3, 1.4); D.barrels([[7.5, -9], [8.4, -9.5]]);
  D.railing(-7, -12, -7, -4, 1.2, 1.05);
  D.lowWall(-2.6, -10.5, -0.4, -9.9, 1.0, { color: 0xdcb98a });
  for (const z of [6, -4, -10]) { D.wallLamp(-10, 3.4, z, 1, 0, 0xffc880); D.wallLamp(10, 3.4, z, -1, 0, 0xffc880); }

  // ============================================================ SHORT corridor
  D.crate(16.1, 7, 1.4); D.barrels([[12.8, 8.8]]);

  // ============================================================ PALACE
  D.fountain(0, -21, 2.6, 0.9, {}); D.planter(-13, -25.3, 2.6, 1.0, 0.75, { flowers: true }); D.planter(8, -25.3, 2.6, 1.0, 0.75, { flowers: true });
  D.palm(-14.8, -24.2, 4.4); D.palm(15.5, -17.5, 3.8);
  D.crate(-14.4, -17.5, 1.4, { variant: 'tide' }); D.crate(-14.4, -19, 1.4, { variant: 'wood' });
  D.barrels([[15.6, -21.5], [15.6, -22.5], [14.8, -22]]);
  D.lowWall(-9, -24.5, -6.5, -23.9, 1.0); D.lowWall(6.5, -24.5, 9.5, -23.9, 1.0);
  D.pillar(-9.5, -17.2, 0.9, 4.6); D.pillar(9.5, -17.2, 0.9, 4.6);
  for (const x of [-12, -4, 4, 11]) D.wallLamp(x, 3.2, -25.9, 0, 1, 0xffc880);

  // ============================================================ TIDE SPAWN + connectors
  D.planter(-13.6, -49.1, 2.4, 1.1, 0.8, { flowers: true }); D.planter(13.6, -49.1, 2.4, 1.1, 0.8, { flowers: true });
  D.palm(-15.3, -47, 4.6); D.palm(15.3, -47, 4.6); D.palm(-9, -49.2, 3.8); D.palm(9, -49.2, 3.8);
  D.crate(-14.6, -39.4, 1.4, { variant: 'tide' }); D.crate(-13.1, -39.4, 1.4); D.crate(-13.85, -39.4, 1.4, { variant: 'tide', y0: 1.4, cover: false });
  D.barrels([[14.6, -39.5], [13.6, -39.8]]);
  D.bench(-5, -49.4, 3, 0.7); D.bench(5, -49.4, 3, 0.7);
  D.pillar(-8.5, -38.6, 1.2, 5, { color: 0xe6dfc8, trim: 0x2fd0ff }); D.pillar(8.5, -38.6, 1.2, 5, { color: 0xe6dfc8, trim: 0x2fd0ff });
  for (const x of [-9, 9]) D.banner(x, 2.2, -49.85, 0, -1, 1.7, 3.6, 0x2fd0ff);
  for (const z of [-40, -33, -20]) D.banner(22.06, 2.0, z, 1, 0, 1.5, 3.4, 0x2a9d9f); for (const z of [-24, -38]) D.banner(-22.06, 0.8, z, -1, 0, 1.5, 3.4, 0x1f8a8f);
  for (const x of [-10, -2, 6, 12]) D.wallLamp(x, 3.0, -37.9, 0, 1, 0x9ae8ff);
  D.lampPost(-11, -44, 3.6, 0xbfeaff); D.lampPost(11, -44, 3.6, 0xbfeaff);
  D.lowWall(-3.8, -33, -2.8, -30, 1.0); D.lowWall(2.8, -33, 3.8, -30, 1.0);
  D.crate(7.2, -36.5, 1.4); D.crate(7.2, -35.1, 1.4, { variant: 'tide' }); D.barrels([[11.2, -27.2], [10.4, -27.5]]);
  D.bench(-19.3, -34, 1.4, 2.6, { h: 0.55 }); D.crate(-17, -36.8, 1.4); D.crate(-17, -35.4, 1.4, { variant: 'olive' });
  D.planter(-12, -27.4, 2.0, 1.0, 0.75);

  // ============================================================ LONG LANE
  D.container(40.6, 0, 43, 6.2, 2.7, 0x2a9d9f, { name: 'cargo' });
  D.container(33, 6.5, 36, 9.5, 2.4, 0xd9834e, { name: 'long-corner' });
  D.barrels([[34.4, 18], [35.2, 18.7], [34.6, 19.3]]);
  D.crate(41.8, 22, 1.4, { variant: 'olive' }); D.crate(41.8, 20.6, 1.4);
  D.crate(47, 12.6, 1.4, { y0: -1.5 }); D.crate(47, 16.6, 1.4, { y0: -1.5, variant: 'ember' });
  for (const sx of [-1, 1]) D.VB.box('wood', 38 + sx * 3 - (sx > 0 ? 0.12 : 0), 0, 27.1, 38 + sx * 3 + (sx > 0 ? 0 : 0.12), 3.4, 29.9, rgb(0xb07848), { ao: 0.8 });
  D.crate(22.5, 40.8, 1.4); D.crate(22.5, 42.2, 1.4, { variant: 'ember' }); D.barrels([[30.5, 40.8], [31.4, 41.2]]);
  D.planter(26, 45.4, 3, 1.1, 0.8); D.palm(25, 45, 4.2);
  D.pillar(33.8, 38.5, 1.0, 4.8);
  for (const z of [44, 36, 20, 4, -2]) { D.wallLamp(33, 3.4, z, 1, 0, 0xffc880); }
  for (const z of [38, 22, 6]) D.wallLamp(43, 3.4, z, -1, 0, 0xffc880);

  // ============================================================ A SITE
  D.pergola(23.6, -16.8, 29.6, -13.4, 3.1); D.stall(24.3, -15.8, 28.9, -14.4, { seed: 1 });
  D.crateBox(24, -21, 25.4, -19.6, 1.4, { y0: A_Y, name: 'A-triple-1' }); D.crateBox(25.4, -21, 26.8, -19.6, 1.4, { y0: A_Y, variant: 'olive', name: 'A-triple-2' }); D.crateBox(24.7, -21, 26.1, -19.6, 1.4, { y0: A_Y + 1.4, variant: 'dark', name: 'A-triple-3' });
  D.crateBox(34, -19, 36.8, -16.2, 2.8, { y0: A_Y, name: 'A-big-crate' });
  D.container(39, -24, 46, -21.4, 2.6, 0x2a9d9f, { y0: A_Y, name: 'A-container' });
  D.crateBox(36.5, -29, 37.9, -27.6, 1.4, { y0: A_Y, name: 'A-default-1' }); D.crateBox(36.5, -27.6, 37.9, -26.2, 1.4, { y0: A_Y, variant: 'tide', name: 'A-default-2' });
  D.crateBox(38, -38, 39.4, -36.6, 0.7, { y0: A_Y, name: 'A-ledge-step' }); D.crateBox(39.4, -38, 40.8, -36.6, 1.4, { y0: A_Y, variant: 'dark', name: 'A-ledge-box' });
  D.pillar(28, -37, 1.0, 4.6); D.pillar(28, -43, 1.0, 4.6); D.pillar(44.5, -14.2, 1.0, 4.6);
  D.barrels([[45.5, -18], [46.4, -18.7], [45.8, -17.2]], { y0: A_Y });
  D.planter(23.4, -36, 1.0, 2.4, 0.8); D.planter(23.4, -23, 1.0, 2.4, 0.8); D.palm(23.5, -34.2, 4.4); D.palm(23.5, -21.5, 4.4);
  D.railing(41, -46, 41, -39.5, H.PLAT, 1.05);
  D.crate(45.8, -44.2, 1.4, { y0: H.PLAT }); D.crate(44.4, -44.2, 1.4, { y0: H.PLAT, variant: 'ember' }); D.barrels([[46.8, -37.5]], { y0: H.PLAT });
  D.crate(20.2, -29.2, 1.4, { y0: H.DECK }); 
  D.lampPost(32, -14, 4.2); D.lampPost(40, -44, 4.2); D.lampPost(24, -30, 4.2);
  // beacon plinth (visual only)
  plinth(D, 34.5, -28.5, A_Y, 0xff7a2f);

  // ============================================================ B SITE
  D.container(-40, -40, -34, -37.4, 2.6, 0xd9834e, { y0: B_Y, name: 'B-container' });
  D.crateBox(-29, -33, -27.6, -31.6, 1.4, { y0: B_Y, name: 'B-default-1' }); D.crateBox(-29, -31.6, -27.6, -30.2, 1.4, { y0: B_Y, variant: 'tide', name: 'B-default-2' });
  D.crateBox(-36.2, -26, -34.8, -24.6, 1.4, { y0: B_Y, name: 'B-south-crate' });
  D.crateBox(-31.4, -41.4, -28.6, -38.6, 2.8, { y0: B_Y, name: 'B-big-crate' });
  // window boost steps
  D.crateBox(-25.6, -35.5, -24.4, -32.5, 0.6, { y0: B_Y, variant: 'dark', name: 'B-step-1', thin: false }); D.crateBox(-24.4, -35.5, -23.2, -32.5, 1.2, { y0: B_Y, name: 'B-step-2', thin: false }); D.crateBox(-23.2, -35.5, -22, -32.5, 1.9, { y0: B_Y, variant: 'olive', name: 'B-step-3', thin: false });
  for (const x of [-44, -41, -27, -24.5]) D.pillar(x, -21.6, 0.9, 4.6);
  D.barrels([[-24.2, -44.2], [-25.1, -44.8], [-24.4, -43.3]], { y0: B_Y });
  D.fountain(-30, -45.2, 1.9, 0.85, { glow: 0x62e6d8 });
  D.railing(-38, -46, -38, -36, B_Y + 2.6, 1.05); D.railing(-46, -36, -43, -36, B_Y + 2.6, 1.05);
  D.crate(-44.5, -44.5, 1.4, { y0: H.BALC }); D.crate(-42.9, -44.5, 1.4, { y0: H.BALC, variant: 'tide' }); D.crate(-44.5, -43.1, 1.4, { y0: H.BALC, variant: 'olive', cover: false });
  D.planter(-26, -22.2, 2.2, 1.0, 0.75, { y0: B_Y }); D.palm(-23.3, -22, 3.4);
  D.lampPost(-26, -28, 4.2, 0xbfeaff); D.lampPost(-42, -32, 4.2, 0xbfeaff);
  D.pergola(-41.5, -26, -36.5, -23, 3.0);
  plinth(D, -33, -31, B_Y, 0x2fd0ff);
  // water surfaces
  waterRect(D, -46, -30, -44, -22, H.CANAL + 0.35);
  waterRect(D, -46, -22, -44, -20, -1.55, true);
  for (const z of [-26, -22]) D.lowWall(-44.5, z - 0.3, -43.9, z + 0.3, 0.2, { y0: H.CANAL });

  // ============================================================ B TUNNELS lamps, crates, pillars
  for (const [x, z, nx, nz] of [[-36, 36, 1, 0], [-30, 30, -1, 0], [-42, 14, 1, 0], [-36, 22, -1, 0], [-30, 6, -1, 0], [-36, 0, 1, 0], [-30, -6, -1, 0], [-22, 43, 0, 1], [-30, 43, 0, 1]]) D.wallLamp(x, 3.4, z, nx, nz, 0xffb86a);
  D.crate(-41.2, 25.2, 1.4); D.crate(-40, 26.2, 1.4, { variant: 'olive' });
  D.crate(-35.2, 3, 1.4); D.crate(-35.2, 4.4, 1.4, { variant: 'dark' }); D.pillar(-33, -6, 0.9, 4.3);
  D.barrels([[-41, 16], [-40.2, 16.6]]); D.crate(-31, 33, 1.4, { variant: 'ember' });
  D.pillar(-23, 44.8, 0.9, 4.3); D.crate(-25.5, 40.8, 1.4);

  // ============================================================ facade kits (panels, awnings, shopfronts, balconies, windows, eaves)
  dressFacades(D, D.terrainWalls || []);
  extras(D);
}

function plinth(D, x, z, y0, color) {
  const n = 12, c = rgb(0xe9ddc0), TAU = Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, p = (r, a, yy) => [x + Math.cos(a) * r, yy, z + Math.sin(a) * r];
    D.VB.quad('emissive', p(1.7, a0, y0 + 0.03), p(1.7, a1, y0 + 0.03), p(1.45, a1, y0 + 0.03), p(1.45, a0, y0 + 0.03), mulc(rgb(color), 2.4));
    D.VB.quad('plain', p(1.45, a0, y0 + 0.03), p(1.45, a1, y0 + 0.03), p(0.0001, a1, y0 + 0.03), p(0.0001, a0, y0 + 0.03), mulc(c, 0.92));
  }
  D.objects.push({ name: 'plinth', kind: 'plinth', min: [x - 1.5, y0, z - 1.5], max: [x + 1.5, y0 + 0.1, z + 1.5], center: [x, y0, z], height: 0 });
}
function waterRect(D, x0, z0, x1, z1, y, slope) {
  D.VB.quad('water', [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], rgb(0x7fd6d0));
}
