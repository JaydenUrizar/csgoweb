// Crux Station — level definition (pure data, no DOM, no three.js meshes).
// Coordinates: metres, +X east, -Z north, yaw 0 faces -Z. EMBER spawns south (+Z), TIDE north (-Z).
// A site: NE upper courtyard. B site: NW lower plaza. Mid hub in the centre, long lane on the east edge, B tunnels on the west.
import { createGrid, makeOps, heightAt } from './grid.js';

export const H = { A: 1.5, PLAT: 3.6, BPLAZA: -1.4, BALC: 1.2, DECK: 3.0, CANAL: -2.0 };

export function buildLayout() {
  const g = createGrid();
  const op = makeOps(g);
  const { solid, floor, ramp, paint } = op;

  // ------------------------------------------------------------------ building mass (heights vary for a readable skyline)
  solid(-50, -52, 50, 52, 8.5);
  solid(-50, -52, 50, -49, 10); solid(-50, 49, 50, 52, 9.5); solid(-50, -52, -47, 52, 10); solid(47, -52, 50, 52, 10);
  solid(-18, 36, 18, 52, 6.6);            // ember spawn keeps low walls -> more sun
  solid(-18, -52, 18, -36, 7.2);          // tide spawn
  solid(6, -12, 32, 36, 9.5);             // east block
  solid(-28, -12, -6, 36, 8.0);           // west block
  solid(-50, 30, -30, 52, 7.0);
  solid(-22, -40, -20, -24, 6.4);   // lower the west wall of the Window Room so the NW sun reaches it
  solid(-47, -52, -20, -46, 6.0); solid(-50, -52, -46, -18, 6.0); solid(-47, -46, -46, -20, 6.0);   // lower north/west B walls: lets the NW sun into the plaza

  // ------------------------------------------------------------------ EMBER side (south)
  floor(-16, 38, 16, 50, 0, 'es', 'brick');
  floor(-30, 40, -16, 46, 0, 'tunapp', 'stone');
  floor(16, 40, 34, 46, 0, 'outerlong', 'sand');
  floor(-5, 15, 5, 38, 0, 'midapp', 'stone');
  floor(-2, 10, 2, 15, 0, 'doors', 'stone');

  // ------------------------------------------------------------------ LONG lane (east edge)
  floor(33, -4, 43, 46, 0, 'long', 'sand');
  paint(33, 30, 43, 46, { zone: 'outerlong' });
  solid(33, 27, 35, 30, 8.5, 'long'); solid(41, 27, 43, 30, 8.5, 'long');    // door jambs (arch spans the gap)
  ramp(43, 10, 46, 18, 'x', 43, 0, 46, -1.5, 'pit', 'sand');
  floor(46, 10, 48, 18, -1.5, 'pit', 'sand');
  ramp(33, -12, 43, -4, 'z', -4, 0, -12, H.A, 'longramp', 'stone');

  // ------------------------------------------------------------------ A site (upper courtyard, NE)
  floor(22, -46, 48, -12, H.A, 'a', 'stone');
  floor(41, -46, 48, -34, H.PLAT, 'aplat', 'stone');
  ramp(42, -34, 48, -29, 'z', -29, H.A, -34, H.PLAT, 'aplat', 'stone', { stairs: true });
  floor(12, -32, 22, -26, H.DECK, 'terrace', 'metal');
  ramp(22, -32, 27, -26, 'x', 22, H.DECK, 27, H.A, 'a', 'stone', { stairs: true });
  ramp(16, -46, 22, -40, 'x', 16, 0, 22, H.A, 'adoor', 'stone');

  // ------------------------------------------------------------------ MID hub, palace, catwalk
  floor(-10, -14, 10, 10, 0, 'hub', 'stone');
  floor(10, 4, 12, 10, 0, 'hub', 'stone');
  floor(12, 4, 17, 10, 0, 'short', 'stone');
  ramp(12, -16, 17, 4, 'z', 4, 0, -16, H.DECK, 'short', 'stone');
  floor(-10, -12, -7, -4, H.BALC, 'hub', 'stone');
  ramp(-10, -4, -7, 0, 'z', 0, 0, -4, H.BALC, 'hub', 'stone', { stairs: true });
  floor(-8, -16, -4, -14, 0, 'palace', 'stone'); floor(4, -16, 8, -14, 0, 'palace', 'stone');   // centre arch closed (breaks the x=0 spawn-to-spawn sightline)
  floor(-16, -26, 17, -16, 0, 'palace', 'stone');
  ramp(-22, -26, -16, -20, 'x', -16, 0, -22, H.BPLAZA, 'bconn', 'stone');

  // ------------------------------------------------------------------ TIDE side (north)
  floor(-16, -50, 16, -38, 0, 'ts', 'stone');
  floor(-5, -38, 5, -26, 0, 'tidemid', 'stone');
  floor(-20, -38, -9, -26, 0, 'winroom', 'stone');
  floor(6, -38, 12, -26, 0, 'eastroom', 'stone');
  ramp(-22, -46, -16, -40, 'x', -16, 0, -22, H.BPLAZA, 'bdoor', 'stone');

  // ------------------------------------------------------------------ B site (lower plaza, NW) + tunnels
  floor(-46, -46, -22, -20, H.BPLAZA, 'bplaza', 'brick');
  floor(-46, -46, -38, -36, H.BALC, 'bbalc', 'stone');
  ramp(-46, -36, -38, -30, 'z', -30, H.BPLAZA, -36, H.BALC, 'bbalc', 'stone', { stairs: true });
  floor(-22, -36, -20, -32, 1.1, 'winroom', 'stone');                       // window sill (jump-through)
  floor(-46, -30, -44, -22, H.CANAL, 'bplaza', 'water');                   // canal
  ramp(-46, -22, -44, -20, 'z', -22, H.CANAL, -20, H.BPLAZA, 'bplaza', 'water');
  // B tunnel (snakes: 4 legs, 6 m wide)
  floor(-30, 40, -16, 46, 0, 'tunapp', 'stone');
  floor(-36, 24, -30, 46, 0, 'btun1', 'stone');
  floor(-42, 24, -30, 30, 0, 'btun1', 'stone');
  floor(-42, 6, -36, 24, 0, 'btun2', 'stone');
  floor(-42, 6, -30, 12, 0, 'btun2', 'stone');
  floor(-36, -12, -30, 12, 0, 'btun3', 'stone');
  floor(-36, 6, -30, 12, 0, 'btun2', 'stone');
  ramp(-36, -20, -30, -12, 'z', -12, 0, -20, H.BPLAZA, 'btunmouth', 'stone');

  // ------------------------------------------------------------------ zone colour tints (cell inlays)
  // A site: teal tile carpet border + centre medallion
  paint(30, -34, 38, -22, { surf: 'tile', tint: 0x9fc9c0 }); paint(31, -33, 37, -23, { surf: 'stone', tint: 0 });
  paint(33, -31, 36, -26, { surf: 'tile', tint: 0x2a9d9f });
  // B site centre medallion
  paint(-37, -35, -29, -27, { surf: 'tile', tint: 0x9fc9c0 }); paint(-36, -34, -30, -28, { surf: 'stone', tint: 0 });
  paint(-34, -33, -32, -29, { surf: 'tile', tint: 0x2a9d9f });
  // Long lane bright sand with a darker walking line
  paint(36, -4, 40, 27, { tint: 0xf1d9a4 });

  // 2 m checker paving in the big open courts (breaks up the empty floor), skipped where inlays follow
  const CHK = { a: [0xf2e0b2, 0xe3cd9a], aplat: [0xf4e4b8, 0xe6d3a2], palace: [0xe0cba4, 0xd1bc92], hub: [0xe2ccA6, 0xd3be96], ts: [0xdddcd0, 0xcdcbbd], longramp: [0xeed9a8, 0xdfc994], midapp: [0xdcc7a1, 0xd0bb92], terrace: [0xd2c9bb, 0xc4bbac] };
  for (let j = 0; j < g.NZ; j++) for (let i = 0; i < g.NX; i++) { const k = j * g.NX + i; if (!g.open[k] || g.tint[k] || g.surf[k] !== 0) continue; const c = CHK[g.zoneNames[g.zone[k]]]; if (!c) continue; const x = i + g.X0, z = j + g.Z0; g.tint[k] = c[(((x >> 1) + (z >> 1)) & 1)] | 0x1000000; }
  // floor inlays: runners, borders, medallions (cell-level tints crisp against the paving)
  paint(-1, 15, 1, 38, { tint: 0xc9a77a });                                  // mid lane runner
  paint(-10, -26, 16, -25, { surf: 'brick', tint: 0xc98a68 }); paint(-10, -17, 16, -16, { surf: 'brick', tint: 0xc98a68 }); // palace border bricks
  paint(-4, -1, 4, 1, { surf: 'tile', tint: 0xa9d3cd }); paint(-3, 0, 3, 1, { surf: 'tile', tint: 0x2a9d9f }); paint(-1, -4, 1, 4, { surf: 'tile', tint: 0x2a9d9f }); // hub compass
  paint(35, 24, 41, 25, { surf: 'tile', tint: 0x2a9d9f }); paint(35, 30, 41, 31, { surf: 'tile', tint: 0x2a9d9f });  // long door tile bands
  paint(-16, 38, 16, 39, { surf: 'tile', tint: 0xff7a2f }); paint(-16, -39, 16, -38, { surf: 'tile', tint: 0x2fd0ff });
  paint(-5, -38, 5, -37, { surf: 'tile', tint: 0x2a9d9f }); paint(-15, -50, -14, -40, { surf: 'tile', tint: 0x9fd5d0 }); paint(14, -50, 15, -40, { surf: 'tile', tint: 0x9fd5d0 });
  paint(23, -45, 24, -13, { surf: 'tile', tint: 0x9fc9c0 }); paint(46, -45, 47, -13, { surf: 'tile', tint: 0x9fc9c0 });
  paint(-45, -45, -23, -44, { surf: 'tile', tint: 0x2a9d9f }); paint(-26, -45, -25, -22, { surf: 'tile', tint: 0xe0b090 });
  return { grid: g, op };
}

