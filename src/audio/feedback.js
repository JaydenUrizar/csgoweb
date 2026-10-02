// Combat feedback (hit confirmation, damage taken, tag-out shatter) + UI / round sounds.
import { osc, noise, click, ring, midi, clamp } from './dsp.js';
import { reg } from './registry.js';

const jit = (V, p = 0.06) => 1 + (V.r() * 2 - 1) * p;
const PENTA = [0, 2, 4, 7, 9];

function tinkle(V, when, g, dMul = 1) {
  const f = midi(84 + PENTA[(V.r() * 5) | 0] + (V.r() < 0.4 ? 12 : 0)) * jit(V, 0.01);
  ring(V, { when, f, ratios: [1, 2.76, 5.4], decays: [1, 0.5, 0.25], gains: [1, 0.35, 0.15], d: (0.08 + V.r() * 0.22) * dMul, g });
}

export function registerFeedback() {
  // ---------- hit confirmation (attacker's ears; non-positional) ----------
  const tick = (V, crown) => {
    const o = V.o, limb = o.group === 'limb', j = jit(V, 0.04), f = (limb ? 1250 : o.group === 'stomach' ? 1550 : 1800) * j, k = clamp(0.7 + (o.damage ?? 30) / 120, 0.7, 1.15);
    click(V, { g: 0.36 * k, hp: 3000, d: 0.003 });
    noise(V, { a: 0.0003, d: 0.03, g: 0.5 * k, bp: f * 1.35, q: 1.3 });
    osc(V, { f0: f, f1: f * 0.78, pt: 0.03, d: 0.06, g: 0.3 * k });
    osc(V, { f0: 230 * j, f1: 120, pt: 0.02, d: 0.06, g: 0.3 * k * (limb ? 0.6 : 1) });   // body thump = weight
    if (o.armor) ring(V, { f: 1350, ratios: [1, 2.3, 3.4], decays: [1, 0.5, 0.3], gains: [1, 0.5, 0.3], d: 0.11, g: 0.14 });
    if (crown) {   // the iconic 'bing'
      const b = 2637 * jit(V, 0.006);
      osc(V, { f0: b, d: 0.3, g: 0.30, a: 0.0005 }); osc(V, { f0: b * 1.5, d: 0.17, g: 0.17, a: 0.0005 }); osc(V, { f0: b * 2, d: 0.11, g: 0.1, a: 0.0005 });
      osc(V, { f0: b * 1.004, d: 0.22, g: 0.1, a: 0.0005 });
      osc(V, { f0: 150, f1: 70, pt: 0.03, d: 0.1, g: 0.35 });
      noise(V, { a: 0.0002, d: 0.02, g: 0.35, hp: 5500 });
    }
  };
  reg('hit.tick', (V) => tick(V, false), { cat: 'hit', spatial: false, send: 0, prio: 8, voices: 4, gain: 2.4 });
  reg('hit.crown', (V) => tick(V, true), { cat: 'hit', spatial: false, send: 0, prio: 9, voices: 4, gain: 2.0 });
  reg('hit.kill', (V) => {           // tag-out confirm: rising bell + sparkle
    const crown = !!V.o.crown, b = crown ? 2349 : 1760;
    ring(V, { f: b, ratios: [1, 2.76, 5.4], decays: [1, 0.55, 0.3], gains: [1, 0.4, 0.2], d: 0.6, g: 0.3 });
    ring(V, { when: 0.075, f: b * 1.5, ratios: [1, 2.76, 5.4], decays: [1, 0.55, 0.3], gains: [1, 0.4, 0.2], d: 0.75, g: 0.28 });
    osc(V, { f0: 140, f1: 55, pt: 0.05, d: 0.28, g: 0.55, sat: 0.2 }); click(V, { g: 0.35, hp: 2500 });
    for (let i = 0; i < 7; i++) tinkle(V, 0.05 + i * 0.045 + V.r() * 0.03, 0.06);
    noise(V, { a: 0.0003, d: 0.05, g: 0.3, hp: 4500 });
  }, { cat: 'hit', spatial: false, send: 0.08, prio: 10, voices: 3, gain: 1.5 });

  // ---------- damage taken (own ears) ----------
  reg('dmg.taken', (V) => {
    const o = V.o, crown = o.group === 'crown', k = clamp(0.55 + (o.damage ?? 30) / 70, 0.6, 1.5), j = jit(V, 0.05);
    osc(V, { f0: 125 * j, f1: 44, pt: 0.06, d: 0.26, g: 0.75 * k, sat: 0.3 });
    noise(V, { a: 0.0008, d: 0.13, g: 0.34 * k, lp: 900, hp: 50 });
    noise(V, { kind: 'pink', a: 0.004, d: 0.14, g: 0.18 * k, bp: 1400, q: 0.6 });
    click(V, { g: 0.2 * k, hp: 2000 });
    if (crown) { noise(V, { a: 0.0003, d: 0.045, g: 0.5, bp: 2600, q: 0.8, sat: 0.4 }); ring(V, { f: 2200, ratios: [1, 1.5], decays: [1, 0.5], gains: [1, 0.4], d: 0.35, g: 0.07 }); osc(V, { f0: 90, f1: 35, pt: 0.1, d: 0.35, g: 0.5 }); }
    if (o.armor) ring(V, { f: 900, ratios: [1, 2.3], d: 0.14, g: 0.08 });
  }, { cat: 'hit', spatial: false, send: 0.05, prio: 9, voices: 4 });

  // ---------- tag-out: freeze into glass, shatter into confetti light ----------
  reg('tag.out.shatter', (V) => {
    osc(V, { f0: 1200, f1: 4400, pt: 0.1, a: 0.01, d: 0.16, g: 0.1, lp: 8000 });                       // crystallise
    const t = 0.1;
    click(V, { when: t, g: 0.8, hp: 1500 }); noise(V, { when: t, a: 0.0002, d: 0.09, g: 0.5, hp: 2500, sat: 0.3 });
    osc(V, { when: t, f0: 250, f1: 70, pt: 0.05, d: 0.28, g: 0.55, sat: 0.2 });
    const n = V.fp ? 22 : 30;
    for (let i = 0; i < n; i++) tinkle(V, t + 0.01 + Math.pow(V.r(), 1.6) * 0.75, 0.05 + V.r() * 0.07);   // shards, front-loaded
    noise(V, { when: t, a: 0.04, hold: 0.08, d: 0.55, g: 0.045, hp: 6500 });                           // confetti flutter
    noise(V, { when: t, kind: 'pink', a: 0.004, d: 0.6, g: 0.14, lp: [4200, 500, 0.6] });
    ring(V, { when: t + 0.02, f: 1320, ratios: [1, 1.5, 2, 2.5], decays: [1, 0.8, 0.6, 0.4], gains: [1, 0.6, 0.5, 0.3], d: 0.9, g: 0.05, a: 0.02 });
  }, { cat: 'tag', ref: 8, roll: 1.05, maxDist: 100, send: 0.4, prio: 6, voices: 4 });
  reg('tag.out.self', (V) => {   // you were tagged out: freeze downward + muffled shatter
    osc(V, { f0: 900, f1: 90, pt: 0.55, a: 0.01, d: 0.85, g: 0.16, lp: 3000 });
    noise(V, { kind: 'pink', a: 0.02, d: 0.9, g: 0.22, lp: [3500, 200, 0.9] });
    osc(V, { f0: 120, f1: 32, pt: 0.2, d: 1.1, g: 0.8, sat: 0.2 });
    click(V, { when: 0.05, g: 0.5, hp: 1200 });
    for (let i = 0; i < 14; i++) tinkle(V, 0.08 + Math.pow(V.r(), 1.5) * 0.7, 0.04 + V.r() * 0.05);
    ring(V, { f: 660, ratios: [1, 1.5, 2], d: 1.4, g: 0.05, a: 0.05 });
  }, { cat: 'tag', spatial: false, send: 0.25, prio: 9, voices: 1 });
  reg('tag.whiz', (V) => {       // near-miss pulse zip
    const j = jit(V, 0.15);
    osc(V, { type: 'sine', f0: 3800 * j, f1: 1400, pt: 0.14, a: 0.01, d: 0.18, g: 0.16, lp: 7000 });
    noise(V, { a: 0.02, d: 0.13, g: 0.1, bp: 3600, q: 1.5, sweep: [1500, 0.14] });
  }, { cat: 'tag', spatial: true, ref: 1.5, roll: 1.5, maxDist: 8, send: 0.05, voices: 3, prio: 4 });

  // ---------- UI ----------
  const ui = (name, fn, o = {}) => reg(name, fn, { cat: 'ui', bus: 'ui', spatial: false, send: 0, voices: 4, gain: 0.5, ...o });
  ui('ui.click', (V) => { click(V, { g: 0.14, hp: 3500 }); osc(V, { f0: 1250, f1: 820, pt: 0.03, d: 0.055, g: 0.28 }); osc(V, { f0: 2500, f1: 1640, pt: 0.03, d: 0.03, g: 0.05 }); });
  ui('ui.hover', (V) => { osc(V, { f0: 2400, d: 0.035, a: 0.002, g: 0.06 }); click(V, { g: 0.03, hp: 4500 }); });
  ui('ui.back', (V) => { click(V, { g: 0.12, hp: 3000 }); osc(V, { f0: 900, f1: 540, pt: 0.05, d: 0.07, g: 0.24 }); });
  ui('ui.open', (V) => { noise(V, { a: 0.03, d: 0.1, g: 0.09, bp: 600, q: 0.8, sweep: [2400, 0.12] }); osc(V, { f0: 700, f1: 1100, pt: 0.06, d: 0.09, g: 0.1 }); click(V, { g: 0.08 }); });
  ui('ui.close', (V) => { noise(V, { a: 0.03, d: 0.09, g: 0.08, bp: 2200, q: 0.8, sweep: [600, 0.1] }); osc(V, { f0: 1000, f1: 640, pt: 0.05, d: 0.08, g: 0.09 }); });
  ui('ui.tab', (V) => { noise(V, { a: 0.015, d: 0.07, g: 0.07, bp: 900, q: 0.9, sweep: [2600, 0.08] }); click(V, { g: 0.06 }); });
  ui('ui.toggle', (V) => { click(V, { g: 0.12 }); osc(V, { f0: 1800, f1: 2400, pt: 0.03, d: 0.05, g: 0.15 }); });
  ui('ui.buy', (V) => {
    click(V, { g: 0.25, hp: 2500 }); osc(V, { f0: 180, f1: 90, pt: 0.03, d: 0.08, g: 0.3 });
    ring(V, { when: 0.02, f: 1900, ratios: [1, 1.5, 2.4], decays: [1, 0.6, 0.3], gains: [1, 0.6, 0.4], d: 0.28, g: 0.16 });
    [3200, 4100, 5400].forEach((f, i) => ring(V, { when: 0.05 + i * 0.038, f, ratios: [1, 2.02], decays: [1, 0.4], gains: [1, 0.3], d: 0.16, g: 0.09 }));
  });
  ui('ui.error', (V) => { for (let i = 0; i < 2; i++) { osc(V, { when: i * 0.11, type: 'square', f0: 190, f1: 175, pt: 0.08, hold: 0.04, d: 0.05, g: 0.16, lp: 1400, hp: 100 }); } noise(V, { a: 0.001, d: 0.06, g: 0.05, bp: 500 }); });
  ui('ui.money', (V) => { ring(V, { f: 1568, ratios: [1, 2], d: 0.12, g: 0.1 }); ring(V, { when: 0.06, f: 2093, ratios: [1, 2], d: 0.2, g: 0.1 }); });
  ui('ui.countdown.tick', (V) => { click(V, { g: 0.2 }); osc(V, { f0: 880, hold: 0.025, d: 0.05, g: 0.3 }); osc(V, { f0: 1760, d: 0.04, g: 0.06 }); });
  ui('ui.countdown.go', (V) => { osc(V, { f0: 1320, hold: 0.09, d: 0.12, g: 0.28 }); osc(V, { f0: 1760, hold: 0.09, d: 0.16, g: 0.16 }); click(V, { g: 0.2 }); ring(V, { f: 2640, ratios: [1, 2], d: 0.3, g: 0.06 }); });
  ui('ui.timer.warn', (V) => { const hi = (V.o.n | 0) % 2 === 0; click(V, { g: 0.14 }); osc(V, { f0: hi ? 1175 : 880, hold: 0.012, d: 0.05, g: 0.26 }); osc(V, { f0: hi ? 2350 : 1760, d: 0.03, g: 0.04 }); });
  ui('ui.scoreboard', (V) => { noise(V, { a: 0.02, d: 0.09, g: 0.09, bp: 800, sweep: [2600, 0.1] }); click(V, { g: 0.05 }); });
  ui('ui.notify', (V) => { ring(V, { f: 1319, ratios: [1, 2], d: 0.18, g: 0.11 }); ring(V, { when: 0.07, f: 1760, ratios: [1, 2], d: 0.28, g: 0.11 }); });
  ui('ui.roundstart.horn', (V) => {
    const notes = [110, 165, 220, 330, 440];
    notes.forEach((f, i) => { for (const dt of [-7, 0, 7]) osc(V, { type: 'sawtooth', f0: f, det: dt, a: 0.05, hold: 0.32, d: 0.7, g: 0.05, lp: [420, 3400, 0.16], lpQ: 1.5 }); });
    osc(V, { f0: 55, hold: 0.3, d: 0.6, g: 0.22 }); noise(V, { a: 0.02, d: 0.3, g: 0.07, bp: 1800, q: 0.5 }); click(V, { g: 0.2, hp: 1200 });
  }, { prio: 6, send: 0.3 });
  ui('ui.round.win', (V) => {
    [440, 554.4, 659.3, 880].forEach((f, i) => { ring(V, { when: i * 0.1, f, ratios: [1, 2, 3], decays: [1, 0.5, 0.25], gains: [1, 0.4, 0.2], d: 0.7, g: 0.16 }); osc(V, { when: i * 0.1, type: 'triangle', f0: f, d: 0.4, g: 0.08 }); });
    ring(V, { when: 0.45, f: 1760, ratios: [1, 1.5, 2, 3], d: 1.2, g: 0.06, a: 0.02 }); osc(V, { f0: 110, d: 0.9, hold: 0.1, g: 0.2 });
  }, { prio: 6, send: 0.35 });
  ui('ui.round.lose', (V) => {
    [440, 349.2, 293.7].forEach((f, i) => { osc(V, { when: i * 0.22, f0: f, d: 0.8, g: 0.14, lp: 2500 }); osc(V, { when: i * 0.22, type: 'triangle', f0: f / 2, d: 0.9, g: 0.1 }); });
    osc(V, { f0: 73, when: 0.3, d: 1.0, g: 0.25, sat: 0.1 });
  }, { prio: 6, send: 0.3 });
  ui('ui.match.win', (V) => {
    [440, 554.4, 659.3, 880, 1108.7, 1318.5].forEach((f, i) => { ring(V, { when: i * 0.11, f, ratios: [1, 2, 3], decays: [1, 0.5, 0.25], gains: [1, 0.4, 0.2], d: 1.0, g: 0.14 }); osc(V, { when: i * 0.11, type: 'triangle', f0: f, d: 0.7, g: 0.08 }); });
    for (const f of [220, 277, 330, 440]) osc(V, { type: 'sawtooth', f0: f, when: 0.6, a: 0.05, hold: 0.5, d: 1.2, g: 0.045, lp: [600, 3000, 0.3] });
    ring(V, { when: 0.7, f: 2200, ratios: [1, 1.5, 2, 3], d: 1.8, g: 0.06, a: 0.02 });
  }, { prio: 6, send: 0.4 });
  ui('ui.match.lose', (V) => {
    [392, 329.6, 261.6, 196].forEach((f, i) => { osc(V, { when: i * 0.3, f0: f, d: 1.0, g: 0.13, lp: 2200 }); osc(V, { when: i * 0.3, type: 'triangle', f0: f / 2, d: 1.1, g: 0.1 }); });
    osc(V, { f0: 65, when: 0.5, d: 1.6, g: 0.28 });
  }, { prio: 6, send: 0.4 });
  ui('ui.mvp', (V) => { for (let i = 0; i < 12; i++) tinkle(V, i * 0.05 + V.r() * 0.02, 0.09); ring(V, { f: 1760, ratios: [1, 2.76], d: 0.7, g: 0.16 }); });
  reg('ui.ping', (V) => { osc(V, { f0: 1760, f1: 1500, pt: 0.1, d: 0.16, g: 0.3 }); ring(V, { f: 3520, ratios: [1, 1.5], d: 0.25, g: 0.08 }); click(V, { g: 0.2 }); }, { cat: 'ui', spatial: true, ref: 10, roll: 0.7, maxDist: 200, send: 0.2 });
}
