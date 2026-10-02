// World sounds: surface impacts, footsteps / jump / land, utility, beacon.
import { osc, noise, click, ring, chain, clamp } from './dsp.js';
import { reg } from './registry.js';
import { clack } from './weapons.js';

export const SURFACES = ['stone', 'metal', 'wood', 'glass', 'sand', 'tile', 'grass', 'rubber', 'plastic', 'water'];
const ALIAS = { concrete: 'stone', brick: 'stone', rock: 'stone', asphalt: 'stone', dirt: 'sand', gravel: 'sand', carpet: 'rubber', foam: 'rubber', steel: 'metal', grate: 'metal', crate: 'wood', plank: 'wood', floor: 'tile', ceramic: 'tile', default: 'stone', body: 'stone' };
export const resolveSurface = (s) => (SURFACES.includes(s) ? s : ALIAS[s] || 'stone');

const jit = (V, p = 0.1) => 1 + (V.r() * 2 - 1) * p;

// ---------------- impacts ----------------
const IMPACT = {
  stone(V, k, j) {
    click(V, { g: 0.45 * k, hp: 2500 });
    noise(V, { a: 0.0004, d: 0.055, g: 0.5 * k, bp: 2600 * j, q: 0.8, sat: 0.2 });
    osc(V, { f0: 340 * j, f1: 110, pt: 0.02, d: 0.07, g: 0.5 * k });
    for (let i = 0; i < 3; i++) noise(V, { when: 0.03 + V.r() * 0.12, a: 0.0002, d: 0.01, g: (0.12 + V.r() * 0.1) * k, bp: (2500 + V.r() * 3500), q: 2 });   // debris
    noise(V, { kind: 'pink', a: 0.004, d: 0.18, g: 0.12 * k, lp: [3000, 500, 0.2], hp: 300 });                                                        // dust puff
  },
  metal(V, k, j) {
    click(V, { g: 0.5 * k, hp: 3000 });
    ring(V, { f: 1750 * j, ratios: [1, 2.41, 3.87, 5.6], decays: [1, 0.75, 0.5, 0.3], gains: [1, 0.6, 0.4, 0.25], d: 0.32, g: 0.34 * k });
    noise(V, { a: 0.0003, d: 0.03, g: 0.4 * k, hp: 3500 });
    osc(V, { f0: 260, f1: 130, pt: 0.02, d: 0.06, g: 0.3 * k });
    if (V.r() < 0.55) osc(V, { when: 0.008, f0: 4800 * j, f1: 1600, pt: 0.22, d: 0.25, g: 0.07 * k, a: 0.002 });   // ricochet zing
  },
  wood(V, k, j) {
    click(V, { g: 0.3 * k, hp: 1800 });
    osc(V, { f0: 400 * j, f1: 190, pt: 0.03, d: 0.09, g: 0.7 * k });
    noise(V, { a: 0.0005, d: 0.045, g: 0.45 * k, bp: 1300 * j, q: 1.3 });
    ring(V, { f: 600 * j, ratios: [1, 1.9, 2.8], decays: [1, 0.6, 0.4], gains: [1, 0.5, 0.3], d: 0.14, g: 0.12 * k });
    for (let i = 0; i < 2; i++) noise(V, { when: 0.02 + V.r() * 0.08, a: 0.0003, d: 0.012, g: 0.16 * k, bp: 3000 + V.r() * 1500, q: 3 });   // splinter
  },
  glass(V, k, j) {
    click(V, { g: 0.5 * k, hp: 4000 });
    ring(V, { f: 3300 * j, ratios: [1, 1.51, 2.13, 3.2], decays: [1, 0.8, 0.6, 0.35], gains: [1, 0.7, 0.5, 0.3], d: 0.18, g: 0.28 * k });
    noise(V, { a: 0.0003, d: 0.13, g: 0.45 * k, hp: 5000 });
    for (let i = 0; i < 6; i++) ring(V, { when: 0.02 + V.r() * 0.16, f: 3000 + V.r() * 4000, ratios: [1, 1.6], decays: [1, 0.5], gains: [1, 0.4], d: 0.05 + V.r() * 0.06, g: (0.1 + V.r() * 0.1) * k });
  },
  sand(V, k, j) {
    noise(V, { kind: 'pink', a: 0.002, d: 0.11, g: 0.55 * k, lp: [1800 * j, 500, 0.1], hp: 120 });
    osc(V, { f0: 150, f1: 60, pt: 0.03, d: 0.09, g: 0.42 * k });
    for (let i = 0; i < 3; i++) noise(V, { when: V.r() * 0.08, a: 0.001, d: 0.02, g: 0.06 * k, hp: 4500 });
  },
  tile(V, k, j) {
    click(V, { g: 0.5 * k, hp: 3200 });
    noise(V, { a: 0.0003, d: 0.04, g: 0.5 * k, bp: 3200 * j, q: 1.4 });
    osc(V, { f0: 420 * j, f1: 170, pt: 0.015, d: 0.05, g: 0.4 * k });
    ring(V, { f: 2000 * j, ratios: [1, 2.3], decays: [1, 0.4], gains: [1, 0.3], d: 0.09, g: 0.12 * k });
    for (let i = 0; i < 2; i++) noise(V, { when: 0.03 + V.r() * 0.1, a: 0.0002, d: 0.01, g: 0.12 * k, bp: 3000 + V.r() * 3000, q: 2 });
  },
  grass(V, k, j) {
    noise(V, { kind: 'pink', a: 0.005, d: 0.1, g: 0.35 * k, bp: 700 * j, q: 0.6 });
    osc(V, { f0: 120, f1: 55, pt: 0.03, d: 0.08, g: 0.4 * k });
    noise(V, { when: 0.01, a: 0.006, d: 0.08, g: 0.06 * k, hp: 3500 });
  },
  rubber(V, k, j) {
    osc(V, { f0: 190 * j, f1: 70, pt: 0.02, d: 0.1, g: 0.6 * k });
    noise(V, { a: 0.001, d: 0.05, g: 0.3 * k, lp: 1200, hp: 100 });
  },
  plastic(V, k, j) {
    click(V, { g: 0.3 * k, hp: 2500 });
    osc(V, { f0: 500 * j, f1: 210, pt: 0.02, d: 0.06, g: 0.5 * k });
    noise(V, { a: 0.0004, d: 0.035, g: 0.4 * k, bp: 1900, q: 1.1 });
  },
  water(V, k, j) {
    noise(V, { kind: 'pink', a: 0.003, d: 0.18, g: 0.4 * k, bp: 900 * j, q: 0.7, sweep: [2300, 0.14] });
    osc(V, { f0: 320 * j, f1: 780, pt: 0.07, d: 0.11, g: 0.2 * k, a: 0.005 });
    noise(V, { when: 0.02, a: 0.004, d: 0.13, g: 0.12 * k, hp: 3000 });
  },
};