// ---------------------------------------------------------------------------------------------------------------------
// Zone palette. floor = surface material key; wall = body material key; plinth = lower wall band material key.
export const ZONES = {
  mass:      { floor: 'floor', wall: 'wall',    plinth: 'wall',  c: 0xdcc39a, p: 0xb59770, cap: 0xe4cf9f, f: 0xdcc6a0 },
  es:        { floor: 'brick', wall: 'plaster', plinth: 'brick', c: 0xe0a06a, p: 0xc46f4a, cap: 0xf0c9a0, f: 0xdfa07e, trim: 0xff7a2f },
  tunapp:    { floor: 'brick', wall: 'plaster', plinth: 'brick', c: 0xe3b27a, p: 0xb9603a, cap: 0xf0cfa4, f: 0xd09a74, trim: 0xc4673d },
  btun1:     { floor: 'floor', wall: 'wall',    plinth: 'tile',  c: 0xc9c3b0, p: 0x2a9d9f, cap: 0xdcd6c2, f: 0xb9b8a8, trim: 0x2a9d9f },
  btun2:     { floor: 'floor', wall: 'brick',   plinth: 'wall',  c: 0xc9694a, p: 0x8f6a52, cap: 0xdba080, f: 0xb89a7a, trim: 0xd9a441 },
  btun3:     { floor: 'floor', wall: 'plaster', plinth: 'wall',  c: 0xefe6cc, p: 0x7fa3b0, cap: 0xf6f0dc, f: 0xcfd0c6, trim: 0x3b6f8f },
  btunmouth: { floor: 'floor', wall: 'wall',    plinth: 'wall',  c: 0xc9a67a, p: 0x9a7f5b, cap: 0xdcc394, f: 0xcbb08a },
  outerlong: { floor: 'sand',  wall: 'plaster', plinth: 'wall',  c: 0xeed19a, p: 0xc79a62, cap: 0xf6e6b8, f: 0xe9cf9b },
  long:      { floor: 'sand',  wall: 'wall',    plinth: 'wall',  c: 0xefd39c, p: 0xcda870, cap: 0xf7e8bf, f: 0xebd3a0 },
  pit:       { floor: 'sand',  wall: 'wall',    plinth: 'wall',  c: 0xe0bf86, p: 0xb8925c, cap: 0xf0dcae, f: 0xe0c48e },
  longramp:  { floor: 'floor', wall: 'wall',    plinth: 'wall',  c: 0xefd39c, p: 0xcda870, cap: 0xf7e8bf, f: 0xe8d3a6 },
  a:         { floor: 'floor', wall: 'wall',    plinth: 'tile',  c: 0xf1dba6, p: 0x2a9d9f, cap: 0xf8ecc8, f: 0xf0dcb0, trim: 0x2a9d9f },
  aplat:     { floor: 'floor', wall: 'wall',    plinth: 'tile',  c: 0xf4dfac, p: 0x2a9d9f, cap: 0xfaf0d0, f: 0xf3e2b8, trim: 0x2a9d9f },
  adoor:     { floor: 'floor', wall: 'wall',    plinth: 'wall',  c: 0xe6c793, p: 0xba9060, cap: 0xf1dcae, f: 0xe3cda2 },
  terrace:   { floor: 'deck',  wall: 'wall',    plinth: 'wall',  c: 0xe0c08a, p: 0xb8925c, cap: 0xefd8a8, f: 0xc9c2b4 },
  midapp:    { floor: 'floor', wall: 'plaster', plinth: 'wall',  c: 0xdfb98a, p: 0xb58f66, cap: 0xeed4a8, f: 0xd9c4a0 },
  doors:     { floor: 'floor', wall: 'wall',    plinth: 'wall',  c: 0xd9b283, p: 0xa88660, cap: 0xe8cd9f, f: 0xd3bd98 },
  hub:       { floor: 'floor', wall: 'plaster', plinth: 'wall',  c: 0xe2bc8c, p: 0xb98f64, cap: 0xf0d8ac, f: 0xdcc6a0 },
  short:     { floor: 'floor', wall: 'wall',    plinth: 'wall',  c: 0xd8b686, p: 0xb08a5e, cap: 0xe8d0a2, f: 0xd2bc96 },
  palace:    { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xe4b98a, p: 0x2a9d9f, cap: 0xf1d9ae, f: 0xdbc5a0, trim: 0x2a9d9f },
  ts:        { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xe3dac0, p: 0x2fb3c8, cap: 0xf1ead2, f: 0xd7d6ca, trim: 0x2fd0ff },
  tidemid:   { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xdcd2b8, p: 0x2a9d9f, cap: 0xeee6cc, f: 0xd3d2c4 },
  winroom:   { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xd9c9ac, p: 0x2a9d9f, cap: 0xeadcc0, f: 0xd0cabb },
  eastroom:  { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xd9c9ac, p: 0x2a9d9f, cap: 0xeadcc0, f: 0xd0cabb },
  bconn:     { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xd6a184, p: 0x1f8a8f, cap: 0xe7c6a8, f: 0xcdb797 },
  bdoor:     { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xd6a184, p: 0x1f8a8f, cap: 0xe7c6a8, f: 0xcdb797 },
  bplaza:    { floor: 'brick', wall: 'plaster', plinth: 'tile',  c: 0xd49578, p: 0x1f8a8f, cap: 0xe8c5a6, f: 0xcf9f82, trim: 0x1f8a8f },
  bbalc:     { floor: 'floor', wall: 'plaster', plinth: 'tile',  c: 0xd49578, p: 0x1f8a8f, cap: 0xe8c5a6, f: 0xd8b592, trim: 0x1f8a8f },
};

export { heightAt };
