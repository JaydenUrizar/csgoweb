import * as THREE from 'three';

const _c = new THREE.Color();
/** hex/css -> [r,g,b] in linear working space (what the shaders expect). */
export function lin(hex) { _c.set(hex); return [_c.r, _c.g, _c.b]; }
export function mixLin(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export const TEAM_COL = { ember: 0xff7a2f, tide: 0x2fd0ff };

// Surface aliases -> canonical impact preset key
export const SURFACE_ALIAS = {
  stone: 'stone', concrete: 'stone', brick: 'stone', tile: 'tile', plaster: 'stone', rock: 'stone', asphalt: 'stone', default: 'stone', ground: 'stone', floor: 'stone',
  metal: 'metal', steel: 'metal', grate: 'metal', vent: 'metal',
  wood: 'wood', crate: 'wood', plank: 'wood',
  sand: 'sand', dirt: 'sand', gravel: 'sand', grass: 'grass', foliage: 'grass',
  glass: 'glass', crystal: 'glass', ice: 'glass',
  water: 'water', liquid: 'water',
  rubber: 'rubber', fabric: 'rubber', carpet: 'rubber', plastic: 'rubber',
};

// Surface look. Colours are sRGB hex (converted to linear at init).
export const SURFACES = {
  stone:  { dust: 0xc9bca5, chip: 0xa89c88, chipN: 5, puffN: 4, puff: 0.5, spark: 0, dustA: 0.5, kick: 1.0 },
  tile:   { dust: 0xe6e2da, chip: 0xf2efe8, chipN: 6, puffN: 3, puff: 0.42, spark: 0, dustA: 0.42, kick: 1.1 },
  metal:  { dust: 0x8b8f96, chip: 0xd7dbe2, chipN: 2, puffN: 1, puff: 0.28, spark: 9, dustA: 0.22, kick: 1.0 },
  wood:   { dust: 0xa7825a, chip: 0xd1a56c, chipN: 5, puffN: 2, puff: 0.32, spark: 0, dustA: 0.36, kick: 1.0, splinter: 7 },
  sand:   { dust: 0xd9bd8a, chip: 0xc7a874, chipN: 5, puffN: 6, puff: 0.68, spark: 0, dustA: 0.6, kick: 0.85 },
  grass:  { dust: 0x9fae72, chip: 0x6f8a45, chipN: 4, puffN: 4, puff: 0.45, spark: 0, dustA: 0.42, kick: 0.9 },
  glass:  { dust: 0xdff6ff, chip: 0xbdefff, chipN: 0, puffN: 0, puff: 0.0, spark: 0, dustA: 0.0, kick: 1.0, glass: 10 },
  water:  { dust: 0xeaf7ff, chip: 0xffffff, chipN: 0, puffN: 3, puff: 0.5, spark: 0, dustA: 0.55, kick: 1.0, water: 12 },
  rubber: { dust: 0x9a9aa2, chip: 0x55555c, chipN: 3, puffN: 2, puff: 0.25, spark: 0, dustA: 0.28, kick: 0.9 },
};

// Per-tagger tracer look. width/len in metres, speed m/s.
export const TAGGER_TRACER = {
  tap:     { style: 'none' },
  pip:     { style: 'beam',  width: 0.020, len: 3.0, speed: 420, intensity: 1.6, white: 0.35, power: 0.7 },
  twin:    { style: 'beam',  width: 0.018, len: 2.6, speed: 460, intensity: 1.6, white: 0.4, power: 0.7 },
  judge:   { style: 'comet', width: 0.034, len: 5.0, speed: 360, intensity: 2.0, white: 0.3, power: 1.1 },
  zip:     { style: 'beam',  width: 0.016, len: 2.4, speed: 480, intensity: 1.5, white: 0.4, power: 0.6 },
  hum:     { style: 'beam',  width: 0.019, len: 3.4, speed: 480, intensity: 1.6, white: 0.35, power: 0.75 },
  arc:     { style: 'beam',  width: 0.026, len: 4.6, speed: 520, intensity: 1.9, white: 0.25, power: 1.0 },
  rail:    { style: 'beam',  width: 0.022, len: 5.6, speed: 560, intensity: 1.8, white: 0.3, power: 1.0 },
  halo:    { style: 'twin',  width: 0.030, len: 5.0, speed: 560, intensity: 1.8, white: 0.3, power: 1.0 },
  lance:   { style: 'laser', width: 0.045, len: 14.0, speed: 900, intensity: 3.0, white: 0.5, power: 1.9 },
  scatter: { style: 'pulse', width: 0.014, len: 1.6, speed: 380, intensity: 1.4, white: 0.35, power: 1.4 },
  storm:   { style: 'pulse', width: 0.024, len: 4.0, speed: 500, intensity: 1.7, white: 0.3, power: 1.2 },
  default: { style: 'beam',  width: 0.02, len: 3.2, speed: 480, intensity: 1.6, white: 0.35, power: 1.0 },
};

export const STYLE_ID = { beam: 0, pulse: 1, comet: 2, prism: 3, laser: 4, twin: 5, thin: 4 };