// ---------------- footsteps ----------------
const stepK = (o) => { const s = o.speed ?? 5.5; let k = clamp((s - 0.6) / 5.2, 0.10, 1.15); if (o.crouch || o.walk) k *= 0.5; return k; };

const STEP = {
  stone(V, k, j, heel) { click(V, { g: 0.13 * k, hp: 2600 }); osc(V, { f0: 150 * j, f1: 72, pt: 0.025, d: 0.07, g: 0.55 * k * heel }); noise(V, { a: 0.0005, d: 0.04, g: 0.34 * k, bp: 1150 * j, q: 0.9 }); noise(V, { when: 0.004, a: 0.001, d: 0.05, g: 0.06 * k, hp: 3200 }); },
  metal(V, k, j, heel) { click(V, { g: 0.16 * k, hp: 3000 }); osc(V, { f0: 130 * j, f1: 80, pt: 0.02, d: 0.06, g: 0.4 * k * heel }); ring(V, { f: 720 * j, ratios: [1, 2.13, 3.4, 5.2], decays: [1, 0.8, 0.5, 0.3], gains: [1, 0.6, 0.4, 0.2], d: 0.17, g: 0.26 * k }); noise(V, { a: 0.0004, d: 0.03, g: 0.3 * k, bp: 2300, q: 1.2 }); },
  wood(V, k, j, heel) { osc(V, { f0: 210 * j, f1: 105, pt: 0.03, d: 0.1, g: 0.6 * k * heel }); noise(V, { a: 0.0005, d: 0.05, g: 0.3 * k, bp: 750 * j, q: 1.2 }); ring(V, { f: 330 * j, ratios: [1, 1.9, 2.9], decays: [1, 0.6, 0.4], gains: [1, 0.5, 0.3], d: 0.13, g: 0.12 * k }); click(V, { g: 0.08 * k, hp: 2000 }); },
  glass(V, k, j, heel) { click(V, { g: 0.2 * k, hp: 4000 }); osc(V, { f0: 140, f1: 80, pt: 0.02, d: 0.05, g: 0.3 * k * heel }); ring(V, { f: 3200 * j, ratios: [1, 1.5, 2.2, 3.3], decays: [1, 0.7, 0.5, 0.3], gains: [1, 0.6, 0.4, 0.3], d: 0.1, g: 0.14 * k }); for (let i = 0; i < 4; i++) noise(V, { when: V.r() * 0.05, a: 0.0003, d: 0.012, g: 0.1 * k, hp: 3500 + V.r() * 2000, q: 2 }); },
  sand(V, k, j, heel) { noise(V, { kind: 'pink', a: 0.008, d: 0.12, g: 0.4 * k, lp: [1700 * j, 500, 0.12], hp: 120 }); osc(V, { f0: 95, f1: 60, pt: 0.03, d: 0.07, g: 0.28 * k * heel }); for (let i = 0; i < 3; i++) noise(V, { when: 0.005 + V.r() * 0.07, a: 0.001, d: 0.015, g: 0.045 * k, hp: 5000 }); },
  tile(V, k, j, heel) { click(V, { g: 0.28 * k, hp: 3200 }); noise(V, { a: 0.0003, d: 0.03, g: 0.4 * k, bp: 2500 * j, q: 1.4 }); osc(V, { f0: 190 * j, f1: 90, pt: 0.02, d: 0.06, g: 0.4 * k * heel }); ring(V, { f: 2000 * j, ratios: [1, 2.3], decays: [1, 0.4], gains: [1, 0.3], d: 0.07, g: 0.09 * k }); },
  grass(V, k, j, heel) { noise(V, { kind: 'pink', a: 0.02, d: 0.13, g: 0.22 * k, bp: 650 * j, q: 0.6 }); osc(V, { f0: 85, f1: 55, pt: 0.03, d: 0.09, g: 0.24 * k * heel }); noise(V, { when: 0.02, a: 0.01, d: 0.08, g: 0.045 * k, hp: 3500 }); },
  rubber(V, k, j, heel) { osc(V, { f0: 125 * j, f1: 62, pt: 0.025, d: 0.09, g: 0.55 * k * heel }); noise(V, { a: 0.001, d: 0.05, g: 0.22 * k, lp: 900, hp: 100 }); noise(V, { when: 0.0, a: 0.0005, d: 0.02, g: 0.06 * k, hp: 2800 }); },
  plastic(V, k, j, heel) { click(V, { g: 0.14 * k, hp: 2500 }); osc(V, { f0: 240 * j, f1: 115, pt: 0.02, d: 0.06, g: 0.45 * k * heel }); noise(V, { a: 0.0004, d: 0.035, g: 0.3 * k, bp: 1600 * j, q: 1.1 }); },
  water(V, k, j, heel) { noise(V, { kind: 'pink', a: 0.004, d: 0.2, g: 0.32 * k, bp: 900 * j, q: 0.7, sweep: [2200, 0.14] }); osc(V, { f0: 300 * j, f1: 700, pt: 0.06, d: 0.09, g: 0.16 * k, a: 0.004 }); noise(V, { when: 0.02, a: 0.004, d: 0.14, g: 0.09 * k, hp: 2800 }); },
};
function stepVoice(V, s, o) {
  const k = stepK(o) * (V.fp ? 0.85 : 1), j = jit(V, 0.07) * (o.foot ? 1.05 : 0.97);
  STEP[s](V, k, j, 0.45);
  // bright scuff + grit: the locatable 1-6 kHz part of a footstep
  noise(V, { a: 0.0004, d: 0.04, g: 0.55 * k, bp: 2600 * j, q: 0.6, hp: 1100, sat: 0.3 });
  noise(V, { a: 0.0003, d: 0.022, g: 0.3 * k, hp: 4800 });
  click(V, { g: 0.2 * k, hp: 2200 });
  // toe-off tick a moment later (softer, higher)
  const toe = 0.06 + V.r() * 0.01;
  const sub = { ...V, t: V.t + toe, end: 0 }; STEP[s](sub, k * 0.32, j * 1.25, 0.1); noise(sub, { a: 0.0003, d: 0.03, g: 0.28 * k, bp: 3400, q: 0.7, hp: 1500 }); V.end = Math.max(V.end, toe + sub.end);
  // cloth
  noise(V, { kind: 'pink', a: 0.01, d: 0.09, g: 0.05 * k, bp: 1500, q: 0.5 });
}

