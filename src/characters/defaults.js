// Default CosmeticSpec per team + sample specs used by the gallery. Schema: docs/ARCHITECTURE.md (CosmeticSpec).
import { TEAMS } from '../core/config.js';

export function defaultSpec(team) {
  const ember = team !== 'tide';
  return {
    suit: { base: ember ? 0x86361a : 0x1f86b8, accent: ember ? 0x1d2026 : 0xe9f3f8, pattern: 'solid', patternColor: ember ? 0xb4552b : 0xe9f3f8, material: 'satin' },
    helmet: { shape: 'round', color: ember ? 0x3a2c26 : 0xe6eff3, accent: ember ? 0xff7a2f : 0x2b2f38 },
    visor: { shape: 'wide', color: ember ? 0xffc79a : 0xaeeaff, glow: ember ? 0xffa060 : 0x7fe3ff },
    back: { model: 'none', color: 0x3a3f4b }, trail: { type: 'none', color: 0xffffff, color2: 0xffffff },
    tagOutEffect: 'shatter', taggerSkin: null, charm: { model: 'none', color: 0xffffff }, nameplate: { style: 'plain', color: 0xffffff }, emote: '', rarity: 'common',
  };
}

export function teamColor(team) { return (TEAMS[team] || TEAMS.ember).color; }

/** Fill any missing branches of a (possibly partial) spec with team defaults. */
export function completeSpec(spec, team) {
  const d = defaultSpec(team); if (!spec) return d;
  const out = {};
  for (const k of Object.keys(d)) out[k] = (d[k] && typeof d[k] === 'object') ? { ...d[k], ...(spec[k] || {}) } : (spec[k] ?? d[k]);
  return out;
}

export const HELMETS = ['round', 'visorcap', 'hex', 'crest', 'antenna', 'horns', 'halo', 'none'];
export const VISORS = ['wide', 'slit', 'round', 'shades', 'cyclops', 'x'];
export const BACKS = ['none', 'pack', 'wings', 'tail', 'jet', 'banner'];
export const PATTERNS = ['solid', 'stripes', 'hex', 'chevron', 'camo', 'circuit', 'gradient', 'checker'];
export const TAGOUTS = ['shatter', 'confetti', 'pixelate', 'fireworks', 'petals', 'stars'];

/** A handful of showy sample loadouts for the gallery (index wraps). */
export const SAMPLE_SPECS = [
  {},
  { suit: { base: 0x3b2a6b, accent: 0xff5fa8, pattern: 'chevron', patternColor: 0xff5fa8, material: 'metallic' }, helmet: { shape: 'crest', color: 0xff5fa8, accent: 0x231a3f }, visor: { shape: 'shades', glow: 0xff9ad1 }, back: { model: 'wings', color: 0x6a3fd0 }, tagOutEffect: 'stars' },
  { suit: { base: 0x1c3a2a, accent: 0x9be15a, pattern: 'camo', patternColor: 0x2f6a45, material: 'matte' }, helmet: { shape: 'hex', color: 0x2a4a35, accent: 0x9be15a }, visor: { shape: 'slit', glow: 0xb7ff5a }, back: { model: 'pack', color: 0x2a3d30 }, tagOutEffect: 'confetti' },
  { suit: { base: 0x222831, accent: 0x00e5ff, pattern: 'circuit', patternColor: 0x00e5ff, material: 'holo' }, helmet: { shape: 'antenna', color: 0x39414f, accent: 0x00e5ff }, visor: { shape: 'cyclops', glow: 0x00e5ff }, back: { model: 'jet', color: 0x39414f }, tagOutEffect: 'pixelate' },
  { suit: { base: 0xf2f2f2, accent: 0x111111, pattern: 'checker', patternColor: 0x111111, material: 'satin' }, helmet: { shape: 'horns', color: 0xf2f2f2, accent: 0xd33a2c }, visor: { shape: 'x', glow: 0xff4040 }, back: { model: 'tail', color: 0xd33a2c }, tagOutEffect: 'fireworks' },
  { suit: { base: 0xffb3c7, accent: 0xffffff, pattern: 'gradient', patternColor: 0xa66bff, material: 'satin' }, helmet: { shape: 'halo', color: 0xffe2ec, accent: 0xa66bff }, visor: { shape: 'round', glow: 0xfff08a }, back: { model: 'banner', color: 0xa66bff }, tagOutEffect: 'petals' },
  { suit: { base: 0x8a5a1c, accent: 0xffd166, pattern: 'hex', patternColor: 0xffd166, material: 'metallic' }, helmet: { shape: 'visorcap', color: 0x8a5a1c, accent: 0xffd166 }, visor: { shape: 'wide', glow: 0xffd166 }, back: { model: 'pack', color: 0x6b430f }, tagOutEffect: 'shatter' },
  { suit: { base: 0x111827, accent: 0xffffff, pattern: 'stripes', patternColor: 0xffffff, material: 'satin' }, helmet: { shape: 'none', color: 0x111827, accent: 0xffffff }, visor: { shape: 'slit', glow: 0xffffff }, back: { model: 'none' }, tagOutEffect: 'confetti' },
];