export function registerWorld() {
  for (const s of SURFACES) {
    reg(`impact.${s}`, (V) => IMPACT[s](V, clamp(V.o.intensity ?? 1, 0.3, 1.4), jit(V, 0.1)), { cat: 'impact', ref: 3.5, roll: 1.2, maxDist: 70, send: 0.35, voices: 10, prio: 1 });
    reg(`step.${s}`, (V) => stepVoice(V, s, V.o), { cat: 'step', ref: 1.6, roll: 1.35, maxDist: 42, send: 0.2, voices: 16, prio: 2, gain: 1.3 });
  }
  reg('impact.body', (V) => {   // pulse strikes a player
    click(V, { g: 0.35, hp: 2400 }); noise(V, { a: 0.0005, d: 0.05, g: 0.4, bp: 1800, q: 1 }); osc(V, { f0: 300, f1: 110, pt: 0.02, d: 0.08, g: 0.35 });
    ring(V, { f: 2400 * jit(V, 0.05), ratios: [1, 1.5], decays: [1, 0.5], gains: [1, 0.4], d: 0.12, g: 0.1 });
  }, { cat: 'impact', ref: 3.5, maxDist: 60, send: 0.25 });

  reg('move.jump', (V) => {
    const k = V.fp ? 0.9 : 1, s = resolveSurface(V.o.surface);
    noise(V, { kind: 'pink', a: 0.012, d: 0.1, g: 0.13 * k, bp: 1600, q: 0.6, sweep: [900, 0.1] });
    const sub = { ...V }; sub.end = 0; STEP[s](sub, 0.55 * k, jit(V, 0.05), 1); V.end = Math.max(V.end, sub.end);
  }, { cat: 'move', ref: 1.8, roll: 1.3, maxDist: 40, send: 0.12, voices: 6, prio: 2 });
  reg('move.land', (V) => {
    const o = V.o, k = clamp((o.speed ?? 6) / 9, 0.25, 1.5) * (V.fp ? 0.9 : 1), s = resolveSurface(o.surface), j = jit(V, 0.06);
    osc(V, { f0: 105 * j, f1: 38, pt: 0.05, d: 0.3, g: 0.75 * k, sat: 0.2 });
    noise(V, { a: 0.001, d: 0.13, g: 0.28 * k, lp: 800, hp: 60 });
    noise(V, { a: 0.02, d: 0.14, g: 0.10 * k, bp: 1700, q: 0.5 });
    const sub = { ...V }; sub.end = 0; STEP[s](sub, 1.0 * k, j, 1); V.end = Math.max(V.end, sub.end);
    if (k > 0.8) osc(V, { f0: 62, f1: 34, pt: 0.08, d: 0.35, g: 0.4 * k });
  }, { cat: 'move', ref: 2.5, roll: 1.25, maxDist: 55, send: 0.2, voices: 6, prio: 3 });
  reg('move.slide', (V) => noise(V, { kind: 'pink', a: 0.06, hold: 0.25, d: 0.2, g: 0.22, bp: 1200, q: 0.5, sweep: [700, 0.5] }), { cat: 'move', ref: 2, maxDist: 35, send: 0.08 });
  reg('move.pickup', (V) => { clack(V, 0, { f: 1800, g: 0.25, metal: 0.5 }); noise(V, { a: 0.03, d: 0.1, g: 0.1, bp: 1200, sweep: [2000, 0.1] }); }, { cat: 'move', ref: 2 });

  // ---- utility ----
  reg('util.pin', (V) => {
    click(V, { g: 0.4, hp: 2500 }); ring(V, { f: 3800, ratios: [1, 2.1, 3.2], decays: [1, 0.5, 0.3], gains: [1, 0.5, 0.3], d: 0.2, g: 0.2 });
    clack(V, 0.07, { f: 2200, g: 0.22, metal: 0.7, body: 220 });   // spoon flick
  }, { cat: 'util', ref: 2.5, maxDist: 40 });
  const throwSnd = (type) => (V) => {
    const q = type === 'strobe' ? 1.4 : type === 'pulse' ? 0.7 : 1;
    noise(V, { kind: 'pink', a: 0.08, hold: 0.02, d: 0.22, g: 0.25, bp: 320 * q, q: 0.8, sweep: [1100 * q, 0.28], hp: 120 });
    osc(V, { f0: 140 * q, f1: 90 * q, pt: 0.15, a: 0.05, d: 0.16, g: 0.14 });
    click(V, { g: 0.12, hp: 1500, when: 0.02 });
  };
  for (const t of ['haze', 'strobe', 'pulse']) reg(`util.throw.${t}`, throwSnd(t), { cat: 'util', ref: 2.5, maxDist: 45, send: 0.08 });
  reg('util.bounce', (V) => {
    const k = clamp(V.o.speed ?? 6, 1, 12) / 8, j = jit(V, 0.1);
    osc(V, { f0: 480 * j, f1: 170, pt: 0.02, d: 0.09, g: 0.5 * k }); noise(V, { a: 0.0004, d: 0.04, g: 0.3 * k, bp: 1100, q: 1 });
    ring(V, { f: 1300 * j, ratios: [1, 2.2, 3.6], decays: [1, 0.5, 0.3], gains: [1, 0.4, 0.2], d: 0.1, g: 0.14 * k });
  }, { cat: 'util', ref: 3, maxDist: 55, send: 0.2 });
  reg('util.haze.pop', (V) => {
    osc(V, { f0: 180, f1: 52, pt: 0.1, d: 0.4, g: 0.85, sat: 0.2 }); noise(V, { kind: 'pink', a: 0.004, d: 0.7, g: 0.5, lp: [2600, 260, 0.6], hp: 60 });
    ring(V, { f: 620, ratios: [1, 2.3, 3.6], decays: [1, 0.5, 0.3], gains: [1, 0.5, 0.3], d: 0.35, g: 0.1 });
    noise(V, { a: 0.03, d: 0.35, g: 0.22, bp: 2400, q: 0.6, sweep: [900, 0.35] }); click(V, { g: 0.45, hp: 1500 });
  }, { cat: 'util', ref: 9, roll: 1.0, maxDist: 130, send: 0.5, prio: 4 });
  reg('util.haze.hiss', (V) => {
    const d = 9.5;
    noise(V, { a: 0.25, hold: 3.5, d: d - 3.75, g: 0.2, bp: 4200, q: 0.5, sweep: [2600, d], hp: 1200 });
    noise(V, { kind: 'pink', a: 0.4, hold: 3, d: d - 3.4, g: 0.16, lp: [2200, 500, d], hp: 200 });
  }, { cat: 'util', ref: 6, roll: 1.2, maxDist: 55, send: 0.3, voices: 3, prio: 2 });
  reg('util.strobe.pop', (V) => {
    click(V, { g: 0.9, hp: 1500 }); noise(V, { a: 0.0002, d: 0.17, g: 0.75, hp: 1800, sat: 0.4 });
    osc(V, { f0: 210, f1: 66, pt: 0.03, d: 0.2, g: 0.85, sat: 0.3 });
    osc(V, { type: 'square', f0: 6200, f1: 2600, pt: 0.28, d: 0.32, g: 0.11, lp: 8000 });
    ring(V, { f: 4400, ratios: [1, 1.62, 2.4], decays: [1, 0.7, 0.4], gains: [1, 0.6, 0.4], d: 0.55, g: 0.12 });
    noise(V, { kind: 'pink', a: 0.004, d: 0.5, g: 0.2, lp: [3000, 400, 0.5] });
  }, { cat: 'util', ref: 12, roll: 1.0, maxDist: 140, send: 0.5, prio: 4 });
  reg('util.strobe.ring', (V) => {   // tinnitus: two beating sines + high shimmer, level by o.amount
    const a = clamp(V.o.amount ?? 1, 0.15, 1), d = 1.4 + 3.6 * a;
    osc(V, { f0: 4100, d, hold: 0.3 * a, a: 0.03, g: 0.05 + 0.07 * a });
    osc(V, { f0: 4137, d: d * 0.9, hold: 0.25 * a, a: 0.03, g: 0.04 + 0.05 * a });
    osc(V, { f0: 6010, d: d * 0.7, hold: 0.15 * a, a: 0.05, g: 0.02 + 0.035 * a });
    osc(V, { f0: 8300, d: d * 0.45, a: 0.08, g: 0.012 * a });
    osc(V, { f0: 820, d: d * 0.35, a: 0.01, g: 0.05 * a, lp: 1500 });
  }, { cat: 'util', spatial: false, bus: 'ui', send: 0, voices: 1, prio: 9 });
  reg('util.pulse.boom', (V) => {
    osc(V, { f0: 92, f1: 24, pt: 0.35, d: 1.4, g: 1.0, sat: 0.25 });
    osc(V, { f0: 210, f1: 46, pt: 0.12, d: 0.9, g: 0.6, sat: 0.35 });
    noise(V, { kind: 'pink', a: 0.002, d: 1.3, g: 0.6, lp: [5200, 150, 1.2], hp: 40 });
    osc(V, { f0: 1900, f1: 200, pt: 0.5, d: 0.7, g: 0.16, a: 0.003 });
    ring(V, { f: 1200, ratios: [1, 1.335, 1.5, 2], decays: [1, 0.9, 0.8, 0.6], gains: [1, 0.7, 0.6, 0.4], d: 1.3, g: 0.08, a: 0.06 });
    click(V, { g: 0.8, hp: 1800 }); noise(V, { a: 0.0003, d: 0.06, g: 0.5, bp: 1500, q: 0.5, sat: 0.5 });
  }, { cat: 'util', ref: 16, roll: 0.95, maxDist: 170, send: 0.6, prio: 5 });
  reg('util.pickup', (V) => { ring(V, { f: 1500, ratios: [1, 1.5], d: 0.16, g: 0.16 }); click(V, { g: 0.3 }); }, { cat: 'util', ref: 3 });

  // ---- beacon ----
  reg('beacon.arm.beep', (V) => {
    const u = clamp(V.o.urgency ?? 0, 0, 1), f = 1480 * (1 + u * 0.55), j = jit(V, 0.005);
    click(V, { g: 0.32, hp: 2500 });
    osc(V, { type: 'square', f0: f * j, d: 0.075 + (V.o.last ? 0.4 : 0), hold: V.o.last ? 0.2 : 0.006, g: 0.3, lp: 5500, hp: 500 });
    osc(V, { f0: f * 2 * j, d: 0.05, g: 0.12 });
    ring(V, { f: f * 1.5, ratios: [1, 2.02], decays: [1, 0.5], gains: [1, 0.4], d: 0.1, g: 0.05 });
    if (u > 0.6) osc(V, { type: 'square', when: 0.09, f0: f * 1.33, d: 0.06, g: 0.22, lp: 5500, hp: 500 });
  }, { cat: 'beacon', ref: 7, roll: 0.9, maxDist: 120, send: 0.4, voices: 3, prio: 6 });
  reg('beacon.pickup', (V) => { ring(V, { f: 1319, ratios: [1, 2], decays: [1, 0.4], gains: [1, 0.3], d: 0.2, g: 0.16 }); ring(V, { when: 0.07, f: 1760, ratios: [1, 2], decays: [1, 0.4], gains: [1, 0.3], d: 0.3, g: 0.16 }); click(V, { g: 0.2 }); }, { cat: 'beacon', spatial: false, send: 0.15 });
  reg('beacon.drop', (V) => { osc(V, { f0: 220, f1: 70, pt: 0.05, d: 0.25, g: 0.6 }); ring(V, { f: 900, ratios: [1, 2.3], d: 0.2, g: 0.1 }); noise(V, { a: 0.0005, d: 0.05, g: 0.25, bp: 1000 }); }, { cat: 'beacon', ref: 4, maxDist: 60 });
  reg('beacon.arm.start', (V) => { click(V, { g: 0.3 }); osc(V, { f0: 400, f1: 900, pt: 0.12, d: 0.15, g: 0.14, lp: 3000 }); clack(V, 0.02, { f: 1800, g: 0.2, metal: 0.6 }); }, { cat: 'beacon', ref: 4, maxDist: 60 });
  reg('beacon.cancel', (V) => { osc(V, { f0: 900, f1: 300, pt: 0.1, d: 0.14, g: 0.16 }); click(V, { g: 0.2 }); }, { cat: 'beacon', ref: 4, maxDist: 50 });
  reg('beacon.armed', (V) => {   // "locked in" sting
    clack(V, 0, { f: 1500, g: 0.5, metal: 0.9, body: 140 }); osc(V, { f0: 190, f1: 70, pt: 0.08, d: 0.4, g: 0.6, sat: 0.2 });
    [880, 1109, 1319, 1760].forEach((f, i) => { ring(V, { when: 0.08 + i * 0.075, f, ratios: [1, 2, 3], decays: [1, 0.5, 0.25], gains: [1, 0.4, 0.2], d: 0.55 - i * 0.05, g: 0.17 }); osc(V, { when: 0.08 + i * 0.075, type: 'square', f0: f, d: 0.09, g: 0.06, lp: 4000 }); });
    osc(V, { when: 0.05, f0: 300, f1: 1900, pt: 0.3, a: 0.05, d: 0.35, g: 0.08, lp: 5000 });
    noise(V, { kind: 'pink', a: 0.01, d: 0.9, g: 0.1, lp: [3000, 400, 0.9] });
  }, { cat: 'beacon', spatial: false, send: 0.35, prio: 7 });
  reg('beacon.disarm.start', (V) => { click(V, { g: 0.3 }); osc(V, { f0: 900, f1: 500, pt: 0.1, d: 0.14, g: 0.14, lp: 3000 }); clack(V, 0.02, { f: 1700, g: 0.18, metal: 0.6 }); }, { cat: 'beacon', ref: 4, maxDist: 60 });
  reg('beacon.disarm.done', (V) => {
    [1568, 1319, 988, 784].forEach((f, i) => ring(V, { when: i * 0.075, f, ratios: [1, 2, 3], decays: [1, 0.5, 0.25], gains: [1, 0.4, 0.2], d: 0.5, g: 0.15 }));
    osc(V, { f0: 1800, f1: 160, pt: 0.5, a: 0.01, d: 0.6, g: 0.1, lp: 4000 }); clack(V, 0.3, { f: 1400, g: 0.3, metal: 0.8, body: 130 });
    noise(V, { kind: 'pink', a: 0.02, d: 0.8, g: 0.09, lp: [4000, 300, 0.8] });
  }, { cat: 'beacon', spatial: false, send: 0.35, prio: 7 });
  reg('beacon.complete', (V) => {   // final swell + boom
    const chord = [110, 165, 220, 277.2, 330];
    chord.forEach((f, i) => osc(V, { type: 'sawtooth', f0: f * (1 + i * 0.002), a: 1.1, hold: 0.25, d: 1.3, g: 0.11, lp: [280, 5200, 1.2], det: (i % 2 ? 6 : -6) }));
    noise(V, { a: 1.2, hold: 0.1, d: 1.0, g: 0.3, hp: 1800, bp: 3000, q: 0.3, sweep: [9000, 1.3] });
    const t = 1.35;
    osc(V, { when: t, f0: 88, f1: 24, pt: 0.4, d: 1.7, g: 1.0, sat: 0.25 }); osc(V, { when: t, f0: 220, f1: 45, pt: 0.14, d: 1.0, g: 0.6, sat: 0.3 });
    noise(V, { when: t, kind: 'pink', a: 0.002, d: 1.5, g: 0.6, lp: [5500, 150, 1.4] }); click(V, { when: t, g: 0.9, hp: 1800 });
    ring(V, { when: t, f: 880, ratios: [1, 1.5, 2, 3, 4.1], decays: [1, 0.9, 0.8, 0.6, 0.4], gains: [1, 0.8, 0.6, 0.4, 0.3], d: 1.8, g: 0.14, a: 0.01 });
  }, { cat: 'beacon', spatial: false, send: 0.5, prio: 8, voices: 1 });
}

/** Continuous charge drone (arming / disarming hold). set(progress 0..1) each frame. */
export function makeDrone(ac, dest, kind = 'arm') {
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), lp = ac.createBiquadFilter(), g = ac.createGain();
  o1.type = 'sawtooth'; o2.type = 'sine'; lfo.type = 'sine'; lfo.frequency.value = kind === 'arm' ? 9 : 5; lg.gain.value = kind === 'arm' ? 14 : 22;
  lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 3; g.gain.value = 0.0001;
  lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune); o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
  const t = ac.currentTime; o1.start(t); o2.start(t); lfo.start(t);
  g.gain.setTargetAtTime(0.09, t, 0.05);
  let dead = false;
  return {
    set(p, gain = 1) {
      if (dead) return; const now = ac.currentTime;
      const f = kind === 'arm' ? 140 + p * 520 : 620 - p * 360;
      o1.frequency.setTargetAtTime(f, now, 0.05); o2.frequency.setTargetAtTime(f * 2, now, 0.05);
      lp.frequency.setTargetAtTime(700 + p * 2600, now, 0.05); lfo.frequency.setTargetAtTime((kind === 'arm' ? 6 : 4) + p * 14, now, 0.1);
      g.gain.setTargetAtTime((0.05 + 0.07 * p) * gain, now, 0.05);
    },
    stop(fade = 0.08) { if (dead) return; dead = true; const now = ac.currentTime; g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, fade / 3); const e = now + fade + 0.1; o1.stop(e); o2.stop(e); lfo.stop(e); setTimeout(() => { try { g.disconnect(); } catch {} }, (fade + 0.3) * 1000); },
  };
}
